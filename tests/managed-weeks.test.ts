import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/model';
import { advanceWeek, applyAction, createGame, getSummary, previewWeek } from '../src/sim/engine';
import { runManagedWeeks } from '../src/sim/managedWeeks';

function cafe() {
  let state = createGame('Delegation test', 99);
  state = applyAction(state, { type: 'openStore', lotId: 'dogenzaka-02', style: 'standard' });
  return applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { manager: true, quality: 85, price: 750 } });
}

describe('weekly durable delegated progress', () => {
  it('commits each of thirteen weeks in sequence before notifying and matches manual simulation', async () => {
    const initial = createGame(); const sequence: string[] = []; let committed: GameState | undefined;
    const result = await runManagedWeeks(initial, 13, {
      commit: async next => { await new Promise(resolve => setTimeout(resolve, 0)); committed = next; sequence.push(`save:${next.week}`); },
      onCommit: (next, report) => { expect(committed).toBe(next); expect(report.week).toBe(next.week - 1); sequence.push(`notify:${next.week}`); },
    });
    let manual = initial; for (let i = 0; i < 13; i++) manual = advanceWeek(manual);
    expect(result.state).toEqual(manual); expect(result.reports).toHaveLength(13); expect(result.stopReason).toBeNull();
    expect(sequence).toEqual(Array.from({ length: 13 }, (_, i) => [`save:${i + 2}`, `notify:${i + 2}`]).flat());
    expect(initial.week).toBe(1);
  });
  it('returns only committed progress when saving the third week fails', async () => {
    const initial = cafe(); let saves = 0; const callbacks: number[] = [];
    const result = await runManagedWeeks(initial, 4, {
      commit: async () => { saves++; if (saves === 3) throw new Error('quota exhausted'); },
      onCommit: next => callbacks.push(next.week),
    });
    expect(saves).toBe(3); expect(callbacks).toEqual([2, 3]); expect(result.reports).toHaveLength(2);
    expect(result.state).toEqual(advanceWeek(advanceWeek(initial))); expect(result.stopReason).toContain('quota exhausted');
  });
  it('stops before debt default without silently repaying or financing', async () => {
    let initial = cafe();
    initial = applyAction(initial, { type: 'borrow', amount: 1000000, weeks: 52 });
    initial = applyAction(initial, { type: 'updateStore', storeId: initial.stores[0].id, changes: { manager: false, staff: 30, marketing: 500000 } });
    expect(previewWeek(initial).netProfit).toBeLessThan(0);
    let saves = 0; const result = await runManagedWeeks(initial, 4, { commit: async () => { saves++; } });
    expect(result.state).toBe(initial); expect(result.state.gameOver).toBe(false); expect(saves).toBe(0); expect(result.stopReason).toContain('借入');
  });
  it('stops before cash insolvency even with no debt', async () => {
    let initial = cafe();
    initial = applyAction(initial, { type: 'updateStore', storeId: initial.stores[0].id, changes: { manager: false, staff: 30, marketing: 500000 } });
    // Reach the last solvent week using ordinary weekly transitions.
    while (initial.cash + previewWeek(initial).cashChange >= 0) initial = advanceWeek(initial);
    let saves = 0; const result = await runManagedWeeks(initial, 4, { commit: async () => { saves++; } });
    expect(result.state).toBe(initial); expect(saves).toBe(0); expect(result.stopReason).toContain('現預金');
  });
  it('observes late cancellation between weeks after retaining the in-flight save', async () => {
    let cancel = false; let saves = 0;
    const result = await runManagedWeeks(cafe(), 13, { commit: async () => { saves++; if (saves === 2) cancel = true; }, shouldCancel: () => cancel });
    expect(result.state.week).toBe(3); expect(result.reports).toHaveLength(2); expect(saves).toBe(2); expect(result.stopReason).toContain('停止');
  });
  it('ignores existing offers and pauses only when a new batch becomes available', async () => {
    const initial = cafe();
    const four = await runManagedWeeks(initial, 4, { commit: async () => {} });
    expect(four.reports).toHaveLength(4); expect(four.stopReason).toBeNull();
    const thirteen = await runManagedWeeks(initial, 13, { commit: async () => {} });
    expect(thirteen.state.week).toBe(13); expect(thirteen.reports).toHaveLength(12); expect(thirteen.stopReason).toContain('営業提案');
  });
  it('keeps the saved state if a UI observer fails after commit', async () => {
    const initial = cafe(); const result = await runManagedWeeks(initial, 4, { commit: async () => {}, onCommit: () => { throw new Error('render failed'); } });
    expect(result.state).toEqual(advanceWeek(initial)); expect(result.reports).toHaveLength(1); expect(result.stopReason).toContain('保存は完了');
  });
  it('pauses when IPO eligibility first becomes true', async () => {
    let initial = createGame('IPO gate', 1);
    for (const lotId of ['dogenzaka-02', 'sakuragaoka-06', 'dogenzaka-04']) {
      initial = applyAction(initial, { type: 'openStore', lotId, style: 'standard' });
      initial = applyAction(initial, { type: 'updateStore', storeId: initial.stores.at(-1)!.id, changes: { price: 850, quality: 100, staff: 4, marketing: 0 } });
    }
    // Find the actual immediately-pre-IPO state without edited wealth or counters.
    for (let week = 0; week < 100 && !getSummary(advanceWeek(initial)).ipoEligible; week++) initial = advanceWeek(initial);
    expect(getSummary(initial).ipoEligible).toBe(false);
    const result = await runManagedWeeks(initial, 4, { commit: async () => {} });
    expect(result.reports).toHaveLength(1); expect(getSummary(result.state).ipoEligible).toBe(true); expect(result.stopReason).toContain('IPO');
  });
});

