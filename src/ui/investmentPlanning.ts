import type { DistrictId, GameState, MarketAcquisitionMode, MarketOperationPolicy, RailProjectChoiceId, StoreStyle } from '../model';
import { LOTS } from '../data/district';
import { getStoreOpeningPlans } from '../sim/storePlanning';
import { getRailProjects } from '../sim/railProjects';
import { getMarketAcquisitionTargets } from '../sim/marketAcquisitions';
import { getAcquisitionComparison } from '../sim/acquisitionComparison';
import { getActiveMarketOperation, getMarketOperationQuote } from '../sim/marketOperations';

/** Navigation intent only. Neither planning nor returning executes an investment. */
export type InvestmentIntent =
  | { kind: 'store'; lotId: string; style: StoreStyle }
  | { kind: 'rail'; districtId: DistrictId; choiceId: RailProjectChoiceId }
  | { kind: 'acquisition'; stockId: string; mode: MarketAcquisitionMode }
  | { kind: 'marketOperation'; sector: string; policy: MarketOperationPolicy };

export interface InvestmentVisit { id: string; intent: InvestmentIntent }
export interface InvestmentMemo {
  id: string;
  label: string;
  spending: number;
  returnLabel: string;
}
const storeNames: Record<StoreStyle, string> = { standard: '街角カフェ', premium: 'プレミアム', takeaway: 'テイクアウト' };

/** A public planning budget at selection time, not an executable quote or future profit. */
export function getInvestmentMemo(state: GameState, visit: InvestmentVisit): InvestmentMemo | null {
  const intent = visit.intent;
  // A plan survives navigation; visit.id is only the command to reopen its destination.
  const memoId = JSON.stringify(intent.kind === 'store' ? [state.id, intent.kind, intent.lotId, intent.style]
    : intent.kind === 'rail' ? [state.id, intent.kind, intent.districtId, intent.choiceId]
    : intent.kind === 'marketOperation' ? [state.id, intent.kind, intent.sector, intent.policy]
    : [state.id, intent.kind, intent.stockId, intent.mode]);
  if (intent.kind === 'store') {
    const lot = LOTS.find(candidate => candidate.id === intent.lotId);
    if (!lot?.available || state.stores.some(store => store.lotId === lot.id)) return null;
    const plan = getStoreOpeningPlans(state, lot.id).find(candidate => candidate.style === intent.style);
    return plan?.openingCost === null || plan?.openingCost === undefined ? null : {
      id: memoId, label: `${lot.name}・${storeNames[intent.style]}`, spending: plan.openingCost, returnLabel: 'この出店プランに戻る',
    };
  }
  if (intent.kind === 'rail') {
    const district = getRailProjects(state).find(candidate => candidate.districtId === intent.districtId);
    const choice = district?.options.find(candidate => candidate.id === intent.choiceId);
    return district && choice ? {
      id: memoId, label: `${district.name}・${choice.name}`, spending: choice.cost, returnLabel: 'この共同開発プランに戻る',
    } : null;
  }
  if (intent.kind === 'marketOperation') {
    const quote = getMarketOperationQuote(state, intent.sector, intent.policy);
    if (!quote.eligibleCount || getActiveMarketOperation(state)) return null;
    return {
      id: memoId,
      label: `${intent.sector}・${intent.policy === 'growth' ? '成長に投資' : '変動を抑える'}（${quote.weeklyCost > 0 ? '初回支払＋26週の運営費の確保額' : '初回支払'}）`,
      spending: quote.reserveRequired,
      returnLabel: 'この事業計画に戻る',
    };
  }
  const target = getMarketAcquisitionTargets(state).find(candidate => candidate.stockId === intent.stockId);
  if (!target || target.status === 'owned' || target.status === 'integrating') return null;
  const choice = target.choices.find(candidate => candidate.mode === intent.mode);
  if (!choice) return null;
  const budget = getAcquisitionComparison(state, target, intent.mode);
  return {
    id: memoId, label: `${target.name}・${choice.name}（未払調査・準備費込み）`,
    spending: budget.remainingCashBudget, returnLabel: 'この買収プランに戻る',
  };
}
