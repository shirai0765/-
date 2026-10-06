import { describe, expect, it } from 'vitest';
import { LOTS } from '../src/data/district';
import { STOCKS } from '../src/data/stocks';
import { applyAction, advanceWeek, createGame } from '../src/sim/engine';
import { getMarketAcquisitionTargets, getMarketGroupFinancials } from '../src/sim/marketAcquisitions';
import { getInvestmentMemo, type InvestmentIntent } from '../src/ui/investmentPlanning';

// Fixed, deliberately wealthy accounting fixtures. No normal-play affordability or timing claim.
function funded() {
  const state = createGame('投資メモ境界', 9401);
  state.cash = 900_000_000;
  state.listed = true;
  state.reputation = 100;
  return state;
}
const stockId = STOCKS[0].id;
const site = LOTS.find(lot => lot.available && lot.district === 'sakuragaoka')!;
const acquisition: InvestmentIntent = { kind: 'acquisition', stockId, mode: 'integrated' };
const memo = (state: ReturnType<typeof createGame>, intent: InvestmentIntent, id = 'visit-1') => getInvestmentMemo(state, { id, intent });
const targetOf = (state: ReturnType<typeof createGame>) => getMarketAcquisitionTargets(state).find(target => target.stockId === stockId)!;

describe('investment navigation accounting memo', () => {
  it('quotes actual opening costs without granting cash, and identifies the investment across repeat visits', () => {
    const state = createGame('資金不足でも比較', 9401);
    state.cash = 0;
    const snapshot = structuredClone(state);
    const ids = new Set<string>();
    for (const style of ['standard', 'premium', 'takeaway'] as const) {
      const intent: InvestmentIntent = { kind: 'store', lotId: site.id, style };
      const result = memo(state, intent)!;
      const executable = { ...state, cash: 900_000_000 };
      const opened = applyAction(executable, { type: 'openStore', lotId: site.id, style });
      expect(result.spending).toBe(executable.cash - opened.cash);
      expect(result.spending).toBeGreaterThan(state.cash);
      expect(() => applyAction(state, { type: 'openStore', lotId: site.id, style })).toThrow();
      expect(memo({ ...state, week: state.week + 1 }, intent, 'another-visit')!.id).toBe(result.id);
      expect(memo({ ...state, id: `${state.id}-other-company` }, intent)!.id).not.toBe(result.id);
      ids.add(result.id);
    }
    expect(ids.size).toBe(3);
    expect(state).toEqual(snapshot);
  });

  it('reserves unpaid research and preparation once, after crediting already held shares', () => {
    let state = funded();
    const quote = targetOf(state).quotePrice;
    state = applyAction(state, { type: 'buyStock', stockId, shares: Math.floor(quote / state.stockPrices[stockId] / 3) });
    const snapshot = structuredClone(state);
    const before = memo(state, acquisition)!;
    const researched = applyAction(state, { type: 'researchMarketCompany', stockId });
    const afterResearch = memo(researched, acquisition)!;
    expect(before.spending - afterResearch.spending).toBe(state.cash - researched.cash);
    expect(state.cash - before.spending).toBe(researched.cash - afterResearch.spending);
    const acquired = applyAction(researched, { type: 'acquireMarketCompany', stockId, mode: 'integrated' });
    const upfrontPaid = researched.cash - acquired.cash;
    expect(upfrontPaid).toBeLessThan(quote);
    expect(acquired.positions.some(position => position.stockId === stockId)).toBe(false);
    let preparation = acquired;
    let preparationCosts = 0;
    const readyWeek = acquired.marketAcquisitions!.companies[0].readyWeek;
    while (preparation.week < readyWeek) {
      preparationCosts += getMarketGroupFinancials(preparation).weeklyExpense;
      preparation = advanceWeek(preparation);
    }
    expect(preparationCosts).toBeGreaterThan(0);
    expect(afterResearch.spending).toBe(upfrontPaid + preparationCosts);
    expect(before.spending).toBe(state.cash - acquired.cash + preparationCosts);
    expect(state).toEqual(snapshot);
  });

  it('keeps research cash necessary before an excess-share refund and never waives listing conditions', () => {
    let state = funded();
    const target = targetOf(state);
    expect(target.requiresListing).toBe(true);
    state = applyAction(state, { type: 'buyStock', stockId, shares: Math.ceil(target.quotePrice * 2 / state.stockPrices[stockId]) });
    state.cash = 0;
    const snapshot = structuredClone(state);
    expect(memo(state, acquisition)!.spending).toBe(target.researchCost);
    expect(() => applyAction(state, { type: 'researchMarketCompany', stockId })).toThrow('調査資金');
    const researched = applyAction({ ...state, cash: target.researchCost }, { type: 'researchMarketCompany', stockId });
    expect(memo(researched, acquisition)!.spending).toBe(0);
    const unlisted = { ...researched, listed: false };
    expect(memo(unlisted, acquisition)!.spending).toBe(0);
    expect(() => applyAction(unlisted, { type: 'acquireMarketCompany', stockId, mode: 'integrated' })).toThrow('上場');
    const acquired = applyAction(researched, { type: 'acquireMarketCompany', stockId, mode: 'integrated' });
    expect(acquired.cash).toBeGreaterThan(0);
    const choice = targetOf(researched).choices.find(candidate => candidate.mode === 'integrated')!;
    expect(acquired.cash).toBeGreaterThan(choice.weeklyIntegrationCost * choice.leadWeeks);
    expect(state).toEqual(snapshot);
  });

  it('rejects new memos for occupied lots, started districts, and acquired or integrating companies', () => {
    const rail: InvestmentIntent = { kind: 'rail', districtId: site.district, choiceId: 'commerce' };
    const poor = createGame('条件未達', 9401);
    poor.cash = 0;
    const poorSnapshot = structuredClone(poor);
    expect(memo(poor, rail)!.spending).toBe(6_000_000);
    expect(() => applyAction(poor, { type: 'startRailProject', districtId: site.district, choiceId: 'commerce' })).toThrow();
    expect(poor).toEqual(poorSnapshot);
    let state = applyAction(funded(), { type: 'openStore', lotId: site.id, style: 'standard' });
    for (const style of ['standard', 'premium', 'takeaway'] as const) expect(memo(state, { kind: 'store', lotId: site.id, style })).toBeNull();
    state = applyAction(state, { type: 'buyProperty', lotId: site.id });
    state = applyAction(state, { type: 'startRailProject', districtId: site.district, choiceId: 'commerce' });
    expect(memo(state, rail)).toBeNull();
    expect(memo(state, { ...rail, choiceId: 'rental' })).toBeNull();
    state = applyAction(state, { type: 'researchMarketCompany', stockId });
    state = applyAction(state, { type: 'acquireMarketCompany', stockId, mode: 'integrated' });
    expect(targetOf(state).status).toBe('integrating');
    expect(memo(state, acquisition)).toBeNull();
    const ready = { ...state, week: state.marketAcquisitions!.companies[0].readyWeek };
    expect(targetOf(ready).status).toBe('owned');
    expect(memo(ready, acquisition)).toBeNull();
  });
});
