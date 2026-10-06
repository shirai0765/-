import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, advanceWeek, applyAction } from '../src/sim/engine';
import { getOffers, applyDealAction } from '../src/sim/deals';
import { LOTS } from '../src/data/district';
import { createEnvelope, decodeEnvelope, validateGame, saveGame, loadGame, listBackups, restoreBackup, deleteSave, importGame } from '../src/persistence';

beforeEach(async () => { await loadGame(); await deleteSave(); });

type StoredSaveRow = { key: string; revision: number; week: number; companyName: string; envelope: Awaited<ReturnType<typeof createEnvelope>> };

async function rawSaveRows(): Promise<StoredSaveRow[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('shibuya-capital-v1', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('saves', 'readonly');
      const rows = tx.objectStore('saves').getAll();
      tx.oncomplete = () => { db.close(); resolve(rows.result as StoredSaveRow[]); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  });
}

/** Fault injection changes only the primary envelope, preserving its observed revision. */
async function damagePrimary(withoutBackups = false): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('shibuya-capital-v1', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('saves', 'readwrite'), store = tx.objectStore('saves');
      const rows = store.getAll();
      rows.onsuccess = () => {
        const primary = (rows.result as StoredSaveRow[]).find(row => row.key === 'primary')!;
        store.put({ ...primary, envelope: { ...primary.envelope, checksum: '0'.repeat(64) } });
        if (withoutBackups) for (const row of rows.result as StoredSaveRow[]) if (row.key.startsWith('backup:')) store.delete(row.key);
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  });
}

async function clearRawSaves(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('shibuya-capital-v1', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    };
    request.onerror = () => reject(request.error);
  });
}

async function freshPersistenceTab() {
  vi.resetModules();
  return import('../src/persistence');
}

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

