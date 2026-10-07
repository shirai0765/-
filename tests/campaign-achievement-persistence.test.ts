import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../src/model';
import { ACQUISITION_TARGETS, DISTRICTS, LOTS } from '../src/data/district';
import { STOCKS } from '../src/data/stocks';
import { advanceWeek, applyAction, createGame, getWeekOutlook } from '../src/sim/engine';
import { getCampaignCompletion } from '../src/sim/campaign';
import { settleCampaignAchievement } from '../src/sim/campaignAchievement';
import { DEVELOPMENT_CHOICES } from '../src/sim/development';
import { marketIntegrationWeeks } from '../src/sim/marketAcquisitions';
import { runManagedWeeks } from '../src/sim/managedWeeks';
import { createEnvelope, decodeEnvelope, deleteSave, importGame, loadGame, SaveError, saveGame, validateGame } from '../src/persistence';

beforeEach(async () => { await loadGame(); await deleteSave(); });

// Synthetic funded endgame fixtures verify persistence boundaries. They are
// not evidence of naturally earned capital, campaign pacing, or play duration.
function fundedEndgameFixture(): GameState {
  let state = createGame('達成記録の保存fixture', 42);
  state.cash = 100_000_000_000;
  state.week = 20;
  state.listed = true;
  state.reputation = 90;
  state = applyAction(state, { type: 'openStore', lotId: 'sakuragaoka-06', style: 'standard' });
  state = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { price: 1_200, quality: 85, staff: 5, marketing: 0 } });
  for (const district of Object.keys(DISTRICTS)) {
    const lot = LOTS.find(candidate => candidate.available && candidate.district === district)!;
    state = applyAction(state, { type: 'buyProperty', lotId: lot.id });
  }
  state.subsidiaries = ACQUISITION_TARGETS.map(target => ({ id: target.id, name: target.name, sector: target.sector, purchasePrice: target.price, weeklyProfit: target.weeklyProfit, risk: target.risk }));
  state.marketAcquisitions = {
    research: STOCKS.map(stock => ({ stockId: stock.id, week: 1 })),
    companies: STOCKS.map(stock => ({ stockId: stock.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 1 + marketIntegrationWeeks(stock, 'autonomous') })),
  };
  state.development = { programs: (Object.keys(DISTRICTS) as (keyof typeof DISTRICTS)[]).map(districtId => ({
    districtId,
    completedChoiceIds: [0, 1, 2].map(phase => DEVELOPMENT_CHOICES.find(choice => choice.districtId === districtId && choice.phase === phase && choice.id.endsWith('-commerce'))!.id),
  })) };
  return state;
}

function earnedFixture(): GameState {
  const state = advanceWeek(fundedEndgameFixture());
  expect(state.campaignAchievement).toBeDefined();
  return state;
}

async function importEnvelope(state: GameState): Promise<GameState> {
  const text = JSON.stringify(await createEnvelope(state));
  return importGame({ size: new TextEncoder().encode(text).length, text: async () => text } as File);
}

