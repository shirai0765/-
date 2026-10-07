import { describe, expect, it } from 'vitest';
import { LOTS } from '../src/data/district';
import { advanceWeek, applyAction, createGame, getSummary, previewWeek } from '../src/sim/engine';

function eligibleCompany() {
  let state = createGame();
  // Capital-only fixture isolates the IPO earnings condition; every report is settled normally.
  state.cash = 80_000_000;
  const sites = LOTS.filter(site => site.available).sort((a, b) => a.rent - b.rent).slice(0, 3);
  for (const site of sites) state = applyAction(state, { type: 'openStore', lotId: site.id, style: 'standard' });
  for (let week = 0; week < 12; week++) state = advanceWeek(state);
  expect(state.profitableWeeks).toBe(12);
  expect(state.lastReport!.netProfit).toBeGreaterThan(0);
  expect(getSummary(state).ipoEligible).toBe(true);
  return state;
}

describe('IPO settled earnings condition', () => {
  it('rejects a latest settled loss even after the current operating plan becomes profitable', () => {
    let state = eligibleCompany();
    const settings = state.stores.map(store => ({ id: store.id, staff: store.staff }));
    for (const store of state.stores) state = applyAction(state, { type: 'updateStore', storeId: store.id, changes: { staff: 30 } });
    state = advanceWeek(state);
    expect(state.lastReport!.netProfit).toBeLessThan(0);
    for (const store of settings) state = applyAction(state, { type: 'updateStore', storeId: store.id, changes: { staff: store.staff } });
    expect(previewWeek(state).netProfit).toBeGreaterThan(0);
    const before = structuredClone(state);
    expect(getSummary(state).ipoRequirements.at(-1)).toEqual({ label: '直近の決算が黒字', met: false });
    expect(getSummary(state).ipoEligible).toBe(false);
    expect(() => applyAction(state, { type: 'ipo' })).toThrow('上場条件');
    expect(state).toEqual(before);
  });

  it('uses the positive latest settlement even when the current neutral plan is negative', () => {
    let state = eligibleCompany();
    for (const store of state.stores) state = applyAction(state, { type: 'updateStore', storeId: store.id, changes: { staff: 30 } });
    expect(previewWeek(state).netProfit).toBeLessThan(0);
    const summary = getSummary(state);
    expect(summary.ipoRequirements.at(-1)?.met).toBe(true);
    expect(summary.ipoEligible).toBe(true);
    const listed = applyAction(state, { type: 'ipo' });
    expect(listed.listed).toBe(true);
    expect(listed.cash - state.cash).toBe(Math.round(summary.valuation * .25));
    expect(listed.lastReport).toEqual(state.lastReport);
    expect(getSummary(listed).ipoEligible).toBe(false);
  });

  it.each(['missing', 'zero'] as const)('requires a positive actual settlement when the latest report is %s', report => {
    const state = eligibleCompany();
    state.lastReport = report === 'missing' ? null : { ...state.lastReport!, netProfit: 0 };
    expect(previewWeek(state).netProfit).toBeGreaterThan(0);
    expect(getSummary(state).ipoRequirements.slice(0, 3).every(requirement => requirement.met)).toBe(true);
    expect(getSummary(state).ipoEligible).toBe(false);
    expect(() => applyAction(state, { type: 'ipo' })).toThrow('上場条件');
  });

  it('never offers IPO to an ended company even when every numeric requirement is met', () => {
    const state = eligibleCompany();
    state.gameOver = true;
    state.gameOverReason = '終了状態の境界検査';
    expect(getSummary(state).ipoRequirements.every(requirement => requirement.met)).toBe(true);
    expect(getSummary(state).ipoEligible).toBe(false);
    expect(() => applyAction(state, { type: 'ipo' })).toThrow('ゲームは終了');
  });
});
