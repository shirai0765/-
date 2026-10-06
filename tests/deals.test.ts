import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/engine';
import { applyDealAction, getOffers, getDealFinancials, tickDeals, getDealMaturityCash, getCanonicalDealOffer, initializeDeals } from '../src/sim/deals';
import { validateGame } from '../src/persistence';
import { LOTS } from '../src/data/district';
import { getRealizedDealBenefit } from '../src/sim/deals';
import type { GameState } from '../src/model';
function cafe(): GameState { const s = createGame(); s.stores.push({ id: 'test', lotId: 'test', name: '店', style: 'standard', price: 580, quality: 65, staff: 4, manager: false, marketing: 0, level: 1, openedWeek: 1, revenue: 0, profit: 0, customers: 0, satisfaction: 70 }); return s; }
describe('営業提案', () => {
 it('begins after opening, reproducible across saves and decline persists', () => {
  expect(getOffers(createGame())).toEqual([]); const s = cafe(); const offers = getOffers(s);
  expect(offers).toHaveLength(2); expect(getOffers(JSON.parse(JSON.stringify(s)))).toEqual(offers);
  const next = applyDealAction(s, { type: 'declineOffer', offerId: offers[0].id });
  expect(getOffers(next)).toHaveLength(1); expect(next.cash).toBe(s.cash); expect(s.deals).toBeUndefined();
 });
 it('investigation exposes costly pitch economics and charges only once', () => {
  const s = cafe(), offer = getOffers(s)[1]; const next = applyDealAction(s, { type: 'investigateOffer', offerId: offer.id });
  const investigated = getOffers(next).find(o => o.id === offer.id)!;
  expect(investigated.optimisticWeeklyBenefit).toBeLessThan(investigated.weeklyFee);
  expect(next.cash).toBe(s.cash - offer.investigationCost);
  expect(() => applyDealAction(next, { type: 'investigateOffer', offerId: offer.id })).toThrow();
  expect(getCanonicalDealOffer(next, investigated)).toEqual(investigated);
 });
 it('waits for implementation, books fees once, reveals measured results and cancels', () => {
  const original = cafe(), offer = getOffers(original)[0]; let s = applyDealAction(original, { type: 'acceptOffer', offerId: offer.id });
  expect(s.cash).toBe(original.cash - offer.upfrontCost);
  expect(getDealFinancials(s, true)).toEqual({ weeklyRevenue: 0, weeklyExpense: offer.weeklyFee, weeklyProfit: -offer.weeklyFee });
  const first = tickDeals(s); expect(tickDeals(first)).toEqual(first); expect(first.cash).toBe(s.cash);
  s.week += offer.leadWeeks; s = tickDeals(s); expect(s.deals!.contracts[0].realizedWeeklyBenefit).toBeGreaterThan(offer.weeklyFee);
  expect(s.deals!.contracts[0].cumulativeBenefit).toBe(getDealFinancials(s, true).weeklyRevenue);
  const cancelled = applyDealAction(s, { type: 'cancelContract', contractId: s.deals!.contracts[0].id });
  expect(cancelled.cash).toBe(s.cash - offer.cancellationFee); expect(getDealFinancials(cancelled).weeklyProfit).toBe(0);
  expect(() => applyDealAction(cancelled, { type: 'cancelContract', contractId: s.deals!.contracts[0].id })).toThrow();
 });
 it('expires pitches, rejects duplicates and insufficient cash', () => {
  const s = initializeDeals(cafe()), offer = getOffers(s)[0]; s.week = 8;
  expect(() => applyDealAction(s, { type: 'acceptOffer', offerId: offer.id })).toThrow();
  s.week = 1; s.cash = 0; expect(() => applyDealAction(s, { type: 'acceptOffer', offerId: offer.id })).toThrow();
  s.cash = 1e7; const accepted = applyDealAction(s, { type: 'acceptOffer', offerId: offer.id });
  expect(() => applyDealAction(accepted, { type: 'acceptOffer', offerId: offer.id })).toThrow();
 });
 it('unlocks property by assets, matures residual once and affects only supplier modestly', () => {
  const s = cafe(); expect(getOffers(s).some(o => o.category === 'property')).toBe(false); s.cash = 60e6;
  const offer = getOffers(s).find(o => o.category === 'property')!;
  const accepted = applyDealAction(s, { type: 'acceptOffer', offerId: offer.id }); expect(accepted.stockPrices).toEqual(s.stockPrices);
  const first = tickDeals(accepted); const changes = Object.keys(s.stockPrices).filter(id => s.stockPrices[id] !== first.stockPrices[id]);
  expect(changes).toEqual([offer.supplierStockId]); expect(first.stockPrices[changes[0]] / s.stockPrices[changes[0]] - 1).toBeLessThanOrEqual(.000501);
  accepted.week = accepted.deals!.contracts[0].endWeek - 1; expect(getDealMaturityCash(accepted)).toBe(offer.residualValue);
  const done = tickDeals(accepted); expect(getDealMaturityCash(done)).toBe(0); expect(getDealFinancials(done).weeklyProfit).toBe(0);
 });
});

