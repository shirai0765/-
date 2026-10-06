import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/model';
import { advanceWeek, applyAction, createGame, getSummary, getWeekOutlook, previewWeek } from '../src/sim/engine';
import { runManagedWeeks, type ManagedWeekOptions } from '../src/sim/managedWeeks';

const pausePolicies: { name: string; options?: ManagedWeekOptions }[] = [
  { name: 'default' }, { name: 'unchecked', options: { stopOnNewOffers: false } },
];

function cafe() {
  let state = createGame('Delegation test', 99);
  state = applyAction(state, { type: 'openStore', lotId: 'dogenzaka-02', style: 'standard' });
  return applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { manager: true, quality: 85, price: 750 } });
}

function beforeIPO() {
  let state = createGame('IPO gate', 1);
  for (const lotId of ['dogenzaka-02', 'sakuragaoka-06', 'dogenzaka-04']) {
    state = applyAction(state, { type: 'openStore', lotId, style: 'standard' });
    state = applyAction(state, { type: 'updateStore', storeId: state.stores.at(-1)!.id, changes: { price: 850, quality: 100, staff: 4, marketing: 0 } });
  }
  // Find the actual immediately-pre-IPO state without edited wealth or counters.
  for (let week = 0; week < 100 && !getSummary(advanceWeek(state)).ipoEligible; week++) state = advanceWeek(state);
  return state;
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
  it.each(pausePolicies)('returns only committed progress when saving the third week fails ($name)', async ({ options }) => {
    const initial = cafe(); let saves = 0; const callbacks: number[] = [];
    const result = await runManagedWeeks(initial, 4, {
      commit: async () => { saves++; if (saves === 3) throw new Error('quota exhausted'); },
      onCommit: next => callbacks.push(next.week),
    }, options);
    expect(saves).toBe(3); expect(callbacks).toEqual([2, 3]); expect(result.reports).toHaveLength(2);
    expect(result.state).toEqual(advanceWeek(advanceWeek(initial))); expect(result.stopReason).toContain('quota exhausted');
  });
  it.each(pausePolicies)('stops before debt default without silently repaying or financing ($name)', async ({ options }) => {
    let initial = cafe();
    initial = applyAction(initial, { type: 'borrow', amount: 1000000, weeks: 52 });
    initial = applyAction(initial, { type: 'updateStore', storeId: initial.stores[0].id, changes: { manager: false, staff: 30, marketing: 500000 } });
    expect(previewWeek(initial).netProfit).toBeLessThan(0);
    let saves = 0; const result = await runManagedWeeks(initial, 4, { commit: async () => { saves++; } }, options);
    expect(result.state).toBe(initial); expect(result.state.gameOver).toBe(false); expect(saves).toBe(0); expect(result.stopReason).toContain('借入');
  });
  it.each(pausePolicies)('stops before cash insolvency even with no debt ($name)', async ({ options }) => {
    let initial = cafe();
    initial = applyAction(initial, { type: 'updateStore', storeId: initial.stores[0].id, changes: { manager: false, staff: 30, marketing: 500000 } });
    // Reach the last solvent week using ordinary weekly transitions.
    while (initial.cash + previewWeek(initial).cashChange >= 0) initial = advanceWeek(initial);
    let saves = 0; const result = await runManagedWeeks(initial, 4, { commit: async () => { saves++; } }, options);
    expect(result.state).toBe(initial); expect(saves).toBe(0); expect(result.stopReason).toContain('現預金');
  });
  it.each(pausePolicies)('observes late cancellation between weeks after retaining the in-flight save ($name)', async ({ options }) => {
    let cancel = false; let saves = 0;
    const result = await runManagedWeeks(cafe(), 13, { commit: async () => { saves++; if (saves === 2) cancel = true; }, shouldCancel: () => cancel }, options);
    expect(result.state.week).toBe(3); expect(result.reports).toHaveLength(2); expect(saves).toBe(2); expect(result.stopReason).toContain('停止');
  });
  it.each([{ name: 'default', options: undefined }, { name: 'checked', options: { stopOnNewOffers: true } }])('ignores existing offers and pauses only when a new batch becomes available ($name)', async ({ options }) => {
    const initial = cafe();
    const four = await runManagedWeeks(initial, 4, { commit: async () => {} }, options);
    expect(four.reports).toHaveLength(4); expect(four.stopReason).toBeNull();
    const thirteen = await runManagedWeeks(initial, 13, { commit: async () => {} }, options);
    expect(thirteen.state.week).toBe(13); expect(thirteen.reports).toHaveLength(12); expect(thirteen.stopReason).toContain('営業提案');
  });
  it.each(pausePolicies)('keeps the saved state if a UI observer fails after commit ($name)', async ({ options }) => {
    const initial = cafe(); const result = await runManagedWeeks(initial, 4, { commit: async () => {}, onCommit: () => { throw new Error('render failed'); } }, options);
    expect(result.state).toEqual(advanceWeek(initial)); expect(result.reports).toHaveLength(1); expect(result.stopReason).toContain('保存は完了');
  });
  it.each(pausePolicies)('pauses when IPO eligibility first becomes true ($name)', async ({ options }) => {
    const initial = beforeIPO();
    expect(getSummary(initial).ipoEligible).toBe(false);
    const result = await runManagedWeeks(initial, 4, { commit: async () => {} }, options);
    expect(result.reports).toHaveLength(1); expect(getSummary(result.state).ipoEligible).toBe(true); expect(result.stopReason).toContain('IPO');
  });
  it('saves all thirteen actual cafe weeks unchecked without changing offers or accepting contracts', async () => {
    const { createEnvelope, decodeEnvelope } = await import('../src/persistence');
    const initial = cafe(), before = structuredClone(initial), saved: GameState[] = [], sequence: string[] = [];
    const result = await runManagedWeeks(initial, 13, {
      commit: async next => { saved.push(await decodeEnvelope(await createEnvelope(next))); sequence.push(`save:${next.week}`); },
      onCommit: (next, report) => { expect(next).toEqual(saved.at(-1)); expect(report).toEqual(saved.at(-1)!.lastReport); sequence.push(`notify:${next.week}`); },
    }, { stopOnNewOffers: false });
    let manual = initial;
    const manualWeeks: GameState[] = [];
    for (let i = 0; i < 13; i++) { manual = advanceWeek(manual); manualWeeks.push(manual); }
    expect(result.reports).toHaveLength(13);
    expect(result.stopReason).toBeNull();
    expect(saved).toEqual(manualWeeks);
    expect(result.state).toEqual(manual);
    expect(result.state.deals!.offers.length).toBeGreaterThanOrEqual(4);
    expect(result.state.deals!.contracts).toEqual([]);
    expect(result.state.deals!.dismissed).toEqual([]);
    expect(sequence).toEqual(Array.from({ length: 13 }, (_, i) => [`save:${i + 2}`, `notify:${i + 2}`]).flat());
    expect(initial).toEqual(before);
  });
  it.each([true, false])('snapshots stopOnNewOffers=%s before the first asynchronous save', async stopOnNewOffers => {
    const options = { stopOnNewOffers };
    let saves = 0;
    const result = await runManagedWeeks(cafe(), 13, {
      commit: async () => { saves++; options.stopOnNewOffers = !stopOnNewOffers; },
    }, options);
    expect(options.stopOnNewOffers).toBe(!stopOnNewOffers);
    expect(saves).toBe(stopOnNewOffers ? 12 : 13);
    expect(result.reports).toHaveLength(saves);
    expect(result.stopReason).toBe(stopOnNewOffers ? '新しい営業提案が届きました。内容を確認してください。' : null);
  });
  it('retains the lower-bound debt stop unchecked even when neutral profit stays positive', async () => {
    let initial = applyAction(cafe(), { type: 'borrow', amount: 1_000_000, weeks: 52 });
    initial = applyAction(initial, { type: 'updateStore', storeId: initial.stores[0].id, changes: { manager: false, marketing: 0 } });
    const neutral = previewWeek(initial).netProfit;
    initial = applyAction(initial, { type: 'updateStore', storeId: initial.stores[0].id, changes: { marketing: neutral - 1_000 } });
    const outlook = getWeekOutlook(initial);
    expect(outlook.expected.netProfit).toBe(1_000);
    expect(outlook.risk.debtLossPossible).toBe(true);
    let saves = 0;
    const result = await runManagedWeeks(initial, 13, { commit: async () => { saves++; } }, { stopOnNewOffers: false });
    expect(saves).toBe(0);
    expect(result.state).toBe(initial);
    expect(result.reports).toEqual([]);
    expect(result.stopReason).toContain('可能性');
  });
});

