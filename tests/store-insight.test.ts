import { describe, expect, it } from 'vitest';
import type { GameState, Store, StoreStyle } from '../src/model';
import { LOTS } from '../src/data/district';
import { advanceWeek, applyAction, createGame, getStoreOperatingInsight, managerPlan, operatingConditions, previewWeek } from '../src/sim/engine';
import { createEnvelope, decodeEnvelope } from '../src/persistence';

const open = (lotId = 'center-01', style: StoreStyle = 'standard') => applyAction(createGame('店舗診断テスト', 812), { type: 'openStore', lotId, style });
const set = (s: GameState, changes: Partial<Pick<Store, 'price' | 'staff' | 'quality' | 'marketing' | 'manager'>>, index = 0) => applyAction(s, { type: 'updateStore', storeId: s.stores[index].id, changes });
const insight = (s: GameState, index = 0) => getStoreOperatingInsight(s, s.stores[index].id)!;
const reportKeys = ['id', 'revenue', 'profit', 'customers', 'satisfaction'];
const saturated = () => set(open(), { price: 950, staff: 4, quality: 85, marketing: 0 });
function fourStores() {
  let s = set(open('center-01', 'takeaway'), { price: 1400, staff: 4, quality: 100, marketing: 10000 });
  for (const lotId of ['center-04', 'sakuragaoka-06', 'miyashita-04']) {
    while (s.cash < 3_100_000) s = advanceWeek(s);
    s = applyAction(s, { type: 'openStore', lotId, style: 'takeaway' });
    s = set(s, { price: 1400, quality: 100, staff: 4, marketing: 10000 }, s.stores.length - 1);
  }
  return s;
}
function freezeDeep(value: object) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
}

