import type { GameState, StoreStyle, WeeklyReport } from '../model';
import { LOTS } from '../data/district';
import { applyAction, evaluateSite, operatingConditions, previewWeek } from './engine';

export const STORE_OPENING_STYLES: readonly StoreStyle[] = ['standard', 'premium', 'takeaway'];

export interface StoreOpeningPlan {
  style: StoreStyle;
  available: boolean;
  reason: string;
  openingCost: number | null;
  cashBefore: number;
  cashAfter: number | null;
  before: WeeklyReport;
  after: WeeklyReport | null;
  netProfitDelta: number | null;
  existingStoreProfitDelta: number | null;
  overheadDelta: number | null;
  founderCapacity: number | null;
  defaults: { price: number; quality: number; staff: number; marketing: number } | null;
  debtProfitRisk: boolean;
  cashRisk: boolean;
}

/** Compare executable cash-funded openings at the same week, without mutating the company. */
export function getStoreOpeningPlans(state: GameState, lotId: string): StoreOpeningPlan[] {
  const before = previewWeek(state);
  const economyBefore = operatingConditions(state);
  const lot = LOTS.find(candidate => candidate.id === lotId);
  return STORE_OPENING_STYLES.map(style => {
    const openingCost = lot?.available ? evaluateSite(state, lotId, style).openingCost : null;
    const base: StoreOpeningPlan = {
      style, available: false, reason: '', openingCost, cashBefore: state.cash, cashAfter: null,
      before, after: null, netProfitDelta: null, existingStoreProfitDelta: null,
      overheadDelta: null, founderCapacity: null, defaults: null, debtProfitRisk: false, cashRisk: false,
    };
    try {
      const next = applyAction(state, { type: 'openStore', lotId, style });
      const after = previewWeek(next);
      const opened = next.stores.find(store => store.lotId === lotId)!;
      const economyAfter = operatingConditions(next);
      const existingIds = new Set(state.stores.map(store => store.id));
      const existingAfter = after.storeResults.filter(store => existingIds.has(store.id)).reduce((sum, store) => sum + store.profit, 0);
      const existingBefore = before.storeResults.reduce((sum, store) => sum + store.profit, 0);
      return {
        ...base, available: true, cashAfter: next.cash, after,
        netProfitDelta: after.netProfit - before.netProfit,
        existingStoreProfitDelta: existingAfter - existingBefore,
        overheadDelta: economyAfter.overhead - economyBefore.overhead,
        founderCapacity: economyAfter.founderCapacity,
        defaults: { price: opened.price, quality: opened.quality, staff: opened.staff, marketing: opened.marketing },
        debtProfitRisk: next.loans.some(loan => loan.remaining > 0) && after.netProfit <= 0,
        cashRisk: next.cash + after.cashChange < 0,
      };
    } catch (error) {
      return { ...base, reason: error instanceof Error ? error.message : 'この条件では出店できません。' };
    }
  });
}
