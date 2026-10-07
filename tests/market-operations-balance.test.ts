import { describe, expect, it } from 'vitest';
import type { GameState, MarketAcquisitionMode, MarketOperationPolicy, MarketOperationProject, StockDefinition } from '../src/model';
import { STOCKS } from '../src/data/stocks';
import { createGame, applyAction, advanceWeek, previewWeek, getWeekOutlook, getSummary } from '../src/sim/engine';
import { getMarketGroupFinancials, marketIntegrationWeeks } from '../src/sim/marketAcquisitions';
import { calculateMarketGroupFinancials, marketOperationCohort, marketOperationCosts, marketCompanyWeekRevenue } from '../src/sim/marketBusinessMath';
import type { MarketOutcomeMode } from '../src/sim/marketBusinessMath';
import { getMarketOperationQuote, getMarketOperationOutcome, getMarketOperationFinancialEffects } from '../src/sim/marketOperations';

// Explicit funded/owned synthetic fixtures isolate accounting and economics.
// They are not natural campaign runs or evidence of human completion time.
function fixture(seed = 1, week = 7, stocks: StockDefinition[] = STOCKS, mode: MarketAcquisitionMode = 'autonomous'): GameState {
  const s = createGame('経営比較の検証', seed);
  s.cash = 50_000_000_000; s.reputation = 95; s.listed = true; s.week = week;
  s.marketAcquisitions = {
    research: stocks.map(stock => ({ stockId: stock.id, week: 1 })),
    companies: stocks.map(stock => ({ stockId: stock.id, mode, acquiredWeek: 1, readyWeek: 1 + marketIntegrationWeeks(stock, mode) })),
  };
  return s;
}
function start(s: GameState, sector: string, policy: MarketOperationPolicy) {
  return applyAction(s, { type: 'startMarketOperation', sector, policy });
}
function withoutProgram(s: GameState): GameState { return { ...s, marketOperations: undefined }; }
function contribution(s: GameState, project: MarketOperationProject, outcome: MarketOutcomeMode) {
  let total = -marketOperationCosts(s, project).upfrontCost;
  for (let week = project.startWeek; week < project.endWeek; week++) {
    const future = { ...s, week };
    total += calculateMarketGroupFinancials(future, outcome, project).weeklyProfit - calculateMarketGroupFinancials(future, outcome).weeklyProfit;
  }
  return total;
}

