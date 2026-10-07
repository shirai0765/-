import type { GameState, MarketOperationAction, MarketOperationPolicy, MarketOperationProject, MarketOperationSettlement } from '../model';
import { STOCKS } from '../data/stocks';
import { calculateMarketGroupFinancials, MARKET_OPERATION_RULES, MARKET_OPERATION_TERM_WEEKS, marketOperationCohort, marketOperationCosts } from './marketBusinessMath';
import type { MarketOutcomeMode } from './marketBusinessMath';

export { MARKET_OPERATION_TERM_WEEKS } from './marketBusinessMath';
export { marketOperationCohort as getMarketOperationCohort } from './marketBusinessMath';
export { marketOperationCosts as getMarketOperationCosts } from './marketBusinessMath';
export const MARKET_OPERATION_POLICIES = {
  growth: { id: 'growth' as const, name: '成長投資', description: '26週間、事業規模を伸ばす投資。固定運営費と大きい業績変動を負担します。', ...MARKET_OPERATION_RULES.growth },
  stability: { id: 'stability' as const, name: '安定運営', description: '26週間、収益の一部と初期費用を使い、景気・個別業績の変動を抑えます。', ...MARKET_OPERATION_RULES.stability },
};
export const MARKET_OPERATION_PROJECT_LIMIT = 40;
export function getActiveMarketOperation(s: GameState): MarketOperationProject | undefined {
  return s.marketOperations?.projects.find(project => project.startWeek <= s.week && s.week < project.endWeek);
}

export interface MarketOperationSector {
  sector: string; eligibleCount: number; integratingCount: number; baseValue: number;
  weeklyProfit: number; weeklyProfitRange: { min: number; max: number };
}
export function getMarketOperationSectors(s: GameState): MarketOperationSector[] {
  const companies = s.marketAcquisitions?.companies ?? [], active = getActiveMarketOperation(s);
  const sectors = [...new Set(companies.map(company => STOCKS.find(stock => stock.id === company.stockId)!.sector))];
  return sectors.map(sector => {
    const project = { sector, policy: 'growth' as const, startWeek: s.week, endWeek: s.week + MARKET_OPERATION_TERM_WEEKS };
    const eligibleCount = marketOperationCohort(s, project).length;
    const integratingCount = companies.filter(company => company.readyWeek > s.week && STOCKS.find(stock => stock.id === company.stockId)!.sector === sector).length;
    const expected = calculateMarketGroupFinancials(s, 'expected', active, sector);
    return { sector, eligibleCount, integratingCount, baseValue: marketOperationCosts(s, project).baseValue, weeklyProfit: expected.weeklyProfit,
      weeklyProfitRange: { min: calculateMarketGroupFinancials(s, 'low', active, sector).weeklyProfit, max: calculateMarketGroupFinancials(s, 'high', active, sector).weeklyProfit } };
  }).sort((a, b) => a.sector.localeCompare(b.sector, 'ja'));
}

/** Expected and envelope values only: this forecast never requests actual draws.
 * Ownership and group size stay at the quoted state. Further acquisitions can
 * change oversight costs; their cash and effects are not forecast here. */
export function getMarketOperationQuote(s: GameState, sector: string, policy: MarketOperationPolicy) {
  if (policy !== 'growth' && policy !== 'stability') throw new Error('事業運営方針が不正です。');
  if (!STOCKS.some(stock => stock.sector === sector)) throw new Error('対象業種が見つかりません。');
  const project: MarketOperationProject = { sector, policy, startWeek: s.week, endWeek: s.week + MARKET_OPERATION_TERM_WEEKS };
  const costs = marketOperationCosts(s, project), eligibleCount = marketOperationCohort(s, project).length;
  const active = getActiveMarketOperation(s);
  const reason = s.gameOver ? 'ゲームは終了しています。' : !s.listed ? '事業投資には上場が必要です。' : active ? `進行中の事業投資が第${active.endWeek}週に終了するまで、新しい計画を開始できません。` : !eligibleCount ? 'この業種に稼働済みの傘下企業がありません。' : s.cash < costs.upfrontCost ? '初回支払の資金が不足しています。' : '';
  let expectedContribution = 0, minContribution = 0, maxContribution = 0;
  let expectedOperatingProfit = 0, expectedBaselineProfit = 0;
  for (let week = project.startWeek; week < project.endWeek; week++) {
    const future = { ...s, week };
    const expectedBase = calculateMarketGroupFinancials(future, 'expected'), expectedPlan = calculateMarketGroupFinancials(future, 'expected', project);
    expectedContribution += expectedPlan.weeklyProfit - expectedBase.weeklyProfit;
    expectedOperatingProfit += expectedPlan.weeklyProfit;
    expectedBaselineProfit += expectedBase.weeklyProfit;
    // Effects use the same shock in the plan and its counterfactual. Stability's
    // contribution decreases as outcomes improve, so its envelope is reversed.
    const lowerMode = policy === 'growth' ? 'low' : 'high', upperMode = policy === 'growth' ? 'high' : 'low';
    const lowerDelta = calculateMarketGroupFinancials(future, lowerMode, project).weeklyProfit - calculateMarketGroupFinancials(future, lowerMode).weeklyProfit;
    const upperDelta = calculateMarketGroupFinancials(future, upperMode, project).weeklyProfit - calculateMarketGroupFinancials(future, upperMode).weeklyProfit;
    // Aggregate rounding can differ from a corner realization by at most two
    // yen. Extend outwards instead of presenting an exact correlated endpoint.
    minContribution += lowerDelta - 2;
    maxContribution += upperDelta + 2;
  }
  return { sector, policy, project, eligibleCount, ...costs, canStart: !reason, reason,
    cashAfter: s.cash - costs.upfrontCost, expectedOperatingProfit, expectedBaselineProfit,
    expectedNetContribution: expectedContribution - costs.upfrontCost,
    netContributionRange: { min: minContribution - costs.upfrontCost, max: maxContribution - costs.upfrontCost },
    weeklyProfitRange: { min: calculateMarketGroupFinancials(s, 'low', project).weeklyProfit, max: calculateMarketGroupFinancials(s, 'high', project).weeklyProfit },
  };
}

