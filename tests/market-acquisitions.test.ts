import { describe, expect, it } from 'vitest';
import { createGame, applyAction, previewWeek, advanceWeek, getSummary } from '../src/sim/engine';
import { getMarketAcquisitionTargets, getMarketGroupFinancials, marketCompanyDefinition } from '../src/sim/marketAcquisitions';
import { STOCKS } from '../src/data/stocks';
import { createEnvelope, decodeEnvelope, validateGame } from '../src/persistence';
// Explicit wealthy unit fixture: accounting tests, not evidence of campaign playtime.
function fixture() { const s = createGame(); s.cash = 2000000000; s.reputation = 95; s.listed = true; return s; }
const profitableStock = STOCKS.find(s => s.dividendYield > 0)!;
function researched(id = profitableStock.id) { return applyAction(fixture(), { type: 'researchMarketCompany', stockId: id }); }
describe('friendly market-company acquisition', () => {
  it('offers all100 targets with game valuations,5fundassets and differentiatedresearch/modechoices', () => {
    const targets = getMarketAcquisitionTargets(createGame());
    expect(targets).toHaveLength(100); expect(new Set(targets.map(t => t.stockId)).size).toBe(100);
    expect(targets.filter(t => t.isFund)).toHaveLength(5);
    expect(new Set(targets.map(t => t.quotePrice)).size).toBeGreaterThan(50);
    expect(targets.every(t => t.quality === null && t.choices.length === 2)).toBe(true);
  });
  it('requires paid research once and respects small-company credit and larger-company listing gates', () => {
    let s = fixture(); s.listed = false; s.reputation = 39;
    const small = getMarketAcquisitionTargets(s).find(t => !t.requiresListing && t.minReputation === 40)!;
    expect(() => applyAction(s, { type: 'acquireMarketCompany', stockId: small.stockId, mode: 'autonomous' })).toThrow('調査');
    const cash = s.cash; s = applyAction(s, { type: 'researchMarketCompany', stockId: small.stockId });
    expect(s.cash).toBe(cash - small.researchCost);
    expect(() => applyAction(s, { type: 'researchMarketCompany', stockId: small.stockId })).toThrow('完了');
    expect(() => applyAction(s, { type: 'acquireMarketCompany', stockId: small.stockId, mode: 'autonomous' })).toThrow('信用');
    s.reputation = 40;
    expect(applyAction(s, { type: 'acquireMarketCompany', stockId: small.stockId, mode: 'autonomous' }).marketAcquisitions!.companies).toHaveLength(1);
    const large = getMarketAcquisitionTargets(s).find(t => t.requiresListing)!;
    s = applyAction(s, { type: 'researchMarketCompany', stockId: large.stockId });
    expect(() => applyAction(s, { type: 'acquireMarketCompany', stockId: large.stockId, mode: 'autonomous' })).toThrow('上場');
  });
  it('fairly nets portfolio holdings including excess value once, removes dividends and blocks trading', () => {
    let s = researched(); const target = getMarketAcquisitionTargets(s).find(t => t.stockId === profitableStock.id)!;
    const shares = Math.ceil(target.quotePrice / s.stockPrices[target.stockId]) + 10;
    s = applyAction(s, { type: 'buyStock', stockId: target.stockId, shares });
    const cash = s.cash, marketValue = Math.round(shares * s.stockPrices[target.stockId]);
    expect(previewWeek(s).dividendsReceived).toBeGreaterThan(0);
    s = applyAction(s, { type: 'acquireMarketCompany', stockId: target.stockId, mode: 'autonomous' });
    expect(s.cash).toBe(cash + marketValue - target.quotePrice); expect(s.positions).toHaveLength(0);
    expect(previewWeek(s).dividendsReceived).toBe(0);
    expect(() => applyAction(s, { type: 'buyStock', stockId: target.stockId, shares: 1 })).toThrow('グループ傘下');
    expect(() => applyAction(s, { type: 'sellStock', stockId: target.stockId, shares: 1 })).toThrow('グループ傘下');
    expect(() => applyAction(s, { type: 'acquireMarketCompany', stockId: target.stockId, mode: 'autonomous' })).toThrow('既に');
  });
  it('charges capital once, forecasts integration costs and actual operating profit exactly through completion', () => {
    let s = researched(); const target = getMarketAcquisitionTargets(s).find(t => t.stockId === profitableStock.id)!, choice = target.choices.find(c => c.mode === 'integrated')!;
    const cash = s.cash, worth = getSummary(s).netWorth;
    s = applyAction(s, { type: 'acquireMarketCompany', stockId: target.stockId, mode: 'integrated' });
    expect(s.cash).toBe(cash - choice.upfrontCost);
    expect(getSummary(s).netWorth).toBe(worth - choice.upfrontCost + Math.round(marketCompanyDefinition(profitableStock).baseValue * .4));
    expect(previewWeek(s).netProfit).toBe(-choice.weeklyIntegrationCost);
    for (let i = 0; i <= choice.leadWeeks; i++) {
      const before = s.cash, forecast = previewWeek(s), next = advanceWeek(s);
      expect(next.cash).toBe(before + forecast.cashChange); expect(next.lastReport).toEqual(forecast); s = next;
    }
    expect(getMarketGroupFinancials(s).integrating).toBe(0); expect(getMarketGroupFinancials(s).operating).toBe(1);
    expect(previewWeek(s).netProfit).toBeGreaterThan(0);
    expect(getSummary(s).borrowingLimit).toBeLessThan(target.quotePrice);
  });
  it('bounds share-price-linked quotes and includes pending costs in debt failure forecasts', () => {
    let s = researched(); const d = marketCompanyDefinition(profitableStock);
    s.stockPrices[profitableStock.id] *= 1000;
    expect(getMarketAcquisitionTargets(s).find(t => t.stockId === profitableStock.id)!.quotePrice).toBe(Math.round(d.baseValue * 1.6));
    s.stockPrices[profitableStock.id] = .01;
    expect(getMarketAcquisitionTargets(s).find(t => t.stockId === profitableStock.id)!.quotePrice).toBe(Math.round(d.baseValue * .6));
    s = applyAction(s, { type: 'borrow', amount: 1000000, weeks: 52 });
    s = applyAction(s, { type: 'acquireMarketCompany', stockId: profitableStock.id, mode: 'autonomous' });
    expect(previewWeek(s).netProfit).toBeLessThan(0); expect(previewWeek(s).headlines.some(h => h.includes('ゲームオーバー'))).toBe(true);
    expect(advanceWeek(s).gameOverReason).toContain('借入');
  });
  it('roundtrips pending companies, accepts oldv1 and rejects forged profits/times/IDs/duplicates/holdings', async () => {
    expect(validateGame(createGame()).marketAcquisitions).toBeUndefined();
    const s = applyAction(researched(), { type: 'acquireMarketCompany', stockId: profitableStock.id, mode: 'autonomous' });
    const restored = await decodeEnvelope(await createEnvelope(s)); expect(advanceWeek(restored)).toEqual(advanceWeek(s));
    for (const change of [
      (x: typeof s) => { Object.assign(x.marketAcquisitions!.companies[0], { weeklyProfit: 999999999 }); },
      (x: typeof s) => { x.marketAcquisitions!.companies[0].readyWeek++; },
      (x: typeof s) => { x.marketAcquisitions!.research[0].week = x.week + 1; },
      (x: typeof s) => { x.marketAcquisitions!.companies[0].stockId = 'unknown'; },
      (x: typeof s) => { x.marketAcquisitions!.companies.push({ ...x.marketAcquisitions!.companies[0] }); },
      (x: typeof s) => { x.positions.push({ stockId: profitableStock.id, shares: 1, averageCost: 1 }); },
    ]) { const bad = structuredClone(s); change(bad); expect(() => validateGame(bad)).toThrow(); }
  });
});
it('can hold all100 distinct operating businesses without portfolio dividends or duplicate company earnings', () => {
  let s = fixture(); s.cash = 50000000000;
  for (const stock of STOCKS) {
    s = applyAction(s, { type: 'researchMarketCompany', stockId: stock.id });
    s = applyAction(s, { type: 'acquireMarketCompany', stockId: stock.id, mode: 'autonomous' });
  }
  expect(s.marketAcquisitions!.companies).toHaveLength(100);
  while (getMarketGroupFinancials(s).integrating > 0) s = advanceWeek(s);
  const financials = getMarketGroupFinancials(s), report = previewWeek(s);
  expect(financials.operating).toBe(100); expect(financials.weeklyProfit).toBeGreaterThan(0);
  expect(report.operatingProfit).toBe(financials.weeklyProfit); expect(report.dividendsReceived).toBe(0);
  expect(advanceWeek(s).cash).toBe(s.cash + report.cashChange);
  expect(validateGame(s).marketAcquisitions!.companies).toHaveLength(100);
});
