import { describe, expect, it } from 'vitest';
import type { GameState, RailProjectChoiceId } from '../src/model';
import { advanceWeek, applyAction, createGame, previewWeek } from '../src/sim/engine';
import { getRailProjectEffects, getRailProjectFinancials } from '../src/sim/railProjects';
import { runManagedWeeks } from '../src/sim/managedWeeks';
import { createEnvelope, decodeEnvelope, validateGame } from '../src/persistence';

// Fixed accounting scenarios, not a claim about earned capital or elapsed campaign time.
function fixture() {
  let s = createGame('沿線統合検証', 765);
  s.cash = 600_000_000; s.listed = true; s.reputation = 90;
  s = applyAction(s, { type: 'openStore', lotId: 'sakuragaoka-06', style: 'standard' });
  s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { price: 1_200, staff: 5, quality: 85 } });
  return applyAction(s, { type: 'buyProperty', lotId: 'sakuragaoka-06' });
}
const start = (s: GameState, choiceId: RailProjectChoiceId = 'commerce') => applyAction(s, { type: 'startRailProject', districtId: 'sakuragaoka', choiceId });
const roundTrip = async (s: GameState) => decodeEnvelope(await createEnvelope(s));
function withoutRail(s: GameState) { const copy = structuredClone(s); delete copy.railProjects; return copy; }

describe('沿線共同開発の保存・複数週統合', () => {
  it('keeps old v1 saves without rail state unchanged', async () => {
    const old = fixture(), restored = await roundTrip(old);
    expect(restored).toEqual(old); expect(Object.hasOwn(restored, 'railProjects')).toBe(false);
    expect(advanceWeek(restored)).toEqual(advanceWeek(old));
  });
  it.each(['duplicate', 'future-start', 'wrong-duration', 'unknown-choice', 'unknown-district', 'extra-field'] as const)('rejects %s project saves', mutation => {
    const s = start(fixture()), rail = s.railProjects!, project = rail.projects[0];
    if (mutation === 'duplicate') rail.projects.push(structuredClone(project));
    if (mutation === 'future-start') { project.startWeek++; project.completeWeek++; }
    if (mutation === 'wrong-duration') project.completeWeek--;
    if (mutation === 'unknown-choice') Object.assign(project, { choiceId: 'free-rail' });
    if (mutation === 'unknown-district') Object.assign(project, { districtId: 'outside' });
    if (mutation === 'extra-field') Object.assign(project, { completed: true });
    expect(() => validateGame(s)).toThrow();
  });
  it('saves the completion-week state before stopping, with its benefit in the next exact forecast', async () => {
    const initial = start(fixture()), completeWeek = initial.railProjects!.projects[0].completeWeek;
    let durable: GameState | undefined; const order: string[] = [];
    const result = await runManagedWeeks(initial, 13, {
      commit: async next => { durable = await roundTrip(next); order.push(`save:${next.week}`); },
      onCommit: next => { expect(durable).toEqual(next); order.push(`observe:${next.week}`); },
    });
    expect(result.stopReason).toContain('沿線'); expect(result.state).toEqual(durable);
    expect(result.state.week).toBe(completeWeek); expect(result.reports).toHaveLength(4);
    expect(result.reports.at(-1)!.week).toBe(completeWeek - 1);
    expect(order.at(-2)).toBe(`save:${completeWeek}`); expect(order.at(-1)).toBe(`observe:${completeWeek}`);
    const forecast = previewWeek(result.state), without = previewWeek(withoutRail(result.state));
    expect(forecast.customers).toBeGreaterThan(without.customers); expect(forecast.netProfit).toBeGreaterThan(without.netProfit);
    expect(advanceWeek(result.state).lastReport).toEqual(forecast);
    const resumed = await runManagedWeeks(await roundTrip(result.state), 4, { commit: async next => { await roundTrip(next); } });
    expect(resumed.stopReason).toBeNull(); expect(resumed.reports).toHaveLength(4);
    expect(resumed.reports[0]).toEqual(forecast);
    expect(resumed.reports.filter(r => r.headlines.some(h => h.includes('共同開発の効果')))).toHaveLength(1);
  });
  it('does not call an unsaved completion durable and can retry it deterministically', async () => {
    let initial = start(fixture());
    while (initial.week < initial.railProjects!.projects[0].completeWeek - 1) initial = advanceWeek(initial);
    let notifications = 0;
    const failed = await runManagedWeeks(initial, 4, { commit: async () => { throw new Error('容量不足'); }, onCommit: () => { notifications++; } });
    expect(failed.state).toBe(initial); expect(failed.reports).toHaveLength(0); expect(notifications).toBe(0);
    expect(failed.stopReason).toContain('保存'); expect(getRailProjectEffects(failed.state, 'sakuragaoka').cafeDemandBonus).toBe(0);
    const retry = await runManagedWeeks(initial, 4, { commit: async next => { await roundTrip(next); } });
    expect(retry.state).toEqual(advanceWeek(initial)); expect(retry.stopReason).toContain('沿線');
  });
  it('settles each construction and operating week once across manual/delegated save reloads', async () => {
    // Rental on self-occupied premises yields no benefit, so its exact fee is isolated in every report.
    const initial = start(fixture(), 'rental'); let manual = initial;
    const manualReports = [];
    for (let i = 0; i < 10; i++) {
      const report = previewWeek(manual), baseline = previewWeek(withoutRail(manual)), cash = manual.cash;
      expect(report.netProfit).toBe(baseline.netProfit - 4_000);
      expect(getRailProjectFinancials(manual).weeklyUpkeep).toBe(4_000);
      manual = await roundTrip(advanceWeek(manual));
      expect(manual.cash).toBe(Math.round(cash + report.cashChange)); expect(manual.lastReport).toEqual(report);
      manualReports.push(report);
    }
    const first = await runManagedWeeks(initial, 13, { commit: async next => { await roundTrip(next); } });
    expect(first.reports).toHaveLength(6); expect(first.stopReason).toContain('沿線');
    const second = await runManagedWeeks(await roundTrip(first.state), 4, { commit: async next => { await roundTrip(next); } });
    expect(second.reports).toHaveLength(4); expect(second.state).toEqual(manual);
    expect([...first.reports, ...second.reports]).toEqual(manualReports);
  });
});

