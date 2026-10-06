import { describe, expect, it } from 'vitest';
import { STOCKS } from '../src/data/stocks';
import { createGame, applyAction, previewWeek } from '../src/sim/engine';
import { getMarketAcquisitionTargets } from '../src/sim/marketAcquisitions';
import { getAcquisitionComparison, previewAcquisitionComparison } from '../src/sim/acquisitionComparison';

function fixture() {
  const state = createGame('比較テスト', 812);
  state.cash = 900_000_000; state.reputation = 100; state.listed = true;
  return state;
}
const stockId = STOCKS.find(s => s.dividendYield > 0)!.id;
const targetOf = (state: ReturnType<typeof createGame>) => getMarketAcquisitionTargets(state).find(t => t.stockId === stockId)!;

describe('market acquisition decision comparison', () => {
  it('reserves research and every preparation week without counting paid research twice', () => {
    const state = fixture(), target = targetOf(state);
    const before = getAcquisitionComparison(state, target, 'integrated');
    expect(before.preparationReserve).toBe(before.choice.leadWeeks * before.choice.weeklyIntegrationCost);
    expect(before.remainingCashBudget).toBe(target.researchCost + target.quotePrice + before.choice.integrationCost + before.preparationReserve);
    const researched = applyAction(state, { type: 'researchMarketCompany', stockId });
    const after = getAcquisitionComparison(researched, targetOf(researched), 'integrated');
    expect(after.remainingCashBudget).toBe(before.remainingCashBudget - target.researchCost);
    expect(after.totalProjectCost).toBe(before.totalProjectCost);
    expect(state.cash - before.remainingCashBudget).toBe(researched.cash - after.remainingCashBudget);
    const exactAcquisitionCash = { ...researched, cash: after.choice.upfrontCost };
    const boundary = getAcquisitionComparison(exactAcquisitionCash, targetOf(exactAcquisitionCash), 'integrated');
    expect(boundary.ready).toBe(true);
    expect(boundary.remainingCashBudget).toBeGreaterThan(exactAcquisitionCash.cash);
  });

  it('requires cash for research even if excess shares later fund acquisition and preparation', () => {
    const state = fixture(), target = targetOf(state);
    const shares = Math.ceil((target.quotePrice * 2) / state.stockPrices[stockId]);
    state.positions = [{ stockId, shares, averageCost: state.stockPrices[stockId] }];
    state.cash = 0;
    const row = getAcquisitionComparison(state, targetOf(state), 'autonomous');
    expect(row.choice.upfrontCost).toBe(0);
    expect(row.choice.refund).toBeGreaterThan(row.preparationReserve);
    expect(row.remainingCashBudget).toBe(target.researchCost);
    expect(row.ready).toBe(false);
    expect(previewAcquisitionComparison(state, targetOf(state), 'autonomous')).toBeNull();
    const paid = applyAction({ ...state, cash: target.researchCost }, { type: 'researchMarketCompany', stockId });
    expect(getAcquisitionComparison(paid, targetOf(paid), 'autonomous').remainingCashBudget).toBe(0);
    expect(previewAcquisitionComparison(paid, targetOf(paid), 'autonomous')!.cashAfter).toBe(row.choice.refund);
  });

  it('keeps unresearched previews undisclosed and checks the selected mode cash gate', () => {
    let state = fixture();
    const snapshot = structuredClone(state);
    expect(previewAcquisitionComparison(state, targetOf(state), 'integrated')).toBeNull();
    expect(state).toEqual(snapshot);
    state = applyAction(state, { type: 'researchMarketCompany', stockId });
    state.cash = targetOf(state).upfrontCost;
    expect(previewAcquisitionComparison(state, targetOf(state), 'autonomous')).not.toBeNull();
    expect(previewAcquisitionComparison(state, targetOf(state), 'integrated')).toBeNull();
    state = applyAction(state, { type: 'acquireMarketCompany', stockId, mode: 'autonomous' });
    expect(previewAcquisitionComparison(state, targetOf(state), 'autonomous')).toBeNull();
  });

  it('compares independent alternatives with real interest, lost dividends and week-end cash', () => {
    let state = applyAction(fixture(), { type: 'researchMarketCompany', stockId });
    state = applyAction(state, { type: 'buyStock', stockId, shares: 100 });
    state = applyAction(state, { type: 'borrow', amount: 100_000, weeks: 52 });
    const snapshot = structuredClone(state), target = targetOf(state);
    for (const mode of ['autonomous', 'integrated'] as const) {
      const result = previewAcquisitionComparison(state, target, mode)!;
      const actual = applyAction(state, { type: 'acquireMarketCompany', stockId, mode });
      const report = previewWeek(actual);
      expect(result.cashAfter).toBe(actual.cash);
      expect(result.weekEndCash).toBe(actual.cash + report.cashChange);
      expect(result.weeklyProfit).toBe(report.netProfit);
      expect(result.weeklyProfitChange).toBe(-target.choices.find(c => c.mode === mode)!.weeklyIntegrationCost);
      expect(result.weeklyProfit).toBeLessThan(result.weeklyProfitChange);
      expect(result.lostDividends).toBeGreaterThan(0);
      expect(result.debtFailure).toBe(true);
    }
    expect(state).toEqual(snapshot);
  });
});
