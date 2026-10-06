import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import legacyEnvelope from './fixtures/legacy-0.3.2-envelope.json';
import type { GameState, Store } from '../src/model';
import { advanceWeek, applyAction, createGame, getStoreOperatingInsight, getWeekOutlook, previewWeek } from '../src/sim/engine';
import { createEnvelope, decodeEnvelope, deleteSave, loadGame, saveGame } from '../src/persistence';

const resultKeys = ['id', 'revenue', 'profit', 'customers', 'satisfaction'];
const open = () => applyAction(createGame('確定費用の保存', 812), { type: 'openStore', lotId: 'center-01', style: 'standard' });
const change = (state: GameState, changes: Partial<Pick<Store, 'price' | 'staff' | 'quality' | 'marketing' | 'manager' | 'style' | 'name'>>) =>
  applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes });
const loss = () => advanceWeek(change(open(), { price: 950, staff: 30, quality: 85, marketing: 0 }));

beforeEach(async () => { await loadGame(); await deleteSave(); });

describe('settled store account lifecycle', () => {
  it('keeps a settled loss and its expenses historical after settings, delegation, and renovation change', async () => {
    const settled = loss();
    const report = structuredClone(settled.lastReport!);
    const history = structuredClone(settled.history);
    const openingRecords = structuredClone(settled.openingRecords);
    const account = report.storeAccounts![0];
    expect(report.storeResults[0].profit).toBeLessThan(0);
    expect(account.costs.labor).toBe(30 * 52_000);

    let edited = change(settled, { name: '設定変更後の店舗', price: 1300, staff: 1, quality: 100, marketing: 12345, manager: true, style: 'premium' });
    edited = applyAction(edited, { type: 'upgradeStore', storeId: edited.stores[0].id });
    const current = getStoreOperatingInsight(edited, edited.stores[0].id)!;
    expect(current.costs.labor).not.toBe(account.costs.labor);
    expect(current.result.profit).not.toBe(report.storeResults[0].profit);
    expect(edited.lastReport).toEqual(report);
    expect(edited.history).toEqual(history);
    expect(edited.openingRecords).toEqual(openingRecords);
    expect(await decodeEnvelope(await createEnvelope(edited))).toEqual(edited);
    expect(settled.lastReport).toEqual(report);
  });

  it('saves accounts for closed stores without joining them to a newly opened store or replacing an old first result', async () => {
    const settled = loss(), store = settled.stores[0];
    const report = structuredClone(settled.lastReport!);
    const firstResult = structuredClone(settled.openingRecords![0].result);
    const closed = applyAction(settled, { type: 'closeStore', storeId: store.id });
    expect(closed.stores).toHaveLength(0);
    expect(closed.lastReport).toEqual(report);
    expect(await decodeEnvelope(await createEnvelope(closed))).toEqual(closed);

    const reopened = applyAction(closed, { type: 'openStore', lotId: store.lotId, style: 'takeaway' });
    const replacement = reopened.stores[0];
    expect(replacement.id).not.toBe(store.id);
    expect(replacement).toMatchObject({ revenue: 0, profit: 0, customers: 0, openedWeek: 2 });
    expect(reopened.lastReport).toEqual(report);
    expect(reopened.lastReport!.storeResults.some(row => row.id === replacement.id)).toBe(false);
    expect(reopened.openingRecords![0].result).toEqual(firstResult);
    expect(reopened.openingRecords![1].result).toBeUndefined();

    await saveGame(reopened);
    const restored = (await loadGame())!;
    expect(restored).toEqual(reopened);
    const next = advanceWeek(restored);
    expect(next.lastReport!.storeAccounts!.map(row => row.storeId)).toEqual([replacement.id]);
    expect(next.openingRecords![0].result).toEqual(firstResult);
    expect(next.openingRecords![1].result?.week).toBe(2);
    expect(restored.lastReport).toEqual(report);
  });

  it('keeps the saved account detached from stores and omits it from every public forecast', () => {
    const opened = open(), storeKeys = Object.keys(opened.stores[0]);
    const settled = advanceWeek(opened), snapshot = structuredClone(settled);
    expect(settled.lastReport!.storeAccounts).toHaveLength(1);
    expect(Object.keys(settled.lastReport!.storeResults[0])).toEqual(resultKeys);
    expect(Object.keys(settled.stores[0])).toEqual(storeKeys);
    expect(settled.stores[0]).not.toHaveProperty('costs');
    expect(settled.stores[0]).not.toHaveProperty('roundingAdjustment');
    expect(settled.stores[0]).not.toHaveProperty('storeAccounts');

    for (const state of [opened, settled]) {
      const preview = previewWeek(state), outlook = getWeekOutlook(state), insight = getStoreOperatingInsight(state, state.stores[0].id)!;
      expect(preview).not.toHaveProperty('storeAccounts');
      expect(outlook.expected).not.toHaveProperty('storeAccounts');
      expect(Object.keys(preview.storeResults[0])).toEqual(resultKeys);
      expect(insight).not.toHaveProperty('storeAccounts');
      expect(insight.result).not.toHaveProperty('costs');
      expect(insight.result).not.toHaveProperty('roundingAdjustment');
    }
    expect(settled).toEqual(snapshot);
  });

  it('round trips the actual 0.3.2 payload exactly and captures expenses only at its next settlement', async () => {
    const legacy = await decodeEnvelope(legacyEnvelope);
    const report = structuredClone(legacy.lastReport!);
    const reexported = await createEnvelope(legacy);
    expect(reexported.payload).toBe(legacyEnvelope.payload);
    expect(reexported.checksum).toBe(legacyEnvelope.checksum);
    expect(legacy).not.toHaveProperty('openingRecords');
    expect(legacy).not.toHaveProperty('railProjects');
    expect(legacy.lastReport).not.toHaveProperty('storeAccounts');

    const edited = change(legacy, { price: 950, staff: 30, manager: false });
    expect(edited.lastReport).toEqual(report);
    await saveGame(edited);
    const restored = (await loadGame())!;
    expect(restored).toEqual(edited);
    expect(restored.lastReport).not.toHaveProperty('storeAccounts');
    const settled = advanceWeek(restored);
    expect(settled.lastReport!.week).toBe(2);
    expect(settled.lastReport!.storeAccounts).toHaveLength(1);
    expect(settled).not.toHaveProperty('openingRecords');
    expect(restored.lastReport).toEqual(report);
    expect((await createEnvelope(legacy)).payload).toBe(legacyEnvelope.payload);
  });
});
