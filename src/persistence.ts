import type { GameState, DealOffer, MarketOperationProject } from './model';
import { getCanonicalDealOffer, getRealizedDealBenefit, isDealOfferId } from './sim/deals';
import { LOTS, ACQUISITION_TARGETS } from './data/district';
import { STOCKS } from './data/stocks';
import { marketIntegrationWeeks } from './sim/marketAcquisitions';
import { getMarketOperationSettlement, MARKET_OPERATION_PROJECT_LIMIT, MARKET_OPERATION_TERM_WEEKS } from './sim/marketOperations';
import { marketOperationCohort } from './sim/marketBusinessMath';
import { DEVELOPMENT_CHOICES } from './sim/development';
import { OPENING_RECORD_LIMIT } from './sim/openingJournal';
import { RAIL_PROJECT_CHOICES } from './sim/railProjects';
import { isWeeklyNewsDigest } from './sim/weeklyNews';
const lotIds = new Set(LOTS.map(l => l.id));
const stockIds = new Set(STOCKS.map(s => s.id));
const stockSectors = new Set(STOCKS.map(s => s.sector));
const subsidiaryIds = new Set(ACQUISITION_TARGETS.map(t => t.id));

const DATABASE = 'shibuya-capital-v1';
const MAX_BYTES = 8 * 1024 * 1024;
let expectedRevision: number | null = null;
declare const damagedPrimaryTokenBrand: unique symbol;
export type DamagedPrimaryToken = { readonly [damagedPrimaryTokenBrand]: true };
export type SaveErrorKind = 'save' | 'invalid-data' | 'damaged-primary' | 'unavailable' | 'conflict';
export class SaveError extends Error {
  constructor(message: string, public readonly kind: SaveErrorKind = 'save', public readonly replacementToken?: DamagedPrimaryToken) { super(message); this.name = 'SaveError'; }
}
export interface SaveGameOptions { replaceDamagedPrimary?: DamagedPrimaryToken }
let damagedPrimary: { token: DamagedPrimaryToken; revision: number } | null = null;
type Obj = Record<string, unknown>;
function fail(): never { throw new SaveError('セーブデータの形式・数値・参照が不正です。', 'invalid-data'); }
function obj(v: unknown): Obj { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); const o = v as Obj; if (Object.keys(o).some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) fail(); return o; }
function str(v: unknown, max = 160): string { if (typeof v !== 'string' || !v.trim() || v.length > max) fail(); return v; }
function num(v: unknown, min = -1e18, max = 1e18, integer = false): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v))) fail(); return v; }
function bool(v: unknown) { if (typeof v !== 'boolean') fail(); }
function choice(v: unknown, choices: string[]) { if (typeof v !== 'string' || !choices.includes(v)) fail(); }
function array(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max) fail(); return v; }
function fields(o: Obj, names: string[], min = -1e18, max = 1e18, integer = false) { names.forEach(n => num(o[n], min, max, integer)); }
function uniqueRows(v: unknown, key: string, validate: (o: Obj) => void, max = 10000) { const seen = new Set<string>(); return array(v, max).map(row => { const o = obj(row); const id = str(o[key], 120); if (seen.has(id)) fail(); seen.add(id); validate(o); return o; }); }
function uniqueStrings(value: unknown, max: number, length: number): string[] {
  const values = array(value, max).map(v => str(v, length));
  if (new Set(values).size !== values.length) fail();
  return values;
}
function validateDeals(value: unknown, state: Obj) {
  const deals = obj(value); const week = Number(state.week);
  const validateOffer = (offer: Obj) => {
    str(offer.id, 120); choice(offer.category, ['system', 'marketing', 'property']);
    ['title', 'salesperson', 'supplier'].forEach(k => str(offer[k], 200)); str(offer.pitch, 2000);
    if (offer.supplierStockId !== undefined && !stockIds.has(str(offer.supplierStockId, 120))) fail();
    fields(offer, ['upfrontCost', 'weeklyFee', 'advertisedWeeklyBenefit', 'advertisedAnnualYield', 'conservativeWeeklyBenefit', 'optimisticWeeklyBenefit', 'investigationCost', 'cancellationFee', 'residualValue'], 0);
    const created = num(offer.createdWeek, 1, week, true);
    num(offer.expiresWeek, created, 1000000, true); num(offer.termWeeks, 1, 1000000, true); num(offer.leadWeeks, 0, Number(offer.termWeeks), true);
    if (Number(offer.optimisticWeeklyBenefit) < Number(offer.conservativeWeeklyBenefit) || Number(offer.residualValue) > Number(offer.upfrontCost)) fail();
    bool(offer.investigated); array(offer.signals, 30).forEach(v => str(v, 2000)); array(offer.investigationNotes, 30).forEach(v => str(v, 2000));
    const canonical = getCanonicalDealOffer(state as unknown as GameState, offer as unknown as DealOffer);
    if (!canonical || Object.entries(canonical).some(([key, expected]) => JSON.stringify(offer[key]) !== JSON.stringify(expected))) fail();
  };
  uniqueRows(deals.offers, 'id', validateOffer, 10000);
  const contractOffers = new Set<string>(); const activeCategories = new Set<string>();
  uniqueRows(deals.contracts, 'id', contract => {
    const offer = obj(contract.offer); validateOffer(offer);
    const offerId = String(offer.id); if (contractOffers.has(offerId)) fail(); contractOffers.add(offerId);
    const sourceOffer = (deals.offers as Obj[]).find(candidate => candidate.id === offerId);
    if (sourceOffer && Object.keys(offer).some(key => JSON.stringify(offer[key]) !== JSON.stringify(sourceOffer[key]))) fail();
    if (contract.id !== `contract-${offerId}`) fail();
    const start = num(contract.startWeek, Number(offer.createdWeek), Math.min(week, Number(offer.expiresWeek)), true);
    const reveal = num(contract.revealWeek, start, 2000000, true); const end = num(contract.endWeek, start + 1, 2000000, true);
    if (reveal !== start + Number(offer.leadWeeks) || end !== start + Number(offer.termWeeks)) fail();
    choice(contract.status, ['active', 'cancelled', 'completed']);
    if (contract.status === 'active') { const category = String(offer.category); if (activeCategories.has(category) || week >= end) fail(); activeCategories.add(category); }
    if (contract.status === 'completed' && week + 1 < end) fail();
    fields(contract, ['cumulativeBenefit', 'cumulativeFees'], 0);
    const elapsed = Math.min(Number(offer.termWeeks), week - start + 1);
    if (Number(contract.cumulativeFees) > elapsed * Number(offer.weeklyFee)) fail();
    const realizedMaximum = getRealizedDealBenefit(state as unknown as GameState, offer as unknown as DealOffer);
    if (Number(contract.cumulativeBenefit) > Math.max(0, Math.min(Number(offer.termWeeks) - Number(offer.leadWeeks), week - reveal + 1)) * realizedMaximum) fail();
    if (contract.realizedWeeklyBenefit !== undefined) { num(contract.realizedWeeklyBenefit, 0); if (week < reveal || contract.realizedWeeklyBenefit !== getRealizedDealBenefit(state as unknown as GameState, offer as unknown as DealOffer)) fail(); }
  }, 10000);
  uniqueStrings(deals.generatedBatches, 10000, 120).forEach(batch => {
    const match = /^(cafe|property)-(0|[1-9]\d*)$/.exec(batch);
    if (!match || Number(match[2]) > Math.floor((week - 1) / (match[1] === 'property' ? 26 : 12))) fail();
  });
  uniqueStrings(deals.dismissed, 10000, 120).forEach(id => { if (!isDealOfferId(id)) fail(); });
  if (deals.lastTickWeek !== undefined) num(deals.lastTickWeek, 1, week, true);
}
function validateStoreAccounts(value: unknown, results: Obj[]) {
  const byId = new Map(results.map(result => [String(result.id), result]));
  const keys = ['ingredients', 'fulfilment', 'labor', 'rent', 'equipment', 'marketing', 'manager'];
  uniqueRows(value, 'storeId', account => {
    if (Object.keys(account).some(key => !['storeId', 'costs', 'roundingAdjustment'].includes(key))) fail();
    const result = byId.get(String(account.storeId)); if (!result) fail();
    const costs = obj(account.costs);
    if (Object.keys(costs).some(key => !keys.includes(key))) fail();
    let sum = 0;
    for (const key of keys) sum = num(sum + num(costs[key], 0, Number.MAX_SAFE_INTEGER, true), 0, Number.MAX_SAFE_INTEGER, true);
    const adjustment = num(account.roundingAdjustment, -4, 4, true);
    const revenue = num(result.revenue, 0, Number.MAX_SAFE_INTEGER, true), profit = num(result.profit, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true);
    const total = num(sum + adjustment, 0, Number.MAX_SAFE_INTEGER, true);
    if (total !== num(revenue - profit, 0, Number.MAX_SAFE_INTEGER, true)) fail();
  }, results.length);
}
function validateMarketOperations(value: unknown, state: Obj) {
  const operations = obj(value);
  if (Object.keys(operations).some(key => key !== 'projects')) fail();
  let previousEnd = 0;
  for (const value of array(operations.projects, MARKET_OPERATION_PROJECT_LIMIT)) {
    const project = obj(value);
    if (Object.keys(project).some(key => !['sector', 'policy', 'startWeek', 'endWeek'].includes(key))) fail();
    if (!stockSectors.has(str(project.sector))) fail();
    choice(project.policy, ['growth', 'stability']);
    const start = num(project.startWeek, 1, Number(state.week), true);
    const end = num(project.endWeek, start + 1, 1000000 + MARKET_OPERATION_TERM_WEEKS, true);
    if (end !== start + MARKET_OPERATION_TERM_WEEKS || start < previousEnd) fail();
    previousEnd = end;
    if (!state.listed || !state.marketAcquisitions || !marketOperationCohort(state as unknown as GameState, project as unknown as MarketOperationProject).length) fail();
  }
}
function validateMarketOperationSettlement(value: unknown, report: Obj, state: Obj) {
  const settlement = obj(value);
  const keys = ['sector', 'policy', 'startWeek', 'endWeek', 'week', 'baselineProfit', 'operatingProfit', 'weeklyCost', 'profitDelta'];
  if (Object.keys(settlement).some(key => !keys.includes(key))) fail();
  if (!stockSectors.has(str(settlement.sector))) fail();
  choice(settlement.policy, ['growth', 'stability']);
  const start = num(settlement.startWeek, 1, Number(state.week) - 1, true);
  const end = num(settlement.endWeek, start + 1, 1000000 + MARKET_OPERATION_TERM_WEEKS, true);
  const week = num(settlement.week, start, Math.min(end - 1, Number(state.week) - 1), true);
  if (end !== start + MARKET_OPERATION_TERM_WEEKS || week !== report.week) fail();
  fields(settlement, ['baselineProfit', 'operatingProfit', 'profitDelta'], -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true);
  num(settlement.weeklyCost, 0, Number.MAX_SAFE_INTEGER, true);
  if (settlement.profitDelta !== Number(settlement.operatingProfit) - Number(settlement.baselineProfit)) fail();
  const game = state as unknown as GameState;
  if (!game.marketOperations?.projects.some(project => project.sector === settlement.sector && project.policy === settlement.policy && project.startWeek === start && project.endWeek === end)) fail();
  // Current-week acquisitions must not alter a previously closed week's group
  // overhead or result. Ownership records retain the exact historical cohort.
  const historical = { ...game, week, marketAcquisitions: game.marketAcquisitions && { ...game.marketAcquisitions, companies: game.marketAcquisitions.companies.filter(company => company.acquiredWeek <= week) } };
  const expected = getMarketOperationSettlement(historical);
  if (!expected || Object.entries(expected).some(([key, value]) => settlement[key] !== value)) fail();
}
/** Validate before either serialization or use: imports are untrusted data. */
export function validateGame(value: unknown): GameState {
  const s = obj(value); if (s.version !== 1) throw new SaveError('このセーブのバージョンには対応していません。', 'invalid-data');
  str(s.id, 120); str(s.companyName, 120); num(s.seed, 0, 0xffffffff, true); num(s.week, 0, 1000000, true);
  fields(s, ['cash']); fields(s, ['reputation'], 0, 100); fields(s, ['sharesOutstanding', 'founderShares', 'profitableWeeks', 'totalCustomers'], 0, 1e18, true);
  num(s.sharePrice, 0); num(s.dividendPayout, 0, 1); if (Number(s.founderShares) > Number(s.sharesOutstanding)) fail();
  bool(s.listed); bool(s.gameOver); if (s.gameOverReason !== null) str(s.gameOverReason, 1000);
  if (s.railProjects !== undefined) {
    const rail = obj(s.railProjects);
    if (Object.keys(rail).some(k => k !== 'projects')) fail();
    uniqueRows(rail.projects, 'districtId', project => {
      if (Object.keys(project).some(k => !['districtId', 'choiceId', 'startWeek', 'completeWeek'].includes(k))) fail();
      choice(project.districtId, ['center', 'dogenzaka', 'miyashita', 'sakuragaoka']);
      const definition = RAIL_PROJECT_CHOICES.find(c => c.id === project.choiceId);
      if (!definition) fail();
      const startWeek = num(project.startWeek, 1, Number(s.week), true);
      if (num(project.completeWeek, 1, 1000006, true) !== startWeek + definition.weeks) fail();
      if (!s.listed) fail();
    }, 4);
  }
  if (s.development !== undefined) {
    const development = obj(s.development);
    if (Object.keys(development).some(k => k !== 'programs')) fail();
    uniqueRows(development.programs, 'districtId', p => {
      if (Object.keys(p).some(k => !['districtId', 'completedChoiceIds', 'construction'].includes(k))) fail();
      choice(p.districtId, ['center', 'dogenzaka', 'miyashita', 'sakuragaoka']);
      const completed = array(p.completedChoiceIds, 3);
      completed.forEach((id, phase) => { str(id, 120); const c = DEVELOPMENT_CHOICES.find(c => c.id === id); if (!c || c.districtId !== p.districtId || c.phase !== phase) fail(); });
      if (p.construction !== undefined) {
        const construction = obj(p.construction);
        if (Object.keys(construction).some(k => !['choiceId', 'startWeek', 'completeWeek'].includes(k))) fail();
        const id = str(construction.choiceId, 120), c = DEVELOPMENT_CHOICES.find(c => c.id === id);
        if (!c || c.districtId !== p.districtId || c.phase !== completed.length || completed.length >= 3) fail();
        const start = num(construction.startWeek, 1, Number(s.week), true);
        const end = num(construction.completeWeek, Number(s.week), 1000012, true);
        if (end !== start + c.weeks) fail();
      }
    }, 4);
  }
  if (s.marketAcquisitions !== undefined) {
    const group = obj(s.marketAcquisitions);
    if (Object.keys(group).some(k => !['research', 'companies'].includes(k))) fail();
    const researchWeeks = new Map<string, number>();
    uniqueRows(group.research, 'stockId', r => {
      if (Object.keys(r).some(k => !['stockId', 'week'].includes(k)) || !stockIds.has(String(r.stockId))) fail();
      researchWeeks.set(String(r.stockId), num(r.week, 1, Number(s.week), true));
    }, STOCKS.length);
    const acquiredIds = new Set<string>();
    uniqueRows(group.companies, 'stockId', c => {
      if (Object.keys(c).some(k => !['stockId', 'mode', 'acquiredWeek', 'readyWeek'].includes(k))) fail();
      const stock = STOCKS.find(x => x.id === c.stockId); if (!stock) fail();
      choice(c.mode, ['autonomous', 'integrated']);
      const acquiredWeek = num(c.acquiredWeek, 1, Number(s.week), true);
      const readyWeek = num(c.readyWeek, 1, 1000006, true);
      if (readyWeek !== acquiredWeek + marketIntegrationWeeks(stock, c.mode as 'autonomous' | 'integrated')) fail();
      const researchWeek = researchWeeks.get(stock.id); if (researchWeek === undefined || researchWeek > acquiredWeek) fail();
      acquiredIds.add(stock.id);
    }, STOCKS.length);
    if (array(s.positions, 10000).some(row => acquiredIds.has(String(obj(row).stockId)))) fail();
  }
  if (s.marketOperations !== undefined) validateMarketOperations(s.marketOperations, s);
  const storeLots = new Set<string>();
  const stores = uniqueRows(s.stores, 'id', o => { str(o.lotId, 120); if (!lotIds.has(String(o.lotId))) fail(); if (storeLots.has(String(o.lotId))) fail(); storeLots.add(String(o.lotId)); str(o.name); choice(o.style, ['standard', 'premium', 'takeaway']); fields(o, ['price', 'marketing', 'revenue', 'customers'], 0); fields(o, ['quality', 'satisfaction'], 0, 100); num(o.staff, 0, 100000, true); num(o.level, 1, 1000, true); num(o.openedWeek, 0, Number(s.week), true); num(o.profit); bool(o.manager); });
  if (s.openingRecords !== undefined) {
    let priorDecisionWeek = 0, priorSequence = 0;
    const pendingStores = new Set<string>();
    uniqueRows(s.openingRecords, 'id', record => {
      if (Object.keys(record).some(k => !['id', 'storeId', 'lotId', 'storeName', 'style', 'decisionWeek', 'openingCost', 'cashBefore', 'cashAfter', 'netProfitBefore', 'netProfitAfter', 'initialStoreProfit', 'companyStoreCount', 'result', 'closedWeek'].includes(k))) fail();
      const decisionWeek = num(record.decisionWeek, 1, Number(s.week), true);
      const match = /^opening-([1-9]\d*)-([1-9]\d*)$/.exec(String(record.id));
      if (!match || Number(match[1]) !== decisionWeek || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) <= priorSequence || decisionWeek < priorDecisionWeek) fail();
      priorDecisionWeek = decisionWeek; priorSequence = Number(match[2]);
      const selectedLot = LOTS.find(l => l.id === record.lotId);
      if (!selectedLot?.available || record.storeId !== `store-${selectedLot.id}-${decisionWeek}`) fail();
      str(record.storeName, 40); choice(record.style, ['standard', 'premium', 'takeaway']);
      fields(record, ['openingCost', 'cashAfter'], 0, 1e18, true);
      num(record.cashBefore, 0);
      if (Math.round(Number(record.cashBefore) - Number(record.openingCost)) !== record.cashAfter) fail();
      fields(record, ['netProfitBefore', 'netProfitAfter', 'initialStoreProfit']);
      num(record.companyStoreCount, 1, LOTS.filter(l => l.available).length, true);
      if (record.result !== undefined && record.closedWeek !== undefined) fail();
      if (record.result !== undefined) {
        const result = obj(record.result);
        if (Object.keys(result).some(k => !['week', 'companyNetProfit', 'cashChange', 'storeProfit', 'customers'].includes(k))) fail();
        if (num(result.week, decisionWeek, Number(s.week) - 1, true) !== decisionWeek) fail();
        fields(result, ['companyNetProfit', 'cashChange', 'storeProfit']); num(result.customers, 0);
      } else if (record.closedWeek !== undefined) {
        if (num(record.closedWeek, decisionWeek, Number(s.week), true) !== decisionWeek) fail();
      } else {
        const currentStore = stores.find(store => store.id === record.storeId);
        if (decisionWeek !== s.week || !currentStore || currentStore.lotId !== record.lotId || currentStore.openedWeek !== decisionWeek || pendingStores.has(String(record.storeId))) fail();
        pendingStores.add(String(record.storeId));
      }
    }, OPENING_RECORD_LIMIT);
  }
  uniqueRows(s.loans, 'id', o => { fields(o, ['principal', 'remaining', 'weeklyPayment'], 0); num(o.annualRate, 0, 10); num(o.weeksLeft, 0, 1000000, true); });
  const propertyLots = new Set<string>();
  uniqueRows(s.properties, 'id', o => { const lot = str(o.lotId, 120); if (!lotIds.has(lot)) fail(); if (propertyLots.has(lot)) fail(); propertyLots.add(lot); fields(o, ['purchasePrice', 'weeklyIncome'], 0); num(o.occupancy, 0, 1); num(o.level, 1, 1000, true); });
  const prices = obj(s.stockPrices); if (Object.keys(prices).length > 10000) fail(); Object.entries(prices).forEach(([k, v]) => { str(k, 120); if (!stockIds.has(k)) fail(); num(v, 0); }); if (STOCKS.some(stock => !Object.hasOwn(prices, stock.id))) fail();
  uniqueRows(s.positions, 'stockId', o => { if (!Object.hasOwn(prices, String(o.stockId))) fail(); num(o.shares, 0, 1e18, true); num(o.averageCost, 0); });
  uniqueRows(s.subsidiaries, 'id', o => { if (!subsidiaryIds.has(String(o.id))) fail(); str(o.name); choice(o.sector, ['food', 'property', 'rail']); num(o.purchasePrice, 0); num(o.weeklyProfit); num(o.risk, 0, 1); });
  let previousWeek = -1; array(s.history, 100000).forEach(row => { const o = obj(row); const week = num(o.week, 0, Number(s.week), true); if (week <= previousWeek) fail(); previousWeek = week; fields(o, ['cash', 'profit']); fields(o, ['revenue', 'valuation'], 0); num(o.stores, 0, 10000, true); });
  array(s.milestones, 10000).forEach(v => str(v, 500));
  const settings = obj(s.settings); choice(settings.quality, ['low', 'medium', 'high']); bool(settings.sound);
  if (s.lastReport !== null) {
    const r = obj(s.lastReport); num(r.week, 0, Number(s.week), true); fields(r, ['revenue', 'interest', 'loanRepayment', 'dividendsReceived', 'dividendsPaid', 'customers'], 0); fields(r, ['operatingProfit', 'netProfit', 'cashChange']); array(r.headlines, 100).forEach(v => str(v, 1000));
    const results = uniqueRows(r.storeResults, 'id', o => { fields(o, ['revenue', 'customers'], 0); num(o.profit); num(o.satisfaction, 0, 100); });
    if (Object.hasOwn(r, 'storeAccounts')) validateStoreAccounts(r.storeAccounts, results);
    if (Object.hasOwn(r, 'news') && !isWeeklyNewsDigest(r.news, Number(r.week))) fail();
    if (Object.hasOwn(r, 'marketOperation')) validateMarketOperationSettlement(r.marketOperation, r, s);
  }
  if (s.deals !== undefined) validateDeals(s.deals, s);
  void stores;
  // Clone severs imported object references and rejects oversized saves before IndexedDB work.
  const json = JSON.stringify(s); if (new TextEncoder().encode(json).length > MAX_BYTES) throw new SaveError('セーブが上限の8MBを超えています。', 'invalid-data');
  return JSON.parse(json) as GameState;
}
interface Envelope { format: 'shibuya-capital'; schema: 1; savedAt: string; checksum: string; payload: string }
interface Stored { key: string; revision: number; week: number; companyName: string; envelope: Envelope }
async function hash(payload: string) { if (!globalThis.crypto?.subtle) throw new SaveError('安全な保存にはHTTPSまたはlocalhostが必要です。', 'unavailable'); const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)); return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''); }
export async function createEnvelope(state: GameState): Promise<Envelope> { const payload = JSON.stringify(validateGame(state)); return { format: 'shibuya-capital', schema: 1, savedAt: new Date().toISOString(), checksum: await hash(payload), payload }; }
export async function decodeEnvelope(value: unknown): Promise<GameState> { const e = obj(value); if (e.format !== 'shibuya-capital' || e.schema !== 1 || typeof e.payload !== 'string' || e.payload.length > MAX_BYTES || typeof e.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(e.checksum) || typeof e.savedAt !== 'string' || !Number.isFinite(Date.parse(e.savedAt))) fail(); if (await hash(e.payload) !== e.checksum) throw new SaveError('セーブの破損を検出しました。別のバックアップを選んでください。', 'invalid-data'); try { return validateGame(JSON.parse(e.payload)); } catch (error) { if (error instanceof SaveError) throw error; throw new SaveError('セーブを読み取れません。', 'invalid-data'); } }
function openDB(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { if (!globalThis.indexedDB) return reject(new SaveError('この環境ではIndexedDB保存を使用できません。')); const r = indexedDB.open(DATABASE, 1); r.onupgradeneeded = () => r.result.createObjectStore('saves', { keyPath: 'key' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new SaveError('保存領域を開けません。ブラウザの設定と空き容量を確認してください。')); r.onblocked = () => reject(new SaveError('別タブを閉じてから再試行してください。')); }); }
async function readAll(): Promise<Stored[]> { const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction('saves', 'readonly'); const r = tx.objectStore('saves').getAll(); tx.oncomplete = () => { db.close(); resolve(r.result as Stored[]); }; tx.onabort = tx.onerror = () => { db.close(); reject(new SaveError('保存データを読み取れません。')); }; }); }
export async function loadGame(): Promise<GameState | null> {
  const row = (await readAll()).find(r => r.key === 'primary');
  // Capture the revision with the row, before async decoding. An unavailable
  // crypto/storage environment must not grant permission to replace that row.
  const observedRevision = row?.revision ?? null;
  if (!row) { expectedRevision = null; damagedPrimary = null; return null; }
  try {
    const state = await decodeEnvelope(row.envelope);
    expectedRevision = observedRevision;
    damagedPrimary = null;
    return state;
  }
  catch (error) {
    if (!(error instanceof SaveError) || error.kind !== 'invalid-data') throw error;
    const token = Object.freeze({}) as DamagedPrimaryToken;
    expectedRevision = observedRevision;
    damagedPrimary = { token, revision: row.revision };
    throw new SaveError(error.message, 'damaged-primary', token);
  }
}
export async function saveGame(state: GameState, options: SaveGameOptions = {}): Promise<void> {
  if (damagedPrimary) {
    if (options.replaceDamagedPrimary !== damagedPrimary.token) throw new SaveError('読み込めない保存データを置き換えるには、復元・読み込み・新しい会社の設立を選び、置き換えを確認してください。', 'damaged-primary', damagedPrimary.token);
    if (expectedRevision !== damagedPrimary.revision) throw new SaveError('保存データの状態が変わりました。このタブを再読み込みしてください。', 'conflict');
  } else if (options.replaceDamagedPrimary) throw new SaveError('保存データの状態が変わりました。このタブを再読み込みしてください。', 'conflict');
  return writeGame(state, expectedRevision);
}
async function writeGame(state: GameState, revisionAtStart: number | null): Promise<void> {
  const envelope = await createEnvelope(state); const snapshot = JSON.parse(envelope.payload) as GameState; const db = await openDB();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('saves', 'readwrite'); const store = tx.objectStore('saves'); let conflict = false; let nextRevision = 0; const r = store.getAll();
    r.onsuccess = () => { const rows = r.result as Stored[]; const current = rows.find(v => v.key === 'primary'); if ((current?.revision ?? null) !== revisionAtStart) { conflict = true; tx.abort(); return; } nextRevision = (current?.revision ?? 0) + 1; const record: Stored = { key: 'primary', revision: nextRevision, week: snapshot.week, companyName: snapshot.companyName, envelope }; store.put(record); const backupKey = `backup:${snapshot.id}:${snapshot.week}`; store.put({ ...record, key: backupKey }); const backups = rows.filter(v => v.key.startsWith('backup:') && v.key !== backupKey).sort((a, b) => b.revision - a.revision); backups.slice(11).forEach(v => store.delete(v.key)); };
    tx.oncomplete = () => { expectedRevision = nextRevision; damagedPrimary = null; db.close(); resolve(); }; tx.onabort = tx.onerror = () => { db.close(); reject(new SaveError(conflict ? '別のタブがセーブを更新しました。このタブを再読み込みしてください。' : '保存できませんでした。空き容量とブラウザ設定を確認し、セーブを書き出してください。', conflict ? 'conflict' : 'save')); };
  });
}
export async function exportGame(state: GameState): Promise<void> { const envelope = await createEnvelope(state); const url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `shibuya-capital-week-${state.week}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
export async function importGame(file: File): Promise<GameState> { if (file.size > MAX_BYTES * 2) throw new SaveError('セーブファイルが大きすぎます。'); try { return await decodeEnvelope(JSON.parse(await file.text())); } catch (error) { if (error instanceof SaveError) throw error; throw new SaveError('有効なセーブJSONを選んでください。'); } }
export async function listBackups() { return (await readAll()).filter(r => r.key.startsWith('backup:')).sort((a, b) => b.revision - a.revision).map(r => ({ key: r.key, week: r.week, companyName: r.companyName, savedAt: r.envelope.savedAt })); }
export async function restoreBackup(key: string): Promise<GameState> { if (!key.startsWith('backup:')) fail(); const rows = await readAll(); const backup = rows.find(r => r.key === key); if (!backup) throw new SaveError('バックアップが見つかりません。'); const state = await decodeEnvelope(backup.envelope); // Explicit recovery can replace a corrupt primary, but still compares its revision atomically.
  await writeGame(state, rows.find(r => r.key === 'primary')?.revision ?? null); return state; }
export async function deleteSave(): Promise<void> { const db = await openDB(); await new Promise<void>((resolve, reject) => { const tx = db.transaction('saves', 'readwrite'); const store = tx.objectStore('saves'); const r = store.get('primary'); let conflict = false; r.onsuccess = () => { if ((r.result?.revision ?? null) !== expectedRevision) { conflict = true; tx.abort(); return; } store.clear(); }; tx.oncomplete = () => { expectedRevision = null; damagedPrimary = null; db.close(); resolve(); }; tx.onabort = tx.onerror = () => { db.close(); reject(new SaveError(conflict ? '別タブが更新しました。再読み込みしてください。' : 'セーブを削除できません。')); }; }); }
