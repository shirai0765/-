import { describe, expect, it } from 'vitest';
import { createGame, applyAction, advanceWeek, previewWeek, getWeekOutlook, getSummary } from '../src/sim/engine';
import { getDevelopmentPrograms, getDevelopmentEffects, getDevelopmentFinancials } from '../src/sim/development';
import { createEnvelope, decodeEnvelope, validateGame } from '../src/persistence';
import { LOTS } from '../src/data/district';
import type { GameState, DistrictId } from '../src/model';
// Unit fixture isolates project accounting; this is not a campaign-duration or earnability test.
function fixture(district: DistrictId = 'center') {
  let s = createGame(); s.cash = 500000000; s.reputation = 95; s.listed = true;
  const site = LOTS.find(l => l.available && l.district === district)!;
  s = applyAction(s, { type: 'openStore', lotId: site.id, style: 'standard' });
  s = applyAction(s, { type: 'buyProperty', lotId: site.id });
  return s;
}
function finish(s: GameState): GameState {
  while (s.development?.programs.some(p => p.construction)) {
    const r = previewWeek(s), cash = s.cash, next = advanceWeek(s);
    expect(next.lastReport!.netProfit).toBeGreaterThanOrEqual(getWeekOutlook(s).netProfit.min); expect(next.lastReport!.netProfit).toBeLessThanOrEqual(getWeekOutlook(s).netProfit.max); expect(previewWeek(s)).toEqual(r); expect(next.cash).toBe(cash + next.lastReport!.cashChange); s = next;
  }
  return s;
}
describe('district development', () => {
  it('requires an owned district property, a store and the stated stage prerequisites', () => {
    const s = createGame(), p = getDevelopmentPrograms(s)[0];
    expect(p.status).toBe('locked'); expect(p.choices).toHaveLength(2);
    expect(() => applyAction(s, { type: 'startDevelopment', districtId: p.districtId, choiceId: p.choices[0].id })).toThrow();
    expect(s.development).toBeUndefined();
    let unlocked = fixture(); unlocked.listed = false;
    const choice = getDevelopmentPrograms(unlocked)[0].choices[0];
    unlocked = finish(applyAction(unlocked, { type: 'startDevelopment', districtId: 'center', choiceId: choice.id }));
    expect(getDevelopmentPrograms(unlocked)[0].choices.every(c => !c.unlocked && c.reason.includes('上場'))).toBe(true);
  });
  it('treats construction as upfront capital, waits for operation, and settles upkeep exactly once', () => {
    let s = fixture(); const choice = getDevelopmentPrograms(s)[0].choices[0], profit = previewWeek(s).netProfit, worth = getSummary(s).netWorth, cash = s.cash;
    s = applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: choice.id });
    expect(s.cash).toBe(cash - choice.cost); expect(getSummary(s).netWorth).toBe(worth - choice.cost / 2);
    expect(previewWeek(s).netProfit).toBe(profit); expect(getDevelopmentFinancials(s).weeklyUpkeep).toBe(0);
    expect(() => applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: choice.id })).toThrow();
    const readyWeek = s.week + choice.weeks;
    while (s.week < readyWeek) s = advanceWeek(s);
    expect(getDevelopmentFinancials(s).weeklyUpkeep).toBe(choice.weeklyUpkeep);
    expect(previewWeek(s).headlines.some(h => h.includes('が完成'))).toBe(true);
    s = finish(s); expect(s.development!.programs[0].completedChoiceIds).toEqual([choice.id]);
    expect(getDevelopmentPrograms(s)[0].phase).toBe(1);
    expect(previewWeek(s).headlines.some(h => h.includes('が完成'))).toBe(false);
  });
  it('suspends both benefits and upkeep after the last property sale and resumes on reacquisition', () => {
    let s = fixture(); const choice = getDevelopmentPrograms(s)[0].choices[0];
    s = finish(applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: choice.id }));
    const property = s.properties[0], before = getDevelopmentEffects(s, 'center');
    s = applyAction(s, { type: 'sellProperty', propertyId: property.id });
    expect(getDevelopmentPrograms(s)[0].status).toBe('suspended');
    expect(getDevelopmentEffects(s, 'center')).toEqual({ cafeDemandBonus: 0, propertyYieldBonus: 0, weeklyUpkeep: 0 });
    expect(s.gameOver).toBe(false);
    s = applyAction(s, { type: 'buyProperty', lotId: property.lotId });
    expect(getDevelopmentEffects(s, 'center')).toEqual(before);
  });
  it('does not invent rent from self-occupied premises and keeps bonuses local', () => {
    let s = fixture(); const choice = getDevelopmentPrograms(s)[0].choices.find(c => c.id.endsWith('property'))!;
    s = finish(applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: choice.id }));
    const without = structuredClone(s); delete without.development;
    expect(getDevelopmentEffects(s, 'sakuragaoka').propertyYieldBonus).toBe(0);
    // Stores are at capacity, so this project has upkeep but no phantom tenant revenue.
    expect(previewWeek(s).revenue).toBe(previewWeek(without).revenue);
    expect(previewWeek(s).netProfit).toBe(previewWeek(without).netProfit - choice.weeklyUpkeep);
  });
  it('completes exactly three phases per district and rejects repeat purchases', () => {
    let s = fixture();
    for (let phase = 0; phase < 3; phase++) {
      const p = getDevelopmentPrograms(s)[0]; expect(p.phase).toBe(phase);
      s = finish(applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: p.choices[0].id }));
    }
    const p = getDevelopmentPrograms(s)[0]; expect(p.phase).toBe(3); expect(p.status).toBe('complete'); expect(p.choices).toHaveLength(0);
    expect(p.effects.cafeDemandBonus).toBeLessThanOrEqual(.3);
    expect(() => applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: 'center-2-commerce' })).toThrow();
    expect(validateGame(s).development).toEqual(s.development);
  });
  it('restores pending projects deterministically and accepts old v1 saves without project state', async () => {
    let s = fixture(); const choice = getDevelopmentPrograms(s)[0].choices[0];
    expect(validateGame(s).development).toBeUndefined();
    s = applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: choice.id });
    const restored = await decodeEnvelope(await createEnvelope(s));
    expect(advanceWeek(restored)).toEqual(advanceWeek(s));
    const foreign = structuredClone(s); foreign.development!.programs[0].construction!.choiceId = 'sakuragaoka-0-commerce';
    expect(() => validateGame(foreign)).toThrow();
    const time = structuredClone(s); time.development!.programs[0].construction!.completeWeek++;
    expect(() => validateGame(time)).toThrow();
    const duplicate = structuredClone(s); duplicate.development!.programs.push(structuredClone(duplicate.development!.programs[0]));
    expect(() => validateGame(duplicate)).toThrow();
  });
});
it('includes development upkeep in the borrowed-profit failure rule before committing a week', () => {
  let s = fixture(); const choice = getDevelopmentPrograms(s)[0].choices.find(c => c.id.endsWith('property'))!;
  s = finish(applyAction(s, { type: 'startDevelopment', districtId: 'center', choiceId: choice.id }));
  const without = structuredClone(s); delete without.development;
  const targetBeforeUpkeep = 3000;
  const marketing = s.stores[0].marketing + advanceWeek(without).lastReport!.netProfit - targetBeforeUpkeep;
  s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { marketing } });
  s = applyAction(s, { type: 'borrow', amount: 1000000, weeks: 52 });
  const withoutUpkeep = structuredClone(s); delete withoutUpkeep.development;
  expect(advanceWeek(withoutUpkeep).lastReport!.netProfit).toBeGreaterThan(0);
  expect(advanceWeek(s).lastReport!.netProfit).toBeLessThanOrEqual(0);
  expect(getWeekOutlook(s).risk.debtLossPossible).toBe(true);
  expect(advanceWeek(s).gameOverReason).toContain('借入');
});
