import { describe, expect, it } from 'vitest';
import { LOTS } from '../src/data/district';
import type { GameState, OpeningRecord } from '../src/model';
import { createEnvelope, decodeEnvelope, validateGame } from '../src/persistence';
import { advanceWeek, applyAction, createGame, previewWeek } from '../src/sim/engine';
import { closeOpeningRecords, OPENING_RECORD_LIMIT, recordOpening, settleOpeningRecords } from '../src/sim/openingJournal';
import { runManagedWeeks } from '../src/sim/managedWeeks';

const lot = LOTS.find(l => l.available)!;
function openedGame() {
  const before = createGame('出店記録', 71);
  const opened = applyAction(before, { type: 'openStore', lotId: lot.id, style: 'takeaway' });
  // Explicitly exercise the journal API, independently of the engine hook.
  delete opened.openingRecords;
  return recordOpening(opened, opened.stores[0], previewWeek(before), previewWeek(opened), before.cash, before.cash - opened.cash);
}
function withoutJournal(state: GameState) { const result = structuredClone(state); delete result.openingRecords; return result; }
function settledGame() { const opened = openedGame(); return settleOpeningRecords(advanceWeek(opened), previewWeek(opened)); }

describe('opening decision journal', () => {
  it('records same-week company and store forecasts without changing finances or its input', () => {
    const before = createGame('比較', 71);
    const opened = applyAction(before, { type: 'openStore', lotId: lot.id, style: 'takeaway' });
    delete opened.openingRecords;
    const snapshot = structuredClone(opened);
    const next = recordOpening(opened, opened.stores[0], previewWeek(before), previewWeek(opened), before.cash, 3_000_000);
    expect(opened).toEqual(snapshot);
    expect(withoutJournal(next)).toEqual(opened);
    expect(next.openingRecords![0]).toMatchObject({ decisionWeek: 1, cashBefore: 12_000_000, cashAfter: 9_000_000, netProfitBefore: previewWeek(before).netProfit, netProfitAfter: previewWeek(opened).netProfit, initialStoreProfit: previewWeek(opened).storeResults[0].profit });
    expect(validateGame(next)).toEqual(next);
  });

  it('preserves the decision forecast and attaches only the first result after later settings change', () => {
    const opened = openedGame(), original = structuredClone(opened.openingRecords![0]);
    const changed = applyAction(opened, { type: 'updateStore', storeId: opened.stores[0].id, changes: { staff: 1, price: 1_500 } });
    const report = previewWeek(changed);
    const settled = settleOpeningRecords(advanceWeek(changed), report);
    expect(settled.openingRecords![0]).toMatchObject(original);
    expect(settled.openingRecords![0].result).toEqual({ week: 1, companyNetProfit: report.netProfit, cashChange: report.cashChange, storeProfit: report.storeResults[0].profit, customers: report.storeResults[0].customers });
    expect(settled.openingRecords![0].initialStoreProfit).not.toBe(report.storeResults[0].profit);
    expect(settleOpeningRecords(settled, { ...report, week: 2, netProfit: 999 })).toEqual(settled);
    expect(validateGame(settled)).toEqual(settled);
  });

  it('keeps pre-opening closure separate even when the same store id reopens that week', () => {
    const opened = openedGame();
    let closed = applyAction(opened, { type: 'closeStore', storeId: opened.stores[0].id });
    closed = closeOpeningRecords(closed, opened.stores[0].id);
    expect(closed.openingRecords![0].closedWeek).toBe(1);
    const reopened = applyAction(closed, { type: 'openStore', lotId: lot.id, style: 'takeaway' });
    // Discard any engine-added second record to directly cover this module's API.
    reopened.openingRecords = closed.openingRecords;
    const logged = recordOpening(reopened, reopened.stores[0], previewWeek(closed), previewWeek(reopened), closed.cash, 3_000_000);
    const settled = settleOpeningRecords(advanceWeek(logged), previewWeek(logged));
    expect(settled.openingRecords![0].result).toBeUndefined();
    expect(settled.openingRecords![1].result?.week).toBe(1);
    expect(settled.openingRecords![0].id).not.toBe(settled.openingRecords![1].id);
    expect(validateGame(settled)).toEqual(settled);
    const laterClosed = closeOpeningRecords(settled, reopened.stores[0].id);
    expect(laterClosed.openingRecords![1].result).toEqual(settled.openingRecords![1].result);
  });

  it('round trips records while old saves remain unrecorded and history pruning does not erase entries', async () => {
    const old = withoutJournal(openedGame());
    expect((await decodeEnvelope(await createEnvelope(old))).openingRecords).toBeUndefined();
    const settled = settledGame();
    expect(await decodeEnvelope(await createEnvelope(settled))).toEqual(settled);
    const later = { ...settled, week: 1_006, history: [] };
    expect((await decodeEnvelope(await createEnvelope(later))).openingRecords).toEqual(settled.openingRecords);
  });

  it('keeps valid fractional-cash legacy saves usable after a new opening', async () => {
    const legacy = createGame('旧形式の端数現金', 71);
    legacy.cash = 12_000_000.25;
    const restored = await decodeEnvelope(await createEnvelope(legacy));
    expect(restored.openingRecords).toBeUndefined();
    const opened = applyAction(restored, { type: 'openStore', lotId: lot.id, style: 'takeaway' });
    expect(opened.openingRecords![0]).toMatchObject({ cashBefore: 12_000_000.25, openingCost: 3_000_000, cashAfter: 9_000_000 });
    expect(await decodeEnvelope(await createEnvelope(opened))).toEqual(opened);
    const tampered = structuredClone(opened);
    tampered.openingRecords![0].cashAfter += 1;
    expect(() => validateGame(tampered)).toThrow();
  });

  it('retains the latest forty entries and keeps ids unique across same-week reopening', () => {
    const settled = settledGame();
    settled.cash = 1e9;
    // Older settled records are valid historical rows even when their stores closed.
    settled.openingRecords = Array.from({ length: OPENING_RECORD_LIMIT }, (_, i) => ({ ...structuredClone(settled.openingRecords![0]), id: `opening-1-${i + 1}` }));
    settled.stores[0] = { ...settled.stores[0], id: `store-${lot.id}-2`, openedWeek: 2 };
    const report = previewWeek(settled);
    const next = recordOpening(settled, settled.stores[0], report, report, settled.cash + 3_000_000, 3_000_000);
    expect(next.openingRecords).toHaveLength(40);
    expect(next.openingRecords![0].id).toBe('opening-1-2');
    expect(next.openingRecords!.at(-1)!.id).toBe('opening-2-41');
    expect(validateGame(next)).toEqual(next);
  });

  it('does not adopt a first result when delegated save fails and records it once after retry', async () => {
    const opened = openedGame();
    const failed = await runManagedWeeks(opened, 4, { commit: async () => { throw new Error('disk full'); } });
    expect(failed.state).toEqual(opened);
    expect(failed.state.openingRecords![0].result).toBeUndefined();
    expect(failed.reports).toHaveLength(0);
    const committed: GameState[] = [];
    const retried = await runManagedWeeks(failed.state, 4, { commit: async next => { committed.push(await decodeEnvelope(await createEnvelope(next))); } });
    expect(committed.length).toBeGreaterThan(0);
    expect(committed[0].openingRecords![0].result?.week).toBe(1);
    expect(retried.state.openingRecords![0].result).toEqual(committed[0].openingRecords![0].result);
  });
});

