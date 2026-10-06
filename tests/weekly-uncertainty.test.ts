import { describe, expect, it } from 'vitest';
import type { GameState, StoreStyle } from '../src/model';
import { advanceWeek, applyAction, createGame, getStoreOperatingInsight, getSummary, getWeekOutlook, managerPlan, previewWeek } from '../src/sim/engine';
import { runManagedWeeks } from '../src/sim/managedWeeks';
import { createEnvelope, decodeEnvelope } from '../src/persistence';
import { getOffers, getDealFinancials } from '../src/sim/deals';
import { getMarketGroupFinancials } from '../src/sim/marketAcquisitions';
import { STOCKS } from '../src/data/stocks';
import { ACQUISITION_TARGETS, LOTS } from '../src/data/district';

function cafe(seed = 765, style: StoreStyle = 'standard', lotId = 'center-01') {
  return applyAction(createGame('週末実績検証', seed), { type: 'openStore', lotId, style });
}
function bounds(s: GameState) {
  const before = structuredClone(s), outlook = getWeekOutlook(s), next = advanceWeek(s), actual = next.lastReport!;
  for (const key of ['netProfit', 'cashChange', 'revenue', 'customers'] as const) {
    expect(actual[key]).toBeGreaterThanOrEqual(outlook[key].min);
    expect(actual[key]).toBeLessThanOrEqual(outlook[key].max);
    expect(outlook.expected[key]).toBeGreaterThanOrEqual(outlook[key].min);
    expect(outlook.expected[key]).toBeLessThanOrEqual(outlook[key].max);
  }
  expect(next.cash).toBe(Math.round(s.cash + actual.cashChange));
  expect(next.cash).toBeGreaterThanOrEqual(outlook.cashAfter.min);
  expect(next.cash).toBeLessThanOrEqual(outlook.cashAfter.max);
  expect(actual.netProfit).toBe(actual.operatingProfit - actual.interest);
  for (const row of actual.storeResults) {
    const view = getStoreOperatingInsight(s, row.id)!;
    for (const key of ['profit', 'revenue', 'customers', 'satisfaction'] as const) {
      expect(row[key]).toBeGreaterThanOrEqual(view.resultRange[key].min);
      expect(row[key]).toBeLessThanOrEqual(view.resultRange[key].max);
    }
    expect(Object.keys(row)).toEqual(['id', 'revenue', 'profit', 'customers', 'satisfaction']);
  }
  expect(s).toEqual(before);
  return { outlook, next, actual };
}

