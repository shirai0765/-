import { describe, expect, it } from 'vitest';
import type { DistrictId, GameState, RailProjectChoiceId } from '../src/model';
import { LOTS } from '../src/data/district';
import { createGame, applyAction, advanceWeek, previewWeek, getSummary } from '../src/sim/engine';
import { getRailProjects, getRailProjectEffects, getRailProjectFinancials, RAIL_PROJECT_CHOICES } from '../src/sim/railProjects';
import { getDevelopmentEffects } from '../src/sim/development';
import { createEnvelope, decodeEnvelope, validateGame } from '../src/persistence';

// Accounting fixtures isolate branches. They do not establish campaign timing or investment affordability.
function fixture(districtId: DistrictId = 'sakuragaoka') {
  let s = createGame(); s.cash = 600_000_000; s.listed = true; s.reputation = 90;
  const site = LOTS.filter(l => l.available && l.district === districtId).sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
  s = applyAction(s, { type: 'openStore', lotId: site.id, style: 'standard' });
  return applyAction(s, { type: 'buyProperty', lotId: site.id });
}
const start = (s: GameState, choiceId: RailProjectChoiceId = 'commerce', districtId: DistrictId = 'sakuragaoka') => applyAction(s, { type: 'startRailProject', districtId, choiceId });
function complete(s: GameState) {
  const ready = s.railProjects!.projects[0].completeWeek;
  while (s.week <= ready) {
    const forecast = previewWeek(s), cash = s.cash;
    s = advanceWeek(s); expect(s.lastReport).toEqual(forecast); expect(s.cash).toBe(Math.round(cash + forecast.cashChange));
  }
  return s;
}
function withoutProject(s: GameState) { const result = structuredClone(s); delete result.railProjects; return result; }

