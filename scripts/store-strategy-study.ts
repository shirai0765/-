/** Small, sequential economic probe. Only public actions change game state. */
import { writeFileSync } from 'node:fs';
import { applyAction, createGame, previewWeek, advanceWeek, operatingConditions } from '../src/sim/engine';
import { LOTS } from '../src/data/district';
import type { GameState, StoreStyle } from '../src/model';

const seed = 812;
const sites = ['center-01', 'dogenzaka-02', 'miyashita-04', 'sakuragaoka-06'];
const styles: StoreStyle[] = ['standard', 'premium', 'takeaway'];
const grid = { price: [650, 950, 1400, 2000, 2500], staff: [1, 2, 4, 5], quality: [55, 85, 100], marketing: [0, 10000] };
type Setting = { price: number; staff: number; quality: number; marketing: number };
let previews = 0, settlements = 0;
const actions: Record<string, number> = {};
function action(s: GameState, a: Parameters<typeof applyAction>[1]) {
  actions[a.type] = (actions[a.type] ?? 0) + 1;
  return applyAction(s, a);
}
function preview(s: GameState) { previews++; return previewWeek(s); }
function advance(s: GameState) { settlements++; return advanceWeek(s); }
function setting(s: GameState, id: string, value: Setting) {
  return action(s, { type: 'updateStore', storeId: id, changes: value });
}
function measure(s: GameState, id: string) {
  const report = preview(s), store = s.stores.find(st => st.id === id)!;
  const result = report.storeResults.find(r => r.id === id)!;
  // Descriptive diagnostic copied from engine.ts capacity formula; not a second economic engine.
  const perStaff = { standard: 280, premium: 210, takeaway: 360 }[store.style];
  const capacity = Math.min(store.staff, 5 + (store.level - 1) * 1.4) * perStaff * (1 + (store.level - 1) * .18) * operatingConditions(s).founderCapacity;
  return { settings: { price: store.price, staff: store.staff, quality: store.quality, marketing: store.marketing },
    storeProfit: result.profit, companyNetProfit: report.netProfit, customers: result.customers,
    capacity: Math.round(capacity * 100) / 100, capacityUse: result.customers / capacity,
    satisfaction: result.satisfaction, cashAfterWeek: s.cash + report.cashChange };
}
type Row = ReturnType<typeof measure>;
function scan(s: GameState, id: string, label: string) {
  const baseline = measure(s, id), candidates: Row[] = [];
  const targetLot = LOTS.find(l => l.id === s.stores.find(st => st.id === id)!.lotId)!;
  const nearbyStores = s.stores.filter(st => st.id !== id && (() => {
    const other = LOTS.find(l => l.id === st.lotId)!;
    return Math.hypot(other.x - targetLot.x, other.z - targetLot.z) < 70;
  })()).length;
  for (const price of grid.price) for (const staff of grid.staff) for (const quality of grid.quality) for (const marketing of grid.marketing)
    candidates.push(measure(setting(s, id, { price, staff, quality, marketing }), id));
  candidates.sort((a, b) => b.companyNetProfit - a.companyNetProfit || b.satisfaction - a.satisfaction);
  const eligible = candidates.filter(r => r.satisfaction >= 85);
  const bestBy = (key: keyof Setting) => Object.fromEntries(grid[key].map(value => [value, candidates.find(r => r.settings[key] === value)]));
  return { label, week: s.week, cash: s.cash, reputation: s.reputation, storeCount: s.stores.length,
    properties: s.properties.map(p => p.lotId), level: s.stores.find(st => st.id === id)!.level,
    nearbyStores, founderCapacity: operatingConditions(s).founderCapacity, overhead: operatingConditions(s).overhead,
    baseline, best: candidates[0], bestSatisfaction85: eligible[0] ?? null, topFive: candidates.slice(0, 5),
    bestByPrice: bestBy('price'), bestByStaff: bestBy('staff'), bestByQuality: bestBy('quality'),
    bestByMarketing: bestBy('marketing'), candidates };
}
function fixedPolicy(s: GameState, id: string, selected: Row, weeks = 13) {
  let next = setting(s, id, selected.settings);
  const initialCash = next.cash, initialReputation = next.reputation;
  const records = [];
  for (let i = 0; i < weeks && !next.gameOver; i++) {
    next = advance(next);
    records.push({ week: next.lastReport!.week, profit: next.lastReport!.netProfit, cash: next.cash,
      satisfaction: next.lastReport!.storeResults[0].satisfaction, reputation: next.reputation });
  }
  return { settings: selected.settings, elapsedWeeks: records.length, initialCash, finalCash: next.cash,
    cashGain: next.cash - initialCash, initialReputation, finalReputation: next.reputation,
    gameOver: next.gameOver, records };
}

