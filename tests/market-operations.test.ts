import { describe, expect, it } from 'vitest';
import type { GameState, MarketOperationAction, MarketOperationPolicy } from '../src/model';
import { STOCKS } from '../src/data/stocks';
import { createGame, advanceWeek } from '../src/sim/engine';
import { getMarketGroupFinancials } from '../src/sim/marketAcquisitions';
import { marketCompanyDefinition, marketOperationCosts } from '../src/sim/marketBusinessMath';
import { applyMarketOperationAction, getActiveMarketOperation, getMarketOperationOutcome, getMarketOperationQuote, getMarketOperationSectors, getMarketOperationSettlement, MARKET_OPERATION_PROJECT_LIMIT } from '../src/sim/marketOperations';

// Wealthy isolated accounting fixture, not a claimed public-action campaign.
const first = STOCKS.find(stock => stock.id === 'jp-6731')!;
function fixture(): GameState {
  const s = createGame('事業投資の検証', 1);
  s.week = 3; s.cash = 1_000_000_000; s.listed = true; s.reputation = 95;
  s.marketAcquisitions = { research: [{ stockId: first.id, week: 1 }], companies: [{ stockId: first.id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 3 }] };
  return s;
}
function start(s = fixture(), policy: MarketOperationPolicy = 'growth') {
  return applyMarketOperationAction(s, { type: 'startMarketOperation', sector: first.sector, policy });
}

