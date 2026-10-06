import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, advanceWeek, applyAction } from '../src/sim/engine';
import { getOffers, applyDealAction } from '../src/sim/deals';
import { LOTS } from '../src/data/district';
import { createEnvelope, decodeEnvelope, validateGame, saveGame, loadGame, listBackups, restoreBackup, deleteSave, importGame } from '../src/persistence';

beforeEach(async () => { await loadGame(); await deleteSave(); });
describe('durable game saves', () => {
  it('round trips a game with operational store and weekly reports', async () => {
    const available = LOTS.find(l => l.available)!;
    let s = createGame('永続テスト');
    s.cash = 1e9;
    s = applyAction(s, { type: 'openStore', lotId: available.id, style: 'standard' });
    s = advanceWeek(s);
    await saveGame(s);
    expect(await loadGame()).toEqual(s);
    expect(await decodeEnvelope(await createEnvelope(s))).toEqual(s);
  });
  it('retains exactly twelve latest weeks and replaces same-week backup', async () => {
    const s = createGame();
    for (let week = 1; week <= 15; week++) { s.week = week; await saveGame(s); }
    s.cash = 1234; await saveGame(s);
    const backups = await listBackups();
    expect(backups).toHaveLength(12);
    expect(backups.map(b => b.week)).toEqual([15,14,13,12,11,10,9,8,7,6,5,4]);
    expect((await restoreBackup(backups[0].key)).cash).toBe(1234);
    const old = await restoreBackup(backups[11].key);
    expect(old.week).toBe(4); expect((await loadGame())?.week).toBe(4);
  });
  it('rejects corruption and unsupported data without replacing the existing save', async () => {
    const state = createGame(); await saveGame(state);
    const envelope = await createEnvelope(state); envelope.payload = envelope.payload.replace('12000000', '99999999');
    await expect(decodeEnvelope(envelope)).rejects.toThrow('破損');
    await expect(importGame({ size: 1, text: async () => '{broken' } as File)).rejects.toThrow();
    await expect(saveGame({ ...state, cash: NaN })).rejects.toThrow();
    expect(await loadGame()).toEqual(state);
  });
  it('recovers an intact backup when the primary record is damaged', async () => {
    const state = createGame(); await saveGame(state);
    const backup = (await listBackups())[0];
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('shibuya-capital-v1', 1);
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction('saves', 'readwrite'); const store = tx.objectStore('saves'); const read = store.get('primary');
        read.onsuccess = () => { const row = read.result; row.envelope.checksum = '0'.repeat(64); store.put(row); };
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
    await expect(loadGame()).rejects.toThrow('破損');
    expect(await restoreBackup(backup.key)).toEqual(state);
    expect(await loadGame()).toEqual(state);
  });
  it('rejects invalid references, missing required fields and nonfinite numbers', () => {
    const state = createGame();
    expect(() => validateGame({ ...state, week: 1.2 })).toThrow();
    expect(() => validateGame({ ...state, founderShares: 2e6 })).toThrow();
    expect(() => validateGame({ ...state, stockPrices: {} })).toThrow();
    expect(() => validateGame({ ...state, positions: [{ stockId: 'unknown', shares: 1, averageCost: 2 }] })).toThrow();
    expect(() => validateGame({ ...state, settings: { quality: 'ultra', sound: false } })).toThrow();
    expect(() => validateGame({ ...state, subsidiaries: [{ id: 'unknown', name: 'X', sector: 'food', purchasePrice: 1, weeklyProfit: 1, risk: 0 }] })).toThrow();
  });
  it('rejects stale tabs atomically instead of overwriting newer progress', async () => {
    const a = createGame(); await saveGame(a);
    vi.resetModules(); const secondTab = await import('../src/persistence');
    await secondTab.loadGame();
    a.cash = 42; await saveGame(a);
    await expect(secondTab.saveGame({ ...a, cash: 7 })).rejects.toThrow('別のタブ');
    expect((await loadGame())?.cash).toBe(42);
  });
  it('rejects concurrent writes started from the same revision', async () => {
    const s = createGame(); await saveGame(s);
    const results = await Promise.allSettled([saveGame({ ...s, cash: 10 }), saveGame({ ...s, cash: 20 })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  });
  it('propagates unavailable storage without silently falling back', async () => {
    const old = globalThis.indexedDB; vi.stubGlobal('indexedDB', undefined);
    await expect(saveGame(createGame())).rejects.toThrow('IndexedDB');
    vi.stubGlobal('indexedDB', old);
  });
});


describe('version-one business contract saves', () => {
  function withOffer() {
    let s = createGame('契約保存テスト', 981);
    s.cash = 100000000;
    s = applyAction(s, { type: 'openStore', lotId: LOTS.find(l => l.available)!.id, style: 'standard' });
    const offer = getOffers(s).find(o => o.category === 'system')!;
    s = applyDealAction(s, { type: 'investigateOffer', offerId: offer.id });
    return applyDealAction(s, { type: 'acceptOffer', offerId: offer.id });
  }
  it('accepts legacy v1 states without deal data', async () => {
    const s = createGame(); delete s.deals;
    expect(validateGame(s).deals).toBeUndefined();
    await saveGame(s); expect(await loadGame()).toEqual(s);
  });
  it('preserves pending events across two weekly saves, import, and realized outcome', async () => {
    let s = withOffer(); const reveal = s.deals!.contracts[0].revealWeek;
    await saveGame(s);
    for (let i = 0; i < 2; i++) {
      s = advanceWeek(s); await saveGame(s);
      const loaded = await loadGame(); expect(loaded).toEqual(s); s = loaded!;
    }
    expect(s.week).toBe(reveal);
    expect(s.deals!.contracts[0].realizedWeeklyBenefit).toBeUndefined();
    const envelope = await createEnvelope(s);
    const imported = await importGame({ size: JSON.stringify(envelope).length, text: async () => JSON.stringify(envelope) } as File);
    expect(advanceWeek(imported)).toEqual(advanceWeek(s));
    s = advanceWeek(imported); await saveGame(s);
    expect(s.deals!.contracts[0].realizedWeeklyBenefit).toBeGreaterThan(0);
    expect((await loadGame())!.deals).toEqual(s.deals);
    const waitingBackup = (await listBackups()).find(b => b.week === reveal)!;
    expect((await restoreBackup(waitingBackup.key)).deals!.contracts[0].realizedWeeklyBenefit).toBeUndefined();
  });
  it('rejects forged nested economics, nonfinite values, timing, and supplier references', async () => {
    const s = withOffer();
    for (const mutate of [
      (v: typeof s) => { v.deals!.contracts[0].offer.weeklyFee = -1; },
      (v: typeof s) => { v.deals!.contracts[0].offer.upfrontCost = 1; },
      (v: typeof s) => { v.deals!.offers[0].advertisedWeeklyBenefit = Infinity; },
      (v: typeof s) => { v.deals!.contracts[0].revealWeek += 1; },
      (v: typeof s) => { v.deals!.offers[0].supplierStockId = 'forged'; },
      (v: typeof s) => { v.deals!.contracts[0].cumulativeFees = NaN; },
      (v: typeof s) => { v.deals!.generatedBatches.push('cafe-99999'); },
      (v: typeof s) => { v.deals!.contracts.push(structuredClone(v.deals!.contracts[0])); },
    ]) {
      const forged = structuredClone(s); mutate(forged);
      expect(() => validateGame(forged)).toThrow();
    }
    let settled = s; for (let i = 0; i < 3; i++) settled = advanceWeek(settled);
    settled.deals!.contracts[0].realizedWeeklyBenefit! += 100;
    expect(() => validateGame(settled)).toThrow();
    await saveGame(s);
    const broken = structuredClone(s); broken.deals!.contracts[0].offer.weeklyFee = 1;
    // Even a recomputed matching checksum cannot bypass schema/economic validation.
    const envelope = await createEnvelope(s); envelope.payload = JSON.stringify(broken);
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(envelope.payload));
    envelope.checksum = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    await expect(decodeEnvelope(envelope)).rejects.toThrow();
    expect(await loadGame()).toEqual(s);
  });
});
