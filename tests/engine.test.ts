import { describe, expect, it } from 'vitest';
import { createGame, applyAction, previewWeek, getWeekOutlook, advanceWeek, getSummary, evaluateSite } from '../src/sim/engine';
import { LOTS, ACQUISITION_TARGETS } from '../src/data/district';
import { STOCKS } from '../src/data/stocks';

const sites = () => LOTS.filter(x => x.available).sort((a, b) => a.rent - b.rent);
const open = () => applyAction(createGame(), { type: 'openStore', lotId: sites()[0].id, style: 'standard' });
describe('weekly economy', () => {
  it('starts with enough capital and estimates an attainable profitable cafe', () => { const s = createGame(); const estimate = evaluateSite(s, sites()[0].id); expect(estimate.openingCost).toBeLessThan(s.cash); expect(estimate.expectedProfit).toBeGreaterThan(0); });
  it('is immutable and reproducible, including market prices', () => { const s = open(), before = JSON.stringify(s); expect(advanceWeek(s)).toEqual(advanceWeek(s)); expect(JSON.stringify(s)).toBe(before); expect(previewWeek(s)).toEqual(previewWeek(s)); });
  it('settles exact operating cash flow and separates capital investment', () => { const initial = createGame(); const s = open(); expect(s.cash).toBeLessThan(initial.cash); const report = previewWeek(s); expect(report.netProfit).toBeGreaterThan(0); const next = advanceWeek(s); expect(next.cash).toBe(s.cash + next.lastReport!.cashChange); expect(next.gameOver).toBe(false); });
  it('counts loan interest as profit expense and principal only as cash outflow', () => { const s = applyAction(open(), { type: 'borrow', amount: 1_000_000, weeks: 52 }); const r = previewWeek(s); expect(r.netProfit).toBe(r.operatingProfit - r.interest); expect(r.loanRepayment).toBe(Math.round(1_000_000 / 52)); expect(r.cashChange).toBe(r.netProfit - r.loanRepayment); expect(advanceWeek(s).gameOver).toBe(false); });
  it('ends a debt-funded loss despite a large bank balance', () => { const s = applyAction(createGame(), { type: 'borrow', amount: 1_000_000, weeks: 52 }); expect(s.cash).toBeGreaterThan(10_000_000); expect(advanceWeek(s).gameOverReason).toContain('借入'); });
  it('does not end a debt-free loss until cash runs out', () => { const s = open(); s.stores[0].staff = 30; const r = previewWeek(s); expect(r.netProfit).toBeLessThan(0); expect(advanceWeek(s).gameOver).toBe(false); s.cash = 0; expect(advanceWeek(s).gameOverReason).toContain('現預金'); });
  it('rejects invalid numbers, nonexistent assets and overspending without mutation', () => { const s = createGame(); expect(() => applyAction(s, { type: 'borrow', amount: NaN, weeks: 52 })).toThrow(); expect(() => applyAction(s, { type: 'buyStock', stockId: STOCKS[0].id, shares: Infinity })).toThrow(); expect(() => applyAction(s, { type: 'sellProperty', propertyId: 'missing' })).toThrow(); expect(s.cash).toBe(12_000_000); });
  it('rejects duplicate openings and invalid staff counts', () => { const s = open(); expect(() => applyAction(s, { type: 'openStore', lotId: s.stores[0].lotId, style: 'standard' })).toThrow(); expect(() => applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { staff: 1.5 } })).toThrow(); });
  it('stock purchase is an asset transfer, not a weekly operating expense', () => { const s = open(); const t = applyAction(s, { type: 'buyStock', stockId: STOCKS[0].id, shares: 1 }); expect(previewWeek(t).netProfit).toBe(previewWeek(s).netProfit); expect(getSummary(t).portfolioValue).toBeGreaterThan(0); expect(previewWeek(t).dividendsReceived).toBeGreaterThanOrEqual(0); });
  it('IPO raises funds and dilutes ownership, further equity and payouts work', () => { let s = createGame(); s.cash = 80_000_000; for (const l of sites().slice(0, 3)) s = applyAction(s, { type: 'openStore', lotId: l.id, style: 'standard' }); s = advanceWeek(s); s.profitableWeeks = 12; expect(getSummary(s).ipoEligible).toBe(true); const cash = s.cash; s = applyAction(s, { type: 'ipo' }); expect(s.cash).toBeGreaterThan(cash); expect(getSummary(s).ownership).toBe(.8); const ownership = getSummary(s).ownership; s = applyAction(s, { type: 'issueShares', fraction: .1 }); expect(getSummary(s).ownership).toBeLessThan(ownership); s = applyAction(s, { type: 'setDividend', payout: .3 }); expect(previewWeek(s).dividendsPaid).toBe(Math.round(Math.max(0, previewWeek(s).netProfit) * .3)); });
  it('acquisitions add operating earnings without expensing the purchase', () => { const t = ACQUISITION_TARGETS[0]; let s = open(); s.cash = t.price + 20_000_000; s.reputation = 100; const r = previewWeek(s); s = applyAction(s, { type: 'acquire', targetId: t.id }); expect(previewWeek(s).operatingProfit).toBeGreaterThan(r.operatingProfit); expect(() => applyAction(s, { type: 'acquire', targetId: t.id })).toThrow(); });
  it('owned occupied premises save rent without creating phantom tenant income', () => { let s = open(); const l = LOTS.find(x => x.id === s.stores[0].lotId)!; s.cash = l.purchasePrice + 1_000_000; const r = previewWeek(s); s = applyAction(s, { type: 'buyProperty', lotId: l.id }); expect(Math.abs(previewWeek(s).operatingProfit - r.operatingProfit - (l.rent - l.purchasePrice * .006 / 52))).toBeLessThanOrEqual(1); });
});