describe('versioned sales catalogue', () => {
 it('rotates at least eight named offers and stages large-chain services', () => {
  const small = cafe(); small.week=13;
  expect(getOffers(small).some(o=>o.title.includes('店長'))).toBe(false);
  const large = cafe(); large.listed=true; large.cash=60e6;
  const names = new Set<string>();
  for (let week=13; week<=169; week+=12) { large.week=week; for (const o of getOffers(large)) names.add(o.title); }
  expect(names.size).toBeGreaterThanOrEqual(10);
 });
 it('has both unsuccessful and successful projects, useful but uncertain research, stable save outcomes', () => {
  const profits: number[]=[];
  for(let seed=1;seed<=100;seed++) {
   const s=cafe(); s.seed=seed; s.week=13; const offer=getOffers(s)[0];
   const researched=applyDealAction(s,{type:'investigateOffer',offerId:offer.id});
   const o=getOffers(researched).find(x=>x.id===offer.id)!;
   expect(o.optimisticWeeklyBenefit-o.conservativeWeeklyBenefit).toBeLessThan(offer.optimisticWeeklyBenefit-offer.conservativeWeeklyBenefit);
   expect(o.optimisticWeeklyBenefit).toBeGreaterThan(o.conservativeWeeklyBenefit);
   const outcome=getRealizedDealBenefit(s,o);
   expect(outcome).toBeGreaterThanOrEqual(o.conservativeWeeklyBenefit); expect(outcome).toBeLessThanOrEqual(o.optimisticWeeklyBenefit);
   expect(getRealizedDealBenefit(JSON.parse(JSON.stringify(s)),o)).toBe(outcome);
   expect(getCanonicalDealOffer(s,o)).toEqual(o);
   profits.push(outcome*(o.termWeeks-o.leadWeeks)-o.weeklyFee*o.termWeeks-o.upfrontCost);
  }
  expect(profits.some(p=>p<0)).toBe(true); expect(profits.some(p=>p>0)).toBe(true);
 });
 it('preserves legacy later-batch economics and rejects unknown versioned identifiers', () => {
  const s=cafe(), old={...getOffers(s)[0],id:'cafe-3-system-fit',createdWeek:37,expiresWeek:42};
  expect(getCanonicalDealOffer(s,old)).toEqual(old);
  expect(getCanonicalDealOffer(s,{...old,id:'cafe-3-system-fit-v2-unknown'})).toBeNull();
  s.week=37; const o=getOffers(s)[0]; expect(getCanonicalDealOffer(s,{...o,category:'property'})).toBeNull();
 });
 it('validates investigated, dismissed and contracted versioned offers without weakening tamper checks', () => {
  let s=cafe(); s.stores[0].lotId=LOTS.find(x=>x.available)!.id; s.week=13;
  const offers=getOffers(s); s=applyDealAction(s,{type:'investigateOffer',offerId:offers[0].id});
  s=applyDealAction(s,{type:'acceptOffer',offerId:offers[0].id}); s=applyDealAction(s,{type:'declineOffer',offerId:offers[1].id});
  expect(()=>validateGame(s)).not.toThrow();
  s.week=17; s=tickDeals(s); expect(()=>validateGame(s)).not.toThrow();
  const tampered=structuredClone(s); tampered.deals!.contracts[0].offer.weeklyFee=0;
  expect(()=>validateGame(tampered)).toThrow();
 });
});
