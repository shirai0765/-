import type { GameAction, GameState, WeeklyReport } from '../model';
import { applyAction, getSummary, getWeekOutlook, type WeekOutlook } from './engine';

export type CapitalPlanId = 'hold' | 'borrow' | 'equity';
export interface CapitalBudget { spending: number; reserve: number }
export interface CapitalPlanningOptions {
  borrowAmount: number;
  borrowWeeks: number;
  budget?: CapitalBudget;
}
export interface CapitalSnapshot {
  cash: number;
  debt: number;
  ownership: number;
  /** Neutral planning report only; never a settlement result. */
  report: WeeklyReport;
  outlook: WeekOutlook;
  dividendsPaidRange: { min: number; max: number };
  weekEndCash: number;
  debtProfitRisk: boolean;
  cashRisk: boolean;
}
export interface CapitalPlan {
  id: CapitalPlanId;
  action: GameAction | null;
  available: boolean;
  reason: string;
  before: CapitalSnapshot;
  after: CapitalSnapshot | null;
  raisedCash: number | null;
  loanAnnualRate: number | null;
  /** Cash-only arithmetic. The investment has NOT been applied or forecast. */
  budgetGap: number | null;
  cashAfterBudget: number | null;
}

function snapshot(state: GameState): CapitalSnapshot {
  const summary = getSummary(state);
  const outlook = getWeekOutlook(state);
  const report = outlook.expected;
  const paid = (profit: number) => state.listed ? Math.round(Math.max(0, profit) * state.dividendPayout) : 0;
  return {
    cash: state.cash, debt: summary.debt, ownership: summary.ownership, report, outlook,
    dividendsPaidRange: { min: paid(outlook.netProfit.min), max: paid(outlook.netProfit.max) },
    weekEndCash: state.cash + report.cashChange,
    debtProfitRisk: outlook.risk.debtLossPossible,
    cashRisk: outlook.risk.cashShortfallPossible,
  };
}

export function capitalBudgetError(budget?: CapitalBudget): string {
  if (!budget) return '';
  return [budget.spending, budget.reserve, budget.spending + budget.reserve].every(value => Number.isSafeInteger(value) && value >= 0)
    ? '' : '計画支出と残す現金は、0以上の整数（円）で入力してください。';
}

/** Only previews existing actions; does not execute investments, advance time, or mutate the input. */
export function getCapitalPlans(state: GameState, options: CapitalPlanningOptions): CapitalPlan[] {
  const before = snapshot(state);
  const budget = options.budget && !capitalBudgetError(options.budget) ? options.budget : undefined;
  const candidates: { id: CapitalPlanId; action: GameAction | null }[] = [
    { id: 'hold', action: null },
    { id: 'borrow', action: { type: 'borrow', amount: options.borrowAmount, weeks: options.borrowWeeks } },
    { id: 'equity', action: state.listed ? { type: 'issueShares', fraction: .1 } : { type: 'ipo' } },
  ];
  return candidates.map(({ id, action }) => {
    const base: CapitalPlan = {
      id, action, before, available: false, reason: '', after: null, raisedCash: null,
      loanAnnualRate: null, budgetGap: null, cashAfterBudget: null,
    };
    try {
      const next = action ? applyAction(state, action) : state;
      const after = action ? snapshot(next) : before;
      return {
        ...base, available: true, after, raisedCash: next.cash - state.cash,
        loanAnnualRate: id === 'borrow' ? next.loans[next.loans.length - 1].annualRate : null,
        budgetGap: budget ? Math.max(0, budget.spending + budget.reserve - next.cash) : null,
        cashAfterBudget: budget ? next.cash - budget.spending : null,
      };
    } catch (error) {
      const unmet = action?.type === 'ipo' && !state.gameOver
        ? getSummary(state).ipoRequirements.filter(requirement => !requirement.met).map(requirement => requirement.label)
        : [];
      return { ...base, reason: unmet.length ? `未達の上場条件：${unmet.join('・')}` : error instanceof Error ? error.message : 'この条件では調達できません。' };
    }
  });
}