describe('駅周辺共同開発', () => {
  it('requires IPO, credit 45 and direct local property ownership', () => {
    const s = fixture();
    expect(() => start({ ...s, listed: false })).toThrow('上場');
    expect(() => start({ ...s, reputation: 44.99 })).toThrow('信用45');
    expect(() => start({ ...s, properties: [] })).toThrow('物件');
    expect(() => start(s, 'commerce', 'center')).toThrow('物件');
    expect(() => start({ ...s, reputation: 45 })).not.toThrow();
  });
  it('rejects bad districts, bad choices, insufficient cash and game-over actions', () => {
    const s = fixture();
    expect(() => start(s, 'invalid' as RailProjectChoiceId)).toThrow();
    expect(() => start(s, 'commerce', 'invalid' as DistrictId)).toThrow();
    expect(() => start({ ...s, cash: 5_999_999 })).toThrow('現預金');
    expect(() => start({ ...s, gameOver: true })).toThrow();
    expect(s.railProjects).toBeUndefined();
  });
  it('charges capital once, accounts for construction upkeep immediately, and preserves inputs', () => {
    const before = fixture(), cash = before.cash, report = previewWeek(before), worth = getSummary(before).netWorth;
    const s = start(before);
    expect(s.cash).toBe(cash - 6_000_000); expect(before.cash).toBe(cash); expect(before.railProjects).toBeUndefined();
    expect(getSummary(s).netWorth).toBe(worth - 3_000_000);
    expect(previewWeek(s).netProfit).toBe(report.netProfit - 6_000);
    expect(getRailProjectEffects(s, 'sakuragaoka')).toEqual({ cafeDemandBonus: 0, propertyYieldBonus: 0, weeklyUpkeep: 6_000 });
    expect(getRailProjectFinancials(s)).toEqual({ weeklyUpkeep: 6_000, bookValue: 3_000_000 });
  });
  it('prevents duplicate charges and mutually exclusive plans before and after completion', () => {
    for (const s of [start(fixture()), complete(start(fixture()))]) {
      const cash = s.cash;
      expect(() => start(s)).toThrow(); expect(() => start(s, 'rental')).toThrow();
      expect(s.cash).toBe(cash); expect(s.railProjects!.projects).toHaveLength(1);
      expect(getRailProjects(s).find(p => p.districtId === 'sakuragaoka')!.options).toHaveLength(0);
    }
  });
  it('turns on benefits in exactly the advertised completion week without increasing upkeep', () => {
    let s = start(fixture()); const ready = s.week + 4;
    while (s.week < ready) {
      expect(getRailProjectEffects(s, 'sakuragaoka').cafeDemandBonus).toBe(0);
      expect(previewWeek(s).headlines.some(h => h.includes('共同開発の効果'))).toBe(false);
      const forecast = previewWeek(s); s = advanceWeek(s); expect(s.lastReport).toEqual(forecast);
    }
    expect(getRailProjectEffects(s, 'sakuragaoka').cafeDemandBonus).toBe(.12);
    expect(getRailProjectFinancials(s).weeklyUpkeep).toBe(6_000);
    expect(previewWeek(s).headlines.some(h => h.includes('共同開発の効果'))).toBe(true);
    const forecast = previewWeek(s); s = advanceWeek(s); expect(s.lastReport).toEqual(forecast);
    expect(previewWeek(s).headlines.some(h => h.includes('共同開発の効果'))).toBe(false);
  });
  it.each(['commerce', 'rental'] as const)('suspends %s fees and effects after sale, resuming without a new capital payment', choice => {
    let s = complete(start(fixture(), choice)); const property = s.properties[0], effects = getRailProjectEffects(s, 'sakuragaoka');
    s = applyAction(s, { type: 'sellProperty', propertyId: property.id });
    expect(getRailProjects(s).find(p => p.districtId === 'sakuragaoka')!.status).toBe('suspended');
    expect(getRailProjectEffects(s, 'sakuragaoka')).toEqual({ cafeDemandBonus: 0, propertyYieldBonus: 0, weeklyUpkeep: 0 });
    const cash = s.cash; s = applyAction(s, { type: 'buyProperty', lotId: property.lotId });
    expect(s.cash).toBe(cash - property.purchasePrice); expect(getRailProjectEffects(s, 'sakuragaoka')).toEqual(effects);
  });
  it('continues funded construction while property ownership is suspended', () => {
    let s = start(fixture()), property = s.properties[0];
    s = applyAction(s, { type: 'sellProperty', propertyId: property.id }); s = complete(s);
    expect(getRailProjectFinancials(s).weeklyUpkeep).toBe(0);
    s = applyAction(s, { type: 'buyProperty', lotId: property.lotId });
    expect(getRailProjects(s).find(p => p.districtId === 'sakuragaoka')!.status).toBe('operating');
  });
  it('adds commercial demand only locally and produces real customers where capacity is free', () => {
    let s = fixture(); s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { price: 1_200, staff: 5, quality: 85 } });
    s = complete(start(s)); const baseline = withoutProject(s);
    expect(getRailProjectEffects(s, 'center').cafeDemandBonus).toBe(0);
    expect(previewWeek(s).customers).toBeGreaterThan(previewWeek(baseline).customers);
    expect(previewWeek(s).netProfit).toBeGreaterThan(previewWeek(baseline).netProfit);
    expect(s.subsidiaries).toHaveLength(0);
  });
  it('does not create rent on self-occupied property', () => {
    const s = complete(start(fixture(), 'rental')), baseline = withoutProject(s);
    expect(previewWeek(s).revenue).toBe(previewWeek(baseline).revenue);
    expect(previewWeek(s).netProfit).toBe(previewWeek(baseline).netProfit - 4_000);
  });
  it('rental plans improve external local rent and are distinct from commercial demand', () => {
    let s = fixture(); const site = LOTS.find(l => l.available && l.district === 'sakuragaoka' && l.id !== s.properties[0].lotId)!;
    s = applyAction(s, { type: 'buyProperty', lotId: site.id }); s = complete(start(s, 'rental'));
    const baseline = withoutProject(s);
    expect(previewWeek(s).customers).toBe(previewWeek(baseline).customers);
    expect(previewWeek(s).revenue).toBeGreaterThan(previewWeek(baseline).revenue);
    expect(previewWeek(s).netProfit).toBeGreaterThan(previewWeek(baseline).netProfit);
  });
  it.each(['commerce', 'rental'] as const)('bounds %s bonuses when combined with full district development', choice => {
    let s = complete(start(fixture(), choice));
    const developmentChoice = choice === 'commerce' ? 'commerce' : 'property';
    s.development = { programs: [{ districtId: 'sakuragaoka', completedChoiceIds: [0, 1, 2].map(p => `sakuragaoka-${p}-${developmentChoice}`) }] };
    const rail = getRailProjectEffects(s, 'sakuragaoka'), district = getDevelopmentEffects(s, 'sakuragaoka');
    expect(rail.cafeDemandBonus + district.cafeDemandBonus).toBeLessThanOrEqual(.4);
    expect(rail.propertyYieldBonus + district.propertyYieldBonus).toBeLessThanOrEqual(.5);
  });
  it('includes upkeep in strict borrowed-profit defeat at zero, without hiding principal cash outflow', () => {
    // This busy district remains at capacity as marketing changes, isolating the exact zero boundary.
    let s = fixture('center'); s = applyAction(s, { type: 'borrow', amount: 1_000_000, weeks: 52 });
    const profit = previewWeek(s).netProfit;
    s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { marketing: s.stores[0].marketing + profit - 6_000 } });
    expect(previewWeek(s).netProfit).toBe(6_000);
    s = start(s, 'commerce', 'center'); const forecast = previewWeek(s);
    expect(forecast.netProfit).toBe(0); expect(forecast.loanRepayment).toBeGreaterThan(0);
    expect(forecast.cashChange).toBe(-forecast.loanRepayment);
    expect(forecast.headlines.some(h => h.includes('ゲームオーバー'))).toBe(true);
    expect(advanceWeek(s).gameOverReason).toContain('借入');
  });
  it('round-trips construction and rejects malformed optional state without changing old saves', async () => {
    const old = fixture(); expect(validateGame(old).railProjects).toBeUndefined();
    const s = start(old), restored = await decodeEnvelope(await createEnvelope(s));
    expect(restored.railProjects).toEqual(s.railProjects); expect(advanceWeek(restored)).toEqual(advanceWeek(s));
    const duplicate = structuredClone(s); duplicate.railProjects!.projects.push(structuredClone(duplicate.railProjects!.projects[0]));
    expect(() => validateGame(duplicate)).toThrow();
    const time = structuredClone(s); time.railProjects!.projects[0].completeWeek++;
    expect(() => validateGame(time)).toThrow();
    const invalid = structuredClone(s); invalid.railProjects!.projects[0].choiceId = 'unknown' as RailProjectChoiceId;
    expect(() => validateGame(invalid)).toThrow();
    expect(RAIL_PROJECT_CHOICES).toHaveLength(2);
  });
});