describe('market operating-program economic contracts', () => {
  it('preserves published legacy money exactly across integration, draws, and a century horizon', () => {
    // Captured from the unmodified 0.4.10 implementation before extraction.
    const golden: [number, number, MarketOutcomeMode, number, number, number, number, number][] = [
      [1, 1, 'expected', 0, 1886204, -1886204, 0, 100],
      [1, 3, 'expected', 11553422, 3532516, 8020906, 50, 50],
      [1, 3, 'actual', 11494675, 3521941, 7972734, 50, 50],
      [1, 3, 'low', 9921788, 3238823, 6682965, 50, 50],
      [1, 3, 'high', 13185055, 3826209, 9358846, 50, 50],
      [1, 7, 'actual', 27347238, 4922503, 22424735, 100, 0],
      [1, 53, 'expected', 26689510, 4804112, 21885398, 100, 0],
      [1, 53, 'low', 22898916, 4121806, 18777110, 100, 0],
      [1, 53, 'high', 30480103, 5486417, 24993686, 100, 0],
      [1, 5200, 'actual', 27027683, 4864983, 22162700, 100, 0],
      [765, 3, 'actual', 11848732, 3585672, 8263060, 50, 50],
      [765, 7, 'low', 23217406, 4179134, 19038272, 100, 0],
      [765, 53, 'high', 30238056, 5442849, 24795207, 100, 0],
      [765, 5200, 'expected', 26766480, 4817966, 21948514, 100, 0],
    ];
    for (const [seed, week, mode, revenue, expense, profit, operating, integrating] of golden) {
      const s = fixture(seed, week);
      s.marketAcquisitions!.companies = STOCKS.map((stock, index) => {
        const acquisitionMode = index % 2 === 0 ? 'autonomous' : 'integrated';
        return { stockId: stock.id, mode: acquisitionMode, acquiredWeek: 1, readyWeek: 1 + marketIntegrationWeeks(stock, acquisitionMode) };
      });
      const financials = getMarketGroupFinancials(s, mode);
      expect([financials.weeklyRevenue, financials.weeklyExpense, financials.weeklyProfit, financials.operating, financials.integrating]).toEqual([revenue, expense, profit, operating, integrating]);
      expect(financials.bookValue).toBe(4491160000);
      expect(financials.borrowCollateral).toBe(1122790000);
      expect(getMarketGroupFinancials({ ...s, marketOperations: { projects: [] } }, mode)).toEqual(financials);
    }
  });

  it('makes growth profitable in a suitable cohort and costly in a low-yield cohort', () => {
    const promising = fixture(3, 73, STOCKS, 'integrated');
    const weak = fixture(765, 93);
    const growth = getMarketOperationQuote(promising, '非鉄金属', 'growth');
    const lowYield = getMarketOperationQuote(weak, '不動産REIT', 'growth');
    expect(growth.expectedNetContribution).toBeGreaterThan(0);
    expect(lowYield.expectedNetContribution).toBeLessThan(0);
    // Even a favorable expected choice still has a bounded cash downside.
    expect(growth.netContributionRange.min).toBeLessThan(growth.expectedNetContribution);
    expect(growth.netContributionRange.max).toBeGreaterThan(growth.expectedNetContribution);
    for (const [s, quote] of [[promising, growth], [weak, lowYield]] as const) {
      expect(quote.expectedNetContribution).toBe(contribution(s, quote.project, 'expected'));
      const actual = contribution(s, quote.project, 'actual');
      expect(actual).toBeGreaterThanOrEqual(quote.netContributionRange.min);
      expect(actual).toBeLessThanOrEqual(quote.netContributionRange.max);
      const finished = { ...start(s, quote.sector, quote.policy), week: quote.project.endWeek };
      expect(getMarketOperationOutcome(finished, quote.project).netContribution).toBe(actual);
    }
  });

  it('can trade expected earnings for a strictly positive debt-loss floor', () => {
    let s = fixture(1, 3, [STOCKS.find(stock => stock.id === 'jp-6731')!]);
    s.cash = 100_000_000; s.reputation = 70;
    s = applyAction(s, { type: 'openStore', lotId: 'center-01', style: 'standard' });
    s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { price: 800, quality: 65, staff: 8, marketing: 300_000 } });
    s = applyAction(s, { type: 'borrow', amount: 1_000_000, weeks: 260 });
    const baseline = getWeekOutlook(s), quote = getMarketOperationQuote(s, '電気機器', 'stability');
    const stable = start(s, '電気機器', 'stability'), protectedOutlook = getWeekOutlook(stable);
    expect(baseline.expected.netProfit).toBe(65_419);
    expect(baseline.netProfit.min).toBe(-3_320);
    expect(baseline.risk.debtLossPossible).toBe(true);
    expect(quote.upfrontCost).toBe(68_850);
    expect(stable.cash).toBe(s.cash - quote.upfrontCost);
    expect(protectedOutlook.expected.netProfit).toBe(59_704);
    expect(protectedOutlook.netProfit.min).toBe(10_236);
    expect(protectedOutlook.risk.debtLossPossible).toBe(false);
    const next = advanceWeek(stable);
    expect(next.gameOver).toBe(false);
    expect(next.lastReport!.netProfit).toBeGreaterThanOrEqual(protectedOutlook.netProfit.min);
    expect(next.lastReport!.marketOperation!.profitDelta).toBe(getMarketOperationFinancialEffects(stable, 'actual')!.weeklyProfitDelta);
  });

  it('contains actual profit over all cycle phases and paired 26-week cash outcomes over several seeds', () => {
    const sectors = [...new Set(STOCKS.map(stock => stock.sector))];
    for (const seed of [1, 765, 911]) for (let phase = 0; phase < 104; phase++) for (const policy of ['growth', 'stability'] as const) {
      const s = fixture(seed, 7 + phase), project = { sector: sectors[phase % sectors.length], policy, startWeek: s.week, endWeek: s.week + 26 };
      s.marketOperations = { projects: [project] };
      const low = getMarketGroupFinancials(s, 'low'), actual = getMarketGroupFinancials(s, 'actual'), high = getMarketGroupFinancials(s, 'high');
      expect(actual.weeklyProfit).toBeGreaterThanOrEqual(low.weeklyProfit);
      expect(actual.weeklyProfit).toBeLessThanOrEqual(high.weeklyProfit);
      expect(actual.bookValue).toBe(getMarketGroupFinancials(withoutProgram(s)).bookValue);
    }
    for (const seed of [1, 765]) for (const phase of [7, 20, 33, 46, 59, 72, 85, 98]) for (const sector of ['通信・IT', '医薬品', '不動産REIT']) for (const policy of ['growth', 'stability'] as const) {
      const s = fixture(seed, phase), quote = getMarketOperationQuote(s, sector, policy);
      const actual = contribution(s, quote.project, 'actual');
      expect(quote.netContributionRange.min).toBeLessThanOrEqual(quote.expectedNetContribution);
      expect(quote.expectedNetContribution).toBeLessThanOrEqual(quote.netContributionRange.max);
      expect(actual).toBeGreaterThanOrEqual(quote.netContributionRange.min);
      expect(actual).toBeLessThanOrEqual(quote.netContributionRange.max);
      // The counterfactual uses the same draw. Stability has the opposite slope.
      const lowMode = policy === 'growth' ? 'low' : 'high', highMode = policy === 'growth' ? 'high' : 'low';
      expect(quote.netContributionRange.min).toBe(contribution(s, quote.project, lowMode) - 52);
      expect(quote.netContributionRange.max).toBe(contribution(s, quote.project, highMode) + 52);
    }
  });

  it('freezes the paid cohort and keeps later acquisitions out of earlier settled outcomes', () => {
    const sectorStocks = STOCKS.filter(stock => stock.sector === '電気機器');
    const s = fixture(1, 7, sectorStocks.slice(0, 1));
    const quote = getMarketOperationQuote(s, '電気機器', 'growth'), active = start(s, '電気機器', 'growth');
    const later = structuredClone(active);
    later.week = 12;
    later.marketAcquisitions!.research.push({ stockId: sectorStocks[1].id, week: 12 });
    later.marketAcquisitions!.companies.push({ stockId: sectorStocks[1].id, mode: 'autonomous', acquiredWeek: 12, readyWeek: 14 });
    later.week = 15;
    expect(marketOperationCohort(later, quote.project).map(company => company.stockId)).toEqual([sectorStocks[0].id]);
    expect(marketOperationCosts(later, quote.project)).toEqual(marketOperationCosts(active, quote.project));
    for (const mode of ['expected', 'actual', 'low', 'high'] as const) {
      const financials = getMarketGroupFinancials(later, mode);
      const originalCompany = marketCompanyWeekRevenue(later, sectorStocks[0], 'autonomous', mode, quote.project);
      const futureCompany = marketCompanyWeekRevenue(later, sectorStocks[1], 'autonomous', mode);
      // Only the original company earns the investment effect. The later one
      // raises legacy group oversight but never grows the paid program's fee.
      const revenue = originalCompany + futureCompany;
      const outwardAdjustment = mode === 'low' ? 1 : mode === 'high' ? -1 : 0;
      expect(financials.weeklyRevenue).toBe(Math.round(revenue));
      expect(financials.weeklyExpense).toBe(Math.round(revenue * .0428 + quote.weeklyCost) + outwardAdjustment);
    }
    const completedBefore = { ...active, week: quote.project.endWeek };
    const recorded = getMarketOperationOutcome(completedBefore, quote.project);
    const completedLater = structuredClone(completedBefore);
    completedLater.marketAcquisitions!.research.push({ stockId: sectorStocks[1].id, week: quote.project.endWeek + 1 });
    completedLater.marketAcquisitions!.companies.push({ stockId: sectorStocks[1].id, mode: 'autonomous', acquiredWeek: quote.project.endWeek + 1, readyWeek: quote.project.endWeek + 3 });
    completedLater.week = quote.project.endWeek + 4;
    expect(getMarketOperationOutcome(completedLater, quote.project)).toEqual(recorded);
    const expired = { ...later, week: quote.project.endWeek };
    expect(getMarketGroupFinancials(expired)).toEqual(getMarketGroupFinancials(withoutProgram(expired)));
  });

  it('cannot capitalize temporary earnings for shares or profit credit while paid cash still reduces equity', () => {
    const baseline = fixture(3, 73, STOCKS, 'integrated');
    const quote = getMarketOperationQuote(baseline, '非鉄金属', 'growth');
    const invested = start(baseline, '非鉄金属', 'growth'), sameCashWithoutProgram = withoutProgram(invested);
    const before = getSummary(baseline), current = getSummary(invested), retained = getSummary(sameCashWithoutProgram);
    expect(previewWeek(invested).netProfit).toBeGreaterThan(previewWeek(sameCashWithoutProgram).netProfit);
    expect(current.weeklyProfit).toBe(previewWeek(invested).netProfit);
    expect(current.valuation).toBe(retained.valuation);
    expect(current.borrowingLimit).toBe(retained.borrowingLimit);
    expect(current.availableCredit).toBe(retained.availableCredit);
    expect(current.netWorth).toBe(before.netWorth - quote.upfrontCost);
    expect(current.valuation).toBe(before.valuation - quote.upfrontCost);
    expect(current.borrowingLimit).toBe(before.borrowingLimit);
    const raised = applyAction(invested, { type: 'issueShares', fraction: .25 });
    const neutralRaised = applyAction(sameCashWithoutProgram, { type: 'issueShares', fraction: .25 });
    expect(raised.cash).toBe(neutralRaised.cash);
    expect(raised.sharePrice).toBe(neutralRaised.sharePrice);
    expect(raised.sharesOutstanding).toBe(neutralRaised.sharesOutstanding);
  });
});
