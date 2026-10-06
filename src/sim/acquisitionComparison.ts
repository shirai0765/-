import type { GameState, MarketAcquisitionMode } from '../model';
import { STOCKS } from '../data/stocks';
import { applyAction, getWeekOutlook } from './engine';
import { marketCompanyDefinition, type MarketAcquisitionTargetView } from './marketAcquisitions';

/** Read-only planning figures. Preparation is a reserve, not a second upfront debit. */
export function getAcquisitionComparison(state: GameState, target: MarketAcquisitionTargetView, mode: MarketAcquisitionMode) {
  const choice = target.choices.find(c => c.mode === mode)!;
  const definition = marketCompanyDefinition(STOCKS.find(s => s.id === target.stockId)!);
  const owned = target.status === 'owned' || target.status === 'integrating';
  const remainingResearchCost = target.researched ? 0 : target.researchCost;
  const preparationReserve = choice.weeklyIntegrationCost * choice.leadWeeks;
  const totalProjectCost = target.researchCost + target.quotePrice + choice.integrationCost + preparationReserve;
  const cashToAcquire = remainingResearchCost + choice.upfrontCost;
  const remainingCashBudget = Math.max(remainingResearchCost, cashToAcquire - choice.refund + preparationReserve);
  const ready = !owned && target.unlocked && state.cash >= choice.upfrontCost;
  return { target, choice, owned, remainingResearchCost, preparationReserve, totalProjectCost, cashToAcquire, remainingCashBudget, ready, risk: definition.risk };
}

/** Preview one alternative against the same current state; never researches or acquires in live state. */
export function previewAcquisitionComparison(state: GameState, target: MarketAcquisitionTargetView, mode: MarketAcquisitionMode) {
  const comparison = getAcquisitionComparison(state, target, mode);
  if (!comparison.ready) return null;
  const after = applyAction(state, { type: 'acquireMarketCompany', stockId: target.stockId, mode });
  const beforeOutlook = getWeekOutlook(state), outlook = getWeekOutlook(after);
  const beforeForecast = beforeOutlook.expected, afterForecast = outlook.expected;
  return {
    cashAfter: after.cash,
    beforeOutlook, outlook,
    weeklyProfit: afterForecast.netProfit,
    weeklyProfitChange: afterForecast.netProfit - beforeForecast.netProfit,
    weekEndCash: after.cash + afterForecast.cashChange,
    lostDividends: beforeForecast.dividendsReceived - afterForecast.dividendsReceived,
    debtFailure: outlook.risk.debtLossPossible,
    cashFailure: outlook.risk.cashShortfallPossible,
  };
}
