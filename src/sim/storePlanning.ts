import type { GameState, StoreStyle, WeeklyReport } from '../model';
import { LOTS } from '../data/district';
import { applyAction, evaluateSite, getWeekOutlook, operatingConditions } from './engine';

export const STORE_OPENING_STYLES: readonly StoreStyle[] = ['standard', 'premium', 'takeaway'];

export interface StoreOpeningPlan {
  style: StoreStyle;
  available: boolean;
  reason: string;
  openingCost: number | null;
  cashBefore: number;
  cashAfter: number | null;
  /** Neutral expected reports for detailed comparisons, never settled weekly results. */
  before: WeeklyReport;
  after: WeeklyReport | null;
  outlook: ReturnType<typeof getWeekOutlook> | null;
  netProfitDelta: number | null;
  existingStoreProfitDelta: number | null;
  overheadDelta: number | null;
  founderCapacity: number | null;
  defaults: { price: number; quality: number; staff: number; marketing: number } | null;
  debtProfitRisk: boolean;
  cashRisk: boolean;
  debtProfitCertain: boolean;
  cashShortfallCertain: boolean;
}

/** Compare executable cash-funded openings at the same week, without mutating the company. */
export function getStoreOpeningPlans(state: GameState, lotId: string): StoreOpeningPlan[] {
  const before = getWeekOutlook(state).expected;
  const economyBefore = operatingConditions(state);
  const lot = LOTS.find(candidate => candidate.id === lotId);
  return STORE_OPENING_STYLES.map(style => {
    const openingCost = lot?.available ? evaluateSite(state, lotId, style).openingCost : null;
    const base: StoreOpeningPlan = {
      style, available: false, reason: '', openingCost, cashBefore: state.cash, cashAfter: null,
      before, after: null, outlook: null, netProfitDelta: null, existingStoreProfitDelta: null,
      overheadDelta: null, founderCapacity: null, defaults: null, debtProfitRisk: false, cashRisk: false,
      debtProfitCertain: false, cashShortfallCertain: false,
    };
    try {
      const next = applyAction(state, { type: 'openStore', lotId, style });
      const outlook = getWeekOutlook(next);
      const after = outlook.expected;
      const opened = next.stores.find(store => store.lotId === lotId)!;
      const economyAfter = operatingConditions(next);
      const existingIds = new Set(state.stores.map(store => store.id));
      const existingAfter = after.storeResults.filter(store => existingIds.has(store.id)).reduce((sum, store) => sum + store.profit, 0);
      const existingBefore = before.storeResults.reduce((sum, store) => sum + store.profit, 0);
      return {
        ...base, available: true, cashAfter: next.cash, after, outlook,
        netProfitDelta: after.netProfit - before.netProfit,
        existingStoreProfitDelta: existingAfter - existingBefore,
        overheadDelta: economyAfter.overhead - economyBefore.overhead,
        founderCapacity: economyAfter.founderCapacity,
        defaults: { price: opened.price, quality: opened.quality, staff: opened.staff, marketing: opened.marketing },
        debtProfitRisk: outlook.risk.debtLossPossible,
        cashRisk: outlook.risk.cashShortfallPossible,
        debtProfitCertain: next.loans.some(loan => loan.remaining > 0) && outlook.netProfit.max <= 0,
        cashShortfallCertain: outlook.cashAfter.max < 0,
      };
    } catch (error) {
      return { ...base, reason: error instanceof Error ? error.message : 'この条件では出店できません。' };
    }
  });
}