describe('progression and repayment', () => {
  it('supports a debt-funded three-cafe company through full loan amortization', () => {
    let s = createGame();
    for (const l of sites().slice(0, 3)) s = applyAction(s, { type: 'openStore', lotId: l.id, style: 'standard' });
    s = applyAction(s, { type: 'borrow', amount: 1_000_000, weeks: 52 });
    for (let i = 0; i < 104; i++) { s = advanceWeek(s); expect(s.gameOver).toBe(false); expect(Number.isFinite(s.cash)).toBe(true); }
    expect(s.loans).toHaveLength(0); expect(s.profitableWeeks).toBe(104); expect(getSummary(s).ipoEligible).toBe(true);
  });
  it('forces a cash crisis when principal repayments exceed earnings and reserves', () => {
    let s = open(); s = applyAction(s, { type: 'borrow', amount: Math.floor(getSummary(s).availableCredit), weeks: 13 });
    s.cash = 0; const r = previewWeek(s); expect(r.netProfit).toBeGreaterThan(0); expect(r.cashChange).toBeLessThan(0);
    expect(advanceWeek(s).gameOverReason).toContain('現預金');
  });
});

import { getOffers, getDealFinancials } from '../src/sim/deals';
import { createEnvelope, decodeEnvelope } from '../src/persistence';
describe('sales contract integration', () => {
  it('pays upfront separately, starts fees immediately, and waits for measured benefits with bounded forecasts', () => {
    let s = open(); const offer = getOffers(s).find(o => o.category === 'system')!;
    const before = previewWeek(s), cash = s.cash;
    s = applyAction(s, { type: 'acceptOffer', offerId: offer.id });
    expect(s.cash).toBe(cash - offer.upfrontCost);
    expect(previewWeek(s).netProfit).toBe(before.netProfit - offer.weeklyFee);
    expect(getDealFinancials(s, true).weeklyRevenue).toBe(0);
    for (let i = 0; i <= offer.leadWeeks; i++) {
      const forecast = previewWeek(s), previousCash = s.cash, next = advanceWeek(s);
      expect(next.lastReport!.netProfit).toBeGreaterThanOrEqual(getWeekOutlook(s).netProfit.min); expect(next.lastReport!.netProfit).toBeLessThanOrEqual(getWeekOutlook(s).netProfit.max); expect(next.cash).toBe(previousCash + next.lastReport!.cashChange); s = next;
    }
    expect(s.deals!.contracts[0].realizedWeeklyBenefit).toBeGreaterThan(0);
    expect(s.deals!.contracts[0].cumulativeFees).toBe(offer.weeklyFee * (offer.leadWeeks + 1));
  });
  it('cancels once, charges the disclosed fee, and removes recurring operating costs', () => {
    let s = open(); const offer = getOffers(s).find(o => o.category === 'system')!;
    s = applyAction(s, { type: 'acceptOffer', offerId: offer.id }); const cash = s.cash, contractId = s.deals!.contracts[0].id;
    s = applyAction(s, { type: 'cancelContract', contractId });
    expect(s.cash).toBe(cash - offer.cancellationFee); expect(getDealFinancials(s, true).weeklyExpense).toBe(0);
    expect(() => applyAction(s, { type: 'cancelContract', contractId })).toThrow();
  });
  it('roundtrips pending contracts without rerolling outcomes or double settlement', async () => {
    let s = open(); const offer = getOffers(s).find(o => o.category === 'system')!;
    s = applyAction(s, { type: 'acceptOffer', offerId: offer.id });
    const restored = await decodeEnvelope(await createEnvelope(s));
    expect(advanceWeek(restored)).toEqual(advanceWeek(s));
    expect(previewWeek(restored)).toEqual(previewWeek(s));
  });
  it('includes property residual redemption in cash forecast, not operating profit, exactly once', () => {
    let s = open(); s.cash = 80000000; const offer = getOffers(s).find(o => o.category === 'property')!;
    s = applyAction(s, { type: 'acceptOffer', offerId: offer.id });
    s.week = s.deals!.contracts[0].endWeek - 1;
    const r = previewWeek(s), cash = s.cash;
    expect(r.cashChange - r.netProfit).toBe(offer.residualValue);
    const next = advanceWeek(s); expect(next.cash).toBe(cash + next.lastReport!.cashChange); expect(next.lastReport!.cashChange - next.lastReport!.netProfit).toBe(offer.residualValue); expect(next.deals!.contracts[0].status).toBe('completed');
    expect(previewWeek(next).cashChange).toBe(previewWeek(next).netProfit);
  });
});
it('recurring sales fees can end a marginal borrowed business despite sufficient cash', () => {
  let s = open();
  const marketing = s.stores[0].marketing + previewWeek(s).netProfit - 20000;
  s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { marketing } });
  s = applyAction(s, { type: 'borrow', amount: 1000000, weeks: 52 });
  expect(previewWeek(s).netProfit).toBeGreaterThan(0);
  const offer = getOffers(s).find(o => o.category === 'marketing')!;
  s = applyAction(s, { type: 'acceptOffer', offerId: offer.id });
  expect(s.cash).toBeGreaterThan(1000000); expect(previewWeek(s).netProfit).toBeLessThanOrEqual(0);
  expect(advanceWeek(s).gameOverReason).toContain('借入');
});
it('site estimate includes chain cannibalization and head-office overhead exactly', () => {
  let s = createGame(); s.cash = 50000000;
  for (let n = 0; n < 3; n++) {
    const best = LOTS.filter(l => l.available && !s.stores.some(st => st.lotId === l.id)).sort((a, b) => evaluateSite(s, b.id).expectedProfit - evaluateSite(s, a.id).expectedProfit)[0];
    s = applyAction(s, { type: 'openStore', lotId: best.id, style: 'standard' });
  }
  const nextLot = LOTS.find(l => l.available && !s.stores.some(st => st.lotId === l.id))!;
  const forecast = evaluateSite(s, nextLot.id), before = previewWeek(s), after = previewWeek(applyAction(s, { type: 'openStore', lotId: nextLot.id, style: 'standard' }));
  expect(forecast.expectedProfit).toBe(after.operatingProfit - before.operatingProfit);
  expect(forecast.expectedProfit).toBeLessThan(after.storeResults.at(-1)!.profit);
});
it('cannot print money through same-week property improvement and resale roundtrips', () => {
  let s = createGame(); const site = sites()[0]; s.cash = site.purchasePrice * 10;
  const initialCash = s.cash;
  for (let repeat = 0; repeat < 3; repeat++) {
    const before = s.cash;
    s = applyAction(s, { type: 'buyProperty', lotId: site.id });
    const propertyId = s.properties[0].id;
    for (let level = 1; level < 5; level++) s = applyAction(s, { type: 'upgradeProperty', propertyId });
    s = applyAction(s, { type: 'sellProperty', propertyId });
    expect(s.cash).toBeLessThan(before);
  }
  expect(s.week).toBe(1); expect(s.cash).toBeLessThan(initialCash); expect(s.properties).toHaveLength(0);
});
it('sustained service quality builds more acquisition credit than low-quality operation', () => {
  let high = open(), low = open(); high.cash = low.cash = 100000000;
  high = applyAction(high, { type: 'updateStore', storeId: high.stores[0].id, changes: { quality: 95, price: 600 } });
  low = applyAction(low, { type: 'updateStore', storeId: low.stores[0].id, changes: { quality: 20, price: 600 } });
  for (let i = 0; i < 52; i++) { high = advanceWeek(high); low = advanceWeek(low); }
  expect(high.reputation).toBeGreaterThan(low.reputation + 15);
  expect(high.gameOver).toBe(false); expect(low.gameOver).toBe(false);
});