it.each(pausePolicies)('durably saves the completed district phase before stopping delegated progress ($name)', async ({ options }) => {
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
  }, options);
  expect(result.stopReason).toContain('街区開発');
  expect(result.reports).toHaveLength(choice.weeks + 1);
  expect(result.state).toEqual(durable);
  expect(durable!.development!.programs[0].completedChoiceIds).toEqual([choice.id]);
  expect(durable!.development!.programs[0].construction).toBeUndefined();
  expect(order.at(-2)).toBe(`saved:${result.state.week}`);
  expect(order.at(-1)).toBe(`notified:${result.state.week}`);
});

it.each(pausePolicies)('commits an acquired company becoming operational before returning to the player ($name)', async ({ options }) => {
  const { getMarketAcquisitionTargets, getMarketGroupFinancials } = await import('../src/sim/marketAcquisitions');
  const { createEnvelope, decodeEnvelope } = await import('../src/persistence');
  let initial = cafe();
  const candidate = getMarketAcquisitionTargets(initial).filter(t => !t.requiresListing).sort((a, b) => a.quotePrice - b.quotePrice)[0];
  // Reach a real affordable, reputable state; this is not an edited cash fixture.
  while (initial.cash < candidate.quotePrice * 2 + 10000000 || initial.reputation < candidate.minReputation || (initial.week - 1) % 12 !== 1) initial = advanceWeek(initial);
  initial = applyAction(initial, { type: 'researchMarketCompany', stockId: candidate.stockId });
  initial = applyAction(initial, { type: 'acquireMarketCompany', stockId: candidate.stockId, mode: 'autonomous' });
  let durable: GameState | undefined;
  const result = await runManagedWeeks(initial, 13, { commit: async next => { durable = await decodeEnvelope(await createEnvelope(next)); } }, options);
  expect(result.stopReason).toContain('運営準備が完了');
  expect(result.reports.length).toBe(candidate.leadWeeks);
  expect(result.state).toEqual(durable);
  expect(getMarketGroupFinancials(durable!).operating).toBe(1);
  expect(getMarketGroupFinancials(durable!).integrating).toBe(0);
});