describe('current-week store operating insight', () => {
  it.each(['standard', 'premium', 'takeaway'] as const)('matches the expected report and bounds the settled result across four districts for %s', style => {
    for (const lotId of ['center-01', 'dogenzaka-02', 'miyashita-04', 'sakuragaoka-06']) {
      const s = open(lotId, style), view = insight(s), forecast = previewWeek(s), next = advanceWeek(s);
      expect(view.week).toBe(s.week);
      expect(view.result).toEqual(forecast.storeResults[0]);
      for (const key of ['profit', 'revenue', 'customers', 'satisfaction'] as const) {
        expect(next.lastReport!.storeResults[0][key]).toBeGreaterThanOrEqual(view.resultRange[key].min);
        expect(next.lastReport!.storeResults[0][key]).toBeLessThanOrEqual(view.resultRange[key].max);
      }
      expect(view.flow.customers).toBe(view.result.customers);
      expect(view.flow.customers).toBe(Math.round(Math.min(view.flow.demand, view.flow.capacity)));
      expect(Object.keys(forecast.storeResults[0])).toEqual(reportKeys);
      expect(Object.keys(next.lastReport!.storeResults[0])).toEqual(reportKeys);
    }
  });

  it('preserves the quality cost tradeoff at the processing limit under neutral footfall', () => {
    const s = saturated(), before = insight(s), after = insight(set(s, { quality: 100 }));
    expect(before.result).toEqual({ id: s.stores[0].id, revenue: 1064000, profit: 402440, customers: 1120, satisfaction: 79 });
    expect(after.result).toEqual({ id: s.stores[0].id, revenue: 1064000, profit: 383120, customers: 1120, satisfaction: 85 });
    expect(before.flow.demand).toBeGreaterThan(before.flow.capacity);
    expect(before.flow.unservedDemand).toBeGreaterThan(0);
    expect(before.flow.unusedCapacity).toBe(0);
    expect(after.costs.ingredients - before.costs.ingredients).toBe(19320);
  });

  it('reports unrounded processing headroom separately from rounded customers', () => {
    const view = insight(set(open('sakuragaoka-06'), { price: 1400, staff: 2, quality: 100, marketing: 10000 }));
    expect(view.result).toMatchObject({ revenue: 614600, profit: 252633, customers: 439, satisfaction: 71 });
    expect(view.flow.capacity).toBe(560);
    expect(view.flow.demand).not.toBe(view.flow.customers);
    expect(view.flow.unusedCapacity).toBe(560 - view.flow.demand);
    expect(view.flow.unservedDemand).toBe(0);
  });

  it('uses the actual manager plan without overwriting the input settings', () => {
    const s = set(open(), { manager: true }), original = structuredClone(s), view = insight(s), planned = managerPlan(s, s.stores[0]);
    expect(view.inputSettings).toMatchObject({ price: 580, staff: 4, quality: 65, marketing: 10000 });
    expect(view.effectiveSettings).toMatchObject({ price: 754, staff: 4, quality: 55, marketing: 0 });
    for (const key of Object.keys(view.effectiveSettings) as (keyof typeof view.effectiveSettings)[]) expect(view.effectiveSettings[key]).toBe(planned[key]);
    expect(view.delegationBudget).toBe(218000);
    expect(view.costs.labor).toBe(208000);
    expect(view.costs.manager).toBe(72000);
    expect(view.result).toMatchObject({ revenue: 912340, profit: 223627, customers: 1210, satisfaction: 78 });
    expect(s).toEqual(original);
  });

  it('does not promise satisfaction 65 when the manager retains a better-profit initial plan', () => {
    const s = set(open('center-01', 'premium'), { price: 2000, staff: 4, quality: 100, marketing: 10000, manager: true });
    const view = insight(s);
    expect(view.effectiveSettings).toEqual(view.inputSettings);
    expect(view.result).toMatchObject({ profit: 803650, satisfaction: 53 });
    expect(view.result).toEqual(previewWeek(s).storeResults[0]);
  });

  it('separates a level staffing limit from paid staff and reflects a paid upgrade', () => {
    const s = saturated(), limit = insight(set(s, { staff: 5 })), excess = insight(set(s, { staff: 30 }));
    expect(limit.context.staffCapacityLimit).toBe(5);
    expect(excess.flow.capacity).toBe(limit.flow.capacity);
    expect(excess.costs.labor - limit.costs.labor).toBe(25 * 52000);
    const upgraded = applyAction(s, { type: 'upgradeStore', storeId: s.stores[0].id });
    expect(insight(upgraded).context.staffCapacityLimit).toBe(6.4);
    expect(insight(upgraded).flow.capacity).toBeGreaterThan(insight(s).flow.capacity);
    expect(insight(upgraded).costs.equipment).toBe(56000);
  });

  it('distinguishes founder capacity from the multiplier applied to a managed store', () => {
    let s = fourStores();
    expect(insight(s).context.founderCapacity).toBeCloseTo(1 / 1.15);
    // A fifth store leaves four unmanaged stores after delegation, preserving founder pressure.
    while (s.cash < 3_100_000) s = advanceWeek(s);
    s = applyAction(s, { type: 'openStore', lotId: 'dogenzaka-02', style: 'takeaway' });
    s = set(s, { manager: true });
    const managed = insight(s), unmanaged = insight(s, 1), noPressure = insight(set(open('center-01', 'takeaway'), { manager: true, staff: s.stores[0].staff, marketing: s.stores[0].marketing }));
    expect(managed.context.founderCapacity).toBeLessThan(1);
    expect(managed.effectiveSettings.manager).toBe(true);
    expect(unmanaged.effectiveSettings.manager).toBe(false);
    expect(managed.flow.capacity / managed.effectiveSettings.staff).toBeCloseTo(noPressure.flow.capacity / noPressure.effectiveSettings.staff);
    expect(unmanaged.flow.capacity / unmanaged.effectiveSettings.staff).toBeLessThan(managed.flow.capacity / managed.effectiveSettings.staff);
  });

  it('keeps property maintenance outside store profit after a normally funded purchase', () => {
    let s = set(open('sakuragaoka-06', 'takeaway'), { price: 950, staff: 2, quality: 100, marketing: 10000 });
    const property = LOTS.find(l => l.id === s.stores[0].lotId)!;
    for (let i = 0; s.cash < property.purchasePrice + 1000000 && i < 160; i++) s = advanceWeek(s);
    const before = insight(s), owned = applyAction(s, { type: 'buyProperty', lotId: property.id }), after = insight(owned);
    expect(before.costs.rent).toBeGreaterThan(0);
    expect(after.context.ownsProperty).toBe(true);
    expect(after.costs.rent).toBe(0);
    expect(after.result).toEqual(previewWeek(owned).storeResults[0]);
    expect(after.result.profit).toBeGreaterThan(previewWeek(owned).netProfit);
    expect(after.flow).toEqual(before.flow);
  });

  it('reconciles displayed whole-yen expenses without changing unrounded wages or profit', () => {
    let s = set(open(), { manager: true });
    s = advanceWeek(s);
    const view = insight(s), economy = operatingConditions(s);
    expect(view.costs.labor).toBe(view.effectiveSettings.staff * 52000 * economy.wages);
    expect(view.costs.manager).toBe(72000 * economy.wages);
    expect(view.costs.fulfilment).toBe(view.result.revenue * .12);
    expect(Object.values(view.costs).some(cost => cost !== Math.round(cost))).toBe(true);
    const displayedCosts = Object.values(view.costs).reduce((sum, cost) => sum + Math.round(cost), 0);
    expect(view.result.revenue - displayedCosts - view.roundedCostAdjustment).toBe(view.result.profit);
    expect(view.result).toEqual(previewWeek(s).storeResults[0]);
  });

  it('returns detached data from a frozen state and never leaks diagnostics into a save', async () => {
    const s = set(open(), { manager: true }), snapshot = structuredClone(s), before = await createEnvelope(s);
    freezeDeep(s);
    const view = insight(s);
    expect(view.inputSettings).not.toBe(view.effectiveSettings);
    expect(view.inputSettings).not.toBe(s.stores[0]);
    Object.assign(view.inputSettings, { price: 201 });
    Object.assign(view.effectiveSettings, { price: 202 });
    Object.assign(view.result, { profit: -999 });
    expect(s).toEqual(snapshot);
    const after = await createEnvelope(s);
    expect(after.payload).toBe(before.payload);
    expect(after.checksum).toBe(before.checksum);
    expect(await decodeEnvelope(after)).toEqual(snapshot);
    const next = advanceWeek(s), restored = await decodeEnvelope(await createEnvelope(next));
    expect(Object.keys(restored.lastReport!.storeResults[0])).toEqual(reportKeys);
    expect(restored.stores[0]).not.toHaveProperty('costs');
    expect(restored.stores[0]).not.toHaveProperty('flow');
    expect(restored.stores[0]).not.toHaveProperty('inputSettings');
  });

  it('returns null for missing or closed stores without an action or week advance', () => {
    const s = open(), id = s.stores[0].id, closed = applyAction(s, { type: 'closeStore', storeId: id });
    expect(getStoreOperatingInsight(s, 'missing')).toBeNull();
    expect(getStoreOperatingInsight(closed, id)).toBeNull();
    expect(getStoreOperatingInsight(createGame(), id)).toBeNull();
    expect(s.week).toBe(1);
  });

  it('keeps company credit context current and preserves strict borrowed-loss defeat', () => {
    const loss = set(open(), { price: 200, staff: 30, quality: 100, marketing: 500000 });
    const s = applyAction(loss, { type: 'borrow', amount: 1000000, weeks: 52 }), view = insight(s), report = previewWeek(s);
    expect(view.context.currentReputation).toBe(s.reputation);
    expect(view).not.toHaveProperty('reputationForecast');
    expect(report.netProfit).toBeLessThanOrEqual(0);
    const next = advanceWeek(s);
    expect(next.gameOver).toBe(true);
    expect(next.lastReport!.netProfit).toBeLessThanOrEqual(0);
    expect(next.lastReport!.storeResults[0].profit).toBeGreaterThanOrEqual(view.resultRange.profit.min);
    expect(next.lastReport!.storeResults[0].profit).toBeLessThanOrEqual(view.resultRange.profit.max);
  });
});
