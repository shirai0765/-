import { describe, expect, it } from 'vitest';
import type { DistrictId } from '../model';
import { createGame, applyAction, getSummary, previewWeek } from './engine';
import { getProgression } from './progression';
import { STOCKS } from '../data/stocks';
import { DEVELOPMENT_CHOICES } from './development';
import { ACQUISITION_TARGETS, DISTRICTS, LOTS } from '../data/district';

describe('live progression', () => {
  it('does not award milestones for available cash and leaves game state unchanged', () => {
    const state = createGame();
    state.cash = 2_000_000_000;
    const before = structuredClone(state);
    const result = getProgression(state);
    expect(result.roadmap.every(s => !s.achieved)).toBe(true);
    expect(result.roadmap.find(s => s.id === 'ipo')!.requirements).toEqual(getSummary(state).ipoRequirements);
    expect(state).toEqual(before);
    expect(result.next?.id).toBe('cafe');
  });
  it('tracks current ownership and district coverage immediately after actions', () => {
    const lot = LOTS.find(l => l.available)!;
    const opened = applyAction(createGame(), { type: 'openStore', lotId: lot.id, style: 'takeaway' });
    expect(getProgression(opened).roadmap[0].achieved).toBe(true);
    expect(getProgression(opened).districts.reduce((sum, d) => sum + d.stores, 0)).toBe(1);
    const closed = applyAction(opened, { type: 'closeStore', storeId: opened.stores[0].id });
    expect(getProgression(closed).roadmap[0].achieved).toBe(false);
  });
  it('puts debt insolvency ahead of growth and distinguishes runway from profit', () => {
    const state = createGame();
    state.loans = [{ id: 'debt', principal: 1_000_000, remaining: 1_000_000, annualRate: .1, weeksLeft: 52, weeklyPayment: 20_000 }];
    const result = getProgression(state);
    expect(result.recommendations[0].urgent).toBe(true);
    expect(result.runway).not.toBeNull();
    expect(result.reserve).toBeGreaterThan(0);
  });
  it('requires the complete campaign but does not require a debt-free balance sheet', () => {
    const state = createGame();
    state.listed = true;
    state.week = 10;
    state.properties = Object.keys(DISTRICTS).map(id => { const l = LOTS.find(l => l.available && l.district === id)!; return { id: 'property-' + l.id, lotId: l.id, purchasePrice: l.purchasePrice, level: 1, occupancy: .9, weeklyIncome: l.rent }; });
    state.marketAcquisitions = { research: STOCKS.map(s => ({ stockId: s.id, week: 1 })), companies: STOCKS.map(s => ({ stockId: s.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 3 })) };
    state.subsidiaries = ACQUISITION_TARGETS.map(t => ({ id: t.id, name: t.name, sector: t.sector, purchasePrice: t.price, weeklyProfit: t.weeklyProfit, risk: t.risk }));
    state.development = { programs: (Object.keys(DISTRICTS) as DistrictId[]).map(districtId => ({ districtId, completedChoiceIds: DEVELOPMENT_CHOICES.filter(c => c.districtId === districtId && c.id.endsWith('commerce')).map(c => c.id) })) };
    state.loans = [{ id: 'small-debt', principal: 1000, remaining: 1000, annualRate: .01, weeksLeft: 52, weeklyPayment: 20 }];
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.lastReport = { ...previewWeek(state), week: 9, netProfit: 0 };
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.lastReport = { ...previewWeek(state), week: 9, netProfit: -1 };
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.lastReport = { ...previewWeek(state), week: 9 };
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(true);
    state.gameOver = true;
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.gameOver = false;
    const cash = state.cash; state.cash = -1;
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.cash = cash;
    const properties = state.properties; state.properties = [];
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.properties = properties;
    state.marketAcquisitions.companies[0].readyWeek = 11;
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.marketAcquisitions.companies[0].readyWeek = 3;
    state.development.programs[0].completedChoiceIds.pop();
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
  });

});