it.each(pausePolicies)('saves rail partnership completion before returning to the player ($name)', async ({ options }) => {
  const { LOTS } = await import('../src/data/district');
  const { getRailProjects } = await import('../src/sim/railProjects');
  const { createEnvelope, decodeEnvelope } = await import('../src/persistence');
  let initial = advanceWeek(beforeIPO());
  initial = applyAction(initial, { type: 'ipo' });
  const property = LOTS.find(l => l.id === initial.stores[0].lotId)!;
  // Fund the real project through operating weeks; avoid unrelated catalogue stops.
  while (initial.cash < property.purchasePrice + 16_000_000 || initial.reputation < 45 || (initial.week - 1) % 12 !== 1) initial = advanceWeek(initial);
  initial = applyAction(initial, { type: 'buyProperty', lotId: property.id });
  initial = applyAction(initial, { type: 'startRailProject', districtId: property.district, choiceId: 'commerce' });
  const completeWeek = initial.railProjects!.projects[0].completeWeek;
  let durable: GameState | undefined; const order: string[] = [];
  const result = await runManagedWeeks(initial, 13, {
    commit: async next => { durable = await decodeEnvelope(await createEnvelope(next)); order.push(`saved:${next.week}`); },
    onCommit: next => { expect(next).toEqual(durable); order.push(`notified:${next.week}`); },
  }, options);
  expect(result.stopReason).toContain('共同開発が完成');
  expect(result.state.week).toBe(completeWeek);
  expect(result.reports).toHaveLength(completeWeek - initial.week);
  expect(result.state).toEqual(durable);
  expect(getRailProjects(result.state).find(p => p.districtId === property.district)!.status).toBe('operating');
  expect(order.at(-2)).toBe(`saved:${completeWeek}`);
  expect(order.at(-1)).toBe(`notified:${completeWeek}`);
});
