import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameAction, GameState, StoreStyle } from '../src/model';
import { LOTS } from '../src/data/district';
import { advanceWeek, applyAction, createGame, previewWeek } from '../src/sim/engine';
import { createEnvelope, decodeEnvelope, deleteSave, importGame, loadGame, saveGame } from '../src/persistence';
import baseline from './fixtures/neighborhoods-v070-baseline.json';
import legacy from './fixtures/legacy-0.3.2-envelope.json';

beforeEach(async () => { await loadGame(); await deleteSave(); });

describe('v080 expansion preserves prior companies and site economics', () => {
  it('preserves all 48 original economic lot values and array indices exactly', () => {
    expect(baseline.sourceCommit).toBe('57e90617f841e8be0a452a949f0d2afd758cdf68');
    expect(baseline.lots).toHaveLength(48);
    for (const old of baseline.lots) expect(LOTS[old.index]).toEqual(old.lot);
    expect(LOTS.filter(lot => lot.available)).toHaveLength(72);
    const oldIds = new Set(baseline.lots.map(row => row.lot.id));
    expect(LOTS.filter(lot => lot.available && !oldIds.has(lot.id))).toHaveLength(24);
  });

  it('imports the original old-version payload unchanged without adding sites or records to the company', async () => {
    const expected = JSON.parse(legacy.payload) as GameState;
    const decoded = await decodeEnvelope(legacy);
    expect(decoded).toEqual(expected);
    const envelope = await createEnvelope(decoded);
    expect(envelope.payload).toBe(legacy.payload);
    expect(envelope.checksum).toBe(legacy.checksum);
    expect(decoded.stores.map(store => store.lotId)).toEqual(['center-01']);
    expect(decoded).not.toHaveProperty('campaignAchievement');
    await saveGame(decoded);
    expect(await loadGame()).toEqual(expected);
  });

  it.each(baseline.scenarios)('keeps payload, forecast, real settlements, and stock RNG exact for $name', async scenario => {
    let state = createGame('v070旧区画回帰fixture', scenario.seed);
    if ('syntheticCash' in scenario) state.cash = scenario.syntheticCash!;
    for (const action of scenario.actions) state = applyAction(state, action as GameAction);
    expect(state).toEqual(scenario.initial);
    const envelope = await createEnvelope(state);
    expect(envelope.payload).toBe(scenario.initialPayload);
    expect(envelope.checksum).toBe(scenario.initialChecksum);
    for (const expected of scenario.timeline) {
      expect(previewWeek(state)).toEqual(expected.forecast);
      state = advanceWeek(state);
      expect(state.stockPrices).toEqual(expected.next.stockPrices);
      expect(state).toEqual(expected.next);
    }
    expect(await decodeEnvelope(await createEnvelope(state))).toEqual(state);
  });

  it('saves every added lot as ordinary version-one store/property references and restores exact settled progress', async () => {
    // Synthetic funding isolates the 24 new reference paths; this is not a
    // natural campaign or an assertion that all 24 investments are affordable.
    const oldIds = new Set(baseline.lots.map(row => row.lot.id));
    const added = LOTS.filter(lot => lot.available && !oldIds.has(lot.id));
    expect(added).toHaveLength(24);
    let state = createGame('v080新区画保存fixture', 765);
    state.cash = 100_000_000_000;
    for (const [index, lot] of added.entries()) {
      state = applyAction(state, { type: 'openStore', lotId: lot.id, style: (['standard', 'premium', 'takeaway'] as StoreStyle[])[index % 3] });
      state = applyAction(state, { type: 'buyProperty', lotId: lot.id });
    }
    expect(state.stores.map(store => store.lotId)).toEqual(added.map(lot => lot.id));
    expect(state.properties.map(property => property.lotId)).toEqual(added.map(lot => lot.id));
    const envelope = await createEnvelope(state);
    expect(envelope.schema).toBe(1);
    expect(JSON.parse(envelope.payload).version).toBe(1);
    const text = JSON.stringify(envelope);
    expect(await importGame({ size: new TextEncoder().encode(text).length, text: async () => text } as File)).toEqual(state);
    await saveGame(state);
    expect(await loadGame()).toEqual(state);

    state = advanceWeek((await loadGame())!);
    expect(state.week).toBe(2);
    expect(state.lastReport!.storeResults).toHaveLength(24);
    expect(state.openingRecords!.every(record => record.result?.week === 1)).toBe(true);
    expect(state).not.toHaveProperty('campaignAchievement');
    await saveGame(state);
    expect(await loadGame()).toEqual(state);

    const closed = state.stores[0];
    state = applyAction(state, { type: 'closeStore', storeId: closed.id });
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties[0].id });
    await saveGame(state);
    expect(await loadGame()).toEqual(state);
    expect(state.stores.some(store => store.lotId === closed.lotId)).toBe(false);
    expect(state.properties.some(property => property.lotId === closed.lotId)).toBe(false);
    expect(await decodeEnvelope(await createEnvelope(state))).toEqual(state);
  });
});
