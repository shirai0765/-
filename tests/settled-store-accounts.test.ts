import { describe, expect, it } from 'vitest';
import type { GameState, StoreWeeklyCosts, WeeklyReport } from '../src/model';
import { advanceWeek } from '../src/sim/engine';
import { validateGame } from '../src/persistence';
import { isWeeklyNewsDigest } from '../src/sim/weeklyNews';
import baseline from './fixtures/settled-store-baseline-v046.json';

// Captured from the unchanged 0.4.6 actual calculation, not from the new account helper.
const fixtures = baseline.fixtures as unknown as {
  label: string; input: GameState; expectedReport: WeeklyReport;
  expectedCosts: StoreWeeklyCosts; actualAccountCaptured: boolean;
}[];
const settled = () => advanceWeek(structuredClone(fixtures[0].input));
const reportObject = (state: GameState) => state.lastReport as unknown as Record<string, unknown>;
const accountObject = (state: GameState) => (reportObject(state).storeAccounts as Record<string, unknown>[])[0];
const costsObject = (state: GameState) => accountObject(state).costs as Record<string, unknown>;

describe('recorded store expense accounts', () => {
  it.each(fixtures)('preserves baseline settlement metrics and actual expenses: $label', fixture => {
    const next = advanceWeek(structuredClone(fixture.input));
    // News is additive reporting data. Keep every original economic field in
    // the exact v0.4.6 comparison and validate the new snapshot separately.
    const { storeAccounts, news, ...oldFields } = next.lastReport!;
    expect(oldFields).toEqual(fixture.expectedReport);
    expect(isWeeklyNewsDigest(news, next.lastReport!.week)).toBe(true);
    expect(storeAccounts !== undefined).toBe(fixture.actualAccountCaptured);
    if (!fixture.actualAccountCaptured) {
      expect(next.lastReport).not.toHaveProperty('storeAccounts');
      return;
    }
    expect(storeAccounts).toHaveLength(1);
    const account = storeAccounts![0], result = next.lastReport!.storeResults[0];
    expect(account.storeId).toBe(result.id);
    expect(account.costs).toEqual(fixture.expectedCosts);
    expect(result.revenue - Object.values(account.costs).reduce((sum, cost) => sum + cost, 0) - account.roundingAdjustment).toBe(result.profit);
    expect(Object.values(account.costs).every(cost => Number.isSafeInteger(cost) && cost >= 0)).toBe(true);
    expect(Math.abs(account.roundingAdjustment)).toBeLessThanOrEqual(4);
    expect(validateGame(next)).toEqual(next);
  });

  it.each([-4, 4])('accepts a signed display adjustment at the %i boundary when the identity holds', adjustment => {
    const state = settled(), result = state.lastReport!.storeResults[0], account = state.lastReport!.storeAccounts![0];
    for (const key of Object.keys(account.costs) as (keyof StoreWeeklyCosts)[]) account.costs[key] = 0;
    account.costs.labor = 100;
    account.roundingAdjustment = adjustment;
    result.revenue = 1000;
    result.profit = 900 - adjustment;
    expect(validateGame(state)).toEqual(state);
  });

  it('permits sparse accounts while retaining an old report result for another store', () => {
    const state = settled();
    state.lastReport!.storeResults.push({ id: 'previously-closed-store', revenue: 42, profit: 1, customers: 1, satisfaction: 50 });
    expect(validateGame(state)).toEqual(state);
    state.lastReport!.storeAccounts = [];
    expect(validateGame(state)).toEqual(state);
  });

  it('keeps the broader legacy result ranges valid when no optional account is present', () => {
    const state = settled();
    delete state.lastReport!.storeAccounts;
    state.lastReport!.storeResults[0].revenue = Number.MAX_SAFE_INTEGER + 1;
    state.lastReport!.storeResults[0].profit = .5;
    expect(validateGame(state)).toEqual(state);
  });
});

