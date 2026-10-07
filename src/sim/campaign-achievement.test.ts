import { describe, expect, it } from 'vitest';
import type { DistrictId, GameState } from '../model';
import { ACQUISITION_TARGETS, DISTRICTS, LOTS } from '../data/district';
import { STOCKS } from '../data/stocks';
import { advanceWeek, applyAction, createGame, previewWeek } from './engine';
import { getCampaignCompletion } from './campaign';
import { settleCampaignAchievement } from './campaignAchievement';
import { DEVELOPMENT_CHOICES } from './development';
import { runManagedWeeks } from './managedWeeks';
import { getProgression } from './progression';

/** Synthetic ownership fixture for settlement boundaries, not a playthrough. */
function readyCompany(): GameState {
  const state = createGame('Synthetic final-settlement fixture', 1);
  state.listed = true;
  state.week = 20;
  state.properties = (Object.keys(DISTRICTS) as DistrictId[]).map(districtId => {
    const lot = LOTS.find(candidate => candidate.available && candidate.district === districtId)!;
    return { id: `property-${lot.id}`, lotId: lot.id, purchasePrice: lot.purchasePrice, level: 1, occupancy: .9, weeklyIncome: lot.rent };
  });
  state.subsidiaries = ACQUISITION_TARGETS.map(target => ({ id: target.id, name: target.name, sector: target.sector, purchasePrice: target.price, weeklyProfit: target.weeklyProfit, risk: target.risk }));
  state.marketAcquisitions = { research: STOCKS.map(stock => ({ stockId: stock.id, week: 1 })), companies: STOCKS.map(stock => ({ stockId: stock.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 3 })) };
  state.development = { programs: (Object.keys(DISTRICTS) as DistrictId[]).map(districtId => ({ districtId, completedChoiceIds: DEVELOPMENT_CHOICES.filter(choice => choice.districtId === districtId && choice.id.endsWith('commerce')).map(choice => choice.id) })) };
  return state;
}