export function applyMarketOperationAction(state: GameState, action: MarketOperationAction): GameState {
  if (action.type !== 'startMarketOperation') throw new Error('事業投資の操作が不正です。');
  const quote = getMarketOperationQuote(state, action.sector, action.policy);
  if (!quote.canStart) throw new Error(quote.reason);
  const s = structuredClone(state);
  s.cash -= quote.upfrontCost;
  s.marketOperations ??= { projects: [] };
  s.marketOperations.projects.push(quote.project);
  s.marketOperations.projects = s.marketOperations.projects.slice(-MARKET_OPERATION_PROJECT_LIMIT);
  return s;
}

export function getMarketOperationFinancialEffects(s: GameState, mode: MarketOutcomeMode = 'expected') {
  const project = getActiveMarketOperation(s);
  if (!project) return undefined;
  const baseline = calculateMarketGroupFinancials(s, mode), operating = calculateMarketGroupFinancials(s, mode, project);
  return { project, baselineProfit: baseline.weeklyProfit, operatingProfit: operating.weeklyProfit,
    weeklyRevenueDelta: operating.weeklyRevenue - baseline.weeklyRevenue,
    weeklyExpenseDelta: operating.weeklyExpense - baseline.weeklyExpense,
    weeklyProfitDelta: operating.weeklyProfit - baseline.weeklyProfit, weeklyCost: marketOperationCosts(s, project).weeklyCost };
}
/** Called only while committing an actual settlement; never from a forecast UI. */
export function getMarketOperationSettlement(s: GameState): MarketOperationSettlement | undefined {
  const effects = getMarketOperationFinancialEffects(s, 'actual');
  if (!effects) return undefined;
  return { ...effects.project, week: s.week, baselineProfit: effects.baselineProfit, operatingProfit: effects.operatingProfit, weeklyCost: effects.weeklyCost, profitDelta: effects.weeklyProfitDelta };
}

/** Reconstructs only closed weeks under fixed v1 formulas, with each historical
 * ownership cohort. A later acquisition cannot change an earlier result. */
export function getMarketOperationOutcome(s: GameState, project: MarketOperationProject) {
  if (!s.marketOperations?.projects.some(saved => saved.sector === project.sector && saved.policy === project.policy && saved.startWeek === project.startWeek && saved.endWeek === project.endWeek) || project.startWeek > s.week) throw new Error('保存された事業投資の記録がありません。');
  const end = Math.min(s.week, project.endWeek), costs = marketOperationCosts(s, project);
  let baselineProfit = 0, operatingProfit = 0, settledWeeks = 0;
  for (let week = project.startWeek; week < end; week++) {
    const historical = { ...s, week, marketAcquisitions: s.marketAcquisitions && { ...s.marketAcquisitions, companies: s.marketAcquisitions.companies.filter(company => company.acquiredWeek <= week) } };
    baselineProfit += calculateMarketGroupFinancials(historical, 'actual').weeklyProfit;
    operatingProfit += calculateMarketGroupFinancials(historical, 'actual', project).weeklyProfit;
    settledWeeks++;
  }
  return { project, settledWeeks, complete: s.week >= project.endWeek, baselineProfit, operatingProfit,
    weeklyCosts: costs.weeklyCost * settledWeeks, upfrontCost: costs.upfrontCost,
    netContribution: operatingProfit - baselineProfit - costs.upfrontCost };
}
