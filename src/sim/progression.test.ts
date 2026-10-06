import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DistrictId } from '../model';
import { createGame, applyAction, getSummary, previewWeek } from './engine';
import { getProgression } from './progression';
import { getCampaignCompletion } from './campaign';
import ProgressionPanel from '../ui/ProgressionPanel';
import { STOCKS } from '../data/stocks';
import { DEVELOPMENT_CHOICES } from './development';
import { ACQUISITION_TARGETS, DISTRICTS, LOTS } from '../data/district';

function marginalCafe() {
  const state = applyAction(createGame(), { type: 'openStore', lotId: 'center-01', style: 'standard' });
  return applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { marketing: 55_000 } });
}

// Synthetic ownership fixture isolates the final campaign conditions.
function campaignCompany() {
  const state = createGame();
  state.listed = true;
  state.week = 10;
  state.properties = Object.keys(DISTRICTS).map(id => { const l = LOTS.find(l => l.available && l.district === id)!; return { id: 'property-' + l.id, lotId: l.id, purchasePrice: l.purchasePrice, level: 1, occupancy: .9, weeklyIncome: l.rent }; });
  state.marketAcquisitions = { research: STOCKS.map(s => ({ stockId: s.id, week: 1 })), companies: STOCKS.map(s => ({ stockId: s.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 3 })) };
  state.subsidiaries = ACQUISITION_TARGETS.map(t => ({ id: t.id, name: t.name, sector: t.sector, purchasePrice: t.price, weeklyProfit: t.weeklyProfit, risk: t.risk }));
  state.development = { programs: (Object.keys(DISTRICTS) as DistrictId[]).map(districtId => ({ districtId, completedChoiceIds: DEVELOPMENT_CHOICES.filter(c => c.districtId === districtId && c.id.endsWith('commerce')).map(c => c.id) })) };
  return { ...state, marketAcquisitions: state.marketAcquisitions, development: state.development };
}

describe('live progression', () => {
  it('does not award milestones for available cash and leaves game state unchanged', () => {
    const state = createGame();
    state.cash = 2_000_000_000;
    const before = structuredClone(state);
    const result = getProgression(state);
    expect(result.roadmap.every(s => !s.achieved)).toBe(true);
    const ipoRequirements = result.roadmap.find(s => s.id === 'ipo')!.requirements;
    expect(ipoRequirements.map(r => r.met)).toEqual(getSummary(state).ipoRequirements.map(r => r.met));
    expect(ipoRequirements.slice(0, 3)).toEqual(getSummary(state).ipoRequirements.slice(0, 3));
    expect(ipoRequirements.at(-1)!.label).toContain('達成判定は基準見込み');
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
  it('warns about possible debt loss even when the neutral plan remains profitable', () => {
    const state = applyAction(marginalCafe(), { type: 'borrow', amount: 1_000_000, weeks: 52 });
    const before = structuredClone(state);
    const result = getProgression(state);
    expect(result.forecast).toEqual(previewWeek(state));
    expect(result.forecast.netProfit).toBeGreaterThan(0);
    expect(result.outlook.netProfit.min).toBeLessThanOrEqual(0);
    expect(result.outlook.risk.debtLossPossible).toBe(true);
    expect(result.recommendations[0]).toMatchObject({ title: '借入中の利益不足に注意', urgent: true, tab: 'finance' });
    expect(result.recommendations[0].body).toContain('可能性');
    expect(result.recommendations[0].body).toContain('実績利益がゼロ以下');
    expect(state).toEqual(before);
  });
  it('uses downside cash burn when the neutral plan adds cash and displays rounded ranges', () => {
    const state = marginalCafe();
    state.cash = 1_000;
    const before = structuredClone(state);
    const result = getProgression(state);
    expect(result.forecast.cashChange).toBeGreaterThanOrEqual(0);
    expect(result.outlook.cashChange.min).toBeLessThan(0);
    expect(result.outlook.risk.cashShortfallPossible).toBe(true);
    expect(result.outlook.risk.debtLossPossible).toBe(false);
    expect(result.runway).toBeCloseTo(state.cash / -result.outlook.cashChange.min);
    expect(result.recommendations[0]).toMatchObject({ title: '週末に現金が不足するおそれ', urgent: true });
    expect(result.recommendations[0].body).toContain('可能性');
    const markup = renderToStaticMarkup(createElement(ProgressionPanel, { state, onNavigate: () => undefined }));
    expect(markup).toContain('今週の現金増減の見込み幅 約¥-8,000〜¥25,000');
    expect(markup).toContain('保守的なケース');
    expect(markup).toContain('実績は週末に確定');
    expect(markup).not.toContain('見込み幅では減少なし');
    expect(state).toEqual(before);
  });
  it('keeps IPO eligibility independent of optional property ownership and managers', () => {
    let state = createGame();
    state.cash = 50_000_000;
    const sites = LOTS.filter(l => l.available).sort((a, b) => a.rent - b.rent).slice(0, 3);
    for (const site of sites) state = applyAction(state, { type: 'openStore', lotId: site.id, style: 'standard' });
    state.profitableWeeks = 12;
    const result = getProgression(state);
    expect(state.properties).toHaveLength(0);
    expect(state.stores.every(s => !s.manager)).toBe(true);
    expect(result.summary.ipoEligible).toBe(true);
    expect(result.roadmap.find(s => s.id === 'property')!.description).toContain('任意の投資');
    expect(result.roadmap.find(s => s.id === 'ipo')!.requirements.map(r => r.met)).toEqual(getSummary(state).ipoRequirements.map(r => r.met));
    expect(applyAction(state, { type: 'ipo' }).listed).toBe(true);
  });
  it('retains neutral-based campaign completion even with a possible downside loss', () => {
    const state = campaignCompany();
    state.lastReport = { ...previewWeek(state), week: 9 };
    const debt = (previewWeek(state).operatingProfit - 1) * 52 / .05;
    state.loans = [{ id: 'marginal-debt', principal: debt, remaining: debt, annualRate: .05, weeksLeft: 52, weeklyPayment: 20 }];
    const before = structuredClone(state);
    const result = getProgression(state);
    const campaign = result.roadmap.find(s => s.id === 'campaign')!;
    expect(result.forecast.netProfit).toBe(1);
    expect(result.outlook.netProfit.min).toBeLessThanOrEqual(0);
    expect(result.outlook.risk.debtLossPossible).toBe(true);
    expect(getCampaignCompletion(state, previewWeek(state)).complete).toBe(true);
    expect(campaign.achieved).toBe(true);
    expect(campaign.requirements.at(-1)!.met).toBe(true);
    expect(campaign.requirements.at(-1)!.label).toContain('〜');
    expect(campaign.requirements.at(-1)!.label).toContain('達成判定は基準見込み');
    expect(state).toEqual(before);
  });
  it('requires the complete campaign but does not require a debt-free balance sheet', () => {
    const state = campaignCompany();
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