describe('campaign achievement persistence', () => {
  it('keeps old complete-company saves unchanged and does not backfill on validation, import, save, reload, or actions', async () => {
    const old = earnedFixture();
    delete old.campaignAchievement;
    const before = structuredClone(old);
    expect(getCampaignCompletion(old).currentRequirementsMet).toBe(true);
    expect(getCampaignCompletion(old).complete).toBe(false);
    expect(validateGame(old)).toEqual(before);
    const envelope = await createEnvelope(old);
    expect(envelope.payload).toBe(JSON.stringify(before));
    const decoded = await decodeEnvelope(envelope);
    const imported = await importEnvelope(decoded);
    expect(imported).toEqual(before);
    expect(Object.hasOwn(imported, 'campaignAchievement')).toBe(false);
    await saveGame(imported);
    const reloaded = (await loadGame())!;
    expect(reloaded).toEqual(before);
    expect(Object.hasOwn(reloaded, 'campaignAchievement')).toBe(false);
    const settings = applyAction(reloaded, { type: 'settings', changes: { quality: 'low' } });
    expect(Object.hasOwn(settings, 'campaignAchievement')).toBe(false);
    expect(settings.week).toBe(before.week);
    expect(settings.cash).toBe(before.cash);
    expect(settings.lastReport).toEqual(before.lastReport);
    expect(old).toEqual(before);

    const newlySettled = advanceWeek(reloaded);
    expect(newlySettled.campaignAchievement?.week).toBe(reloaded.week);
    expect(newlySettled.campaignAchievement?.week).not.toBe(reloaded.lastReport!.week);
    expect(newlySettled.week).toBe(reloaded.week + 1);
  });

  it('records the first actual settlement without changing it and retains the receipt through spending, sales, loss, export, and reload', async () => {
    const initial = fundedEndgameFixture();
    const before = structuredClone(initial);
    let state = advanceWeek(initial);
    const receipt = structuredClone(state.campaignAchievement!);
    expect(receipt.week).toBe(state.lastReport!.week);
    expect(receipt.week).toBe(state.week - 1);
    expect(receipt.cash).toBe(state.cash);
    expect(receipt.netProfit).toBe(state.lastReport!.netProfit);
    expect(initial).toEqual(before);
    const unrecorded = structuredClone(state);
    delete unrecorded.campaignAchievement;
    const unrecordedBefore = structuredClone(unrecorded);
    expect(settleCampaignAchievement(unrecorded, unrecorded.lastReport!)).toEqual(receipt);
    expect(unrecorded).toEqual(unrecordedBefore);
    expect(Object.hasOwn(unrecorded, 'campaignAchievement')).toBe(false);
    const snapshot = structuredClone(state);
    expect(settleCampaignAchievement(state, state.lastReport!)).toBe(state.campaignAchievement);
    expect(state).toEqual(snapshot);

    const extraLot = LOTS.find(lot => lot.available && !state.properties.some(property => property.lotId === lot.id))!;
    state = applyAction(state, { type: 'buyProperty', lotId: extraLot.id });
    expect(state.cash).not.toBe(receipt.cash);
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties.find(property => LOTS.find(lot => lot.id === property.lotId)!.district === 'miyashita')!.id });
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties.find(property => LOTS.find(lot => lot.id === property.lotId)!.district === 'dogenzaka')!.id });
    expect(state.properties.length).toBeLessThan(receipt.propertyCount);
    expect(getCampaignCompletion(state).currentRequirementsMet).toBe(false);
    expect(getCampaignCompletion(state).complete).toBe(true);
    expect(state.campaignAchievement).toEqual(receipt);

    // Deliberately ruin this funded fixture through supported store and loan
    // actions, then settle a real loss; do not fabricate a historical report.
    for (const lot of LOTS.filter(candidate => candidate.available)) {
      if (!state.stores.some(store => store.lotId === lot.id)) state = applyAction(state, { type: 'openStore', lotId: lot.id, style: 'standard' });
      const store = state.stores.find(candidate => candidate.lotId === lot.id)!;
      state = applyAction(state, { type: 'updateStore', storeId: store.id, changes: { price: 200, quality: 20, staff: 30, marketing: 500_000, manager: false } });
    }
    state = applyAction(state, { type: 'borrow', amount: 1_000_000, weeks: 52 });
    expect(getWeekOutlook(state).netProfit.max).toBeLessThan(0);
    state = advanceWeek(state);
    expect(state.lastReport!.netProfit).toBeLessThan(0);
    expect(state.gameOver).toBe(true);
    expect(state.campaignAchievement).toEqual(receipt);
    const exported = await createEnvelope(state);
    expect(await decodeEnvelope(exported)).toEqual(state);
    expect(await importEnvelope(state)).toEqual(state);
    await saveGame(state);
    expect(await loadGame()).toEqual(state);
    expect((await loadGame())!.campaignAchievement).toEqual(receipt);
  });

  it('publishes an earned achievement only after its primary save succeeds and retries the same settlement', async () => {
    const initial = fundedEndgameFixture();
    const before = structuredClone(initial);
    await saveGame(initial);
    let candidate: GameState | undefined;
    let notifications = 0;
    const failed = await runManagedWeeks(initial, 4, {
      commit: async next => { candidate = next; throw new SaveError('fixture: primary save unavailable'); },
      onCommit: () => { notifications++; },
    });
    expect(candidate!.campaignAchievement).toBeDefined();
    expect(failed.state).toBe(initial);
    expect(failed.reports).toHaveLength(0);
    expect(notifications).toBe(0);
    expect(failed.stopReason).toContain('primary save unavailable');
    expect(Object.hasOwn(failed.state, 'campaignAchievement')).toBe(false);
    expect(await loadGame()).toEqual(before);
    expect(initial).toEqual(before);

    const order: string[] = [];
    const retry = await runManagedWeeks(initial, 4, {
      commit: async next => { await saveGame(next); order.push('saved'); },
      onCommit: next => { expect(next).toEqual(candidate); order.push('published'); },
    });
    expect(order).toEqual(['saved', 'published']);
    expect(retry.reports).toHaveLength(1);
    expect(retry.state).toEqual(candidate);
    expect(await loadGame()).toEqual(candidate);
    expect(retry.stopReason).toContain('達成');
  });

  it.each([
    ['undefined', undefined], ['null', null], ['array', []], ['string', 'complete'], ['empty object', {}],
  ])('rejects an explicitly present %s record while accepting an absent record', (_label, value) => {
    const state = earnedFixture();
    Object.assign(state, { campaignAchievement: value });
    expect(() => validateGame(state)).toThrow(SaveError);
    delete state.campaignAchievement;
    expect(validateGame(state)).toEqual(state);
  });

  it.each<[string, string, (state: GameState) => unknown]>([
    ['pre-game week', 'week', () => 0],
    ['current unclosed week', 'week', state => state.week],
    ['future week', 'week', state => state.week + 1],
    ['fractional week', 'week', () => 1.5],
    ['negative cash', 'cash', () => -1],
    ['nonfinite cash', 'cash', () => Infinity],
    ['fractional cash', 'cash', () => 1.5],
    ['zero profit', 'netProfit', () => 0],
    ['loss', 'netProfit', () => -1],
    ['nonfinite profit', 'netProfit', () => NaN],
    ['future customers', 'totalCustomers', state => state.totalCustomers + 1],
    ['negative store count', 'storeCount', () => -1],
    ['fractional store count', 'storeCount', () => 1.5],
    ['too many stores', 'storeCount', () => 10_001],
    ['too few district properties', 'propertyCount', () => 3],
    ['too many properties', 'propertyCount', () => 10_001],
    ['incomplete subsidiaries', 'subsidiaries', () => 7],
    ['incomplete market businesses', 'marketBusinesses', () => 99],
    ['incomplete districts', 'districts', () => 3],
    ['extra key', 'completed', () => true],
  ])('rejects a record with %s', (_label, key, value) => {
    const state = earnedFixture();
    Object.assign(state.campaignAchievement!, { [key]: value(state) });
    expect(() => validateGame(state)).toThrow(SaveError);
  });

  it('rejects a missing snapshot field and malformed import without replacing the primary company', async () => {
    const state = earnedFixture();
    await saveGame(state);
    const incomplete = structuredClone(state);
    const record = incomplete.campaignAchievement as unknown as Record<string, unknown>;
    delete record.cash;
    expect(() => validateGame(incomplete)).toThrow(SaveError);

    const envelope = await createEnvelope(state);
    const payload = JSON.stringify({ ...state, campaignAchievement: null });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const text = JSON.stringify({ ...envelope, payload, checksum });
    await expect(importGame({ size: text.length, text: async () => text } as File)).rejects.toThrow(SaveError);
    expect(await loadGame()).toEqual(state);
  });
});