describe('explicit damaged-primary replacement', () => {
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await clearRawSaves(); });

  async function observeDamage(tab: Awaited<ReturnType<typeof freshPersistenceTab>>) {
    try {
      await tab.loadGame();
      throw new Error('Expected the damaged primary to fail decoding');
    } catch (error) {
      expect(error).toBeInstanceOf(tab.SaveError);
      const damaged = error as InstanceType<typeof tab.SaveError>;
      expect(damaged.kind).toBe('damaged-primary');
      expect(damaged.replacementToken).toBeDefined();
      return damaged.replacementToken!;
    }
  }

  it.each(['new company', 'valid import'] as const)('replaces a fresh-tab damaged primary without backups only for the confirmed %s', async route => {
    await saveGame(createGame('破損前の会社', 8048));
    await damagePrimary(true);
    const damagedRows = await rawSaveRows();
    expect(damagedRows).toHaveLength(1);
    const tab = await freshPersistenceTab(), token = await observeDamage(tab);
    const importedState = advanceWeek(applyAction(createGame('読み込む既存会社', 8049), { type: 'openStore', lotId: 'center-01', style: 'takeaway' }));
    const envelope = await createEnvelope(importedState), text = JSON.stringify(envelope);
    const next = route === 'new company' ? createGame('確認した新しい会社', 8050)
      : await tab.importGame({ size: text.length, text: async () => text } as File);

    await expect(tab.saveGame(next)).rejects.toThrow('確認');
    await expect(tab.saveGame(next, { replaceDamagedPrimary: {} as typeof token })).rejects.toThrow('確認');
    expect(await rawSaveRows()).toEqual(damagedRows);
    await tab.saveGame(next, { replaceDamagedPrimary: token });
    const committed = await rawSaveRows();
    expect(committed.find(row => row.key === 'primary')!.revision).toBe(damagedRows[0].revision + 1);
    expect(await decodeEnvelope(committed.find(row => row.key === 'primary')!.envelope)).toEqual(next);

    // A successful commit consumes the capability before any subsequent load.
    await expect(tab.saveGame(next, { replaceDamagedPrimary: token })).rejects.toMatchObject({ kind: 'conflict' });
    expect(await rawSaveRows()).toEqual(committed);
    await tab.saveGame({ ...next, cash: next.cash + 1 });
    expect(await tab.loadGame()).toEqual({ ...next, cash: next.cash + 1 });
  });

  it('preserves existing usable backups when committing an explicitly chosen new company', async () => {
    const old = createGame('復元できる旧会社', 8051);
    await saveGame(old);
    await saveGame(advanceWeek(old));
    await damagePrimary();
    const oldBackups = (await rawSaveRows()).filter(row => row.key.startsWith('backup:'));
    expect(oldBackups).toHaveLength(2);
    const tab = await freshPersistenceTab(), token = await observeDamage(tab);
    const next = createGame('選び直した会社', 8052);
    await tab.saveGame(next, { replaceDamagedPrimary: token });
    const rows = await rawSaveRows();
    for (const backup of oldBackups) expect(rows.find(row => row.key === backup.key)).toEqual(backup);
    expect((await tab.listBackups()).map(backup => backup.key)).toContain(oldBackups[0].key);
    expect(await tab.restoreBackup(oldBackups[0].key)).toEqual(await decodeEnvelope(oldBackups[0].envelope));
  });

  it('retains damaged data and its confirmation token when replacement validation fails', async () => {
    await saveGame(createGame('保持すべき破損データ', 8053));
    await damagePrimary(true);
    const tab = await freshPersistenceTab(), token = await observeDamage(tab), before = await rawSaveRows();
    const next = createGame('再試行する会社', 8054);
    await expect(tab.saveGame({ ...next, cash: NaN }, { replaceDamagedPrimary: token })).rejects.toThrow();
    expect(await rawSaveRows()).toEqual(before);
    await expect(tab.saveGame(next)).rejects.toThrow('確認');
    expect(await rawSaveRows()).toEqual(before);
    await tab.saveGame(next, { replaceDamagedPrimary: token });
    expect(await tab.loadGame()).toEqual(next);
  });

  it('rolls back every primary and backup write on transaction failure, then permits a confirmed retry', async () => {
    await saveGame(createGame('原子的に保持する会社', 8055));
    await damagePrimary();
    const tab = await freshPersistenceTab(), token = await observeDamage(tab), before = await rawSaveRows();
    const next = createGame('再保存する会社', 8056), nativePut = IDBObjectStore.prototype.put;
    let queuedWrites = 0;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = nativePut.call(this, value, key);
      if (this.name === 'saves' && this.transaction.mode === 'readwrite' && ++queuedWrites === 2) this.transaction.abort();
      return request;
    });
    try {
      await expect(tab.saveGame(next, { replaceDamagedPrimary: token })).rejects.toThrow('保存できません');
    } finally { put.mockRestore(); }
    expect(queuedWrites).toBe(2);
    expect(await rawSaveRows()).toEqual(before);
    await tab.saveGame(next, { replaceDamagedPrimary: token });
    expect(await tab.loadGame()).toEqual(next);
  });

  it('rejects damaged-data confirmation after another tab commits instead of rebasing its revision', async () => {
    const previous = createGame('別タブで更新する会社', 8057);
    await saveGame(previous);
    await damagePrimary();
    const tab = await freshPersistenceTab(), token = await observeDamage(tab);
    const newer = { ...previous, cash: 42 };
    await saveGame(newer);
    const newerRows = await rawSaveRows();
    await expect(tab.saveGame(createGame('古い確認による上書き', 8058), { replaceDamagedPrimary: token })).rejects.toThrow('別のタブ');
    expect(await rawSaveRows()).toEqual(newerRows);
    expect(await loadGame()).toEqual(newer);
  });

  it('does not authorize destructive replacement when storage or native crypto is unavailable', async () => {
    const current = createGame('正常な保存を保持', 8059);
    await saveGame(current);
    const rows = await rawSaveRows(), tab = await freshPersistenceTab();
    const digest = vi.spyOn(crypto.subtle, 'digest').mockRejectedValueOnce(new DOMException('Crypto backend unavailable', 'OperationError'));
    const cryptoError = await tab.loadGame().catch(error => error);
    digest.mockRestore();
    expect(cryptoError).not.toMatchObject({ kind: 'damaged-primary' });
    expect(cryptoError.replacementToken).toBeUndefined();
    expect(await rawSaveRows()).toEqual(rows);
    expect(await tab.loadGame()).toEqual(current);

    const unavailableCryptoTab = await freshPersistenceTab();
    vi.stubGlobal('crypto', undefined);
    try {
      const unavailableCryptoError = await unavailableCryptoTab.loadGame().catch(error => error);
      expect(unavailableCryptoError).toBeInstanceOf(unavailableCryptoTab.SaveError);
      expect(unavailableCryptoError.kind).toBe('unavailable');
      expect(unavailableCryptoError.replacementToken).toBeUndefined();
    } finally { vi.unstubAllGlobals(); }
    expect(await rawSaveRows()).toEqual(rows);

    const storageTab = await freshPersistenceTab();
    vi.stubGlobal('indexedDB', undefined);
    try {
      const storageError = await storageTab.loadGame().catch(error => error);
      expect(storageError).toBeInstanceOf(storageTab.SaveError);
      expect(storageError.message).toContain('IndexedDB');
      expect(storageError).not.toMatchObject({ kind: 'damaged-primary' });
      expect(storageError.replacementToken).toBeUndefined();
    } finally { vi.unstubAllGlobals(); }
    expect(await rawSaveRows()).toEqual(rows);
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
