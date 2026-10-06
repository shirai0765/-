import type { DealAction, DealContract, DealOffer, DealState, GameState } from '../model';
import { STOCKS } from '../data/stocks';
const empty = (): DealState => ({ offers: [], contracts: [], generatedBatches: [], dismissed: [] });
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function roll(seed: number, key: string) { let h = seed >>> 0; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; }
function makeOffer(s: GameState, category: DealOffer['category'], costly: boolean, batch: string): DealOffer {
 const property = category === 'property';
 const upfrontCost = property ? (costly ? 32_000_000 : 24_000_000) : costly ? 180_000 : 80_000;
 const weeklyFee = property ? (costly ? 27_000 : 8_000) : costly ? 38_000 : 4_000;
 const supplier = STOCKS.find(x => property ? x.sector.includes('不動産') : (x.sector.includes('IT') || x.sector.includes('情報') || x.sector.includes('通信')));
 const conservativeWeeklyBenefit = property ? (costly ? 16_000 : 27_000) : costly ? 5_000 : 15_000;
 const optimisticWeeklyBenefit = property ? (costly ? 26_000 : 36_000) : costly ? 20_000 : 23_000;
 const advertisedWeeklyBenefit = costly ? (property ? 51_000 : 70_000) : optimisticWeeklyBenefit;
 return { id: `${batch}-${category}-${costly ? 'reach' : 'fit'}`, category, createdWeek: s.week, expiresWeek: s.week + 5,
  title: property ? (costly ? '駅近ワンルーム・満室想定提案' : '賃貸履歴付きワンルーム提案') : costly ? '集客保証プレミアム広告' : '在庫・発注支援システム',
  salesperson: costly ? '営業担当・速水' : '営業担当・青葉', supplier: supplier?.name ?? '渋谷業務支援', supplierStockId: supplier?.id,
  pitch: costly ? '最大の導入事例では高収益。掲載の利回りは満稼働時・諸費用控除前です。' : '既存の導入実績をもとに、控えめな計画をご提案します。',
  upfrontCost, weeklyFee, termWeeks: property ? 520 : 26, advertisedWeeklyBenefit, advertisedAnnualYield: advertisedWeeklyBenefit * 52 / upfrontCost,
  conservativeWeeklyBenefit: costly ? conservativeWeeklyBenefit * .7 : conservativeWeeklyBenefit * .8,
  optimisticWeeklyBenefit: costly ? advertisedWeeklyBenefit : optimisticWeeklyBenefit * 1.2,
  signals: costly ? ['利回りは費用控除前・最大事例です', '固定費が高く、稼働や集客の保証条件はありません', '同規模の実績は調査で確認できます'] : ['同規模店舗・賃貸履歴の資料があります', '売上保証はありません。効果には幅があります'],
  investigationCost: property ? 60_000 : 8_000, investigated: false, investigationNotes: [], cancellationFee: property ? 250_000 : costly ? 100_000 : 10_000,
  leadWeeks: property ? 4 : 2, residualValue: property ? Math.round(upfrontCost * (costly ? .7 : .9)) : 0 };
}
/** Immutable v2 catalogue. Existing unversioned offers retain their original economics. */
interface PitchSpec { key: string; category: DealOffer['category']; title: string; salesperson: string; upfront: number; fee: number; low: number; high: number; weeks: number; lead: number; cancellation: number; clue: string; tradeoff: string; residual?: number }
const CATALOG: PitchSpec[] = [
 { key:'pos', category:'system', title:'POS・モバイル注文導入', salesperson:'営業担当・真鍋', upfront:240000, fee:11000, low:5000, high:39000, weeks:26, lead:3, cancellation:30000, clue:'注文待ちが長い店舗の導入事例を提示。小規模店では効果が薄い場合があります。', tradeoff:'導入教育3週の間も利用料が発生。省力化が費用を上回るかを検証します。' },
 { key:'loyalty', category:'marketing', title:'近隣客向け会員アプリ', salesperson:'営業担当・日向', upfront:140000, fee:14000, low:4000, high:38000, weeks:26, lead:4, cancellation:20000, clue:'会員数より再来店率が重要。値引き原資を含む類似店舗の資料を確認できます。', tradeoff:'効果は値引き原資控除後。リピート客の増加まで4週待ちます。' },
 { key:'staffing', category:'system', title:'シフト最適化・採用支援', salesperson:'営業担当・藤沢', upfront:360000, fee:18000, low:7000, high:59000, weeks:39, lead:4, cancellation:70000, clue:'繁忙時間の欠員対策に強み。全時間帯の人件費削減は保証しません。', tradeoff:'採用・研修を含む4週の導入期間と長期契約。実績効果は追加人員費控除後です。' },
 { key:'electricity', category:'system', title:'厨房電力・省エネ診断', salesperson:'営業担当・森川', upfront:320000, fee:3000, low:2000, high:22000, weeks:52, lead:2, cancellation:15000, clue:'設備稼働時間により節電余地が変動。料金だけでなく設備償却も確認してください。', tradeoff:'低い週額費用と高い初期設備費。長く使っても回収できない場合があります。' },
 { key:'consultant', category:'marketing', title:'成長戦略・経営顧問パッケージ', salesperson:'営業担当・黒瀬', upfront:650000, fee:52000, low:4000, high:82000, weeks:26, lead:5, cancellation:180000, clue:'大規模チェーンの最大成功例を引用。現場支援の工数と類似企業の実績が調査対象です。', tradeoff:'5週の分析期間も顧問料が必要。広告利回りは最大成功例で回収保証はありません。' },
 { key:'inventory', category:'system', title:'複数店舗・共同仕入れ連携', salesperson:'営業担当・青葉', upfront:480000, fee:22000, low:8000, high:67000, weeks:39, lead:3, cancellation:60000, clue:'まとめ買い割引と廃棄リスクを両方確認。納品頻度を減らすと在庫が増えます。', tradeoff:'推定効果は廃棄原価と配送費控除後。固定期間の発注連携が必要です。' },
 { key:'catering', category:'marketing', title:'渋谷オフィス・法人ケータリング仲介', salesperson:'営業担当・小坂', upfront:280000, fee:25000, low:9000, high:68000, weeks:26, lead:3, cancellation:45000, clue:'法人商談は成約率に幅があります。手数料・追加食材費込みの実績を調査できます。', tradeoff:'効果は追加食材と配送費控除後。契約が決まらなくても仲介固定費は必要です。' },
 { key:'training', category:'system', title:'店長育成・多店舗監査', salesperson:'営業担当・橘', upfront:800000, fee:32000, low:11000, high:97000, weeks:52, lead:6, cancellation:100000, clue:'複数店の運営ばらつき改善を提案。研修参加だけでは定着を保証しません。', tradeoff:'研修期間6週は効果なし。効果は研修勤務コスト控除後の改善額です。' },
 { key:'residence', category:'property', title:'修繕履歴付き・中古ワンルーム', salesperson:'不動産担当・水野', upfront:27000000, fee:11000, low:14000, high:37000, weeks:520, lead:5, cancellation:280000, residual:21000000, clue:'過去の入居率と修繕履歴を開示。将来の入居継続や売却益を保証しません。', tradeoff:'推定賃料は空室・原状回復を織り込み、週額管理費は別途。売却残価は表示のゲーム条件です。' },
 { key:'leaseback', category:'property', title:'家賃見直し付き・サブリース物件', salesperson:'不動産担当・榊', upfront:38000000, fee:23000, low:15000, high:47000, weeks:520, lead:6, cancellation:650000, residual:24000000, clue:'広告は満室賃料を強調。賃料保証の見直し条件と修繕負担を精査できます。', tradeoff:'見直しリスクを織り込んだ定常週額を推定。高額な初期費用と低い残価に注意。' }
];
function catalogSpec(o: DealOffer) { const key = /-v[23]-([a-z]+)(?:-|$)/.exec(o.id)?.[1]; return CATALOG.find(x => x.key === key); }
/** Frozen observations, encoded in the v3 ID to avoid changing the save model. */
export interface DealContext { stores: number; observedStores: number; customers: number; lossMakingStores: number; reportWeek: number }
const CONTEXT_ID = /^cafe-(0|[1-9]\d*)-(system|marketing)-fit-v3-([a-z]+)-(0|[1-9]\d*)-(0|[1-9]\d*)-(0|[1-9]\d*)-(0|[1-9]\d*)-(0|[1-9]\d*)$/;
export function getDealContext(offer: Pick<DealOffer, 'id'>): DealContext | null {
 const m = CONTEXT_ID.exec(offer.id); if (!m || offer.id.length > 120 || !CATALOG.some(x => x.key === m[3] && x.category === m[2])) return null;
 const batch = Number(m[1]); if (!Number.isSafeInteger(batch) || batch > 83333) return null;
 const [stores, observedStores, customers, lossMakingStores, reportWeek] = m.slice(4).map(Number);
 if (![stores, observedStores, customers, lossMakingStores, reportWeek].every(Number.isSafeInteger) || stores < 1 || stores > 10000 || observedStores > stores || customers > 1e9 || lossMakingStores > observedStores || reportWeek > Math.min(1000000, (batch + 1) * 12) || (observedStores === 0 ? customers !== 0 || lossMakingStores !== 0 || reportWeek !== 0 : reportWeek < 1)) return null;
 return { stores, observedStores, customers, lossMakingStores, reportWeek };
}
export function isDealOfferId(id: string): boolean {
 return /^(cafe|property)-\d+-(system|marketing|property)-(fit|reach)(?:-v2-[a-z]+)?$/.test(id) || getDealContext({id}) !== null;
}
function captureContext(s: GameState): DealContext {
 const ids = new Set(s.stores.map(x => x.id));
 const rows = s.lastReport && s.lastReport.week <= s.week ? s.lastReport.storeResults.filter(x => ids.has(x.id)) : [];
 return { stores: s.stores.length, observedStores: rows.length, customers: Math.min(1e9, Math.round(rows.reduce((n, x) => n + x.customers, 0))), lossMakingStores: rows.filter(x => x.profit <= 0).length, reportWeek: rows.length ? s.lastReport!.week : 0 };
}
function contextKey(c: DealContext) { return [c.stores,c.observedStores,c.customers,c.lossMakingStores,c.reportWeek].join('-'); }
function contextFit(c: DealContext, spec: PitchSpec): number {
 // These are game proxies, not measured queue lengths, repeat rates, or supplier discounts.
 const traffic = c.observedStores ? Math.min(1, c.customers / c.observedStores / 1000) : 1;
 const scale = Math.min(1, c.stores / 5);
 switch (spec.key) {
  case 'pos': case 'electricity': return .25 + .75 * traffic;
  case 'inventory': return .25 + .75 * scale * traffic;
  case 'training': return .35 + .65 * scale;
  case 'staffing': return .4 + .6 * traffic;
  case 'consultant': return .35 + .65 * scale;
  case 'loyalty': return .55 + .45 * traffic;
  case 'catering': return .5 + .5 * (c.observedStores ? 1 - traffic : 1);
  default: return 1;
 }
}
function contextEvidence(c: DealContext, spec: PitchSpec): string[] {
 const snapshot = `提案作成時${c.stores}店舗。` + (c.observedStores ? `第${c.reportWeek}週決算の現存${c.observedStores}店舗で来店${c.customers.toLocaleString('ja-JP')}人、損益0以下${c.lossMakingStores}店舗。` : '対象店舗の決算実績は未観測。');
 const reason = ['pos','electricity','staffing'].includes(spec.key) ? '客数を稼働量の代理指標として評価。待ち時間・欠員・電力使用量は未計測です。' : ['inventory','training','consultant'].includes(spec.key) ? '店舗数を連携規模の代理指標として評価。実際の仕入割引・研修定着は未確定です。' : spec.key === 'catering' ? '既存客数が少ないほど追加受注の余地を見込みます。設備の空き・法人需要は未計測です。' : '来店実績を対象客数の代理指標として評価。再来店率は未計測です。';
 return [snapshot, reason, 'この提案の前提と効果幅は作成時に固定されます。以後の出退店や設定変更では再計算しません。'];
}
function effectiveSpec(o: DealOffer, spec: PitchSpec): PitchSpec {
 const c = getDealContext(o); if (!c) return spec;
 const fit = contextFit(c,spec); return {...spec,low:Math.round(spec.low*fit),high:Math.round(spec.high*fit)};
}
/** Complete term, no early cancellation; residual is cash recovery, not operating profit. */
export function getDealTermNetRange(o: DealOffer) {
 const paid = o.upfrontCost + o.weeklyFee * o.termWeeks + (o.investigated ? o.investigationCost : 0);
 const weeks = o.termWeeks - o.leadWeeks;
 return { low: o.conservativeWeeklyBenefit * weeks - paid + o.residualValue, high: o.optimisticWeeklyBenefit * weeks - paid + o.residualValue };
}
function robustRoll(seed: number, key: string) { let h = Math.floor(roll(seed,key)*4294967296); h ^= h >>> 16; h = Math.imul(h,0x7feb352d); h ^= h >>> 15; h = Math.imul(h,0x846ca68b); h ^= h >>> 16; return (h >>> 0)/4294967296; }
function outcomeKey(o: DealOffer) { return getDealContext(o) ? o.id.replace(/-v3-([a-z]+)-.*$/, '-v3-$1') : o.id; }
function researchedRange(s: GameState, o: DealOffer, spec: PitchSpec) {
 const bounded = effectiveSpec(o,spec);
 const spread = bounded.high-bounded.low, center = bounded.low + spread*(.2+.6*robustRoll(s.seed,outcomeKey(o)+':fit'));
 spec = bounded;
 return { low:Math.round(Math.max(spec.low,center-spread*.2)), high:Math.round(Math.min(spec.high,center+spread*.2)) };
}
function inspectCatalog(s: GameState, o: DealOffer, spec: PitchSpec) {
 const range = researchedRange(s,o,spec); o.investigated = true; o.conservativeWeeklyBenefit=range.low; o.optimisticWeeklyBenefit=range.high;
 const weeks = o.termWeeks-o.leadWeeks;
 o.investigationNotes=[`類似事例・契約条件の調査後推定。全期間の損益は約${Math.round((range.low*weeks-o.weeklyFee*o.termWeeks-o.upfrontCost+o.residualValue)/10000)}〜${Math.round((range.high*weeks-o.weeklyFee*o.termWeeks-o.upfrontCost+o.residualValue)/10000)}万円（解約なし・残価込み）。`, spec.tradeoff, '調査後も効果に幅があります。導入後の実績まで確定しません。'];
 if (getDealContext(o)) {
  const net = getDealTermNetRange(o);
  o.investigationNotes = [...contextEvidence(getDealContext(o)!,spec), `作成時の規模・客数に合わせた調査後推定。満了まで約${Math.round(net.low/10000)}〜${Math.round(net.high/10000)}万円（初期費・週額費・調査費・残価込み、解約なし）。`,spec.tradeoff,'調査後も効果に幅があります。導入後の実績まで確定しません。'];
 }
 return o;
}
function makeCatalogOffer(s: GameState, spec: PitchSpec, batch: string): DealOffer {
 const base = makeOffer(s,spec.category,false,batch), id = `${batch}-${spec.category}-fit-v2-${spec.key}`;
 const o: DealOffer = {...base,id,title:spec.title,salesperson:spec.salesperson,pitch:spec.clue,upfrontCost:spec.upfront,weeklyFee:spec.fee,termWeeks:spec.weeks,leadWeeks:spec.lead,cancellationFee:spec.cancellation,residualValue:spec.residual??0,investigationCost:spec.category==='property'?90000:15000,advertisedWeeklyBenefit:spec.high,advertisedAnnualYield:spec.high*52/spec.upfront,conservativeWeeklyBenefit:spec.low,optimisticWeeklyBenefit:spec.high,signals:[spec.clue,spec.tradeoff,'初期費用と導入待ちを含めた全期間の回収を比較してください。']};
 return o;
}
function makeContextOffer(s: GameState, spec: PitchSpec, batch: string, context = captureContext(s)): DealOffer {
 const o = makeCatalogOffer(s,spec,batch);
 o.id = `${batch}-${spec.category}-fit-v3-${spec.key}-${contextKey(context)}`;
 const bounded = effectiveSpec(o,spec);
 o.conservativeWeeklyBenefit = bounded.low; o.optimisticWeeklyBenefit = bounded.high;
 o.signals = [...o.signals, ...contextEvidence(context,spec)];
 return o;
}
/** Refresh is deterministic and non-mutating; old saves require no migration. */
export function initializeDeals(state: GameState): GameState {
 const s = structuredClone(state); s.deals ??= empty();
 if (!s.stores.length || s.gameOver) return s;
 const batch = `cafe-${Math.floor((s.week - 1) / 12)}`;
 if (!s.deals.generatedBatches.includes(batch)) {
  s.deals.generatedBatches.push(batch);
  const index = Math.floor((s.week-1)/12);
  if (index===0) s.deals.offers.push(makeOffer(s,'system',false,batch),makeOffer(s,'marketing',true,batch));
  else {
   const scale = s.stores.length >= 5 || s.listed ? 3 : s.stores.length >= 3 ? 2 : 1;
   const systems = CATALOG.filter(x=>x.category==='system' && (scale>=2 || !['inventory','training','staffing'].includes(x.key)) && (scale>=3 || x.key!=='training'));
   const marketing = CATALOG.filter(x=>x.category==='marketing' && (scale>=2 || x.key!=='catering'));
   s.deals.offers.push(makeContextOffer(s,systems[(index-1)%systems.length],batch),makeContextOffer(s,marketing[(index-1)%marketing.length],batch));
  }
 }
 const assets = s.cash + s.properties.reduce((a, p) => a + p.purchasePrice, 0) + s.subsidiaries.reduce((a, p) => a + p.purchasePrice, 0);
 const propertyBatch = `property-${Math.floor((s.week - 1) / 26)}`;
 if (assets >= 50_000_000 && !s.deals.generatedBatches.includes(propertyBatch)) {
  s.deals.generatedBatches.push(propertyBatch);
  if (Math.floor((s.week-1)/26)===0) s.deals.offers.push(makeOffer(s,'property',false,propertyBatch),makeOffer(s,'property',true,propertyBatch));
  else for (const spec of CATALOG.filter(x=>x.category==='property')) s.deals.offers.push(makeCatalogOffer(s,spec,propertyBatch));
 }
 return s;
}
export function getOffers(state: GameState): DealOffer[] {
 const s = initializeDeals(state), d = s.deals!;
 return d.offers.filter(o => o.expiresWeek >= s.week && !d.dismissed.includes(o.id) && !d.contracts.some(c => c.offer.id === o.id));
}
function actual(s: GameState, o: DealOffer) {
 const spec = catalogSpec(o); if (spec) { const range = researchedRange(s,o,spec); return Math.round(range.low+(range.high-range.low)*robustRoll(s.seed,outcomeKey(o)+':outcome')); }
 const costly = o.id.endsWith('reach'), property = o.category === 'property';
 const low = property ? (costly ? 16_000 : 27_000) : costly ? 5_000 : 15_000;
 const high = property ? (costly ? 26_000 : 36_000) : costly ? 20_000 : 23_000;
 return Math.round(low + (high - low) * roll(s.seed, o.id));
}
function active(s: GameState, c: DealContract) { return c.status === 'active' && s.week >= c.startWeek && s.week < c.endWeek; }
/** Conservative forecast before measurement; realized, reproducible result on settlement. Fees start immediately. */
export function getDealFinancials(s: GameState, settle: boolean | 'expected' | 'low' | 'high' | 'actual' = false) {
 let weeklyRevenue = 0, weeklyExpense = 0;
 for (const c of s.deals?.contracts ?? []) if (active(s, c)) {
  weeklyExpense += c.offer.weeklyFee;
  if (s.week >= c.revealWeek && (c.offer.category === 'property' || s.stores.length > 0)) {
   const expected = Math.round((c.offer.conservativeWeeklyBenefit + c.offer.optimisticWeeklyBenefit) / 2);
   weeklyRevenue += c.realizedWeeklyBenefit ?? (settle === true || settle === 'actual' ? actual(s, c.offer) : settle === 'high' ? Math.round(c.offer.optimisticWeeklyBenefit) : settle === 'expected' ? expected : Math.round(c.offer.conservativeWeeklyBenefit));
  }
 }
 return { weeklyRevenue, weeklyExpense, weeklyProfit: weeklyRevenue - weeklyExpense };
}
export function getDealAssetValue(s: GameState) { return (s.deals?.contracts ?? []).filter(c => c.status === 'active').reduce((n, c) => n + c.offer.residualValue, 0); }
export function applyDealAction(state: GameState, action: DealAction): GameState {
 check(!state.gameOver, 'ゲームは終了しています。'); const s = initializeDeals(state), d = s.deals!;
 const spend = (amount: number) => { check(s.cash >= amount, '現預金が不足しています。'); s.cash -= amount; };
 if (action.type === 'cancelContract') {
  const c = d.contracts.find(x => x.id === action.contractId); check(c && active(s, c), '有効な契約がありません。');
  check(s.cash + c.offer.residualValue >= c.offer.cancellationFee, '解約費用が不足しています。');
  s.cash += c.offer.residualValue - c.offer.cancellationFee; c.status = 'cancelled'; return s;
 }
 const o = getOffers(s).find(x => x.id === action.offerId); check(o, '提案が期限切れ、または見つかりません。');
 const offer = d.offers.find(x => x.id === o.id)!;
 if (action.type === 'declineOffer') { d.dismissed.push(o.id); return s; }
 if (action.type === 'investigateOffer') {
  check(!offer.investigated, '調査は完了しています。'); spend(o.investigationCost); offer.investigated = true;
  const spec = catalogSpec(offer); if (spec) { inspectCatalog(s,offer,spec); return s; }
  const costly = o.id.endsWith('reach'), property = o.category === 'property';
  offer.conservativeWeeklyBenefit = property ? (costly ? 16_000 : 27_000) : costly ? 5_000 : 15_000;
  offer.optimisticWeeklyBenefit = property ? (costly ? 26_000 : 36_000) : costly ? 20_000 : 23_000;
  offer.investigationNotes = [costly ? '同規模の実績では、固定費控除後の赤字リスクが高い提案です。' : '類似条件の実績から推定。実際の成果や回収は保証しません。', '表示範囲は週次の費用控除前効果。初期費用・解約料・導入待ち期間も別途考慮してください。']; return s;
 }
 check(action.type === 'acceptOffer', '営業アクションが不正です。');
 check(!d.contracts.some(c => c.status === 'active' && c.offer.category === o.category), '同じ種類の契約が稼働中です。');
 spend(o.upfrontCost);
 d.contracts.push({ id: `contract-${o.id}`, offer: structuredClone(offer), startWeek: s.week, revealWeek: s.week + o.leadWeeks, endWeek: s.week + o.termWeeks, status: 'active', cumulativeBenefit: 0, cumulativeFees: 0 });
 return s;
}
/** Call once on the closing week's state, AFTER report settlement and BEFORE week increments. No recurring cash debit here. */
export function tickDeals(state: GameState): GameState {
 const s = initializeDeals(state), d = s.deals!; if (d.lastTickWeek === s.week) return s;
 d.lastTickWeek = s.week;
 for (const c of d.contracts) if (active(s, c)) {
  if (c.startWeek === s.week) {
   const stock = STOCKS.find(x => x.id === c.offer.supplierStockId);
   if (stock && s.stockPrices[stock.id]) s.stockPrices[stock.id] *= 1 + Math.min(.0005, c.offer.upfrontCost * .1 / Math.max(stock.marketCap ?? 1e12, 1e9));
  }
  c.cumulativeFees += c.offer.weeklyFee;
  if (s.week >= c.revealWeek) { c.realizedWeeklyBenefit = actual(s, c.offer); if (c.offer.category === 'property' || s.stores.length > 0) c.cumulativeBenefit += c.realizedWeeklyBenefit; }
  if (s.week + 1 >= c.endWeek) { c.status = 'completed'; }
 }
 return s;
}

