import { expect, it } from 'vitest';
import { runScenario } from '../scripts/balance-report';
import { createGame, advanceWeek, applyAction, previewWeek, getWeekOutlook, getSummary, managerPlan } from '../src/sim/engine';
import { LOTS } from '../src/data/district';
import { STOCKS } from '../src/data/stocks';
import baseline from './fixtures/neighborhoods-v070-baseline.json';
import type { GameState } from '../src/model';

it('delegation changes poor decisions without expanding payroll/advertising or changing identity', () => {
  let s = applyAction(createGame(), { type: 'openStore', lotId: LOTS.find(x => x.available)!.id, style: 'standard' });
  s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { manager: true, staff: 6, price: 2500, marketing: 30000 } });
  const old = s.stores[0], plan = managerPlan(s, old), r = previewWeek(s), next = advanceWeek(s);
  expect(plan.price).toBeLessThan(old.price); expect(plan.staff * 52000 + plan.marketing).toBeLessThanOrEqual(old.staff * 52000 + old.marketing);
  expect(next.stores[0].price).toBe(plan.price); expect(next.stores[0].name).toBe(old.name); expect(next.lastReport!.netProfit).toBeGreaterThanOrEqual(getWeekOutlook(s).netProfit.min); expect(next.lastReport!.netProfit).toBeLessThanOrEqual(getWeekOutlook(s).netProfit.max); expect(previewWeek(s)).toEqual(r); expect(next.cash).toBe(s.cash + next.lastReport!.cashChange);
});
it('dividends depend on fundamentals rather than speculative quote changes', () => {
  const s = createGame(); const stock = STOCKS.find(x => x.dividendYield > 0)!;
  s.positions = [{ stockId: stock.id, shares: 100, averageCost: stock.basePrice }]; const dividend = previewWeek(s).dividendsReceived;
  s.stockPrices[stock.id] *= 10; expect(previewWeek(s).dividendsReceived).toBe(dividend);
});
it('a stock portfolio has actual downside across seeded scenarios, while cafe expansion has earned progress', () => {
  const portfolios = Array.from({ length: 20 }, (_, i) => runScenario(i + 1, 'growth'));
  expect(portfolios.some(r => r.netWorth < 12000000)).toBe(true);
  expect(portfolios.some(r => r.netWorth > 12000000)).toBe(true);
  expect(portfolios.every(r => r.drawdown > .03)).toBe(true);
  const cafe = runScenario(4, 'cafes'); expect(cafe.ruined).toBe(false); expect(cafe.stores).toBeGreaterThanOrEqual(3); expect(cafe.ipoWeek).not.toBeNull(); expect(cafe.ipoWeek!).toBeGreaterThanOrEqual(12);
});
it('supports a 100-year save with bounded detailed history and finite market state', () => {
  let s = createGame(); for (let i = 0; i < 5200; i++) s = advanceWeek(s);
  expect(s.history).toHaveLength(520); expect(s.week).toBe(5201); expect(Object.values(s.stockPrices).every(x => Number.isFinite(x) && x >= 1)).toBe(true);
}, 20000);
it('distinguishes capital investment from mismanaged debt-funded operations', () => {
  const prudent = runScenario(11, 'cafes', 104), reckless = runScenario(11, 'overstaffed-debt', 26);
  expect(prudent.ruined).toBe(false); expect(prudent.ipoWeek).not.toBeNull();
  expect(reckless.ruined).toBe(true); expect(reckless.weeks).toBe(1);
});
it('reports an explicit failure warning before committing a borrowed loss', () => {
  const s = applyAction(createGame(), { type: 'borrow', amount: 1000000, weeks: 52 });
  expect(getWeekOutlook(s).risk.debtLossPossible).toBe(true);
  expect(s.gameOver).toBe(false); expect(advanceWeek(s).gameOver).toBe(true);
});
it('delegation supports a larger profitable group while unmanaged expansion stops at its economic limit', () => {
  let openingSpend = 0, settledEarnings = 0, finalState: GameState | null = null;
  const openings: { week: number; lotId: string }[] = [];
  const manual = runScenario(7, 'cafes', 104), delegated = runScenario(7, 'managed-cafes', 104, {
    observeOpening(before, after) {
      expect(before.cash).toBe(12_000_000 - openingSpend + settledEarnings);
      expect(before.cash - after.cash).toBe(3_600_000);
      openingSpend += before.cash - after.cash;
      openings.push({ week: before.week, lotId: after.stores.at(-1)!.lotId });
      expect(after.cash).toBe(12_000_000 - openingSpend + settledEarnings);
    },
    observeSettlement(state) {
      expect(state.lastReport!.cashChange).toBe(state.lastReport!.netProfit);
      settledEarnings += state.lastReport!.netProfit;
      expect(state.cash).toBe(12_000_000 - openingSpend + settledEarnings);
      finalState = state;
    },
  });
  expect(manual.ruined).toBe(false); expect(delegated.ruined).toBe(false);
  expect(delegated.stores).toBeGreaterThan(manual.stores);
  expect(delegated.netWorth).toBeGreaterThan(manual.netWorth);
  expect(delegated.ipoWeek).not.toBeNull(); expect(delegated.ipoWeek!).toBeLessThan(manual.ipoWeek!);
  // Four additional high-traffic choices replace four quieter stores. Keep the
  // old 48-site ceiling on that same opportunity set below; the 72-site policy
  // is checked against its paid openings, actual earnings and equipment book.
  expect(delegated.stores).toBe(8);
  expect(manual.netWorth).toBeLessThan(100000000);
  expect(openings).toEqual([
    { week: 1, lotId: 'miyashita-16' }, { week: 2, lotId: 'miyashita-01' },
    { week: 3, lotId: 'dogenzaka-18' }, { week: 5, lotId: 'center-18' },
    { week: 7, lotId: 'miyashita-18' }, { week: 9, lotId: 'center-03' },
    { week: 11, lotId: 'miyashita-07' }, { week: 12, lotId: 'dogenzaka-01' },
  ]);
  const state = finalState! as GameState;
  expect(openingSpend).toBe(28_800_000);
  expect(state.stores.every(store => store.manager && store.level === 1 && store.style === 'standard')).toBe(true);
  expect(state.loans).toEqual([]); expect(state.positions).toEqual([]);
  expect(state.properties).toEqual([]); expect(state.subsidiaries).toEqual([]);
  expect(state.listed).toBe(false);
  expect(delegated.netWorth).toBe(state.cash + 8 * 3_600_000 * .55);
  expect(delegated.netWorth).toBe(237_076_768); // Seeded 72-site route, not a universal earnings ceiling.
}, 20000);
it('preserves the old 48-site adaptive benchmark and its 208m ceiling on the same opportunity set', () => {
  const candidateLotIds = baseline.lots.map(({ lot }) => lot.id);
  expect(candidateLotIds).toHaveLength(48);
  const delegated = runScenario(7, 'managed-cafes', 104, { candidateLotIds });
  expect(delegated.ruined).toBe(false); expect(delegated.stores).toBe(8);
  expect(delegated.netWorth).toBe(158_229_935);
  expect(delegated.weeklyProfit).toBe(1_506_265);
  expect(delegated.ipoWeek).toBe(16);
  expect(delegated.netWorth).toBeLessThan(208_000_000);
}, 20000);
it('keeps the original profitable managed route bounded and funded only by paid openings and settled earnings', () => {
  // Original 32-site, seed-7 policy before manager recovery. Fixing the route
  // separates a change in investment choices from amplification of the same stores.
  const openings = new Map([
    [1, 'dogenzaka-02'], [2, 'sakuragaoka-01'], [3, 'dogenzaka-04'], [7, 'center-05'],
    [11, 'dogenzaka-08'], [15, 'dogenzaka-06'], [19, 'sakuragaoka-02'], [25, 'miyashita-05'],
  ]);
  let state = createGame('Original managed route', 7), openingSpend = 0, settledEarnings = 0;
  for (let week = 1; week <= 104; week++) {
    const lotId = openings.get(week);
    if (lotId) {
      const cashBefore = state.cash;
      state = applyAction(state, { type: 'openStore', lotId, style: 'standard' });
      state = applyAction(state, { type: 'updateStore', storeId: state.stores.at(-1)!.id, changes: { manager: true } });
      expect(cashBefore - state.cash).toBe(3600000);
      openingSpend += cashBefore - state.cash;
    }
    state = advanceWeek(state);
    settledEarnings += state.lastReport!.netProfit;
    expect(state.cash).toBe(12000000 - openingSpend + settledEarnings);
    expect(state.gameOver).toBe(false);
  }
  expect(openingSpend).toBe(28800000);
  expect(state.stores).toHaveLength(8);
  expect(state.stores.every(store => store.manager && store.level === 1)).toBe(true);
  expect(state.loans).toHaveLength(0); expect(state.listed).toBe(false);
  const summary = getSummary(state);
  expect(summary.netWorth).toBe(state.cash + 8 * 3600000 * .55);
  expect(summary.netWorth).toBe(102239149); // Identical to the retained pre-recovery route.
  expect(summary.netWorth).toBeLessThan(150000000);
}, 20000);
