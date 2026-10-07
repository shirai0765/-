import { describe, expect, it } from 'vitest';
import type { StoreStyle } from '../src/model';
import { advanceWeek, applyAction, createGame, getStoreOperatingInsight, managerPlan } from '../src/sim/engine';
import baseline from './fixtures/manager-plan-v050.json';

// Captured from v0.5.0 before changing managerPlan: all 32 original sites and
// three formats, normal opening followed only by enabling the manager.
function open(lotId: string, style: StoreStyle, seed = 1) {
  const state = applyAction(createGame('Manager recovery', seed), { type: 'openStore', lotId, style });
  return applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { manager: true } });
}

describe('bounded manager loss recovery', () => {
  it('preserves every previously profitable default plan exactly', () => {
    const healthy = baseline.filter(row => row.profit > 0);
    expect(healthy).toHaveLength(85);
    for (const row of healthy) {
      const state = open(row.lotId, row.style as StoreStyle);
      const view = getStoreOperatingInsight(state, state.stores[0].id)!;
      expect(view.effectiveSettings, row.lotId + row.style).toEqual(row.effective);
      expect(view.result.profit).toBe(row.profit);
      expect(view.result.satisfaction).toBe(row.satisfaction);
    }
  });

  it('recovers nine loss presets without changing funding, equipment or the input plan', () => {
    let recovered = 0;
    for (const row of baseline.filter(row => row.profit <= 0)) {
      const state = open(row.lotId, row.style as StoreStyle), before = structuredClone(state);
      const view = getStoreOperatingInsight(state, state.stores[0].id)!;
      if (view.result.profit > 0) {
        recovered++;
        expect(view.result.satisfaction).toBeGreaterThanOrEqual(65);
      }
      expect(view.result.profit).toBeGreaterThanOrEqual(row.profit);
      expect(view.effectiveSettings.staff * 52_000 + view.effectiveSettings.marketing).toBeLessThanOrEqual(218_000);
      expect(view.effectiveSettings).toMatchObject({ style: row.style, level: 1, manager: true });
      expect(state).toEqual(before);
      expect(state.loans).toHaveLength(0);
    }
    expect(recovered).toBe(9);
  });

  it.each(['center-03', 'miyashita-07'])('keeps the capacity-constrained premium loss at %s visible', lotId => {
    const state = open(lotId, 'premium');
    const view = getStoreOperatingInsight(state, state.stores[0].id)!;
    expect(view.result.profit).toBeLessThan(0);
    expect(view.result.satisfaction).toBeLessThan(65);
    expect(view.effectiveSettings).toEqual(view.inputSettings);
    expect(view.context.staffCapacityLimit).toBe(5);
    expect(state.cash).toBe(7_200_000);
  });

  it('does not overspend even a one-person payroll envelope', () => {
    let state = open('center-03', 'standard');
    state = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { staff: 1, marketing: 0 } });
    const plan = managerPlan(state, state.stores[0]);
    expect(plan.staff * 52_000 + plan.marketing).toBeLessThanOrEqual(52_000);
    expect(plan).toEqual(state.stores[0]);
  });

  it('selects the same neutral recovery before different actual draws and preserves deterministic settlement', () => {
    const states = [1, 2, 765].map(seed => open('center-03', 'takeaway', seed));
    const plans = states.map(state => getStoreOperatingInsight(state, state.stores[0].id)!);
    expect(plans[1].effectiveSettings).toEqual(plans[0].effectiveSettings);
    expect(plans[2].effectiveSettings).toEqual(plans[0].effectiveSettings);
    const outcomes = states.map((state, index) => {
      const settled = advanceWeek(state);
      expect(advanceWeek(structuredClone(state))).toEqual(settled);
      const profit = settled.lastReport!.storeResults[0].profit;
      expect(profit).toBeGreaterThanOrEqual(plans[index].resultRange.profit.min);
      expect(profit).toBeLessThanOrEqual(plans[index].resultRange.profit.max);
      return profit;
    });
    expect(new Set(outcomes).size).toBeGreaterThan(1);
  });
});
