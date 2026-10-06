import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LOTS } from '../src/data/district';
import { advanceWeek, applyAction, createGame, getSummary, previewWeek } from '../src/sim/engine';
import { capitalBudgetError, getCapitalPlans } from '../src/sim/capitalPlanning';
import CapitalPlanningPanel from '../src/ui/CapitalPlanningPanel';

const options = { borrowAmount: 3_000_000, borrowWeeks: 52 };
const sites = LOTS.filter(lot => lot.available).sort((a, b) => a.rent - b.rent);
function eligibleCompany() {
  let state = createGame();
  state.cash = 50_000_000;
  for (const site of sites.slice(0, 3)) state = applyAction(state, { type: 'openStore', lotId: site.id, style: 'standard' });
  state.profitableWeeks = 12;
  expect(getSummary(state).ipoEligible).toBe(true);
  return state;
}

describe('capital planning', () => {
  it('compares real actions and keeps previewing and rendering free of mutations', () => {
    const state = eligibleCompany();
    const original = structuredClone(state);
    for (const plan of getCapitalPlans(state, options)) {
      const next = plan.action ? applyAction(state, plan.action) : state;
      expect(plan.available).toBe(true);
      expect(plan.after!.report).toEqual(previewWeek(next));
      expect(plan.after!.cash).toBe(next.cash);
      expect(plan.after!.debt).toBe(getSummary(next).debt);
      expect(plan.after!.ownership).toBe(getSummary(next).ownership);
      expect(plan.after!.weekEndCash).toBe(next.cash + previewWeek(next).cashChange);
    }
    let calls = 0;
    const markup = renderToStaticMarkup(createElement(CapitalPlanningPanel, { state, onAction: () => { calls++; } }));
    expect(markup).toContain('借入中の週');
    expect(calls).toBe(0);
    expect(state).toEqual(original);
  });

  it('shows net IPO proceeds and 80% founder ownership without forecasting future growth', () => {
    const state = eligibleCompany();
    const equity = getCapitalPlans(state, options)[2];
    expect(equity.action).toEqual({ type: 'ipo' });
    expect(equity.raisedCash).toBe(Math.round(getSummary(state).valuation * .25));
    expect(equity.after!.ownership).toBe(.8);
    expect(equity.after!.report.operatingProfit).toBe(equity.before.report.operatingProfit);
    expect(equity.after!.report.week).toBe(state.week);
  });

  it('includes the 5% share issue deduction and the existing 20% ownership floor', () => {
    const state = applyAction(eligibleCompany(), { type: 'ipo' });
    const plan = getCapitalPlans(state, options)[2];
    expect(plan.action).toEqual({ type: 'issueShares', fraction: .1 });
    const issued = Math.round(state.sharesOutstanding * .1);
    expect(plan.raisedCash).toBe(Math.round(issued * getSummary(state).valuation / state.sharesOutstanding * .95));
    expect(plan.after!.ownership).toBe(state.founderShares / (state.sharesOutstanding + issued));
    state.founderShares = Math.round(state.sharesOutstanding * .21);
    const blocked = getCapitalPlans(state, options)[2];
    expect(blocked).toMatchObject({ available: false, after: null });
    expect(blocked.reason).toContain('20%');
  });

  it('states missing IPO requirements and rejects illegal loan values through the engine', () => {
    const state = createGame();
    const equity = getCapitalPlans(state, options)[2];
    expect(equity.reason).toContain('3店舗');
    expect(equity.reason).toContain('12週');
    expect(equity.after).toBeNull();
    for (const invalid of [
      { borrowAmount: 99_999, borrowWeeks: 52 },
      { borrowAmount: 5_000_001, borrowWeeks: 52 },
      { borrowAmount: NaN, borrowWeeks: 52 },
      { borrowAmount: 100_000.5, borrowWeeks: 52 },
      { borrowAmount: 100_000, borrowWeeks: 12 },
      { borrowAmount: 100_000, borrowWeeks: 261 },
    ]) expect(getCapitalPlans(state, invalid)[1]).toMatchObject({ available: false, after: null, raisedCash: null });
  });

  it('makes repayment term change cash flow without pretending it changes operating profit', () => {
    const state = eligibleCompany();
    const short = getCapitalPlans(state, { ...options, borrowWeeks: 13 })[1];
    const long = getCapitalPlans(state, { ...options, borrowWeeks: 260 })[1];
    expect(short.after!.report.operatingProfit).toBe(short.before.report.operatingProfit);
    expect(short.after!.report.netProfit).toBe(long.after!.report.netProfit);
    expect(short.after!.report.loanRepayment).toBeGreaterThan(long.after!.report.loanRepayment);
    expect(short.after!.report.cashChange).toBeLessThan(long.after!.report.cashChange);
    expect(short.after!.ownership).toBe(1);
  });

  it('warns about strict debt defeat at zero profit even if principal is cleared that week', () => {
    const state = createGame();
    state.loans = [{ id: 'final-payment', principal: 100_000, remaining: 100_000, weeklyPayment: 100_000, weeksLeft: 1, annualRate: 0 }];
    const hold = getCapitalPlans(state, options)[0];
    expect(hold.after!.report.netProfit).toBe(0);
    expect(hold.after!.weekEndCash).toBeGreaterThan(0);
    expect(hold.after!.debtProfitRisk).toBe(true);
    expect(advanceWeek(state).gameOver).toBe(true);
    expect(renderToStaticMarkup(createElement(CapitalPlanningPanel, { state, onAction: () => undefined }))).toContain('週末に元本を完済しても回避できません');
  });

  it('separates principal-driven cash shortage from debt profit defeat', () => {
    let state = applyAction(createGame(), { type: 'openStore', lotId: sites[0].id, style: 'standard' });
    state = applyAction(state, { type: 'borrow', amount: 5_000_000, weeks: 13 });
    state.cash = 0;
    const hold = getCapitalPlans(state, options)[0];
    expect(hold.after!.report.netProfit).toBeGreaterThan(0);
    expect(hold.after!.debtProfitRisk).toBe(false);
    expect(hold.after!.cashRisk).toBe(true);
    expect(advanceWeek(state).gameOver).toBe(true);
  });

  it('does not present equity proceeds as a rescue for debt-backed operating losses', () => {
    let state = applyAction(eligibleCompany(), { type: 'ipo' });
    state = applyAction(state, { type: 'borrow', amount: 100_000, weeks: 52 });
    for (const store of state.stores) state = applyAction(state, { type: 'updateStore', storeId: store.id, changes: { staff: 30 } });
    const equity = getCapitalPlans(state, options)[2];
    expect(equity.available).toBe(true);
    expect(equity.raisedCash).toBeGreaterThan(0);
    expect(equity.after!.cashRisk).toBe(false);
    expect(equity.after!.debtProfitRisk).toBe(true);
    expect(equity.after!.report.netProfit).toBe(equity.before.report.netProfit);
    expect(advanceWeek(applyAction(state, equity.action!)).gameOver).toBe(true);
  });

  it('uses budget inputs for immediate funding gaps without applying a fictional investment', () => {
    const state = createGame();
    const plans = getCapitalPlans(state, { ...options, budget: { spending: 14_000_000, reserve: 500_000 } });
    expect(plans[0]).toMatchObject({ budgetGap: 2_500_000, cashAfterBudget: -2_000_000 });
    expect(plans[1]).toMatchObject({ budgetGap: 0, cashAfterBudget: 1_000_000 });
    expect(plans[1].after!.cash).toBe(15_000_000);
    expect(plans[1].after!.report).toEqual(previewWeek(applyAction(state, plans[1].action!)));
    expect(plans[1].after!.debtProfitRisk).toBe(true);
    expect(getCapitalPlans(state, options)[0].budgetGap).toBeNull();
  });

  it('rejects misleading budget arithmetic while preserving the actionable funding preview', () => {
    for (const budget of [{ spending: -1, reserve: 0 }, { spending: 1.5, reserve: 0 }, { spending: NaN, reserve: 0 }, { spending: Number.MAX_SAFE_INTEGER, reserve: 1 }]) {
      expect(capitalBudgetError(budget)).not.toBe('');
      const plan = getCapitalPlans(createGame(), { ...options, budget })[1];
      expect(plan.available).toBe(true);
      expect(plan.budgetGap).toBeNull();
    }
  });

  it('does not offer executable funding for a finished game', () => {
    const state = eligibleCompany(); state.gameOver = true;
    const plans = getCapitalPlans(state, options);
    expect(plans[0].action).toBeNull();
    expect(plans.slice(1).every(plan => !plan.available && plan.after === null)).toBe(true);
  });
});