describe('bounded weekly results versus planning estimates', () => {
  it('does not expose store settlement draws through preview, insight, or company summary', () => {
    const a = cafe(1), b = { ...structuredClone(a), seed: 983 };
    expect(previewWeek(a)).toEqual(previewWeek(b));
    expect(getWeekOutlook(a)).toEqual(getWeekOutlook(b));
    expect(getStoreOperatingInsight(a, a.stores[0].id)).toEqual(getStoreOperatingInsight(b, b.stores[0].id));
    expect(getSummary(a)).toEqual(getSummary(b));
    expect(advanceWeek(a).lastReport!.storeResults).not.toEqual(advanceWeek(b).lastReport!.storeResults);
    expect(previewWeek(a).headlines.some(h => h.includes('人が来店しました'))).toBe(false);
    expect(advanceWeek(a).lastReport!.headlines.some(h => h.includes('人が来店しました'))).toBe(true);
  });

  it('bounds settings, negative unit margin, delegation and all three store forms across independent seeds', () => {
    for (const seed of [1, 99, 765, 812, 983, 4294967295]) for (const style of ['standard', 'premium', 'takeaway'] as const) {
      for (const changes of [{ price: 950, staff: 4, quality: 85, marketing: 0, manager: false }, { price: 200, staff: 30, quality: 100, marketing: 10000, manager: false }, { price: 1400, staff: 5, quality: 85, marketing: 10000, manager: true }]) {
        let s = cafe(seed, style);
        s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes });
        bounds(s);
      }
    }
  });

  it('reverses profit endpoints when an extra customer has negative contribution', () => {
    let s = cafe(); s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { price: 200, quality: 100, staff: 5 } });
    const view = getStoreOperatingInsight(s, s.stores[0].id)!;
    // Per customer 200 - 185 ingredients - 24 fulfilment = -9 yen.
    expect(view.resultRange.profit.max - view.resultRange.profit.min).toBe(9 * (view.resultRange.customers.max - view.resultRange.customers.min));
    bounds(s);
  });

  it('uses the same neutral manager settings before and after realization', () => {
    let s = cafe(812); s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { manager: true } });
    const plan = managerPlan(s, s.stores[0]), view = getStoreOperatingInsight(s, s.stores[0].id)!, next = advanceWeek(s);
    for (const key of ['price', 'staff', 'quality', 'marketing', 'manager'] as const) {
      expect(next.stores[0][key]).toBe(plan[key]);
      expect(view.effectiveSettings[key]).toBe(plan[key]);
    }
    expect(getWeekOutlook(s).expected).toEqual(previewWeek(s));
  });

  it('varies saturated processing instead of forcing full-capacity stores to earn one fixed amount', () => {
    const customers = new Set<number>();
    for (let week = 1; week <= 13; week++) {
      const s = cafe(); s.week = week;
      customers.add(bounds(s).actual.customers);
    }
    expect(customers.size).toBeGreaterThan(5);
  });

  it('cannot reroll by read calls, reload, rename, settings round trips, or identity replacement', async () => {
    const s = cafe(983), before = await createEnvelope(s), first = advanceWeek(s);
    getWeekOutlook(s); getStoreOperatingInsight(s, s.stores[0].id); previewWeek(s);
    const restored = await decodeEnvelope(before);
    expect(advanceWeek(restored)).toEqual(first);
    let edited = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { price: 950 } });
    edited = applyAction(edited, { type: 'updateStore', storeId: s.stores[0].id, changes: { price: s.stores[0].price } });
    expect(advanceWeek(edited)).toEqual(first);
    const renamed = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { name: '別名' } });
    expect(advanceWeek(renamed).lastReport!.storeResults).toEqual(first.lastReport!.storeResults);
    const differentId = structuredClone(s); differentId.stores[0].id = 'replacement-id';
    expect(advanceWeek(differentId).lastReport!.storeResults[0].profit).toBe(first.lastReport!.storeResults[0].profit);
    const after = await createEnvelope(s); expect(after.payload).toBe(before.payload); expect(after.checksum).toBe(before.checksum);
    expect(await decodeEnvelope(await createEnvelope(first))).toEqual(first);
  });

  it('retains past stored results while changing only the future rule, without a save migration', async () => {
    const s = advanceWeek(cafe()), past = structuredClone(s.lastReport), history = structuredClone(s.history);
    const decoded = await decodeEnvelope(await createEnvelope(s));
    getWeekOutlook(decoded);
    expect(decoded.lastReport).toEqual(past); expect(decoded.history).toEqual(history);
    expect(decoded.version).toBe(1);
    expect(Object.keys(advanceWeek(decoded))).toEqual(Object.keys(s));
  });

  it('separates unknown deal outcomes and owned-company shocks from their public plans', () => {
    let s = cafe(765); const offer = getOffers(s)[0];
    s = applyAction(s, { type: 'acceptOffer', offerId: offer.id }); s.week += offer.leadWeeks;
    const other = { ...structuredClone(s), seed: 983 };
    expect(getDealFinancials(s, 'expected')).toEqual(getDealFinancials(other, 'expected'));
    expect(getDealFinancials(s, 'low').weeklyRevenue).toBeLessThanOrEqual(getDealFinancials(s, 'actual').weeklyRevenue);
    expect(getDealFinancials(s, 'high').weeklyRevenue).toBeGreaterThanOrEqual(getDealFinancials(s, 'actual').weeklyRevenue);
    expect(getDealFinancials(s, 'actual')).not.toEqual(getDealFinancials(other, 'actual'));
    bounds(s);
    // Explicit accounting fixture: ownership and funding are synthetic, not a natural-play route.
    s.marketAcquisitions = { research: [{ stockId: STOCKS[0].id, week: 1 }], companies: [{ stockId: STOCKS[0].id, mode: 'autonomous', acquiredWeek: 1, readyWeek: 1 }] };
    expect(getMarketGroupFinancials(s)).toEqual(getMarketGroupFinancials(s, 'expected'));
    expect(getMarketGroupFinancials(s, 'actual').weeklyProfit).not.toBe(getMarketGroupFinancials(s).weeklyProfit);
    bounds(s);
  });

  it('bounds a mixed group, payouts, maturities and loan principal without treating cash as profit', () => {
    for (const seed of [1, 99, 765, 983]) {
      let s = cafe(seed); s.cash = 2000000000; s.reputation = 100;
      const p = LOTS.find(l => l.available && l.id !== s.stores[0].lotId)!;
      s = applyAction(s, { type: 'buyProperty', lotId: p.id });
      s = applyAction(s, { type: 'acquire', targetId: ACQUISITION_TARGETS[0].id });
      s = applyAction(s, { type: 'borrow', amount: 1000000, weeks: 52 });
      s.listed = true; s.sharesOutstanding = 1250000; s.dividendPayout = .8;
      const { actual } = bounds(s);
      expect(actual.dividendsPaid).toBe(Math.round(Math.max(0, actual.netProfit) * .8));
      expect(actual.cashChange).toBe(actual.netProfit + actual.dividendsReceived - actual.loanRepayment - actual.dividendsPaid);
    }
  });

  it('keeps debt loss at zero fatal and one yen positive solvent, based on actual earnings', () => {
    let s = applyAction(cafe(), { type: 'borrow', amount: 1000000, weeks: 52 });
    const profit = advanceWeek(s).lastReport!.netProfit;
    s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { marketing: s.stores[0].marketing + profit } });
    expect(advanceWeek(s).lastReport!.netProfit).toBe(0); expect(advanceWeek(s).gameOver).toBe(true);
    const positive = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { marketing: s.stores[0].marketing - 1 } });
    expect(advanceWeek(positive).lastReport!.netProfit).toBe(1); expect(advanceWeek(positive).gameOver).toBe(false);
  });

  it('keeps the legacy fractional-cash rounding boundary for debt-free losses', () => {
    let s = cafe(); s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { staff: 30, marketing: 500000 } });
    const change = advanceWeek(s).lastReport!.cashChange;
    const safe = { ...s, cash: -change - .49 }, failed = { ...s, cash: -change - .51 };
    expect(advanceWeek(safe).cash === 0).toBe(true); expect(advanceWeek(safe).gameOver).toBe(false);
    expect(advanceWeek(failed).cash).toBe(-1); expect(advanceWeek(failed).gameOver).toBe(true);
    bounds(safe); bounds(failed);
  });

  it('stops delegated progress on a possible lower-bound loss even when neutral profit is positive', async () => {
    let s = applyAction(cafe(), { type: 'borrow', amount: 1000000, weeks: 52 });
    const neutral = previewWeek(s).netProfit;
    s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { marketing: s.stores[0].marketing + neutral - 1000 } });
    const outlook = getWeekOutlook(s); expect(outlook.expected.netProfit).toBe(1000); expect(outlook.risk.debtLossPossible).toBe(true);
    let commits = 0; const result = await runManagedWeeks(s, 4, { commit: async () => { commits++; } });
    expect(commits).toBe(0); expect(result.state).toBe(s); expect(result.reports).toEqual([]); expect(result.stopReason).toContain('可能性');
  });

  it('notifies and returns only saved actual reports during managed weeks', async () => {
    const s = cafe(), saved: GameState[] = [];
    const result = await runManagedWeeks(s, 4, { commit: async next => { saved.push(await decodeEnvelope(await createEnvelope(next))); }, onCommit: (next, report) => { expect(report).toEqual(saved.at(-1)!.lastReport); expect(next).toEqual(saved.at(-1)); } });
    expect(result.reports).toEqual(saved.map(next => next.lastReport));
    expect(result.reports[0]).not.toEqual(previewWeek(s));
    let manual = s; for (let i = 0; i < saved.length; i++) manual = advanceWeek(manual);
    expect(result.state).toEqual(manual);
  });
});
