import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/model';
import legacyEnvelope from './fixtures/legacy-0.3.2-envelope.json';
import { STOCKS } from '../src/data/stocks';
import { advanceWeek, applyAction, createGame, getWeekOutlook, previewWeek } from '../src/sim/engine';
import { marketIntegrationWeeks } from '../src/sim/marketAcquisitions';
import { getActiveMarketOperation, getMarketOperationSettlement, MARKET_OPERATION_PROJECT_LIMIT } from '../src/sim/marketOperations';
import { runManagedWeeks } from '../src/sim/managedWeeks';
import { createEnvelope, decodeEnvelope, deleteSave, listBackups, loadGame, restoreBackup, saveGame, validateGame } from '../src/persistence';

const stock = STOCKS[0];
// Funded accounting fixtures isolate save/timing behavior; they are not campaign evidence.
function operatingFixture(): GameState {
  const state = createGame('事業投資の保存テスト', 765);
  state.week = 10; state.cash = 1_000_000_000; state.listed = true; state.reputation = 95;
  state.marketAcquisitions = { research: [{ stockId: stock.id, week: 1 }], companies: [{ stockId: stock.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 1 + marketIntegrationWeeks(stock, 'autonomous') }] };
  return state;
}
function start(state = operatingFixture()) {
  return applyAction(state, { type: 'startMarketOperation', sector: stock.sector, policy: 'growth' });
}
const roundTrip = async (state: GameState) => decodeEnvelope(await createEnvelope(state));
function nearingExpiry() {
  let state = start();
  while (state.week < state.marketOperations!.projects[0].endWeek - 2) state = advanceWeek(state);
  return state;
}

beforeEach(async () => { await loadGame(); await deleteSave(); });

