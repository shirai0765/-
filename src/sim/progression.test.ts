import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DistrictId } from '../model';
import { createGame, applyAction, advanceWeek, getSummary, previewWeek } from './engine';
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

function threeStoreCompany() {
  let state = createGame();
  state.cash = 50_000_000;
  const sites = LOTS.filter(l => l.available).sort((a, b) => a.rent - b.rent).slice(0, 3);
  for (const site of sites) state = applyAction(state, { type: 'openStore', lotId: site.id, style: 'standard' });
  return state;
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
    expect(ipoRequirements.slice(0, 3).map(r => r.label)).toEqual([
      '店舗数 0 / 3 店', '累計黒字 0 / 12 週', '純資産 ¥2,000,000,000 / ¥20,000,000',
    ]);
    expect(ipoRequirements.at(-1)!.label).toContain('直近の決算が黒字：営業実績はまだありません');
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
    const ipoProfit = result.roadmap.find(s => s.id === 'ipo')!.requirements.at(-1)!;
    expect(ipoProfit.met).toBe(false);
    expect(ipoProfit.label).not.toContain('〜');
    expect(ipoProfit.label).toContain('営業実績はまだありません');
    expect(state).toEqual(before);
  });
  it('retains internal downside risk while rendering only a qualitative warning', () => {
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
    expect(markup).not.toContain('今週の現金増減の見込み幅');
    expect(markup).not.toContain('保守的なケース');
    expect(markup).toContain('現金が不足する可能性');
    expect(markup).not.toContain('見込み幅では減少なし');
    expect(state).toEqual(before);
  });
  it('keeps IPO eligibility independent of optional property ownership and managers', () => {
    const state = advanceWeek(threeStoreCompany());
    state.profitableWeeks = 12;
    const before = structuredClone(state);
    const result = getProgression(state);
    expect(state.properties).toHaveLength(0);
    expect(state.stores.every(s => !s.manager)).toBe(true);
    expect(result.summary.ipoEligible).toBe(true);
    expect(result.next?.id).toBe('ipo');
    expect(result.capital).toEqual({ kind: 'ipo', title: '上場の条件と調達案を確認', eligible: true, tab: 'finance' });
    expect(result.capital).not.toHaveProperty('cost');
    expect(result.roadmap.find(s => s.id === 'property')!.optionalBeforeIPO).toBe(true);
    expect(result.roadmap.find(s => s.id === 'property')!.description).toContain('任意の投資');
    expect(result.roadmap.find(s => s.id === 'property')!.description).toContain('地区開発には対象地区の直接保有物件が必要');
    expect(result.roadmap.find(s => s.id === 'ipo')!.requirements.map(r => r.met)).toEqual(getSummary(state).ipoRequirements.map(r => r.met));
    expect(applyAction(state, { type: 'ipo' }).listed).toBe(true);
    expect(state).toEqual(before);
  });
  it.each([false, true])('keeps the unmet IPO goal visible with optional property ownership=%s', ownsProperty => {
    let state = threeStoreCompany();
    state.profitableWeeks = 11;
    if (ownsProperty) {
      const site = LOTS.filter(l => l.available).sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
      state = applyAction(state, { type: 'buyProperty', lotId: site.id });
    }
    const before = structuredClone(state);
    const result = getProgression(state);
    expect(result.next?.id).toBe('ipo');
    expect(result.capital).toMatchObject({ kind: 'ipo', eligible: false, tab: 'finance' });
    expect(result.capital).not.toHaveProperty('cost');
    const ipo = result.roadmap.find(s => s.id === 'ipo')!;
    expect(ipo.requirements[1]).toEqual({ label: '累計黒字 11 / 12 週', met: false });
    expect(ipo.requirements.map(r => r.met)).toEqual(getSummary(state).ipoRequirements.map(r => r.met));
    expect(result.roadmap.find(s => s.id === 'property')!.achieved).toBe(ownsProperty);
    expect(() => applyAction(state, { type: 'ipo' })).toThrow('上場条件');
    expect(state).toEqual(before);
  });
  it.each([19_999_999, 20_000_000, 20_000_001])('shows exact IPO net worth at the ¥%i boundary without changing eligibility', netWorth => {
    const state = advanceWeek(threeStoreCompany());
    state.profitableWeeks = 12;
    state.cash += netWorth - getSummary(state).netWorth;
    const result = getProgression(state);
    expect(result.summary.netWorth).toBe(netWorth);
    const ipo = result.roadmap.find(s => s.id === 'ipo')!;
    expect(ipo.requirements[2]).toEqual({ label: `純資産 ¥${netWorth.toLocaleString('ja-JP')} / ¥20,000,000`, met: netWorth >= 20_000_000 });
    expect(ipo.requirements.map(r => r.met)).toEqual(getSummary(state).ipoRequirements.map(r => r.met));
    expect(result.capital).toMatchObject({ kind: 'ipo', eligible: getSummary(state).ipoEligible });
  });
  it('keeps IPO profit unmet without a settled report even when internal risk identifies a loss', () => {
    const state = applyAction(createGame(), { type: 'borrow', amount: 100_000, weeks: 52 });
    const result = getProgression(state);
    const requirement = result.roadmap.find(s => s.id === 'ipo')!.requirements.at(-1)!;
    expect(result.summary.weeklyProfit).toBeLessThan(0);
    expect(requirement.met).toBe(false);
    expect(requirement.label).toContain('直近の決算が黒字：営業実績はまだありません');
    expect(requirement.label).not.toContain('〜');
    expect(result.recommendations[0]).toMatchObject({ urgent: true, tab: 'finance' });
  });
  it('does not make unowned optional property the next goal or capital default after IPO', () => {
    const beforeIPO = advanceWeek(threeStoreCompany());
    beforeIPO.profitableWeeks = 12;
    const state = applyAction(beforeIPO, { type: 'ipo' });
    const before = structuredClone(state);
    const result = getProgression(state);
    expect(result.roadmap.find(s => s.id === 'property')).toMatchObject({ achieved: false, optionalBeforeIPO: true });
    expect(result.next?.id).toBe('group');
    expect(result.capital).toMatchObject({ kind: 'investment', tab: 'group' });
    expect(result.roadmap.find(s => s.id === 'ipo')!.achieved).toBe(true);
    expect(state).toEqual(before);
  });
  it('retains a saved campaign achievement even with a possible downside loss during continued play', () => {
    const state = advanceWeek(campaignCompany());
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
    expect(campaign.requirements.at(-1)!.label).not.toContain('〜');
    expect(campaign.requirements.at(-1)!.label).toBe('全事業と全地区が稼働する週の黒字決算を保存');
    expect(campaign.description).toContain(`第${state.campaignAchievement!.week}週の黒字決算`);
    expect(state).toEqual(before);
  });
  it('separates live completion requirements from the first saved achievement and allows debt', () => {
    const state = campaignCompany();
    state.loans = [{ id: 'small-debt', principal: 1000, remaining: 1000, annualRate: .01, weeksLeft: 52, weeklyPayment: 20 }];
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.lastReport = { ...previewWeek(state), week: 9, netProfit: 0 };
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.lastReport = { ...previewWeek(state), week: 9, netProfit: -1 };
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    state.lastReport = { ...previewWeek(state), week: 9 };
    expect(getProgression(state).completion.currentRequirementsMet).toBe(true);
    expect(getProgression(state).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(false);
    const settled = advanceWeek(state);
    expect(getProgression(settled).roadmap.find(s => s.id === 'campaign')!.achieved).toBe(true);
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

  it('recommends loss review only for currently open stores with an actual recorded loss', () => {
    const opened = applyAction(createGame(), { type: 'openStore', lotId: 'center-01', style: 'standard' });
    const costly = applyAction(opened, { type: 'updateStore', storeId: opened.stores[0].id, changes: { staff: 30 } });
    expect(previewWeek(costly).storeResults[0].profit).toBeLessThan(0);
    expect(getProgression(costly).recommendations.some(r => r.title.includes('赤字だった'))).toBe(false);
    const settled = advanceWeek(costly);
    const corrected = applyAction(settled, { type: 'updateStore', storeId: settled.stores[0].id, changes: { staff: 4, price: 950, quality: 85, marketing: 0 } });
    expect(previewWeek(corrected).storeResults[0].profit).toBeGreaterThan(0);
    const before = structuredClone(corrected);
    const lossAdvice = getProgression(corrected).recommendations.find(r => r.title.includes('赤字だった'));
    expect(lossAdvice).toMatchObject({ title: '直近の決算で赤字だった1店舗を見直す', tab: 'stores' });
    expect(lossAdvice!.body).toContain(`第${settled.lastReport!.week}週`);
    const closed = applyAction(corrected, { type: 'closeStore', storeId: corrected.stores[0].id });
    expect(getProgression(closed).recommendations.some(r => r.title.includes('赤字だった'))).toBe(false);
    expect(corrected).toEqual(before);
  });

});
