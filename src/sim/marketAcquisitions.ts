import type { GameState, MarketAcquisitionMode, MarketAcquisitionAction, StockDefinition } from '../model';
import { STOCKS } from '../data/stocks';
import { calculateMarketGroupFinancials, marketCompanyBaseline as baseline, marketCompanyDefinition, marketCompanyQuality as quality, marketIntegrationWeeklyCost as integrationWeeklyCost } from './marketBusinessMath';
import { getActiveMarketOperation } from './marketOperations';
export { marketCompanyDefinition } from './marketBusinessMath';
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const money = Math.round;
export function marketIntegrationWeeks(stock: StockDefinition, mode: MarketAcquisitionMode) { return stock.market === 'REIT' ? (mode === 'autonomous' ? 1 : 4) : (mode === 'autonomous' ? 2 : 6); }
export function isMarketCompanyOwned(s: GameState, stockId: string) { return !!s.marketAcquisitions?.companies.some(c => c.stockId === stockId); }
const researched = (s: GameState, stockId: string) => !!s.marketAcquisitions?.research.some(r => r.stockId === stockId);
export function getMarketGroupFinancials(s: GameState, mode: 'expected' | 'low' | 'high' | 'actual' = 'expected') {
  return calculateMarketGroupFinancials(s, mode, getActiveMarketOperation(s));
}
export interface MarketAcquisitionTargetView {
  stockId: string; name: string; market: string; profile: string; isFund: boolean; researched: boolean; researchCost: number; minReputation: number; requiresListing: boolean;
  status: 'locked' | 'available' | 'integrating' | 'owned'; unlocked: boolean; reason: string; quotePrice: number; portfolioCredit: number; upfrontCost: number; refund: number; leadWeeks: number; remainingWeeks: number;
  weeklyProfitRange: { min: number; max: number }; risks: string[]; quality: '再建余地' | '標準' | '優良' | null;
  choices: { mode: MarketAcquisitionMode; name: string; description: string; leadWeeks: number; weeklyProfitRange: { min: number; max: number }; integrationCost: number; upfrontCost: number; refund: number; weeklyIntegrationCost: number }[];
}
export function getMarketAcquisitionTargets(s: GameState): MarketAcquisitionTargetView[] {
  return STOCKS.map(stock => {
    const d = marketCompanyDefinition(stock), known = researched(s, stock.id), company = s.marketAcquisitions?.companies.find(c => c.stockId === stock.id);
    const quotePrice = money(d.baseValue * clamp(s.stockPrices[stock.id] / stock.basePrice, .6, 1.6));
    const position = s.positions.find(p => p.stockId === stock.id), holdingValue = money((position?.shares ?? 0) * s.stockPrices[stock.id]);
    const choices = (['autonomous', 'integrated'] as const).map(mode => {
      const integrationCost = mode === 'integrated' ? money(quotePrice * .04) : 0;
      const center = known ? baseline(s, stock, mode) : d.baseValue * d.annualYield / 52 * (mode === 'integrated' ? 1.12 : .92);
      // Range includes the full bounded cycle + shock and max group overhead.
      const weeklyProfitRange = { min: money(center * (1 - d.risk) * .82 * (known ? 1 : .62)), max: money(center * (1 + d.risk) * .96 * (known ? 1 : 1.2)) };
      return { mode, name: mode === 'autonomous' ? '独立運営を維持' : 'グループへ統合', description: mode === 'autonomous' ? '統合費用を抑え、早く運営開始。収益改善幅は控えめです。' : '初期統合費と長い準備期間を負担し、運営効率を高めます。', leadWeeks: marketIntegrationWeeks(stock, mode), weeklyProfitRange, integrationCost, upfrontCost: Math.max(0, quotePrice + integrationCost - holdingValue), refund: Math.max(0, holdingValue - quotePrice - integrationCost), weeklyIntegrationCost: integrationWeeklyCost(stock, mode) };
    });
    const reason = s.gameOver ? 'ゲームは終了しています。' : company ? '既にグループ傘下です。' : !known ? '経営調査を先に行ってください。' : d.requiresListing && !s.listed ? 'この規模の取得には上場が必要です。' : s.reputation < d.minReputation ? `信用${d.minReputation}以上が必要です。` : s.cash < choices[0].upfrontCost ? '取得資金が不足しています。' : '';
    return { stockId: stock.id, name: stock.name, market: stock.market ?? 'Standard', profile: stock.profile ?? 'cyclical', isFund: d.isFund, researched: known, researchCost: d.researchCost, minReputation: d.minReputation, requiresListing: d.requiresListing,
      status: company ? s.week < company.readyWeek ? 'integrating' : 'owned' : reason ? 'locked' : 'available', unlocked: !reason, reason, quotePrice, portfolioCredit: Math.min(quotePrice, holdingValue), upfrontCost: choices[0].upfrontCost, refund: choices[0].refund, leadWeeks: choices[0].leadWeeks, remainingWeeks: company ? Math.max(0, company.readyWeek - s.week) : 0,
      weeklyProfitRange: choices[0].weeklyProfitRange, risks: [d.isFund ? 'REITの運用資産取得を単純化したゲーム取引です。実在ファンドの買収ではありません。' : '友好的な全事業取得を単純化したゲーム取引です。実在企業の買収ではありません。', `景気・個別業績の変動幅は基準収益に対し最大約${Math.round(d.risk * 100)}%。`, '準備期間にも運営準備費がかかります。取得後は通常の株式売買と受取配当の対象外です。', ...(known ? [`ゲーム内の経営状態：${quality(s, stock).label}。実在企業の経営評価ではありません。`] : ['経営調査でゲーム内の経営状態と見込収益の幅を確認できます。'])], quality: known ? quality(s, stock).label : null, choices };
  });
}
export function applyMarketAcquisitionAction(state: GameState, action: MarketAcquisitionAction): GameState {
  if (state.gameOver) throw new Error('ゲームは終了しています。');
  const stock = STOCKS.find(x => x.id === action.stockId); if (!stock) throw new Error('取得対象が見つかりません。');
  if (isMarketCompanyOwned(state, stock.id)) throw new Error('既にグループ傘下です。');
  const s = structuredClone(state); s.marketAcquisitions ??= { research: [], companies: [] };
  const d = marketCompanyDefinition(stock);
  if (action.type === 'researchMarketCompany') {
    if (researched(s, stock.id)) throw new Error('この会社の調査は完了しています。');
    if (s.cash < d.researchCost) throw new Error('調査資金が不足しています。');
    s.cash -= d.researchCost; s.marketAcquisitions.research.push({ stockId: stock.id, week: s.week }); return s;
  }
  if (action.mode !== 'autonomous' && action.mode !== 'integrated') throw new Error('統合方針が不正です。');
  const target = getMarketAcquisitionTargets(s).find(t => t.stockId === stock.id)!;
  if (!target.unlocked) throw new Error(target.reason);
  const choice = target.choices.find(c => c.mode === action.mode)!;
  if (s.cash < choice.upfrontCost) throw new Error('統合費用を含む取得資金が不足しています。');
  s.cash = money(s.cash - choice.upfrontCost + choice.refund);
  s.positions = s.positions.filter(p => p.stockId !== stock.id);
  s.marketAcquisitions.companies.push({ stockId: stock.id, mode: action.mode, acquiredWeek: s.week, readyWeek: s.week + choice.leadWeeks });
  return s;
}
