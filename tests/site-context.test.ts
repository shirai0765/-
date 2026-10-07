import { describe, expect, it } from 'vitest';
import { applyAction, createGame, operatingConditions } from '../src/sim/engine';
import { getFootfallBand, getPurchasingPowerBand, getSiteContext } from '../src/sim/siteContext';
import { LOTS } from '../src/data/district';

describe('observable site context', () => {
  it('uses shared stable street bands and never changes them with a different company plan or seed', () => {
    const original = createGame('Site facts', 1);
    const changed = createGame('Other company', 999);
    changed.reputation = 99;
    const before = structuredClone(original);
    expect(getSiteContext(original, 'center-03')).toEqual(getSiteContext(changed, 'center-03'));
    expect(original).toEqual(before);
    expect([29999, 30000, 49999, 50000].map(value => getFootfallBand(value).id)).toEqual(['quiet', 'steady', 'steady', 'busy']);
    expect(getPurchasingPowerBand(125)).toEqual(getPurchasingPowerBand(1.25));
    expect(getSiteContext(original, 'service-bank')).toBeNull();
    expect(getSiteContext(original, 'missing')).toBeNull();
  });
  it('reports the current lease cost, then zero rent on directly owned premises', () => {
    const state = createGame();
    state.week = 300;
    state.cash = 100_000_000;
    const lot = LOTS.find(candidate => candidate.id === 'dogenzaka-09')!;
    expect(getSiteContext(state, lot.id)?.weeklyRent).toBe(Math.round(lot.rent * operatingConditions(state).rents));
    const owned = applyAction(state, { type: 'buyProperty', lotId: lot.id });
    expect(getSiteContext(owned, lot.id)).toMatchObject({ weeklyRent: 0, ownsProperty: true });
  });
  it('counts nearby own stores while excluding the selected store and distant stores', () => {
    let state = createGame();
    state.cash = 30_000_000;
    for (const lotId of ['sakuragaoka-01', 'sakuragaoka-02', 'center-09']) state = applyAction(state, { type: 'openStore', lotId, style: 'standard' });
    const before = structuredClone(state);
    expect(getSiteContext(state, 'sakuragaoka-01')).toMatchObject({ nearbyOwnStores: 1, nearbyOwnStoreNames: [state.stores[1].name] });
    expect(getSiteContext(state, 'center-09')?.nearbyOwnStores).toBe(0);
    expect(state).toEqual(before);
  });
});