const malformed: [string, (state: GameState) => void][] = [
  ['null array', state => { reportObject(state).storeAccounts = null; }],
  ['object instead of array', state => { reportObject(state).storeAccounts = {}; }],
  ['present undefined array', state => { reportObject(state).storeAccounts = undefined; }],
  ['null account', state => { reportObject(state).storeAccounts = [null]; }],
  ['array instead of account', state => { reportObject(state).storeAccounts = [[]]; }],
  ['unknown store ID', state => { accountObject(state).storeId = 'unreported-store'; }],
  ['missing store ID', state => { delete accountObject(state).storeId; }],
  ['duplicate account', state => { state.lastReport!.storeAccounts!.push(structuredClone(state.lastReport!.storeAccounts![0])); }],
  ['null costs', state => { accountObject(state).costs = null; }],
  ['array instead of costs', state => { accountObject(state).costs = []; }],
  ['missing expense category', state => { delete costsObject(state).rent; }],
  ['unknown expense category', state => { costsObject(state).inventedExpense = 0; }],
  ['unknown account key', state => { accountObject(state).effectiveSettings = {}; }],
  ['dangerous expense key', state => { Object.defineProperty(costsObject(state), '__proto__', {value: {}, enumerable: true}); }],
  ['NaN expense', state => { costsObject(state).labor = NaN; }],
  ['infinite expense', state => { costsObject(state).labor = Infinity; }],
  ['unsafe expense', state => { costsObject(state).labor = Number.MAX_SAFE_INTEGER + 1; }],
  ['fractional expense', state => { costsObject(state).labor = .5; }],
  ['negative expense', state => { costsObject(state).labor = -1; }],
  ['string expense', state => { costsObject(state).labor = '1'; }],
  ['missing adjustment', state => { delete accountObject(state).roundingAdjustment; }],
  ['NaN adjustment', state => { accountObject(state).roundingAdjustment = NaN; }],
  ['unsafe adjustment', state => { accountObject(state).roundingAdjustment = Number.MAX_SAFE_INTEGER + 1; }],
  ['fractional adjustment', state => { accountObject(state).roundingAdjustment = .5; }],
  ...[-5, 5].map((adjustment): [string, (state: GameState) => void] => [`out-of-range ${adjustment} adjustment with a matching identity`, state => {
    const account = state.lastReport!.storeAccounts![0], result = state.lastReport!.storeResults[0];
    account.roundingAdjustment = adjustment;
    result.profit = result.revenue - Object.values(account.costs).reduce((sum, cost) => sum + cost, 0) - adjustment;
  }]),
  ['expense identity mismatch', state => { state.lastReport!.storeAccounts![0].costs.labor += 1; }],
  ['unsafe linked revenue', state => { state.lastReport!.storeResults[0].revenue = Number.MAX_SAFE_INTEGER + 1; }],
  ['fractional linked profit', state => { state.lastReport!.storeResults[0].profit = .5; }],
  ['unsafe cumulative expense sum', state => {
    const account = state.lastReport!.storeAccounts![0];
    for (const key of Object.keys(account.costs) as (keyof StoreWeeklyCosts)[]) account.costs[key] = 0;
    account.costs.labor = Number.MAX_SAFE_INTEGER;
    account.costs.rent = 1;
  }],
  ['negative total despite matching identity', state => {
    const account = state.lastReport!.storeAccounts![0], result = state.lastReport!.storeResults[0];
    for (const key of Object.keys(account.costs) as (keyof StoreWeeklyCosts)[]) account.costs[key] = 0;
    account.roundingAdjustment = -1;
    result.revenue = 0; result.profit = 1;
  }],
  ['unsafe adjusted total despite safe operands', state => {
    const account = state.lastReport!.storeAccounts![0], result = state.lastReport!.storeResults[0];
    for (const key of Object.keys(account.costs) as (keyof StoreWeeklyCosts)[]) account.costs[key] = 0;
    account.costs.labor = Number.MAX_SAFE_INTEGER;
    account.roundingAdjustment = 1;
    result.revenue = Number.MAX_SAFE_INTEGER; result.profit = -1;
  }],
];

describe('optional account import validation', () => {
  it.each(malformed)('rejects %s without mutating the input', (_label, mutate) => {
    const state = settled();
    expect(() => validateGame(state)).not.toThrow();
    mutate(state);
    const original = structuredClone(state);
    expect(() => validateGame(state)).toThrow();
    expect(state).toEqual(original);
  });
});
