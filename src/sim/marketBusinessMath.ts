import type { GameState, MarketAcquisitionMode, MarketOperationProject, StockDefinition } from '../model';
import { STOCKS } from '../data/stocks';

export type MarketOutcomeMode = 'expected' | 'low' | 'high' | 'actual';
export const MARKET_OPERATION_TERM_WEEKS = 26;
export const MARKET_OPERATION_RULES = {
  growth: { upfrontRate: .006, weeklyRate: .0004, revenueFactor: 1.3, riskIncrease: .2, riskFactor: 1 },
  stability: { upfrontRate: .0015, weeklyRate: 0, revenueFactor: .97, riskIncrease: 0, riskFactor: .5 },
} as const;

// These v1 operations formulas also reconstruct settled program outcomes. Keep
// their arithmetic and RNG keys stable when changing other simulation systems.
export function marketRoll(seed: number, key: string) { let h = (seed ^ 2166136261) >>> 0; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const money = Math.round;
/** Deliberately compressed GAME enterprise values. Not market capitalization or real valuations. */
export function marketCompanyDefinition(stock: StockDefinition) {
  const market = stock.market ?? 'Standard';
  const bounds = market === 'Prime' ? [90000000, 280000000] : market === 'REIT' ? [110000000, 260000000] : market === 'Growth' ? [12000000, 65000000] : [24000000, 90000000];
  const baseValue = money((bounds[0] + (bounds[1] - bounds[0]) * marketRoll(173, stock.id)) / 100000) * 100000;
  const risk = stock.profile === 'speculative' ? .5 : stock.profile === 'growth' ? .35 : stock.profile === 'cyclical' ? .28 : .14;
  const annualYield = market === 'REIT' ? .08 : stock.profile === 'speculative' ? .19 : stock.profile === 'growth' ? .17 : stock.profile === 'cyclical' ? .14 : .105;
  return { baseValue, risk, annualYield, researchCost: money(Math.max(30000, baseValue * .001)), minReputation: market === 'Prime' ? 70 : market === 'REIT' ? 65 : market === 'Growth' ? 40 : 50, requiresListing: market === 'Prime' || market === 'REIT' || baseValue >= 50000000, isFund: market === 'REIT' };
}
export function marketCompanyQuality(s: GameState, stock: StockDefinition) { const r = marketRoll(s.seed, 'operations:' + stock.id); return r < .23 ? { label: '再建余地' as const, factor: .62 } : r > .77 ? { label: '優良' as const, factor: 1.2 } : { label: '標準' as const, factor: .92 }; }
export function marketCompanyBaseline(s: GameState, stock: StockDefinition, mode: MarketAcquisitionMode) { const d = marketCompanyDefinition(stock); return d.baseValue * d.annualYield / 52 * marketCompanyQuality(s, stock).factor * (mode === 'integrated' ? 1.12 : .92); }
export function marketIntegrationWeeklyCost(stock: StockDefinition, mode: MarketAcquisitionMode) { return money(marketCompanyDefinition(stock).baseValue * (mode === 'integrated' ? .00025 : .00008)); }
export function marketOperationCohort(s: GameState, project: MarketOperationProject) {
  return (s.marketAcquisitions?.companies ?? []).filter(company => company.acquiredWeek <= project.startWeek && company.readyWeek <= project.startWeek && STOCKS.find(stock => stock.id === company.stockId)?.sector === project.sector);
}
export function marketOperationCosts(s: GameState, project: MarketOperationProject) {
  const baseValue = marketOperationCohort(s, project).reduce((total, company) => total + marketCompanyDefinition(STOCKS.find(stock => stock.id === company.stockId)!).baseValue, 0);
  const rule = MARKET_OPERATION_RULES[project.policy];
  const upfrontCost = money(baseValue * rule.upfrontRate), weeklyCost = money(baseValue * rule.weeklyRate);
  return { baseValue, upfrontCost, weeklyCost, totalWeeklyCost: weeklyCost * MARKET_OPERATION_TERM_WEEKS, reserveRequired: upfrontCost + weeklyCost * MARKET_OPERATION_TERM_WEEKS };
}
export function marketCompanyWeekRevenue(s: GameState, stock: StockDefinition, companyMode: MarketAcquisitionMode, mode: MarketOutcomeMode, program?: MarketOperationProject) {
  const d = marketCompanyDefinition(stock);
  const cycle = Math.sin(s.week * Math.PI * 2 / 104 + marketRoll(91, stock.sector) * Math.PI * 2) * .45;
  const shock = mode === 'actual' ? (marketRoll(s.seed, `${s.week}:${stock.id}:operations`) - .5) * 1.1 : mode === 'low' ? -.55 : mode === 'high' ? .55 : 0;
  if (!program) return marketCompanyBaseline(s, stock, companyMode) * (1 + d.risk * (cycle + shock));
  const rule = MARKET_OPERATION_RULES[program.policy], risk = Math.min(.85, d.risk * rule.riskFactor + rule.riskIncrease);
  return marketCompanyBaseline(s, stock, companyMode) * rule.revenueFactor * (1 + risk * (cycle + shock));
}
/** Original aggregate rounding is retained, including its outward one-yen bounds. */
export function calculateMarketGroupFinancials(s: GameState, mode: MarketOutcomeMode = 'expected', program?: MarketOperationProject, sector?: string) {
  const companies = s.marketAcquisitions?.companies ?? [];
  const active = program && s.week >= program.startWeek && s.week < program.endWeek ? program : undefined;
  const cohort = new Set(active ? marketOperationCohort(s, active).map(company => company.stockId) : []);
  let weeklyRevenue = 0, weeklyExpense = 0, bookValue = 0, operating = 0, integrating = 0;
  const headlines: string[] = [];
  for (const company of companies) {
    const stock = STOCKS.find(x => x.id === company.stockId)!;
    if (sector !== undefined && stock.sector !== sector) continue;
    const d = marketCompanyDefinition(stock); bookValue += d.baseValue * .4;
    if (s.week < company.readyWeek) { integrating++; weeklyExpense += marketIntegrationWeeklyCost(stock, company.mode); continue; }
    operating++;
    const revenue = marketCompanyWeekRevenue(s, stock, company.mode, mode, cohort.has(company.stockId) ? active : undefined);
    weeklyRevenue += revenue;
    weeklyExpense += revenue * (.04 + Math.min(.14, companies.length * .0014));
    if (s.week === company.readyWeek) headlines.push(`${stock.name}の${d.isFund ? '保有資産運用' : '事業運営'}が開始しました。`);
  }
  // Program fees are separate from percentage oversight and charged once a week.
  if (active && (sector === undefined || sector === active.sector)) weeklyExpense += marketOperationCosts(s, active).weeklyCost;
  weeklyRevenue = money(weeklyRevenue); weeklyExpense = money(weeklyExpense); bookValue = money(bookValue);
  if (operating && mode === 'low') weeklyExpense++;
  if (operating && mode === 'high') weeklyExpense = Math.max(0, weeklyExpense - 1);
  return { weeklyRevenue, weeklyExpense, weeklyProfit: weeklyRevenue - weeklyExpense, bookValue, borrowCollateral: money(bookValue * .25), operating, integrating, headlines };
}
