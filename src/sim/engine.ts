import type { GameState, GameAction, Store, StoreStyle, WeeklyReport, CompanySummary, SiteEstimate, StoreAccount } from '../model';
import { LOTS, ACQUISITION_TARGETS } from '../data/district';
import { startDevelopment, getDevelopmentEffects, getDevelopmentFinancials, tickDevelopment, developmentHeadlines } from './development';
import { applyMarketAcquisitionAction, isMarketCompanyOwned, getMarketGroupFinancials } from './marketAcquisitions';
import { STOCKS } from '../data/stocks';
import { initializeDeals, applyDealAction, getDealFinancials, getDealAssetValue, getDealMaturityCash, tickDeals } from './deals';
import { recordOpening, settleOpeningRecords, closeOpeningRecords } from './openingJournal';
import { getRailProjectEffects, getRailProjectFinancials, railProjectHeadlines, startRailProject } from './railProjects';
import { quoteStockTrade, settleStockTradeCash } from './stockTrading';

const STYLES = { standard: { cost: 3_600_000, price: 580, quality: 65, capacity: 280, appeal: 1 }, premium: { cost: 4_800_000, price: 780, quality: 85, capacity: 210, appeal: 1.08 }, takeaway: { cost: 3_000_000, price: 450, quality: 55, capacity: 360, appeal: .96 } };
const round = (n: number) => Math.round(n);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function number(n: number, min: number, max = Number.MAX_SAFE_INTEGER, integer = false) { requireThat(Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n)), '入力した数値が範囲外です。'); }
function styleCheck(style: StoreStyle) { requireThat(Object.hasOwn(STYLES, style), '店舗形態が不正です。'); }
function lot(id: string) { const l = LOTS.find(x => x.id === id); requireThat(l, '区画が見つかりません。'); return l; }
function spend(s: GameState, amount: number) { requireThat(s.cash >= amount, '現預金が不足しています。'); s.cash = round(s.cash - amount); }
function noise(seed: number, week: number, key: string) { let n = (seed ^ Math.imul(week + 1, 2654435761)) >>> 0; for (const c of key) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; }
/** Bounded economic conditions avoid unbounded inflation invalidating century-long saves. */
export function operatingConditions(s: GameState) {
  const age = Math.max(0, s.week - 1);
  const cycle = Math.sin(age * Math.PI * 2 / 104);
  const wages = 1 + .18 * (1 - Math.exp(-age / 260)) + .025 * cycle;
  const rents = 1 + .15 * (1 - Math.exp(-age / 390));
  const demand = 1 + .07 * cycle;
  const unmanaged = s.stores.filter(st => !st.manager).length;
  const founderCapacity = 1 / (1 + Math.max(0, unmanaged - 3) * .15);
  const overhead = round(45_000 * Math.max(0, s.stores.length - 2) ** 1.6 + s.subsidiaries.reduce((n, asset) => n + Math.max(0, asset.weeklyProfit) * .06, 0) + 3_000 * Math.max(0, s.properties.length - 2));
  return { wages, rents, demand, founderCapacity, overhead };
}
function storeContext(s: GameState, st: Store) {
  const l = lot(st.lotId), spec = STYLES[st.style], economy = operatingConditions(s);
  const nearby = s.stores.filter(x => x.id !== st.id && Math.hypot(lot(x.lotId).x - l.x, lot(x.lotId).z - l.z) < 70).length;
  return { l, spec, economy, nearby, developmentBonus: getDevelopmentEffects(s, l.district).cafeDemandBonus + getRailProjectEffects(s, l.district).cafeDemandBonus };
}
type OutcomeMode = 'expected' | 'low' | 'high' | 'actual';
export interface EstimateRange { min: number; max: number }
export interface StoreResultRange { profit: EstimateRange; revenue: EstimateRange; customers: EstimateRange; satisfaction: EstimateRange }
export interface WeekOutlook {
  expected: WeeklyReport; netProfit: EstimateRange; cashChange: EstimateRange; cashAfter: EstimateRange; revenue: EstimateRange; customers: EstimateRange;
  /** Conservative possible outcomes, not probabilities or certain failure. */
  risk: { debtLossPossible: boolean; cashShortfallPossible: boolean };
}
const range = (values: number[]): EstimateRange => ({ min: Math.min(...values), max: Math.max(...values) });
/** Settlement-only draws: identity/setting changes never reroll the same district/lot/week. */
function storeOutcome(s: GameState, st: Store) {
  const district = lot(st.lotId).district;
  return { demand: 1 + .04 * (2 * noise(s.seed, s.week, 'v045:traffic:district:' + district) - 1) + .04 * (2 * noise(s.seed, s.week, 'v045:traffic:lot:' + st.lotId) - 1),
    capacity: 1 + (st.manager ? .02 : .04) * (2 * noise(s.seed, s.week, 'v045:condition:' + st.lotId) - 1) };
}
export type StoreOperatingSettings = Readonly<Pick<Store, 'price' | 'staff' | 'quality' | 'marketing' | 'manager' | 'style' | 'level'>>;
/** A detached current-week explanation, never part of a saved weekly report. */
export interface StoreOperatingInsight {
  readonly week: number;
  readonly storeId: string;
  readonly inputSettings: StoreOperatingSettings;
  readonly effectiveSettings: StoreOperatingSettings;
  /** Base-payroll + advertising allocation envelope, not actual wage expense. */
  readonly delegationBudget: number | null;
  readonly flow: Readonly<{ demand: number; capacity: number; customers: number; unservedDemand: number; unusedCapacity: number }>;
  readonly resultRange: Readonly<StoreResultRange>;
  readonly result: Readonly<WeeklyReport['storeResults'][number]>;
  /** Unrounded expense operands used by the authoritative profit calculation. */
  readonly costs: Readonly<{ ingredients: number; fulfilment: number; labor: number; rent: number; equipment: number; marketing: number; manager: number }>;
  /** Add to individually rounded expenses to reconcile revenue - expenses with result.profit. */
  readonly roundedCostAdjustment: number;
  readonly context: Readonly<{ nearbyStores: number; staffCapacityLimit: number; founderCapacity: number; ownsProperty: boolean; currentReputation: number }>;
}
function rawStoreCalculation(s: GameState, st: Store, context = storeContext(s, st), outcome = { demand: 1, capacity: 1 }) {
  const { l, spec, economy, nearby, developmentBonus } = context;
  const affluence = l.affluence > 3 ? l.affluence / 100 : l.affluence;
  const willingness = 390 + 240 * clamp(affluence, .3, 2) + st.quality * 2.3;
  const priceFit = clamp(Math.pow(willingness / st.price, 1.55), .15, 1.7);
  const awareness = 1 + Math.min(.45, Math.sqrt(st.marketing / 100_000) * .22) + s.reputation / 600;
  const demand = (1 + developmentBonus) * economy.demand * outcome.demand * l.footfall * .048 * spec.appeal * priceFit * (.65 + st.quality / 150) * awareness / (1 + nearby * .24 + Math.max(0, s.stores.length - 3) * .035);
  const staffCapacityLimit = 5 + (st.level - 1) * 1.4;
  const capacity = outcome.capacity * Math.min(st.staff, staffCapacityLimit) * spec.capacity * (1 + (st.level - 1) * .18) * (st.manager ? 1.08 : economy.founderCapacity);
  const customers = round(Math.min(demand, capacity));
  const satisfaction = round(clamp(55 + st.quality * .45 - Math.max(0, st.price / willingness - 1) * 40 - Math.max(0, demand / Math.max(1, capacity) - 1) * 12 + (st.manager ? 6 : 0), 10, 100));
  const revenue = round(customers * st.price);
  const ingredient = customers * (70 + st.quality * 1.15);
  const fulfilment = revenue * .12; // Packaging, payment fees, waste and delivery mix.
  const ownsProperty = s.properties.some(p => p.lotId === l.id);
  const rent = ownsProperty ? 0 : l.rent * economy.rents;
  const labor = st.staff * 52_000 * economy.wages, equipment = 28_000 * st.level, manager = st.manager ? 72_000 * economy.wages : 0;
  // Preserve the original subtraction order and final rounding; do not sum rounded costs here.
  const profit = round(revenue - ingredient - fulfilment - labor - rent - equipment - st.marketing - manager);
  return {
    result: { id: st.id, revenue, profit, customers, satisfaction },
    flow: { demand, capacity, customers, unservedDemand: Math.max(0, demand - capacity), unusedCapacity: Math.max(0, capacity - demand) },
    costs: { ingredients: ingredient, fulfilment, labor, rent, equipment, marketing: st.marketing, manager },
    context: { nearbyStores: nearby, staffCapacityLimit, founderCapacity: economy.founderCapacity, ownsProperty, currentReputation: s.reputation },
  };
}
/** Full bounded corners; negative per-customer margin can reverse profit order. */
function storeResultRange(s: GameState, effective: Store): StoreResultRange {
  const context = storeContext(s, effective), spread = effective.manager ? .02 : .04;
  const results = [.92, 1.08].flatMap(demand => [1 - spread, 1 + spread].map(capacity => rawStoreCalculation(s, effective, context, { demand, capacity }).result));
  return { profit: range(results.map(r => r.profit)), revenue: range(results.map(r => r.revenue)), customers: range(results.map(r => r.customers)), satisfaction: range(results.map(r => r.satisfaction)) };
}
function rawStoreResult(s: GameState, st: Store, context = storeContext(s, st)) {
  // Keep the five-field report/save contract; diagnostics must not escape into storeResults.
  return rawStoreCalculation(s, st, context).result;
}
/** Preserve broad legacy money ranges; unrepresentable display accounts are simply absent. */
function settledStoreAccount(calculation: ReturnType<typeof rawStoreCalculation>): StoreAccount | null {
  const { result, costs: raw } = calculation;
  const costs = { ingredients: round(raw.ingredients), fulfilment: round(raw.fulfilment), labor: round(raw.labor), rent: round(raw.rent), equipment: round(raw.equipment), marketing: round(raw.marketing), manager: round(raw.manager) };
  if (!Number.isSafeInteger(result.revenue) || result.revenue < 0 || !Number.isSafeInteger(result.profit)) return null;
  let sum = 0;
  for (const cost of Object.values(costs)) {
    if (!Number.isSafeInteger(cost) || cost < 0) return null;
    sum += cost;
    if (!Number.isSafeInteger(sum)) return null;
  }
  const total = result.revenue - result.profit, roundingAdjustment = total - sum;
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(roundingAdjustment) || Math.abs(roundingAdjustment) > 4 || sum + roundingAdjustment !== total) return null;
  return { storeId: result.id, costs, roundingAdjustment };
}
/** Delegation reallocates the existing payroll + advertising envelope; no capital spending. */
export function managerPlan(s: GameState, st: Store): Store {
  if (!st.manager) return st;
  const budget = st.staff * 52_000 + st.marketing;
  const context = storeContext(s, st);
  let best = st, score = rawStoreResult(s, st, context).profit;
  const spec = STYLES[st.style];
  for (const price of [spec.price * .85, spec.price, spec.price * 1.15, spec.price * 1.3].map(round))
    for (const quality of [spec.quality - 10, spec.quality, Math.min(100, spec.quality + 10)])
      for (const staff of [2, 3, 4, 5, 6, 8])
        for (const marketing of [0, 10_000, 30_000]) {
          if (staff * 52_000 + marketing > budget) continue;
          const candidate = { ...st, price, quality, staff, marketing }, result = rawStoreResult(s, candidate, context);
          if (result.satisfaction >= 65 && result.profit > score) { best = candidate; score = result.profit; }
        }
  return best;
}
function storeResult(s: GameState, st: Store) { return rawStoreResult(s, managerPlan(s, st)); }
function operatingSettings(st: Store): StoreOperatingSettings {
  const { price, staff, quality, marketing, manager, style, level } = st;
  return { price, staff, quality, marketing, manager, style, level };
}
/** Same effective manager plan and calculation as previewWeek; no action, save or reputation forecast. */
export function getStoreOperatingInsight(s: GameState, storeId: string): StoreOperatingInsight | null {
  const input = s.stores.find(st => st.id === storeId);
  if (!input) return null;
  const effective = managerPlan(s, input), calculation = rawStoreCalculation(s, effective);
  const { revenue, profit } = calculation.result;
  return {
    week: s.week, storeId,
    inputSettings: operatingSettings(input), effectiveSettings: operatingSettings(effective),
    delegationBudget: input.manager ? input.staff * 52_000 + input.marketing : null,
    ...calculation, resultRange: storeResultRange(s, effective),
    roundedCostAdjustment: revenue - profit - Object.values(calculation.costs).reduce((sum, cost) => sum + round(cost), 0),
  };
}
function normal(seed: number, week: number, key: string) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, noise(seed, week, key + ':u')))) * Math.cos(2 * Math.PI * noise(seed, week, key + ':v'));
}
/** Reference prices anchor simulated fundamentals, never a live trading feed. */
function fundamental(base: number, week: number) { return base * Math.exp(Math.min(8, .02 * (week - 1) / 52)); }
export function createGame(companyName = '渋谷珈琲ホールディングス', seed = 765): GameState {
  number(seed, 0, 4294967295, true); requireThat(typeof companyName === 'string' && companyName.trim().length > 0 && companyName.trim().length <= 40, '会社名は1〜40文字で入力してください。');
  return { version: 1, id: `shibuya-${seed}`, companyName: companyName.trim(), seed, week: 1, cash: 12_000_000, reputation: 10, stores: [], loans: [], properties: [], positions: [], stockPrices: Object.fromEntries(STOCKS.map(x => [x.id, x.basePrice])), subsidiaries: [], listed: false, sharesOutstanding: 1_000_000, founderShares: 1_000_000, sharePrice: 12, dividendPayout: 0, profitableWeeks: 0, totalCustomers: 0, history: [], lastReport: null, milestones: [], gameOver: false, gameOverReason: null, settings: { quality: 'medium', sound: false } };
}
function calculateWeek(s: GameState, mode: OutcomeMode, plans = s.stores.map(st => managerPlan(s, st))): WeeklyReport {
  const marketGroup = getMarketGroupFinancials(s, mode);
  const development = getDevelopmentFinancials(s);
  const railProjects = getRailProjectFinancials(s);
  const deal = getDealFinancials(s, mode);
  const maturityCash = getDealMaturityCash(s);
  const storeAccounts: StoreAccount[] = [];
  const storeResults = plans.map(st => {
    if (mode === 'actual') {
      const calculation = rawStoreCalculation(s, st, storeContext(s, st), storeOutcome(s, st)), account = settledStoreAccount(calculation);
      if (account) storeAccounts.push(account);
      return calculation.result;
    }
    const result = rawStoreResult(s, st);
    if (mode === 'expected') return result;
    const limits = storeResultRange(s, st), side = mode === 'low' ? 'min' : 'max';
    // Independent conservative envelopes, not a jointly realized scenario/report.
    return { id: st.id, revenue: limits.revenue[side], profit: limits.profit[side], customers: limits.customers[side], satisfaction: limits.satisfaction[side] };
  });
  const revenue = storeResults.reduce((a, x) => a + x.revenue, 0);
  const economy = operatingConditions(s);
  const propertyGross = s.properties.reduce((a, p) => a + (s.stores.some(st => st.lotId === p.lotId) ? 0 : p.weeklyIncome * (1 + getDevelopmentEffects(s, lot(p.lotId).district).propertyYieldBonus + getRailProjectEffects(s, lot(p.lotId).district).propertyYieldBonus) * economy.rents * clamp(p.occupancy * (mode === 'actual' ? .94 + .06 * noise(s.seed, Math.floor(s.week / 13), p.id) : mode === 'low' ? .94 : mode === 'high' ? 1 : .97), 0, 1)), 0);
  const propertyCosts = s.properties.reduce((a, p) => a + p.purchasePrice * .006 / 52 * (1 + (p.level - 1) * .1), 0);
  const propertyIncome = propertyGross - propertyCosts;
  const subsidiaries = s.subsidiaries.reduce((a, p) => a + p.weeklyProfit * (.94 + (mode === 'actual' ? noise(s.seed, s.week, p.id) - .5 : mode === 'low' ? -.5 : mode === 'high' ? .5 : 0) * p.risk + Math.sin(s.week * Math.PI * 2 / 78) * p.risk * .35), 0);
  const operatingProfit = round(storeResults.reduce((a, x) => a + x.profit, 0) + propertyIncome + subsidiaries + deal.weeklyProfit + marketGroup.weeklyProfit - economy.overhead - development.weeklyUpkeep - railProjects.weeklyUpkeep);
  const interest = round(s.loans.reduce((a, l) => a + l.remaining * l.annualRate / 52, 0));
  const loanRepayment = round(s.loans.reduce((a, l) => a + Math.min(l.remaining, l.weeklyPayment), 0));
  const dividendsReceived = round(s.positions.reduce((a, p) => { const stock = STOCKS.find(x => x.id === p.stockId)!; return a + p.shares * fundamental(stock.basePrice, s.week) * stock.dividendYield / 52; }, 0));
  // Dividends and investment transactions never disguise an unprofitable operating business.
  const netProfit = operatingProfit - interest;
  const dividendsPaid = s.listed ? round(Math.max(0, netProfit) * s.dividendPayout) : 0;
  return { week: s.week, revenue: round(revenue + propertyGross + subsidiaries + deal.weeklyRevenue + marketGroup.weeklyRevenue), operatingProfit, interest, netProfit, loanRepayment, dividendsReceived, dividendsPaid, cashChange: netProfit + dividendsReceived - loanRepayment - dividendsPaid + maturityCash, customers: storeResults.reduce((a, x) => a + x.customers, 0), headlines: [...marketGroup.headlines.slice(0, 5), ...(marketGroup.operating || marketGroup.integrating ? [`市場企業グループ：稼働${marketGroup.operating}社・準備${marketGroup.integrating}社、営業利益 ${marketGroup.weeklyProfit.toLocaleString()}円／週。`] : []), ...developmentHeadlines(s), ...railProjectHeadlines(s), ...(railProjects.weeklyUpkeep ? [`沿線共同開発の維持費 ${railProjects.weeklyUpkeep.toLocaleString()}円／週を営業利益に反映。`] : []), ...(development.weeklyUpkeep ? [`地区開発の維持費 ${development.weeklyUpkeep.toLocaleString()}円／週を営業利益に反映。`] : []), ...(economy.overhead ? [`本部・グループ運営費 ${economy.overhead.toLocaleString()}円／週。店長なし店舗の運営能力 ${Math.round(economy.founderCapacity * 100)}%。`] : []), ...(deal.weeklyExpense || deal.weeklyRevenue ? [`営業提案の今週効果 ${deal.weeklyRevenue.toLocaleString()}円／継続費用 ${deal.weeklyExpense.toLocaleString()}円（営業利益に反映）。`] : []), ...(maturityCash ? [`契約満了の残存価値 ${maturityCash.toLocaleString()}円を現金回収（営業利益には含めません）。`] : []), ...(s.loans.some(l => l.remaining > 0) && netProfit <= 0 ? [mode === 'actual' ? '借入中の利益不足により経営を終了しました。' : '見込み利益がゼロ以下です。実績は週末に確定します。'] : []), ...(s.cash + netProfit + dividendsReceived - loanRepayment - dividendsPaid + maturityCash < 0 ? ['警告：週末の現預金が不足します。'] : []), ...(mode === 'actual' ? settlementCauses(s, plans) : []), netProfit > 0 ? (mode === 'actual' ? '利益を確保しました。次の投資機会を検討しましょう。' : '現在の計画は黒字見込みです。客足・運営状況で実績は変動します。') : '収支を見直す余地があります。価格・立地・人員を確認しましょう。'], storeResults, ...(storeAccounts.length ? { storeAccounts } : {}) };
}
/** Expected operating plan only. Never evaluates settlement-only draws. */
export function previewWeek(s: GameState): WeeklyReport { return calculateWeek(s, 'expected'); }
/** Bounded envelopes, not probabilities; all manager plans are chosen before outcomes. */
export function getWeekOutlook(s: GameState): WeekOutlook {
  const plans = s.stores.map(st => managerPlan(s, st));
  const expected = calculateWeek(s, 'expected', plans), low = calculateWeek(s, 'low', plans), high = calculateWeek(s, 'high', plans);
  const netProfit = range([low.netProfit, high.netProfit]);
  const cashChange = range([low.cashChange, high.cashChange]);
  const cashAfter = range([round(s.cash + cashChange.min), round(s.cash + cashChange.max)]);
  return { expected, netProfit, cashChange, cashAfter, revenue: range([low.revenue, high.revenue]), customers: range([low.customers, high.customers]),
    risk: { debtLossPossible: s.loans.some(l => l.remaining > 0) && netProfit.min <= 0, cashShortfallPossible: cashAfter.min < 0 } };
}
function settlementCauses(s: GameState, plans: Store[]): string[] {
  if (!plans.length) return [];
  const impacts = plans.map(st => {
    const outcome = storeOutcome(s, st), base = rawStoreResult(s, st), result = rawStoreCalculation(s, st, storeContext(s, st), outcome).result;
    return { st, outcome, result, delta: result.profit - base.profit };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return impacts.slice(0, 3).map(({ st, outcome, result }) => {
    const traffic = outcome.demand > 1.02 ? '客足が普段より多めで' : outcome.demand < .98 ? '客足が普段より落ち着き' : '普段並みの客足で';
    const operations = outcome.capacity < .98 ? ' 運営に小さな遅れが出ました。' : outcome.capacity > 1.02 ? ' 接客も順調でした。' : '';
    return `${st.name}：${traffic}、${result.customers.toLocaleString('ja-JP')}人が来店しました。${operations}`;
  });
}
export function getSummary(s: GameState): CompanySummary {
  const debt = round(s.loans.reduce((a, l) => a + l.remaining, 0));
  const portfolioValue = round(s.positions.reduce((a, p) => a + p.shares * s.stockPrices[p.stockId], 0));
  const propertyValue = round(s.properties.reduce((a, p) => a + p.purchasePrice * (1 + (p.level - 1) * .10), 0) + getDealAssetValue(s));
  const operatingAssets = s.stores.reduce((a, st) => a + STYLES[st.style].cost * .55 + (st.level - 1) * 600_000, 0) + s.subsidiaries.reduce((a, x) => a + x.purchasePrice, 0);
  const netWorth = round(s.cash + portfolioValue + propertyValue + operatingAssets + getDevelopmentFinancials(s).bookValue + getRailProjectFinancials(s).bookValue + getMarketGroupFinancials(s).bookValue - debt);
  const weeklyProfit = previewWeek(s).netProfit;
  const valuation = round(Math.max(1_000_000, netWorth + Math.max(0, weeklyProfit) * 104));
  const borrowingLimit = round(Math.max(0, 5_000_000 + propertyValue * .5 + operatingAssets * .4 + getMarketGroupFinancials(s).borrowCollateral + Math.max(0, weeklyProfit) * 26));
  const ipoRequirements = [{ label: '3店舗以上を運営', met: s.stores.length >= 3 }, { label: '累計12週の黒字', met: s.profitableWeeks >= 12 }, { label: '純資産2,000万円以上', met: netWorth >= 20_000_000 }, { label: '今週の予想利益が黒字', met: weeklyProfit > 0 }];
  return { debt, borrowingLimit, availableCredit: Math.max(0, borrowingLimit - debt), valuation, netWorth, weeklyProfit, portfolioValue, propertyValue, ownership: s.founderShares / s.sharesOutstanding, ipoEligible: !s.listed && ipoRequirements.every(x => x.met), ipoRequirements };
}
export function evaluateSite(s: GameState, lotId: string, style: StoreStyle = 'standard', manager = false): SiteEstimate {
  styleCheck(style); const l = lot(lotId), spec = STYLES[style];
  const st: Store = { id: '__estimate', lotId, name: '', style, price: spec.price, quality: spec.quality, staff: 4, manager, marketing: 10_000, level: 1, openedWeek: s.week, revenue: 0, profit: 0, customers: 0, satisfaction: 70 };
  const expanded = { ...s, stores: [...s.stores, st] };
  const r = storeResult(expanded, st);
  const incrementalProfit = previewWeek(expanded).operatingProfit - previewWeek(s).operatingProfit;
  return { openingCost: spec.cost, expectedRevenue: r.revenue, expectedProfit: incrementalProfit, weeklyRent: s.properties.some(p => p.lotId === lotId) ? 0 : round(l.rent * operatingConditions(s).rents), expectedCustomers: r.customers, competition: s.stores.filter(x => Math.hypot(lot(x.lotId).x - l.x, lot(x.lotId).z - l.z) < 70).length, annualYield: incrementalProfit * 52 / spec.cost };
}
export function applyAction(state: GameState, action: GameAction): GameState {
  requireThat(!state.gameOver || action.type === 'settings', 'ゲームは終了しています。新しい会社で再開してください。');
  const s = structuredClone(state);
  switch (action.type) {
    case 'researchMarketCompany': case 'acquireMarketCompany': return applyMarketAcquisitionAction(s, action);
    case 'startDevelopment': return startDevelopment(s, action.districtId, action.choiceId);
    case 'startRailProject': return startRailProject(s, action.districtId, action.choiceId);
    case 'acceptOffer': case 'declineOffer': case 'investigateOffer': case 'cancelContract': return applyDealAction(s, action);
    case 'openStore': {
      styleCheck(action.style); const l = lot(action.lotId); requireThat(l.available && !s.stores.some(x => x.lotId === l.id), 'この区画には出店できません。');
      const spec = STYLES[action.style]; const name = action.name?.trim() || `${l.name}店`; requireThat(name.length <= 40, '店舗名は40文字以内です。'); spend(s, spec.cost);
      s.stores.push({ id: `store-${l.id}-${s.week}`, lotId: l.id, name, style: action.style, price: spec.price, quality: spec.quality, staff: 4, manager: false, marketing: 10_000, level: 1, openedWeek: s.week, revenue: 0, profit: 0, customers: 0, satisfaction: 70 }); break;
    }
    case 'updateStore': {
      const st = s.stores.find(x => x.id === action.storeId); requireThat(st, '店舗が見つかりません。'); const c = action.changes;
      requireThat(Object.keys(c).every(k => ['name', 'price', 'quality', 'staff', 'manager', 'marketing', 'style'].includes(k)), '店舗設定が不正です。');
      if (c.price !== undefined) number(c.price, 200, 2500, true); if (c.quality !== undefined) number(c.quality, 20, 100, true); if (c.staff !== undefined) number(c.staff, 1, 30, true); if (c.marketing !== undefined) number(c.marketing, 0, 500_000, true); if (c.manager !== undefined) requireThat(typeof c.manager === 'boolean', '店長の設定が不正です。');
      if (c.name !== undefined) requireThat(typeof c.name === 'string' && c.name.trim().length > 0 && c.name.length <= 40, '店舗名は1〜40文字です。');
      if (c.style !== undefined) { styleCheck(c.style); if (c.style !== st.style) spend(s, 800_000); }
      Object.assign(st, c); break;
    }
    case 'upgradeStore': { const st = s.stores.find(x => x.id === action.storeId); requireThat(st && st.level < 5, '店舗がないか、最大レベルです。'); spend(s, 1_200_000 * st.level); st.level++; break; }
    case 'closeStore': { const st = s.stores.find(x => x.id === action.storeId); requireThat(st, '店舗が見つかりません。'); s.cash += round(STYLES[st.style].cost * .15); s.stores = s.stores.filter(x => x.id !== st.id); return closeOpeningRecords(s, st.id); }
    case 'borrow': { number(action.amount, 100_000, getSummary(s).availableCredit, true); number(action.weeks, 13, 260, true); const annualRate = .045 + Math.min(.055, getSummary(s).debt / Math.max(1, getSummary(s).valuation) * .08); s.loans.push({ id: `loan-${s.week}-${s.loans.length}-${s.cash}`, principal: action.amount, remaining: action.amount, annualRate, weeksLeft: action.weeks, weeklyPayment: action.amount / action.weeks }); s.cash += action.amount; break; }
    case 'repayLoan': { const l = s.loans.find(x => x.id === action.loanId); requireThat(l, '借入が見つかりません。'); spend(s, l.remaining); s.loans = s.loans.filter(x => x.id !== l.id); break; }
    case 'buyProperty': { const l = lot(action.lotId); requireThat(l.available && !s.properties.some(x => x.lotId === l.id), 'この物件は購入できません。'); spend(s, l.purchasePrice); s.properties.push({ id: `property-${l.id}`, lotId: l.id, purchasePrice: l.purchasePrice, level: 1, occupancy: .9, weeklyIncome: l.rent }); break; }
    case 'upgradeProperty': { const p = s.properties.find(x => x.id === action.propertyId); requireThat(p && p.level < 5, '物件がないか、最大レベルです。'); spend(s, round(p.purchasePrice * .12)); p.level++; p.weeklyIncome = round(p.weeklyIncome * 1.15); p.occupancy = Math.min(.98, p.occupancy + .02); break; }
    case 'sellProperty': { const p = s.properties.find(x => x.id === action.propertyId); requireThat(p, '物件が見つかりません。'); s.cash += round(p.purchasePrice * (1 + (p.level - 1) * .10) * .9); s.properties = s.properties.filter(x => x.id !== p.id); break; }
    case 'buyStock': case 'sellStock': { const stock = STOCKS.find(x => x.id === action.stockId); requireThat(stock, '銘柄が見つかりません。'); requireThat(!isMarketCompanyOwned(s, stock.id), 'グループ傘下の会社は通常の株式売買の対象外です。'); number(action.shares, 1, 1_000_000_000, true); const side = action.type === 'buyStock' ? 'buy' : 'sell', value = quoteStockTrade(s.stockPrices[stock.id], action.shares, side), cashAfter = settleStockTradeCash(s.cash, value, side); const p = s.positions.find(x => x.stockId === stock.id);
      if (action.type === 'buyStock') { s.cash = cashAfter; if (p) { p.averageCost = (p.averageCost * p.shares + value) / (p.shares + action.shares); p.shares += action.shares; } else s.positions.push({ stockId: stock.id, shares: action.shares, averageCost: value / action.shares }); }
      else { requireThat(p && p.shares >= action.shares, '保有株数が不足しています。'); p.shares -= action.shares; s.cash = cashAfter; s.positions = s.positions.filter(x => x.shares > 0); } break;
    }
    case 'acquire': { const t = ACQUISITION_TARGETS.find(x => x.id === action.targetId); requireThat(t && !s.subsidiaries.some(x => x.id === t.id), '買収対象が見つからないか、買収済みです。'); requireThat(s.reputation >= t.minReputation, `信用が不足しています。必要信用: ${t.minReputation}`); spend(s, t.price); s.subsidiaries.push({ id: t.id, name: t.name, sector: t.sector, purchasePrice: t.price, weeklyProfit: t.weeklyProfit, risk: t.risk }); break; }
    case 'ipo': { const summary = getSummary(s); requireThat(summary.ipoEligible, '上場条件を満たしていません。'); s.sharePrice = summary.valuation / s.sharesOutstanding; const issued = round(s.sharesOutstanding * .25); s.sharesOutstanding += issued; s.cash += round(issued * s.sharePrice); s.listed = true; s.milestones.push('IPO達成'); break; }
    case 'issueShares': { requireThat(s.listed, '増資には上場が必要です。'); number(action.fraction, .01, .25); const issued = Math.max(1, round(s.sharesOutstanding * action.fraction)); requireThat(s.founderShares / (s.sharesOutstanding + issued) >= .2, '創業者持分20%以上を維持する必要があります。'); s.sharePrice = getSummary(s).valuation / s.sharesOutstanding; s.cash += round(issued * s.sharePrice * .95); s.sharesOutstanding += issued; break; }
    case 'setDividend': requireThat(s.listed, '配当には上場が必要です。'); number(action.payout, 0, .8); s.dividendPayout = action.payout; break;
    case 'settings': { requireThat(Object.keys(action.changes).every(k => ['quality', 'sound'].includes(k)), '設定が不正です。'); if (action.changes.quality !== undefined) requireThat(['low', 'medium', 'high'].includes(action.changes.quality), '描画品質が不正です。'); if (action.changes.sound !== undefined) requireThat(typeof action.changes.sound === 'boolean', '音声設定が不正です。'); Object.assign(s.settings, action.changes); break; }
    default: throw new Error('操作が不正です。');
  }
  if (action.type === 'openStore') {
    const opened = s.stores[s.stores.length - 1];
    return recordOpening(s, opened, previewWeek(state), previewWeek(s), state.cash, STYLES[action.style].cost);
  }
  return s;
}
export function advanceWeek(state: GameState): GameState {
  requireThat(!state.gameOver, 'ゲームは終了しています。'); let s = structuredClone(state); const plans = state.stores.map(st => managerPlan(state, st)); const r = calculateWeek(s, 'actual', plans); const hadDebt = s.loans.some(l => l.remaining > 0);
  s.cash = round(s.cash + r.cashChange); s.lastReport = r; s.totalCustomers += r.customers; if (r.netProfit > 0) s.profitableWeeks++;
  for (const st of s.stores) { Object.assign(st, plans.find(plan => plan.id === st.id)!); const result = r.storeResults.find(x => x.id === st.id)!; Object.assign(st, result); }
  s.loans = s.loans.map(l => ({ ...l, remaining: Math.max(0, l.remaining - Math.min(l.remaining, l.weeklyPayment)), weeksLeft: l.weeksLeft - 1 })).filter(l => l.remaining > .01 && l.weeksLeft > 0);
  if (hadDebt && r.netProfit <= 0) { s.gameOver = true; s.gameOverReason = '借入がある状態で、今週の営業利益から利息を引いた利益がゼロ以下になりました。'; }
  else if (s.cash < 0) { s.gameOver = true; s.gameOverReason = '週末の支払いに必要な現預金が不足しました。'; }
  const avgSat = r.storeResults.length ? r.storeResults.reduce((a, x) => a + x.satisfaction, 0) / r.storeResults.length : 50;
  const reputationTarget = s.stores.length ? clamp((avgSat - 35) * 1.7 + (r.netProfit > 0 ? 5 : -15), 0, 100) : Math.max(10, s.reputation - .5);
  s.reputation = clamp(s.reputation + (reputationTarget - s.reputation) * .035, 0, 100);
  for (const stock of STOCKS) {
    const sigma = stock.volatility;
    const anchor = fundamental(stock.basePrice, s.week);
    const shock = .55 * normal(s.seed, s.week, 'market') + .35 * normal(s.seed, s.week, 'sector:' + stock.sector) + Math.sqrt(1 - .55 ** 2 - .35 ** 2) * normal(s.seed, s.week, 'stock:' + stock.id);
    const reversion = clamp(Math.log(anchor / s.stockPrices[stock.id]) * .006, -.025, .025);
    const logReturn = .04 / 52 - sigma * sigma / 2 + reversion + sigma * shock;
    s.stockPrices[stock.id] = Math.max(1, Math.min(1e12, round(s.stockPrices[stock.id] * Math.exp(clamp(logReturn, -.6, .6)) * 100) / 100));
  }
  if (s.deals?.contracts.some(c => c.status === 'active')) s = tickDeals(s);
  if (s.development?.programs.some(p => p.construction)) s = tickDevelopment(s);
  s.sharePrice = getSummary(s).valuation / s.sharesOutstanding;
  s.history.push({ week: s.week, cash: s.cash, profit: r.netProfit, revenue: r.revenue, valuation: getSummary(s).valuation, stores: s.stores.length });
  if (s.history.length > 520) s.history = s.history.slice(-520);
  if (s.stores.length >= 1 && !s.milestones.includes('渋谷で創業')) s.milestones.push('渋谷で創業');
  if (s.stores.length >= 3 && !s.milestones.includes('3店舗チェーン')) s.milestones.push('3店舗チェーン');
  s = settleOpeningRecords(s, r);
  s.week++; return s.stores.length ? initializeDeals(s) : s;
}