describe('finite acquired-sector operating programs', () => {
  it('quotes all fixed payments while charging only the initial fee once without mutating the source', () => {
    const before = fixture(), original = structuredClone(before), quote = getMarketOperationQuote(before, first.sector, 'growth');
    const basis = marketCompanyDefinition(first).baseValue;
    expect(quote.baseValue).toBe(basis);
    expect(quote.upfrontCost).toBe(Math.round(basis * .006));
    expect(quote.weeklyCost).toBe(Math.round(basis * .0004));
    expect(quote.totalWeeklyCost).toBe(quote.weeklyCost * 26);
    expect(quote.reserveRequired).toBe(quote.upfrontCost + quote.totalWeeklyCost);
    expect(before).toEqual(original);
    const after = start(before);
    expect(after.cash).toBe(before.cash - quote.upfrontCost);
    expect(after.week).toBe(before.week);
    expect(after.lastReport).toEqual(before.lastReport);
    expect(before).toEqual(original);
    const settlement = getMarketOperationSettlement(after)!;
    const next = advanceWeek(after);
    expect(next.cash).toBe(after.cash + next.lastReport!.cashChange);
    expect(next.lastReport!.operatingProfit).toBe(settlement.operatingProfit);
    expect(settlement.profitDelta).toBe(settlement.operatingProfit - settlement.baselineProfit);
    expect(settlement.weeklyCost).toBe(quote.weeklyCost);
  });

  it('requires IPO and a mature sector; initial affordability and future reserves are distinct', () => {
    const s = fixture(); s.listed = false;
    expect(getMarketOperationQuote(s, first.sector, 'growth').reason).toContain('上場');
    expect(() => start(s)).toThrow('上場');
    s.listed = true; s.marketAcquisitions!.companies[0].readyWeek = 4;
    expect(() => start(s)).toThrow('稼働済み');
    const ready = fixture(), quote = getMarketOperationQuote(ready, first.sector, 'growth');
    ready.cash = quote.upfrontCost - 1;
    expect(() => start(ready)).toThrow('資金');
    ready.cash = quote.upfrontCost;
    expect(getMarketOperationQuote(ready, first.sector, 'growth').canStart).toBe(true);
    expect(start(ready).cash).toBe(0);
    expect(quote.reserveRequired).toBeGreaterThan(quote.upfrontCost);
  });

  it('prevents policy switching and any second sector program until exactly 26 settlements complete', () => {
    let s = start(), project = s.marketOperations!.projects[0];
    expect(project.endWeek - project.startWeek).toBe(26);
    expect(() => start(s, 'stability')).toThrow('進行中');
    const otherSector = STOCKS.find(stock => stock.sector !== first.sector)!.sector;
    expect(() => applyMarketOperationAction(s, { type: 'startMarketOperation', sector: otherSector, policy: 'growth' })).toThrow('進行中');
    for (let i = 0; i < 26; i++) {
      expect(getActiveMarketOperation(s)).toEqual(project);
      expect(getMarketOperationSettlement(s)?.weeklyCost).toBe(marketOperationCosts(s, project).weeklyCost);
      s = advanceWeek(s);
    }
    expect(s.week).toBe(project.endWeek);
    expect(getActiveMarketOperation(s)).toBeUndefined();
    expect(getMarketOperationSettlement(s)).toBeUndefined();
    expect(getMarketGroupFinancials(s)).toEqual(getMarketGroupFinancials({ ...s, marketOperations: undefined }));
    const renewed = start(s, 'stability');
    expect(renewed.marketOperations!.projects).toHaveLength(2);
    expect(renewed.marketOperations!.projects[1].startWeek).toBe(project.endWeek);
  });

  it('uses game base values and only already-operating members, not current stock prices or pending companies', () => {
    const s = fixture(), sameSector = STOCKS.find(stock => stock.sector === first.sector && stock.id !== first.id)!;
    s.marketAcquisitions!.research.push({ stockId: sameSector.id, week: 1 });
    s.marketAcquisitions!.companies.push({ stockId: sameSector.id, mode: 'integrated', acquiredWeek: 1, readyWeek: 7 });
    const quoted = getMarketOperationQuote(s, first.sector, 'growth');
    expect(quoted.eligibleCount).toBe(1);
    expect(quoted.baseValue).toBe(marketCompanyDefinition(first).baseValue);
    s.stockPrices[first.id] *= 100;
    expect(getMarketOperationQuote(s, first.sector, 'growth')).toEqual(quoted);
    expect(getMarketOperationSectors(s)).toMatchObject([{ sector: first.sector, eligibleCount: 1, integratingCount: 1 }]);
    const program = start(s); program.week = 7;
    expect(marketOperationCosts(program, program.marketOperations!.projects[0]).baseValue).toBe(quoted.baseValue);
  });

  it('rejects invalid runtime policies, targets and actions instead of manufacturing nonfinite money', () => {
    const s = fixture();
    for (const policy of ['constructor', '__proto__', 'toString', 'retain', null, 1]) {
      expect(() => applyMarketOperationAction(s, { type: 'startMarketOperation', sector: first.sector, policy } as MarketOperationAction)).toThrow('方針');
    }
    expect(() => applyMarketOperationAction(s, { type: 'startMarketOperation', sector: 'unknown', policy: 'growth' })).toThrow('業種');
    expect(() => applyMarketOperationAction(s, { type: 'cancelMarketOperation', sector: first.sector, policy: 'growth' } as unknown as MarketOperationAction)).toThrow('操作');
    s.gameOver = true;
    expect(() => start(s)).toThrow('終了');
  });

  it('reconstructs only closed results and cannot inspect an uncommitted or future plan', () => {
    let s = start(), project = s.marketOperations!.projects[0];
    expect(getMarketOperationOutcome(s, project)).toMatchObject({ settledWeeks: 0, complete: false, baselineProfit: 0, operatingProfit: 0, netContribution: -marketOperationCosts(s, project).upfrontCost });
    const row = getMarketOperationSettlement(s)!;
    s = advanceWeek(s);
    expect(getMarketOperationOutcome(s, project)).toMatchObject({ settledWeeks: 1, baselineProfit: row.baselineProfit, operatingProfit: row.operatingProfit, weeklyCosts: row.weeklyCost, netContribution: row.profitDelta - marketOperationCosts(s, project).upfrontCost });
    expect(() => getMarketOperationOutcome(s, { ...project, startWeek: s.week + 1, endWeek: s.week + 27 })).toThrow('記録');
    expect(() => getMarketOperationOutcome({ ...s, marketOperations: undefined }, project)).toThrow('記録');
    for (let i = 1; i < 26; i++) s = advanceWeek(s);
    const completed = getMarketOperationOutcome(s, project);
    s = advanceWeek(s);
    expect(getMarketOperationOutcome(s, project)).toEqual(completed);
    expect(completed.settledWeeks).toBe(26);
    expect(completed.complete).toBe(true);
  });

  it('bounds retained decision history without deleting active economic effects or claiming earlier records', () => {
    let s = fixture();
    for (let i = 0; i <= MARKET_OPERATION_PROJECT_LIMIT; i++) {
      s = start(s);
      if (i < MARKET_OPERATION_PROJECT_LIMIT) s.week += 26;
    }
    expect(s.marketOperations!.projects).toHaveLength(MARKET_OPERATION_PROJECT_LIMIT);
    expect(s.marketOperations!.projects[0].startWeek).toBe(29);
    expect(getActiveMarketOperation(s)).toEqual(s.marketOperations!.projects.at(-1));
    expect(getMarketOperationSettlement(s)).toBeDefined();
  });
});
