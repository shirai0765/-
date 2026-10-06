import { expect, it } from 'vitest';
import { runScenario } from '../scripts/balance-report';
import { createGame, advanceWeek, applyAction, previewWeek, managerPlan } from '../src/sim/engine';
import { LOTS } from '../src/data/district';
import { STOCKS } from '../src/data/stocks';

it('delegation changes poor decisions without expanding payroll/advertising or changing identity', () => {
  let s = applyAction(createGame(), { type: 'openStore', lotId: LOTS.find(x => x.available)!.id, style: 'standard' });
  s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { manager: true, staff: 6, price: 2500, marketing: 30000 } });
  const old = s.stores[0], plan = managerPlan(s, old), r = previewWeek(s), next = advanceWeek(s);
  expect(plan.price).toBeLessThan(old.price); expect(plan.staff * 52000 + plan.marketing).toBeLessThanOrEqual(old.staff * 52000 + old.marketing);
  expect(next.stores[0].price).toBe(plan.price); expect(next.stores[0].name).toBe(old.name); expect(next.lastReport).toEqual(r);
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
  expect(previewWeek(s).headlines.some(x => x.includes('ゲームオーバー'))).toBe(true);
  expect(s.gameOver).toBe(false); expect(advanceWeek(s).gameOver).toBe(true);
});
it('delegation supports a larger profitable group while unmanaged expansion stops at its economic limit', () => {
  const manual = runScenario(7, 'cafes', 104), delegated = runScenario(7, 'managed-cafes', 104);
  expect(manual.ruined).toBe(false); expect(delegated.ruined).toBe(false);
  expect(delegated.stores).toBeGreaterThan(manual.stores);
  expect(delegated.netWorth).toBeGreaterThan(manual.netWorth);
  expect(delegated.ipoWeek).not.toBeNull(); expect(delegated.ipoWeek!).toBeLessThan(manual.ipoWeek!);
  // A deliberate manager-led chain remains rewarding without reproducing the old 208m passive cafe result.
  expect(manual.netWorth).toBeLessThan(100000000); expect(delegated.netWorth).toBeLessThan(150000000);
}, 20000);