it('durably saves the completed district phase before stopping delegated progress', async () => {
  const { getDevelopmentPrograms } = await import('../src/sim/development');
  const { createEnvelope, decodeEnvelope } = await import('../src/persistence');
  const { LOTS } = await import('../src/data/district');
  let initial = cafe();
  const property = LOTS.find(l => l.id === initial.stores[0].lotId)!;
  // Earn the capital through ordinary play; align away from unrelated offer-batch stops.
  while (initial.cash < property.purchasePrice + 10000000 || (initial.week - 1) % 12 !== 1) initial = advanceWeek(initial);
  initial = applyAction(initial, { type: 'buyProperty', lotId: property.id });
  const program = getDevelopmentPrograms(initial).find(p => p.districtId === property.district)!;
  const choice = program.choices[0];
  initial = applyAction(initial, { type: 'startDevelopment', districtId: property.district, choiceId: choice.id });
  let durable: GameState | undefined; const order: string[] = [];
  const result = await runManagedWeeks(initial, 13, {
    commit: async next => { durable = await decodeEnvelope(await createEnvelope(next)); order.push(`saved:${next.week}`); },
    onCommit: next => { expect(durable).toEqual(next); order.push(`notified:${next.week}`); },
  });
  expect(result.stopReason).toContain('街区開発');
  expect(result.reports).toHaveLength(choice.weeks + 1);
  expect(result.state).toEqual(durable);
  expect(durable!.development!.programs[0].completedChoiceIds).toEqual([choice.id]);
  expect(durable!.development!.programs[0].construction).toBeUndefined();
  expect(order.at(-2)).toBe(`saved:${result.state.week}`);
  expect(order.at(-1)).toBe(`notified:${result.state.week}`);
});

it('commits an acquired company becoming operational before returning to the player', async () => {
  const { getMarketAcquisitionTargets, getMarketGroupFinancials } = await import('../src/sim/marketAcquisitions');
  const { createEnvelope, decodeEnvelope } = await import('../src/persistence');
  let initial = cafe();
  const candidate = getMarketAcquisitionTargets(initial).filter(t => !t.requiresListing).sort((a, b) => a.quotePrice - b.quotePrice)[0];
  // Reach a real affordable, reputable state; this is not an edited cash fixture.
  while (initial.cash < candidate.quotePrice * 2 + 10000000 || initial.reputation < candidate.minReputation || (initial.week - 1) % 12 !== 1) initial = advanceWeek(initial);
  initial = applyAction(initial, { type: 'researchMarketCompany', stockId: candidate.stockId });
  initial = applyAction(initial, { type: 'acquireMarketCompany', stockId: candidate.stockId, mode: 'autonomous' });
  let durable: GameState | undefined;
  const result = await runManagedWeeks(initial, 13, { commit: async next => { durable = await decodeEnvelope(await createEnvelope(next)); } });
  expect(result.stopReason).toContain('運営準備が完了');
  expect(result.reports.length).toBe(candidate.leadWeeks);
  expect(result.state).toEqual(durable);
  expect(getMarketGroupFinancials(durable!).operating).toBe(1);
  expect(getMarketGroupFinancials(durable!).integrating).toBe(0);
});
