import { describe, expect, it } from 'vitest';
import { createGame, previewWeek, applyAction, advanceWeek } from '../src/sim/engine';
import { LOTS } from '../src/data/district';
import { applyDealAction, getCanonicalDealOffer, getDealContext, getDealTermNetRange, getOffers, getRealizedDealBenefit, initializeDeals, isDealOfferId } from '../src/sim/deals';
import { validateGame, createEnvelope, decodeEnvelope } from '../src/persistence';
import type { DealOffer, GameState } from '../src/model';

function business(count = 1, customers = 1000, week = 13): GameState {
 const s = createGame('営業試験', 42); s.week = week;
 s.stores = LOTS.filter(x => x.available).slice(0,count).map((lot,i) => ({id:`store-${i}`,lotId:lot.id,name:`店舗${i}`,style:'standard',price:580,quality:65,staff:4,manager:false,marketing:10000,level:1,openedWeek:1,revenue:customers*580,profit:20000,customers,satisfaction:70}));
 s.lastReport = {...previewWeek(s),week:week-1,storeResults:s.stores.map(x=>({id:x.id,customers,revenue:customers*580,profit:20000,satisfaction:70}))};
 return s;
}

describe('frozen business context in new sales offers', () => {
 it('changes POS outcomes causally with observed traffic, with nonnegative bounded benefits and fixed costs', () => {
  const slow=business(1,100), busy=business(1,1000);
  const busyReturns: number[]=[];
  for(let seed=1;seed<=20;seed++) {
   slow.seed=seed; busy.seed=seed;
   const a=getOffers(slow)[0], b=getOffers(busy)[0];
   expect(a.title).toBe(b.title); expect(a.upfrontCost).toBe(b.upfrontCost); expect(a.weeklyFee).toBe(b.weeklyFee);
   expect(a.conservativeWeeklyBenefit).toBeGreaterThanOrEqual(0);
   expect(a.optimisticWeeklyBenefit).toBeLessThan(b.conservativeWeeklyBenefit + 15000);
   expect(getRealizedDealBenefit(slow,a)).toBeLessThan(getRealizedDealBenefit(busy,b));
   expect(getDealTermNetRange(a).high).toBeLessThan(0);
   busyReturns.push(getRealizedDealBenefit(busy,b)*(b.termWeeks-b.leadWeeks)-b.upfrontCost-b.weeklyFee*b.termWeeks);
  }
  expect(busyReturns.some(n=>n<0)).toBe(true); expect(busyReturns.some(n=>n>0)).toBe(true);
 });
 it('makes joint purchasing depend on store count without multiplying returns without bound', () => {
  const smaller=business(3,1000,49), larger=business(5,1000,49);
  const a=getOffers(smaller).find(x=>x.title.includes('共同仕入れ'))!, b=getOffers(larger).find(x=>x.title.includes('共同仕入れ'))!;
  expect(a).toBeDefined(); expect(b).toBeDefined();
  expect(getRealizedDealBenefit(smaller,a)).toBeLessThan(getRealizedDealBenefit(larger,b));
  expect(b.optimisticWeeklyBenefit).toBe(67000);
 });
 it('distinguishes unavailable observations from zero customers, and ignores closed-store results', () => {
  const s=business(); s.lastReport=null;
  const unknown=getOffers(s)[0];
  expect(getDealContext(unknown)).toEqual({stores:1,observedStores:0,customers:0,lossMakingStores:0,reportWeek:0});
  expect(unknown.signals.join('')).toContain('未観測');
  const zero=business(1,0); zero.lastReport!.storeResults.push({id:'closed',customers:9000,revenue:1e6,profit:1e5,satisfaction:70});
  expect(getDealContext(getOffers(zero)[0])?.customers).toBe(0);
  expect(getOffers(zero)[0].optimisticWeeklyBenefit).toBeLessThan(unknown.optimisticWeeklyBenefit);
 });
 it('freezes offers, investigation and contract outcomes through changed business conditions and JSON saves', () => {
  let s=initializeDeals(business(1,600)); const original=getOffers(s)[0];
  s=applyDealAction(s,{type:'investigateOffer',offerId:original.id});
  const researched=getOffers(s)[0];
  expect(researched.optimisticWeeklyBenefit-researched.conservativeWeeklyBenefit).toBeLessThan(original.optimisticWeeklyBenefit-original.conservativeWeeklyBenefit);
  expect(researched.investigationNotes.join('')).toContain('調査費');
  const outcome=getRealizedDealBenefit(s,researched);
  s=applyDealAction(s,{type:'acceptOffer',offerId:original.id});
  s.week=100; s.stores=[]; s.lastReport=null;
  const loaded=JSON.parse(JSON.stringify(s)) as GameState;
  expect(getCanonicalDealOffer(loaded,researched)).toEqual(researched);
  expect(getRealizedDealBenefit(loaded,researched)).toBe(outcome);
  expect(outcome).toBeGreaterThanOrEqual(researched.conservativeWeeklyBenefit);
  expect(outcome).toBeLessThanOrEqual(researched.optimisticWeeklyBenefit);
 });
 it('rejects changed snapshot IDs, malformed facts, future observations and changed economics on import', () => {
  const s=initializeDeals(business(1,600)); expect(()=>validateGame(s)).not.toThrow();
  const mutations: ((o: DealOffer)=>void)[]=[
   o=>{o.id=o.id.replace('-1-1-600-0-12','-2-1-600-0-12');},
   o=>{o.id=o.id.replace('-1-1-600-0-12','-1-2-600-0-12');},
   o=>{o.id=o.id.replace('-1-1-600-0-12','-1-1-600-0-14');},
   o=>{o.id=o.id.replace('-1-1-600-0-12','-01-1-600-0-12');},
   o=>{o.optimisticWeeklyBenefit+=1;},o=>{o.weeklyFee=0;},
  ];
  for(const mutate of mutations) {const bad=structuredClone(s); mutate(bad.deals!.offers[0]); expect(()=>validateGame(bad)).toThrow();}
  expect(isDealOfferId(s.deals!.offers[0].id)).toBe(true);
  expect(isDealOfferId(s.deals!.offers[0].id+'-extra')).toBe(false);
 });
 it('preserves old catalogue offers and their researched promises when current stores change', () => {
  const s=business();
  for (const investigated of [false,true]) {
   const old=getCanonicalDealOffer(s,{id:'cafe-1-system-fit-v2-pos',category:'system',createdWeek:13,investigated} as DealOffer)!;
   expect(old.id).toBe('cafe-1-system-fit-v2-pos'); expect(getDealContext(old)).toBeNull();
   expect(old.upfrontCost).toBe(240000); expect(old.weeklyFee).toBe(11000);
   if(!investigated) expect([old.conservativeWeeklyBenefit,old.optimisticWeeklyBenefit]).toEqual([5000,39000]);
   const changed={...business(5,0),week:100};
   expect(getCanonicalDealOffer(changed,old)).toEqual(old);
   expect(getRealizedDealBenefit(changed,old)).toBe(getRealizedDealBenefit(s,old));
   s.deals={offers:[old],contracts:[],dismissed:[],generatedBatches:['cafe-1']};
   expect(initializeDeals(s).deals!.offers).toEqual([old]);
   expect(()=>validateGame(s)).not.toThrow();
  }
 });

 it('retains the exact archived v0.3.2 offer content and outcomes through save envelopes', async () => {
  // Golden digest independently generated with the immutable 0.3.2 source archive.
  // All four v1 forms and ten v2 templates, researched/unresearched, three boundary seeds.
  const forms = [
   ['cafe-1-system-fit','system',13],['cafe-1-marketing-reach','marketing',13],
   ['property-1-property-fit','property',27],['property-1-property-reach','property',27],
   ...['pos','staffing','electricity','inventory','training'].map(key=>[`cafe-1-system-fit-v2-${key}`,'system',13]),
   ...['loyalty','consultant','catering'].map(key=>[`cafe-1-marketing-fit-v2-${key}`,'marketing',13]),
   ...['residence','leaseback'].map(key=>[`property-1-property-fit-v2-${key}`,'property',27]),
  ] as const;
  const result:unknown[]=[];
  for(const seed of [0,42,4294967295]) for(const [id,category,createdWeek] of forms) for(const investigated of [false,true]) {
   const s=createGame('fixture',seed); s.week=Number(createdWeek);
   const offer=getCanonicalDealOffer(s,{id,category,createdWeek,investigated} as DealOffer)!;
   expect(offer).not.toBeNull();
   s.deals={offers:[offer],contracts:[],dismissed:[],generatedBatches:[String(id).split('-').slice(0,2).join('-')]};
   const restored=await decodeEnvelope(await createEnvelope(s));
   expect(JSON.stringify(restored)).toBe(JSON.stringify(s));
   result.push({offer,actual:getRealizedDealBenefit(restored,offer)});
  }
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(result))))).map(x=>x.toString(16).padStart(2,'0')).join('');
  expect(result).toHaveLength(84);
  expect(digest).toBe('dbe49b2c06a01cb360c1475b3f7e11d57c3ea46c6ed55df6699bccef573a3729');
 });
 it('restores investigated, accepted and dismissed v3 offers before settling the same frozen outcome', async () => {
  const roundTrip=async(s:GameState)=>{const restored=await decodeEnvelope(await createEnvelope(s));expect(restored).toEqual(s);return restored;};
  let s=await roundTrip(initializeDeals(business(1,600)));
  const [offer,other]=getOffers(s), frozen=getDealContext(offer), expected=getRealizedDealBenefit(s,offer);
  const initialCash=s.cash;
  s=await roundTrip(applyDealAction(s,{type:'investigateOffer',offerId:offer.id}));
  expect(s.cash).toBe(initialCash-offer.investigationCost);
  expect(()=>applyDealAction(s,{type:'investigateOffer',offerId:offer.id})).toThrow();
  s=await roundTrip(applyDealAction(s,{type:'acceptOffer',offerId:offer.id}));
  expect(s.cash).toBe(initialCash-offer.investigationCost-offer.upfrontCost);
  s=await roundTrip(applyDealAction(s,{type:'declineOffer',offerId:other.id}));
  expect(getOffers(s)).toEqual([]);
  s=applyAction(s,{type:'updateStore',storeId:s.stores[0].id,changes:{staff:2,price:850,manager:true}});
  while(s.week<=s.deals!.contracts[0].revealWeek) s=advanceWeek(s);
  s=await roundTrip(s);
  const contract=s.deals!.contracts[0];
  expect(getDealContext(contract.offer)).toEqual(frozen);
  expect(contract.realizedWeeklyBenefit).toBe(expected);
  expect(contract.cumulativeBenefit).toBe(expected);
  expect(getCanonicalDealOffer(s,contract.offer)).toEqual(contract.offer);
  const changed=structuredClone(s); changed.deals!.contracts[0].offer.id=changed.deals!.contracts[0].offer.id.replace('-1-1-600-0-12','-1-1-601-0-12');
  expect(()=>validateGame(changed)).toThrow();
 });
 it('rejects unknown, oversized and internally inconsistent v3 snapshots including dismissed IDs', () => {
  const s=initializeDeals(business(1,600));
  const invalid=[
   'cafe-1-system-fit-v3-unknown-1-1-600-0-12',
   'cafe-1-system-fit-v3-loyalty-1-1-600-0-12',
   'cafe-1-system-fit-v3-pos-0-0-0-0-0',
   'cafe-1-system-fit-v3-pos-10001-1-600-0-12',
   'cafe-1-system-fit-v3-pos-1-1-1000000001-0-12',
   'cafe-1-system-fit-v3-pos-1-0-600-0-0',
   'cafe-1-system-fit-v3-pos-1-0-0-0-12',
   'cafe-1-system-fit-v3-pos-1-1-600-2-12',
   'cafe-1-system-fit-v3-pos-1-1-600-0-0',
   'cafe-83334-system-fit-v3-pos-1-1-600-0-12',
   'cafe-9007199254740992-system-fit-v3-pos-1-1-600-0-12',
   'cafe-1-system-fit-v3-pos-1-1-600-0-25',
  ];
  for(const id of invalid) {
   expect(isDealOfferId(id),id).toBe(false);
   const changed=structuredClone(s); changed.deals!.offers[0].id=id;
   expect(getCanonicalDealOffer(changed,changed.deals!.offers[0]),id).toBeNull();
   expect(()=>validateGame(changed),id).toThrow();
   const dismissed=structuredClone(s); dismissed.deals!.dismissed=[id];
   expect(()=>validateGame(dismissed),id).toThrow();
  }
 });
 it('accounts for lead time, every weekly fee, residual and research in complete-term cash returns', () => {
  let s=business(); const offer=getOffers(s)[0], pre=getDealTermNetRange(offer);
  expect(pre.low).toBe(offer.conservativeWeeklyBenefit*23-offer.upfrontCost-offer.weeklyFee*26);
  s=applyDealAction(s,{type:'investigateOffer',offerId:offer.id});
  const researched=getOffers(s)[0];
  expect(getDealTermNetRange(researched).low).toBe(researched.conservativeWeeklyBenefit*23-researched.upfrontCost-researched.weeklyFee*26-researched.investigationCost);
 });
});