describe('actual first campaign settlement', () => {
  it('does not backfill a legacy eligible state on read, then records the actual settled week', () => {
    const legacy = readyCompany();
    const previous = advanceWeek({ ...legacy, listed: false });
    legacy.lastReport = previous.lastReport;
    legacy.lastReport!.week = legacy.week - 1;
    const before = structuredClone(legacy);
    expect(getCampaignCompletion(legacy)).toMatchObject({ complete: false, currentRequirementsMet: true, readyToSettle: true });
    expect(legacy).toEqual(before);
    const settled = advanceWeek(legacy);
    expect(settled.campaignAchievement).toEqual({
      week: legacy.week, cash: settled.cash, netProfit: settled.lastReport!.netProfit,
      totalCustomers: settled.totalCustomers, storeCount: 0, propertyCount: 4,
      subsidiaries: 8, marketBusinesses: 100, districts: 4,
    });
    expect(getCampaignCompletion(settled).complete).toBe(true);
    expect(legacy).toEqual(before);
  });

  it('waits for a settlement that actually includes the final operating market business', () => {
    const initial = readyCompany();
    initial.marketAcquisitions!.companies.at(-1)!.readyWeek = initial.week + 1;
    const handover = advanceWeek(initial);
    expect(getCampaignCompletion(handover).readyToSettle).toBe(true);
    expect(handover.lastReport!.week).toBe(initial.week);
    expect(handover.campaignAchievement).toBeUndefined();
    const operated = advanceWeek(handover);
    expect(operated.campaignAchievement!.week).toBe(initial.week + 1);
    expect(operated.campaignAchievement!.netProfit).toBe(operated.lastReport!.netProfit);
  });

  it('awards on the final development completion settlement, never the preceding week', () => {
    const initial = readyCompany();
    const program = initial.development!.programs[0];
    const choiceId = program.completedChoiceIds.pop()!;
    const choice = DEVELOPMENT_CHOICES.find(candidate => candidate.id === choiceId)!;
    program.construction = { choiceId, startWeek: initial.week + 1 - choice.weeks, completeWeek: initial.week + 1 };
    const preceding = advanceWeek(initial);
    expect(preceding.campaignAchievement).toBeUndefined();
    expect(preceding.development!.programs[0].completedChoiceIds).toHaveLength(2);
    const completed = advanceWeek(preceding);
    expect(completed.development!.programs[0].completedChoiceIds).toHaveLength(3);
    expect(completed.campaignAchievement!.week).toBe(program.construction.completeWeek);
    expect(completed.campaignAchievement!.netProfit).toBe(completed.lastReport!.netProfit);
  });

  it('does not reuse old profit when the final direct acquisition is made', () => {
    const initial = readyCompany();
    const target = ACQUISITION_TARGETS.at(-1)!;
    initial.subsidiaries.pop();
    initial.cash = target.price + 12_000_000;
    initial.reputation = 100;
    const previousSettlement = advanceWeek(initial);
    expect(previousSettlement.lastReport!.netProfit).toBeGreaterThan(0);
    const acquired = applyAction(previousSettlement, { type: 'acquire', targetId: target.id });
    expect(getCampaignCompletion(acquired).readyToSettle).toBe(true);
    expect(acquired.campaignAchievement).toBeUndefined();
    const settled = advanceWeek(acquired);
    expect(settled.campaignAchievement!.week).toBe(acquired.week);
  });

  it('keeps default rules and refuses achievement when the actual settlement ends the company', () => {
    const initial = readyCompany();
    initial.loans = [{ id: 'synthetic-default', principal: 1e14, remaining: 1e14, annualRate: .1, weeksLeft: 52, weeklyPayment: 1 }];
    const settled = advanceWeek(initial);
    expect(settled.lastReport!.netProfit).toBeLessThan(0);
    expect(settled.gameOver).toBe(true);
    expect(settled.campaignAchievement).toBeUndefined();
  });

  it('preserves the first record without evaluating a supplied forecast or later operating state', () => {
    const settled = advanceWeek(readyCompany());
    const achievement = settled.campaignAchievement!;
    const continued = { ...settled, properties: [], cash: -1, gameOver: true, lastReport: { ...settled.lastReport!, netProfit: -1 } };
    const before = structuredClone(continued);
    expect(settleCampaignAchievement(continued, continued.lastReport)).toBe(achievement);
    expect(getCampaignCompletion(continued, { ...previewWeek(settled), netProfit: -1 })).toMatchObject({ complete: true, achievement, currentRequirementsMet: false });
    expect(continued).toEqual(before);
  });

  it('rejects a stale report instead of recording earlier historical profit', () => {
    const settled = advanceWeek(readyCompany());
    const unrecorded = { ...settled, campaignAchievement: undefined };
    const before = structuredClone(unrecorded);
    expect(settleCampaignAchievement(unrecorded, { ...settled.lastReport!, week: settled.lastReport!.week - 1 })).toBeUndefined();
    expect(unrecorded).toEqual(before);
  });

  it('names suspended districts and distinguishes their live operation from the saved achievement', () => {
    const settled = advanceWeek(readyCompany());
    const property = settled.properties[0];
    const district = LOTS.find(lot => lot.id === property.lotId)!.district;
    const sold = applyAction(settled, { type: 'sellProperty', propertyId: property.id });
    const before = structuredClone(sold);
    const progression = getProgression(sold);
    expect(progression.roadmap.find(step => step.id === 'districts')!.achieved).toBe(false);
    expect(progression.roadmap.find(step => step.id === 'districts')!.requirements.find(requirement => requirement.label.includes(DISTRICTS[district].name))).toMatchObject({ met: false });
    expect(progression.recommendations.find(recommendation => recommendation.title === '地区の稼働を再開する')).toMatchObject({ body: expect.stringContaining(DISTRICTS[district].name), tab: 'city' });
    expect(progression.roadmap.find(step => step.id === 'campaign')!.achieved).toBe(true);
    expect(sold).toEqual(before);
  });
});

describe('delegated first completion', () => {
  it('saves the achievement before stopping, ahead of generic development notices, then permits continued play', async () => {
    const initial = readyCompany();
    const program = initial.development!.programs[0];
    const choiceId = program.completedChoiceIds.pop()!;
    const choice = DEVELOPMENT_CHOICES.find(candidate => candidate.id === choiceId)!;
    program.construction = { choiceId, startWeek: initial.week - choice.weeks, completeWeek: initial.week };
    const order: string[] = [];
    let saved: GameState | undefined;
    const result = await runManagedWeeks(initial, 13, {
      commit: async next => { saved = structuredClone(next); order.push('saved'); },
      onCommit: next => { expect(next).toEqual(saved); expect(next.campaignAchievement).toBeDefined(); order.push('notified'); },
    }, { stopOnNewOffers: false });
    expect(result.reports).toHaveLength(1);
    expect(result.stopReason).toContain('達成記録');
    expect(result.state).toEqual(saved);
    expect(order).toEqual(['saved', 'notified']);
    expect(result.state.campaignAchievement!.week).toBe(initial.week);
    const continued = await runManagedWeeks(result.state, 4, { commit: async () => {} }, { stopOnNewOffers: false });
    expect(continued.reports).toHaveLength(4);
    expect(continued.stopReason).toBeNull();
    expect(continued.state.campaignAchievement).toEqual(result.state.campaignAchievement);
  });
});
