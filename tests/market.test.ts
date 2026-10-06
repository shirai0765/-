import { describe, expect, it } from 'vitest';
import { STOCKS } from '../src/data/stocks';
import universe from '../docs/market-universe.json';

describe('diverse offline investing universe', () => {
  it('has exactly 95 unique equities and 5 REITs verified against dated JPX rows', () => {
    expect(STOCKS).toHaveLength(100);
    expect(new Set(STOCKS.map(s => s.id)).size).toBe(100);
    expect(STOCKS.reduce((a,s) => { a[s.market!] = (a[s.market!] ?? 0) + 1; return a; }, {} as Record<string,number>))
      .toEqual({ Prime:40, Standard:30, Growth:25, REIT:5 });
    for (const stock of STOCKS) {
      const official = universe.find(r => r.code === stock.code);
      expect(official).toMatchObject({ realName:stock.realName, market:stock.market, jpxAsOf:'20260930' });
      expect(stock.name).not.toBe(stock.realName);
    }
    expect(universe.filter(r => r.market === 'Prime' && r.jpxSizeClass.startsWith('TOPIX Small')).length).toBeGreaterThanOrEqual(20);
  });
  it('provides affordable shares and expensive property units without equating cheap with safe', () => {
    expect(STOCKS.filter(s => s.basePrice <= 500).length).toBeGreaterThanOrEqual(8);
    expect(STOCKS.some(s => s.basePrice <= 100 && s.profile === 'speculative')).toBe(true);
    expect(STOCKS.filter(s => s.market === 'REIT').every(s => s.basePrice >= 10000)).toBe(true);
    expect(new Set(STOCKS.map(s => s.sector)).size).toBeGreaterThanOrEqual(15);
    expect(STOCKS.some(s => s.dividendYield === 0)).toBe(true);
    expect(STOCKS.some(s => s.profile === 'income' && s.dividendYield >= .03)).toBe(true);
    expect(Math.min(...STOCKS.filter(s => s.profile === 'speculative').map(s => s.volatility)))
      .toBeGreaterThan(Math.max(...STOCKS.filter(s => s.profile === 'defensive').map(s => s.volatility)));
  });
  it('ships complete finite JPY references with quote timestamps, including alphanumeric codes', () => {
    expect(STOCKS.some(s => /[A-Z]/.test(s.code))).toBe(true);
    for (const stock of STOCKS) {
      expect(stock.priceKind).toBe('market-reference');
      expect(stock.basePrice).toBeGreaterThan(0);
      expect(Number.isFinite(stock.basePrice)).toBe(true);
      expect(Number.isFinite(Date.parse(stock.priceDate!))).toBe(true);
      expect(stock.sourceUrl).toContain(`${stock.code}.T`);
      expect(stock.volatility).toBeGreaterThan(0);
      expect(stock.dividendYield).toBeGreaterThanOrEqual(0);
    }
  });
});