describe('opening journal import validation', () => {
  const change = (mutate: (record: OpeningRecord, state: GameState) => void, settled = false) => {
    const state = settled ? settledGame() : openedGame(); mutate(state.openingRecords![0], state); return state;
  };
  it.each([
    ['nonfinite forecast', (r: OpeningRecord) => { r.netProfitAfter = NaN; }],
    ['invalid cash accounting', (r: OpeningRecord) => { r.cashAfter += 1; }],
    ['unknown lot', (r: OpeningRecord) => { r.lotId = 'missing'; }],
    ['mismatched store', (r: OpeningRecord) => { r.storeId = 'another-store'; }],
    ['invalid style', (r: OpeningRecord) => { r.style = 'unknown' as OpeningRecord['style']; }],
    ['future decision', (r: OpeningRecord) => { r.decisionWeek = 2; }],
    ['duplicated record', (r: OpeningRecord, s: GameState) => { s.openingRecords!.push(structuredClone(r)); }],
    ['stale pending record', (_r: OpeningRecord, s: GameState) => { s.week = 2; }],
    ['missing pending store', (_r: OpeningRecord, s: GameState) => { s.stores = []; }],
  ])('rejects %s', (_label, mutate) => { expect(() => validateGame(change(mutate))).toThrow(); });
  it('rejects future results, wrong first result week, and contradictory closure', () => {
    expect(() => validateGame(change(r => { r.result!.week = 2; }, true))).toThrow();
    expect(() => validateGame(change((r, s) => { s.week = 5; r.result!.week = 3; }, true))).toThrow();
    expect(() => validateGame(change(r => { r.closedWeek = 1; }, true))).toThrow();
    expect(() => validateGame(change(r => { r.result!.customers = -1; }, true))).toThrow();
  });
});
