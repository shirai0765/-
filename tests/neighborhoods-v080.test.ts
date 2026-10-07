import { beforeAll, describe, expect, it } from 'vitest';
import { LOTS, DISTRICTS } from '../src/data/district';
import { V080_NEIGHBORHOOD_LOTS } from '../src/data/neighborhoodsV080';
import type { GameState, Lot, StoreStyle } from '../src/model';
import { advanceWeek, applyAction, createGame } from '../src/sim/engine';

// Three public operating choices, not a search over settlement draws. Every
// company starts with its normal cash, seed and reputation and settles once.
const profiles: { id: string; style: StoreStyle; price: number; quality: number; staff: number; upgrade: boolean }[] = [
  { id: 'small-takeaway', style: 'takeaway', price: 450, quality: 55, staff: 4, upgrade: false },
  { id: 'standard', style: 'standard', price: 700, quality: 85, staff: 4, upgrade: false },
  { id: 'expanded-premium', style: 'premium', price: 1150, quality: 100, staff: 6, upgrade: true },
];
type Trial = { initial: GameState; opened: GameState; configured: GameState; settled: GameState };
const trials = new Map<string, Trial>();
const key = (lot: Lot, profile: string) => `${lot.id}:${profile}`;
const trial = (lot: Lot, profile: string) => trials.get(key(lot, profile))!;
const districts = Object.keys(DISTRICTS);
const cheapest = districts.map(district => V080_NEIGHBORHOOD_LOTS.filter(lot => lot.district === district).reduce((a, b) => a.rent < b.rent ? a : b));
const dominates = (a: Lot, b: Lot) => a.footfall >= b.footfall && a.affluence >= b.affluence && a.rent <= b.rent && a.purchasePrice <= b.purchasePrice
  && (a.footfall > b.footfall || a.affluence > b.affluence || a.rent < b.rent || a.purchasePrice < b.purchasePrice);

describe('optional outer-neighborhood operating choices', () => {
  beforeAll(() => {
    for (const lot of V080_NEIGHBORHOOD_LOTS) for (const profile of profiles) {
      const initial = createGame('外周の実決算比較', 765);
      const opened = applyAction(initial, { type: 'openStore', lotId: lot.id, style: profile.style });
      const upgraded = profile.upgrade ? applyAction(opened, { type: 'upgradeStore', storeId: opened.stores[0].id }) : opened;
      const configured = applyAction(upgraded, { type: 'updateStore', storeId: opened.stores[0].id, changes: { price: profile.price, quality: profile.quality, staff: profile.staff, marketing: 0 } });
      trials.set(key(lot, profile.id), { initial, opened, configured, settled: advanceWeek(configured) });
    }
  });

  it('adds six registered choices per district with traffic, customer and fixed-cost tradeoffs', () => {
    expect(V080_NEIGHBORHOOD_LOTS).toHaveLength(24);
    for (const district of districts) {
      const choices = V080_NEIGHBORHOOD_LOTS.filter(lot => lot.district === district);
      expect(choices.map(lot => lot.id)).toEqual(Array.from({ length: 6 }, (_, i) => `${district}-${i + 13}`));
      const lowCost = choices[0], quietAffluent = choices[2], busy = choices[5];
      expect(quietAffluent.footfall).toBeLessThan(lowCost.footfall);
      expect(quietAffluent.affluence).toBeGreaterThan(lowCost.affluence);
      expect(quietAffluent.rent).toBeGreaterThan(lowCost.rent);
      expect(busy.footfall).toBeGreaterThan(lowCost.footfall);
      expect(busy.rent).toBeGreaterThan(lowCost.rent * 3);
      expect(busy.purchasePrice).toBeGreaterThan(lowCost.purchasePrice * 3);
      for (const lot of choices) {
        expect(LOTS.find(candidate => candidate.id === lot.id)).toEqual(lot);
        expect(lot.purchasePrice / (lot.rent * 52)).toBeGreaterThan(8);
        expect(lot.purchasePrice / (lot.rent * 52)).toBeLessThan(15);
        expect(choices.some(other => other.id !== lot.id && dominates(other, lot)), lot.id).toBe(false);
      }
    }
  });

  it('opens all new sites and settles each profile through ordinary cash-funded actions', () => {
    for (const lot of V080_NEIGHBORHOOD_LOTS) for (const profile of profiles) {
      const { initial, opened, configured, settled } = trial(lot, profile.id);
      expect(initial).toMatchObject({ cash: 12_000_000, reputation: 10, week: 1, loans: [], stores: [] });
      expect(opened.openingRecords![0].cashBefore).toBe(initial.cash);
      expect(configured.cash).toBeGreaterThanOrEqual(6_000_000);
      expect(settled.lastReport!.week).toBe(1);
      expect(settled.lastReport!.storeResults).toHaveLength(1);
      expect(settled.lastReport!.storeResults[0].id).toBe(configured.stores[0].id);
      expect(settled.cash).toBe(configured.cash + settled.lastReport!.netProfit);
      expect(settled.gameOver).toBe(false);
      expect(settled.loans).toEqual([]);
      expect(initial.stores).toEqual([]);
    }
  });

  it('leaves a modest cash-funded first-store option in each district', () => {
    for (const lot of cheapest) {
      const { configured, settled } = trial(lot, 'small-takeaway');
      expect(lot.rent).toBeLessThanOrEqual(86_000);
      expect(configured.cash).toBe(9_000_000);
      expect(settled.lastReport!.netProfit, lot.id).toBeGreaterThan(0);
      expect(settled.lastReport!.storeResults[0].satisfaction).toBeGreaterThanOrEqual(65);
    }
  });

  it('makes high fixed costs matter while allowing capacity and quality investment to recover', () => {
    const highCost = V080_NEIGHBORHOOD_LOTS.filter(lot => lot.rent >= 170_000);
    expect(highCost.length).toBeGreaterThanOrEqual(8);
    for (const lot of highCost) {
      const small = trial(lot, 'small-takeaway').settled.lastReport!;
      const expanded = trial(lot, 'expanded-premium').settled.lastReport!;
      expect(small.netProfit, lot.id).toBeLessThan(0);
      expect(expanded.netProfit, lot.id).toBeGreaterThan(0);
      expect(expanded.storeResults[0].satisfaction, lot.id).toBeGreaterThanOrEqual(65);
    }
  });

  it('does not make any added site an unavoidable loss under these public operating choices', () => {
    for (const lot of V080_NEIGHBORHOOD_LOTS) {
      const expanded = trial(lot, 'expanded-premium').settled.lastReport!;
      expect(expanded.netProfit, lot.id).toBeGreaterThan(0);
      expect(expanded.storeResults[0].satisfaction, lot.id).toBeGreaterThanOrEqual(65);
      const results = profiles.map(profile => trial(lot, profile.id).settled.lastReport!.netProfit);
      expect(new Set(results).size, lot.id).toBeGreaterThan(1);
    }
  });
});
