import { describe, expect, it } from 'vitest';
import { STOCKS } from '../src/data/stocks';
import { applyAction, createGame, previewWeek } from '../src/sim/engine';
import { quoteStockTrade, settleStockTradeCash } from '../src/sim/stockTrading';
import { createEnvelope, decodeEnvelope } from '../src/persistence';

function partitions(total: number): number[][] {
  if (total === 0) return [[]];
  return Array.from({ length: total }, (_, i) => i + 1).flatMap(first => partitions(total - first).map(rest => [first, ...rest]));
}

describe('whole-yen stock settlement', () => {
  it.each([
    [1584.5, 1, 1585, 1584], [1584.5, 2, 3169, 3169],
    [170.1, 1, 171, 170], [170.1, 5, 851, 850],
    [0.29, 100, 29, 29], [1.1, 100, 110, 110],
    [1.005, 1000, 1005, 1005], [1000, 3, 3000, 3000],
    [1e-7, 10_000_000, 1, 1], [1e-7, 1, 1, 0], [0, 1, 0, 0],
  ])('quotes price %s × %s shares without binary floating-point rounding drift', (price, shares, buy, sell) => {
    expect(quoteStockTrade(price, shares, 'buy')).toBe(buy);
    expect(quoteStockTrade(price, shares, 'sell')).toBe(sell);
  });

  it('never earns money from any partition of 1–6 shares at all 100 initial reference prices', () => {
    // Checking the cheapest buy partition against the best sell partition covers
    // every buy/sell partition pair, without relying on the implementation formula.
    for (const stock of STOCKS) for (let count = 1; count <= 6; count++) {
      const choices = partitions(count);
      const paid = choices.map(parts => parts.reduce((sum, n) => sum + quoteStockTrade(stock.basePrice, n, 'buy'), 0));
      const received = choices.map(parts => parts.reduce((sum, n) => sum + quoteStockTrade(stock.basePrice, n, 'sell'), 0));
      expect(Math.max(...received), `${stock.id}, ${count} shares`).toBeLessThanOrEqual(Math.min(...paid));
    }
  });

  it('removes the public 9005 two-share purchase then separate-sales exploit', () => {
    const initial = createGame(), stockId = 'jp-9005';
    expect(initial.stockPrices[stockId]).toBe(1584.5);
    let s = applyAction(initial, { type: 'buyStock', stockId, shares: 2 });
    expect(initial.cash - s.cash).toBe(3169);
    expect(s.positions[0].averageCost).toBe(1584.5);
    s = applyAction(s, { type: 'sellStock', stockId, shares: 1 });
    s = applyAction(s, { type: 'sellStock', stockId, shares: 1 });
    expect(s.cash - initial.cash).toBe(-1);
    expect(s.positions).toHaveLength(0);
    expect(s.week).toBe(initial.week);
    expect(s.stockPrices).toEqual(initial.stockPrices);
  });

  it('removes the public NTT five separate purchases then combined-sale exploit', () => {
    const initial = createGame(), stockId = 'jp-9432';
    expect(initial.stockPrices[stockId]).toBe(170.1);
    let s = initial;
    for (let i = 0; i < 5; i++) s = applyAction(s, { type: 'buyStock', stockId, shares: 1 });
    expect(initial.cash - s.cash).toBe(855);
    expect(s.positions[0].averageCost).toBe(171);
    s = applyAction(s, { type: 'sellStock', stockId, shares: 5 });
    expect(s.cash - initial.cash).toBe(-5);
    expect(s.positions).toHaveLength(0);
  });

  it('uses actual purchase cash in a weighted average and does not rewrite it on a partial sale', () => {
    let s = applyAction(createGame(), { type: 'buyStock', stockId: 'jp-9432', shares: 2 });
    expect(s.positions[0].averageCost).toBe(170.5);
    s = applyAction(s, { type: 'buyStock', stockId: 'jp-9432', shares: 1 });
    expect(s.positions[0].averageCost).toBe(512 / 3);
    s = applyAction(s, { type: 'sellStock', stockId: 'jp-9432', shares: 1 });
    expect(s.positions[0].averageCost).toBe(512 / 3);
    expect(s.positions[0].shares).toBe(2);
  });

  it('rejects one-yen-short cash using the real ceiling price without mutating the state', () => {
    const s = createGame(); s.cash = 170; // Isolated payment-boundary fixture, not a funding route.
    const before = structuredClone(s);
    expect(() => applyAction(s, { type: 'buyStock', stockId: 'jp-9432', shares: 1 })).toThrow('現預金');
    expect(s).toEqual(before);
    const exact = applyAction({ ...s, cash: 171 }, { type: 'buyStock', stockId: 'jp-9432', shares: 1 });
    expect(exact.cash).toBe(0);
    expect(exact.positions[0].averageCost).toBe(171);
  });

  it('keeps the trade out of weekly operating profit and preserves the save shape', async () => {
    const initial = createGame(), report = previewWeek(initial);
    const bought = applyAction(initial, { type: 'buyStock', stockId: 'jp-9005', shares: 1 });
    expect(previewWeek(bought).netProfit).toBe(report.netProfit);
    const envelope = await createEnvelope(bought), restored = await decodeEnvelope(envelope);
    expect(restored).toEqual(bought);
    expect(envelope.schema).toBe(1);
    expect(restored.stockPrices['jp-9005']).toBe(1584.5);
    expect(Object.keys(restored.positions[0])).toEqual(['stockId', 'shares', 'averageCost']);
    expect(Object.keys(restored).sort()).toEqual(Object.keys(initial).sort());
  });

  it('rejects invalid quantities, directions, prices, and imprecisely representable settlement totals', () => {
    for (const shares of [0, -1, .5, NaN, Infinity, 1_000_000_001]) expect(() => quoteStockTrade(1, shares, 'buy')).toThrow();
    for (const price of [-1, NaN, Infinity, -Infinity]) expect(() => quoteStockTrade(price, 1, 'buy')).toThrow();
    expect(() => quoteStockTrade(1, 1, 'invalid' as 'buy')).toThrow();
    expect(() => quoteStockTrade(1e21, 1, 'buy')).toThrow('上限');
    expect(() => quoteStockTrade(1e12, 1e9, 'sell')).toThrow('上限');
    expect(quoteStockTrade(Number.MAX_SAFE_INTEGER, 1, 'buy')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects imprecise cash balances that could otherwise make one-yen purchases free', () => {
    const s = createGame(); s.cash = 2 ** 54; s.stockPrices['jp-9432'] = 1;
    const before = structuredClone(s);
    expect(() => applyAction(s, { type: 'buyStock', stockId: 'jp-9432', shares: 1 })).toThrow('範囲外');
    expect(s).toEqual(before);
    expect(() => settleStockTradeCash(Number.MAX_SAFE_INTEGER, 1, 'sell')).toThrow('上限');
    expect(() => settleStockTradeCash(170.5, 171, 'buy')).toThrow('現預金');
    expect(settleStockTradeCash(Number.MAX_SAFE_INTEGER, 1, 'buy')).toBe(Number.MAX_SAFE_INTEGER - 1);
    expect(settleStockTradeCash(Number.MAX_SAFE_INTEGER - 1, 1, 'sell')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('preserves legacy fractional cash rounding once, without a repeatable round-trip gain', async () => {
    const legacy = createGame(); legacy.cash += .5; legacy.stockPrices['jp-9432'] = 1;
    let s = await decodeEnvelope(await createEnvelope(legacy));
    const initial = s.cash;
    for (let i = 0; i < 100; i++) {
      const before = s.cash;
      s = applyAction(s, { type: 'buyStock', stockId: 'jp-9432', shares: 1 });
      s = applyAction(s, { type: 'sellStock', stockId: 'jp-9432', shares: 1 });
      expect(s.cash - before).toBe(i === 0 ? .5 : 0);
    }
    expect(s.cash - initial).toBe(.5);
    expect(s.positions).toHaveLength(0);
    expect(settleStockTradeCash(171.4, 171, 'buy')).toBe(0);
    expect(settleStockTradeCash(171.5, 171, 'buy')).toBe(1);
    expect(settleStockTradeCash(.5, 171, 'sell')).toBe(171.5);
  });
});