const single = [];
for (const lotId of sites) for (const style of styles) {
  const s = action(createGame(`Store study ${lotId} ${style}`, seed), { type: 'openStore', lotId, style });
  const id = s.stores[0].id, findings = scan(s, id, `${lotId}/${style}/single`);
  single.push({ lotId, district: LOTS.find(l => l.id === lotId)!.district, style, ...findings,
    fixed13WeekProfitWinner: fixedPolicy(s, id, findings.best),
    fixed13WeekSatisfiedWinner: findings.bestSatisfaction85 ? fixedPolicy(s, id, findings.bestSatisfaction85) : null });
}

// Separate ordinary-action branch: additions share the original 12m and earned profits only.
let chain = action(createGame('Store study chain', seed), { type: 'openStore', lotId: 'center-01', style: 'takeaway' });
const targetId = chain.stores[0].id;
chain = setting(chain, targetId, single.find(r => r.lotId === 'center-01' && r.style === 'takeaway')!.best.settings);
const contexts = [];
for (const lotId of ['center-04', 'sakuragaoka-06', 'miyashita-04']) {
  while (chain.cash < 3_100_000 && !chain.gameOver) chain = advance(chain);
  if (chain.gameOver) throw new Error('Unfunded chain experiment');
  chain = action(chain, { type: 'openStore', lotId, style: 'takeaway' });
  const source = single.find(r => r.lotId === (lotId === 'center-04' ? 'center-01' : lotId) && r.style === 'takeaway')!;
  chain = setting(chain, chain.stores.at(-1)!.id, source.best.settings);
  contexts.push(scan(chain, targetId, `${chain.stores.length}-store chain, center target`));
}
const upgradeBase = action(createGame('Store study seats', seed), { type: 'openStore', lotId: 'center-01', style: 'takeaway' });
const upgraded = action(upgradeBase, { type: 'upgradeStore', storeId: upgradeBase.stores[0].id });
contexts.push(scan(upgraded, upgraded.stores[0].id, 'center-01/takeaway/level2 paid upgrade'));

// Self-owned property is reached by actually selling coffee, not by editing cash/week/reputation.
const ownerStart = single.find(r => r.lotId === 'sakuragaoka-06' && r.style === 'takeaway')!;
let owner = action(createGame('Store study self-owned', seed), { type: 'openStore', lotId: ownerStart.lotId, style: 'takeaway' });
owner = setting(owner, owner.stores[0].id, ownerStart.best.settings);
const purchasePrice = LOTS.find(l => l.id === ownerStart.lotId)!.purchasePrice;
let earningWeeks = 0;
while (owner.cash < purchasePrice + 1000000 && !owner.gameOver && earningWeeks < 160) { owner = advance(owner); earningWeeks++; }
let ownership: object;
if (!owner.gameOver && owner.cash >= purchasePrice + 1000000) {
  const before = scan(owner, owner.stores[0].id, 'same-week rented property');
  const bought = action(owner, { type: 'buyProperty', lotId: ownerStart.lotId });
  const after = scan(bought, bought.stores[0].id, 'same-week self-owned property');
  ownership = { reached: true, earningWeeks, week: owner.week, earnedCash: owner.cash, purchasePrice, cashAfter: bought.cash, before, after };
} else ownership = { reached: false, earningWeeks, week: owner.week, cash: owner.cash, gameOver: owner.gameOver };

if (previews + settlements > 3000) throw new Error('Experiment exceeded bounded calculation budget');
const result = { date: '2026-10-06', seed, sourceVersion: '0.4.1', method: 'Only createGame and public applyAction/advanceWeek; no state injection; sequential bounded candidate enumeration',
  limitations: ['One seed, four representative sites, sampled settings; not a global optimum', 'Managers disabled, no debt/contracts/rail/development; no human skill or playtime validation', '13-week fixed policies are not reoptimized and compare early profit with satisfaction, not lifetime company value', 'Capacity is an explicitly copied diagnostic formula; authoritative economic outcomes come from previewWeek'],
  grid, counts: { explicitPreviews: previews, realWeekSettlements: settlements, totalForecastOrSettlementCalls: previews + settlements, actions }, single, contexts, ownership };
writeFileSync('docs/research/store-strategy-study.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ counts: result.counts, best: single.map(r => ({ lot: r.lotId, style: r.style, ...r.best })), ownership: { reached: 'reached' in ownership ? ownership.reached : false, earningWeeks } }, null, 2));