/** Capital release, not operating income. Engine adds this once to closing-week cashChange. */
export function getDealMaturityCash(s: GameState) { return (s.deals?.contracts ?? []).filter(c => active(s, c) && s.week + 1 >= c.endWeek).reduce((n, c) => n + c.offer.residualValue, 0); }
export function getRealizedDealBenefit(s: GameState, offer: DealOffer) { return actual(s, offer); }
/** Rebuild saved offer economics from deterministic catalogue; checksum is not a security boundary. */
export function getCanonicalDealOffer(s: GameState, offer: DealOffer): DealOffer | null {
 const spec = catalogSpec(offer);
 if (offer.id.includes('-v3-')) {
  const context = getDealContext(offer), match = CONTEXT_ID.exec(offer.id);
  if (!context || !match || !spec || offer.category !== spec.category || context.reportWeek > offer.createdWeek || Number(match[1]) !== Math.floor((offer.createdWeek - 1)/12)) return null;
  const canonical = makeContextOffer({...s,week:offer.createdWeek},spec,`cafe-${match[1]}`,context);
  return offer.investigated ? inspectCatalog(s,canonical,spec) : canonical;
 }
 if (spec) {
  const match = /^(cafe|property)-(0|[1-9]\d*)-(system|marketing|property)-fit-v2-([a-z]+)$/.exec(offer.id);
  if (!match || match[3]!==spec.category || offer.category!==spec.category || (match[1]==='property')!==(spec.category==='property') || Number(match[2])!==Math.floor((offer.createdWeek-1)/(match[1]==='property'?26:12))) return null;
  const canonical = makeCatalogOffer({...s,week:offer.createdWeek},spec,`${match[1]}-${match[2]}`);
  return offer.investigated ? inspectCatalog(s,canonical,spec) : canonical;
 }
 const match = /^(cafe|property)-(\d+)-(system|marketing|property)-(fit|reach)$/.exec(offer.id);
 if (!match || match[3] !== offer.category || (match[1] === 'property') !== (offer.category === 'property')) return null;
 if ((offer.category === 'system' && match[4] !== 'fit') || (offer.category === 'marketing' && match[4] !== 'reach')) return null;
 const batch = `${match[1]}-${match[2]}`;
 if (Number(match[2]) !== Math.floor((offer.createdWeek - 1) / (match[1] === 'property' ? 26 : 12))) return null;
 const result = makeOffer({ ...s, week: offer.createdWeek }, offer.category, match[4] === 'reach', batch);
 if (offer.investigated) {
  const fake: GameState = { ...s, cash: Number.MAX_SAFE_INTEGER, gameOver: false, week: offer.createdWeek, deals: { offers: [result], contracts: [], generatedBatches: [batch], dismissed: [] } };
  return applyDealAction(fake, { type: 'investigateOffer', offerId: result.id }).deals!.offers.find(x => x.id === result.id)!;
 }
 return result;
}