describe('optional market-operation saves', () => {
  it('preserves legacy payload/checksum and leaves unused state and reports absent', async () => {
    const legacy = await decodeEnvelope(legacyEnvelope), envelope = await createEnvelope(legacy);
    expect(envelope.payload).toBe(legacyEnvelope.payload);
    expect(envelope.checksum).toBe(legacyEnvelope.checksum);
    expect(legacy).not.toHaveProperty('marketOperations');
    expect(legacy.lastReport).not.toHaveProperty('marketOperation');
    const unused = operatingFixture(), restored = await roundTrip(unused);
    expect(restored).toEqual(unused);
    expect(advanceWeek(restored)).toEqual(advanceWeek(unused));
    expect(advanceWeek(restored)).not.toHaveProperty('marketOperations');
    expect(advanceWeek(restored).lastReport).not.toHaveProperty('marketOperation');
  });

  it('keeps settled reports unchanged on starting, renewing, and later current-week acquisition', async () => {
    const before = advanceWeek(operatingFixture()), report = structuredClone(before.lastReport);
    let state = start(before);
    expect(state.lastReport).toEqual(report);
    state = await roundTrip(advanceWeek(await roundTrip(state)));
    expect(state.lastReport!.marketOperation).toEqual(getMarketOperationSettlement({ ...state, week: state.week - 1 }));
    const settled = structuredClone(state.lastReport);
    const laterStock = STOCKS.find(candidate => candidate.id !== stock.id)!;
    state = applyAction(state, { type: 'researchMarketCompany', stockId: laterStock.id });
    state = applyAction(state, { type: 'acquireMarketCompany', stockId: laterStock.id, mode: 'autonomous' });
    expect((await roundTrip(state)).lastReport).toEqual(settled);
    while (getActiveMarketOperation(state)) state = await roundTrip(advanceWeek(state));
    const final = structuredClone(state.lastReport);
    expect(start(state).lastReport).toEqual(final);
    expect((await roundTrip(start(state))).lastReport).toEqual(final);
  });

  it('settles exactly 26 weeks across reloads and expires without a second upfront debit', async () => {
    let state = start();
    const project = state.marketOperations!.projects[0], reports = [];
    for (let i = 0; i < 26; i++) {
      const before = state.cash;
      state = await roundTrip(advanceWeek(await roundTrip(state)));
      expect(state.cash).toBe(Math.round(before + state.lastReport!.cashChange));
      reports.push(state.lastReport!);
    }
    expect(state.week).toBe(project.endWeek);
    expect(reports.every(report => report.marketOperation?.startWeek === project.startWeek)).toBe(true);
    expect(reports.map(report => report.week)).toEqual(Array.from({ length: 26 }, (_, i) => project.startWeek + i));
    expect(getActiveMarketOperation(state)).toBeUndefined();
    const without = structuredClone(state); delete without.marketOperations;
    expect(previewWeek(state).netProfit).toBe(previewWeek(without).netProfit);
    expect(previewWeek(state).cashChange).toBe(previewWeek(without).cashChange);
    expect(advanceWeek(state).lastReport).not.toHaveProperty('marketOperation');
  });

  const malformed: [string, (state: GameState) => void][] = [
    ['unknown wrapper field', state => { Object.assign(state.marketOperations!, { multiplier: 2 }); }],
    ['unknown project field', state => { Object.assign(state.marketOperations!.projects[0], { weeklyProfit: 999_999_999 }); }],
    ['unknown sector', state => { state.marketOperations!.projects[0].sector = 'outside'; }],
    ['inherited policy name', state => { Object.assign(state.marketOperations!.projects[0], { policy: 'constructor' }); }],
    ['future start', state => { state.marketOperations!.projects[0].startWeek++; state.marketOperations!.projects[0].endWeek++; }],
    ['fractional start', state => { state.marketOperations!.projects[0].startWeek += .5; state.marketOperations!.projects[0].endWeek += .5; }],
    ['wrong duration', state => { state.marketOperations!.projects[0].endWeek--; }],
    ['duplicate project', state => { state.marketOperations!.projects.push({ ...state.marketOperations!.projects[0] }); }],
    ['overlapping historical program', state => { state.week = 50; state.marketOperations!.projects.push({ ...state.marketOperations!.projects[0], startWeek: 20, endWeek: 46 }); }],
    ['out-of-order historical program', state => { state.marketOperations!.projects.unshift({ ...state.marketOperations!.projects[0], startWeek: 5, endWeek: 31 }); }],
    ['program before cohort maturity', state => { state.marketOperations!.projects[0].startWeek = 1; state.marketOperations!.projects[0].endWeek = 27; }],
    ['missing owned cohort', state => { delete state.marketAcquisitions; }],
    ['pre-IPO program', state => { state.listed = false; }],
    ['oversized journal', state => { state.marketOperations!.projects = Array.from({ length: MARKET_OPERATION_PROJECT_LIMIT + 1 }, () => ({ ...state.marketOperations!.projects[0] })); }],
  ];
  it.each(malformed)('rejects %s rather than sanitizing it into a valid save', (_, mutate) => {
    const state = start(); mutate(state);
    expect(() => validateGame(state)).toThrow();
  });

  it('bounds the renewal journal while keeping the latest active program', async () => {
    let state = operatingFixture();
    for (let i = 0; i <= MARKET_OPERATION_PROJECT_LIMIT; i++) {
      state = start(state);
      if (i < MARKET_OPERATION_PROJECT_LIMIT) state.week = state.marketOperations!.projects.at(-1)!.endWeek;
    }
    expect(state.marketOperations!.projects).toHaveLength(MARKET_OPERATION_PROJECT_LIMIT);
    expect(state.marketOperations!.projects[0].startWeek).toBe(36);
    expect(getActiveMarketOperation(state)).toEqual(state.marketOperations!.projects.at(-1));
    expect(await roundTrip(state)).toEqual(state);
  });

  it('rejects forged actual results, even with consistent delta arithmetic or a recomputed checksum', async () => {
    const state = advanceWeek(start());
    await saveGame(state);
    for (const mutate of [
      (copy: GameState) => { copy.lastReport!.marketOperation!.weeklyCost++; },
      (copy: GameState) => { copy.lastReport!.marketOperation!.profitDelta++; },
      (copy: GameState) => { copy.lastReport!.marketOperation!.baselineProfit++; copy.lastReport!.marketOperation!.operatingProfit++; },
      (copy: GameState) => { copy.lastReport!.marketOperation!.week++; },
      (copy: GameState) => { Object.assign(copy.lastReport!.marketOperation!, { refund: 1_000_000 }); },
      (copy: GameState) => { copy.lastReport!.marketOperation!.baselineProfit = NaN; },
      (copy: GameState) => { delete copy.marketOperations; },
    ]) {
      const bad = structuredClone(state); mutate(bad);
      expect(() => validateGame(bad)).toThrow();
      await expect(saveGame(bad)).rejects.toThrow();
    }
    const bad = structuredClone(state); bad.lastReport!.marketOperation!.profitDelta++;
    const envelope = await createEnvelope(state); envelope.payload = JSON.stringify(bad);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(envelope.payload));
    envelope.checksum = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    await expect(decodeEnvelope(envelope)).rejects.toMatchObject({ kind: 'invalid-data' });
    expect(await loadGame()).toEqual(state);
  });

  it('retains CAS conflicts and restores an active program backup exactly', async () => {
    const initial = start(); await saveGame(initial);
    const activeBackup = (await listBackups())[0];
    vi.resetModules(); const otherTab = await import('../src/persistence');
    expect(await otherTab.loadGame()).toEqual(initial);
    const next = advanceWeek(initial); await saveGame(next);
    await expect(otherTab.saveGame(next)).rejects.toMatchObject({ kind: 'conflict' });
    expect(await loadGame()).toEqual(next);
    expect(await restoreBackup(activeBackup.key)).toEqual(initial);
    expect(await loadGame()).toEqual(initial);
    expect(advanceWeek((await loadGame())!)).toEqual(next);
  });
});