export function railStrategyFixture(capacity: 'full' | 'spare', externalRentals: boolean) {
  let s = createGame('沿線比較fixture', 765); s.cash = 600_000_000; s.listed = true; s.reputation = 90;
  for (const lotId of ['sakuragaoka-06', 'sakuragaoka-05', 'sakuragaoka-02', 'sakuragaoka-01']) {
    s = applyAction(s, { type: 'openStore', lotId, style: 'standard' });
    s = applyAction(s, { type: 'buyProperty', lotId });
    s = applyAction(s, { type: 'updateStore', storeId: s.stores.at(-1)!.id, changes: capacity === 'full' ? { staff: 2, price: 580, quality: 85, marketing: 0 } : { staff: 5, price: 1_200, quality: 85, marketing: 0 } });
  }
  if (externalRentals) for (const lotId of ['sakuragaoka-03', 'sakuragaoka-04', 'sakuragaoka-08']) s = applyAction(s, { type: 'buyProperty', lotId });
  return s;
}
function operatingDelta(initial: GameState, choiceId: RailProjectChoiceId) {
  let s = start(initial, choiceId); while (s.week < 7) s = advanceWeek(s);
  const forecast = previewWeek(s), baseline = previewWeek(withoutRail(s));
  return { profit: forecast.netProfit - baseline.netProfit, customers: forecast.customers - baseline.customers };
}
describe('同じ4店舗でも保有・運営状況で共同開発の判断が変わる', () => {
  it('full shops without external rent make both plans a cost, preserving the wait choice', () => {
    const s = railStrategyFixture('full', false);
    expect(operatingDelta(s, 'commerce')).toEqual({ profit: -6_000, customers: 0 });
    expect(operatingDelta(s, 'rental')).toEqual({ profit: -4_000, customers: 0 });
  });
  it('spare cafe capacity favors commerce; external rent with full cafes favors rental', () => {
    const cafes = railStrategyFixture('spare', false), rentals = railStrategyFixture('full', true);
    expect(operatingDelta(cafes, 'commerce').profit).toBeGreaterThan(0);
    expect(operatingDelta(cafes, 'rental').profit).toBe(-4_000);
    expect(operatingDelta(rentals, 'commerce').profit).toBe(-6_000);
    expect(operatingDelta(rentals, 'rental').profit).toBeGreaterThan(0);
  });
});