describe('durable managed operating-program expiry', () => {
  it.each([true, false])('saves the final settlement before pausing, stopOnNewOffers=%s', async stopOnNewOffers => {
    const initial = nearingExpiry(), endWeek = initial.marketOperations!.projects[0].endWeek;
    let durable: GameState | undefined; const order: string[] = [];
    const result = await runManagedWeeks(initial, 4, {
      commit: async next => { durable = await roundTrip(next); order.push(`save:${next.week}`); },
      onCommit: next => { expect(next).toEqual(durable); order.push(`notify:${next.week}`); },
    }, { stopOnNewOffers });
    expect(result.reports).toHaveLength(2);
    expect(result.state.week).toBe(endWeek);
    expect(result.reports.at(-1)!.week).toBe(endWeek - 1);
    expect(result.reports.at(-1)!.marketOperation).toBeDefined();
    expect(result.state).toEqual(durable);
    expect(getActiveMarketOperation(result.state)).toBeUndefined();
    expect(result.stopReason).toContain('26週間');
    expect(order.slice(-2)).toEqual([`save:${endWeek}`, `notify:${endWeek}`]);
  });

  it('returns the prior active week when saving expiry fails and retries deterministically', async () => {
    const initial = nearingExpiry(); let writes = 0, notified = 0;
    const failed = await runManagedWeeks(initial, 4, {
      commit: async () => { if (++writes === 2) throw new Error('quota exhausted'); },
      onCommit: () => { notified++; },
    }, { stopOnNewOffers: false });
    expect(failed.state).toEqual(advanceWeek(initial));
    expect(failed.reports).toHaveLength(1); expect(notified).toBe(1);
    expect(getActiveMarketOperation(failed.state)).toBeDefined();
    expect(failed.stopReason).toContain('quota exhausted');
    const retry = await runManagedWeeks(await roundTrip(failed.state), 4, { commit: async next => { await roundTrip(next); } }, { stopOnNewOffers: false });
    expect(retry.state).toEqual(advanceWeek(failed.state));
    expect(retry.reports).toHaveLength(1); expect(retry.stopReason).toContain('26週間');
  });

  it.each([true, false])('keeps debt and cash preflight stops ahead of expiry, stopOnNewOffers=%s', async stopOnNewOffers => {
    for (const risk of ['debt', 'cash'] as const) {
      const initial = advanceWeek(nearingExpiry());
      initial.loans = [{ id: 'risk-fixture', principal: 1_000_000_000, remaining: 1_000_000_000, annualRate: risk === 'debt' ? 1 : 0, weeksLeft: 52, weeklyPayment: 1_000_000_000 }];
      if (risk === 'cash') initial.cash = 0;
      expect(getWeekOutlook(initial).risk[risk === 'debt' ? 'debtLossPossible' : 'cashShortfallPossible']).toBe(true);
      let writes = 0;
      const result = await runManagedWeeks(initial, 4, { commit: async () => { writes++; } }, { stopOnNewOffers });
      expect(writes).toBe(0); expect(result.state).toBe(initial); expect(result.reports).toEqual([]);
      expect(result.stopReason).toContain(risk === 'debt' ? '借入' : '現預金');
    }
  });
});
