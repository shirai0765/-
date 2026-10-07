/** Reproducible gameplay probe. Every state transition uses public game actions;
 * no balance injection, future-price lookahead, or edited game state. */
import { createGame, applyAction, advanceWeek, getSummary, evaluateSite, previewWeek } from '../../../src/sim/engine';
import { LOTS, ACQUISITION_TARGETS } from '../../../src/data/district';
import { getMarketAcquisitionTargets, getMarketGroupFinancials } from '../../../src/sim/marketAcquisitions';
import { STOCKS } from '../../../src/data/stocks';
import { getDevelopmentPrograms } from '../../../src/sim/development';
import { getOffers, getDealContext } from '../../../src/sim/deals';
import { getRailProjects, getRailProjectFinancials } from '../../../src/sim/railProjects';
import { getCampaignCompletion } from '../../../src/sim/campaign';
import { validateGame, createEnvelope, decodeEnvelope } from '../../../src/persistence';
import type { GameState, GameAction, StoreStyle } from '../../../src/model';

const sites = LOTS.filter(l => l.available);
const styles: StoreStyle[] = ['standard', 'premium', 'takeaway'];
interface Event { week: number; event: string; cash: number; profit: number; reputation: number }
export type RailRoute = 'none' | 'commerce' | 'rental';
/** Original six-store investment policy, copied for isolated v4 regression comparison. */
export async function campaignV4(seed: number, maxWeeks = 3000, railRoute: RailRoute = 'none', onTransition?: (row: { kind: string; before: GameState | null; after: GameState; action?: GameAction }) => void) {
  let state = createGame(`Campaign ${seed}`, seed);
  onTransition?.({ kind: 'createGame', before: null, after: state });
  const events: Event[] = [];
  const actionCounts: Record<string, number> = {};
  const record = (event: string) => events.push({ week: state.week, event, cash: state.cash, profit: previewWeek(state).netProfit, reputation: Math.round(state.reputation * 100) / 100 });
  const act = (action: GameAction, event?: string) => { const before = state; state = applyAction(state, action); onTransition?.({ kind: 'applyAction', before, after: state, action }); actionCounts[action.type] = (actionCounts[action.type] ?? 0) + 1; if (event) record(event); };
  const milestone: Record<string, number> = {};
  const checkpoints: object[] = [];
  let peakWorth = 12000000, maxDrawdown = 0;
  let rejectedInvestments = 0;
  let maxIdleWeeks = 0, lastInvestmentWeek = 1;
  let propertyFlipProbe: object | null = null;
  let railCompletion: object | null = null;
  for (let iteration = 0; iteration < maxWeeks && !state.gameOver; iteration++) {
    if (state.week % 4 === 1 || state.stores.length < 3) {
      // A growing chain deliberately stops at six stores to control cannibalization and HQ costs.
      if (state.stores.length < 6) {
        const baseline = previewWeek(state).netProfit;
        const choices = sites.filter(l => !state.stores.some(st => st.lotId === l.id)).flatMap(l => styles.map(style => {
          const estimate = evaluateSite(state, l.id, style);
          if (state.stores.length >= 3 && estimate.openingCost + 1200000 <= state.cash) {
            let candidate = applyAction(state, { type: 'openStore', lotId: l.id, style });
            candidate = applyAction(candidate, { type: 'updateStore', storeId: candidate.stores.at(-1)!.id, changes: { manager: true } });
            estimate.expectedProfit = previewWeek(candidate).netProfit - baseline;
          }
          return { lotId: l.id, style, estimate };
        })).filter(c => c.estimate.expectedProfit > 15000 && c.estimate.openingCost + 1200000 <= state.cash).sort((a, b) => b.estimate.expectedProfit / b.estimate.openingCost - a.estimate.expectedProfit / a.estimate.openingCost);
        const next = choices[0];
        if (next) {
          act({ type: 'openStore', lotId: next.lotId, style: next.style }, `Open ${next.lotId} (${next.style})`);
          lastInvestmentWeek = state.week;
          if (!milestone.firstStore) milestone.firstStore = state.week;
          if (state.stores.length === 3) milestone.threeStores = state.week;
        }
      }
      if (state.stores.length >= 3) {
        for (const store of state.stores.filter(s => !s.manager)) act({ type: 'updateStore', storeId: store.id, changes: { manager: true } }, `Delegate ${store.lotId}`);
      }
      // Quality-led profitable operation supports acquisition reputation gates.
      for (const store of state.stores.filter(s => !s.manager)) {
        let best = state; let bestProfit = previewWeek(state).netProfit;
        for (const price of [650, 750, 850, 950]) for (const quality of [85, 100]) for (const staff of [3, 4, 5, 6]) {
          const candidate = applyAction(state, { type: 'updateStore', storeId: store.id, changes: { price, quality, staff, marketing: 0 } });
          const forecast = previewWeek(candidate); const result = forecast.storeResults.find(r => r.id === store.id)!;
          if (result.satisfaction >= 85 && forecast.netProfit > bestProfit) { best = candidate; bestProfit = forecast.netProfit; }
        }
        if (best !== state) {
          const chosen = best.stores.find(s => s.id === store.id)!;
          act({ type: 'updateStore', storeId: store.id, changes: { price: chosen.price, quality: chosen.quality, staff: chosen.staff, marketing: chosen.marketing } });
        }
      }
      if (!state.listed && getSummary(state).ipoEligible) { act({ type: 'ipo' }, 'IPO'); milestone.ipo = state.week; lastInvestmentWeek = state.week; }
      if (state.listed && getSummary(state).ownership > .255 && state.cash < 35000000) { act({ type: 'issueShares', fraction: .25 }, 'Issue equity'); lastInvestmentWeek = state.week; }
      // Purchase one real property after listing, then prioritize highest affordable ROI.
      if (state.listed && !state.properties.length) {
        const candidate = sites.filter(l => l.purchasePrice + 5000000 < state.cash).sort((a, b) => b.rent / b.purchasePrice - a.rent / a.purchasePrice)[0];
        if (candidate) {
          act({ type: 'buyProperty', lotId: candidate.id }, `Property ${candidate.id}`); milestone.property = state.week; lastInvestmentWeek = state.week;
          // The unrelated property-flip regression branch is omitted from G01.
        }
      }
      // Optional branch spends earned cash once, on the first relevant owned district.
      // No projected future state or synthetic funds are used to unlock the action.
      if (railRoute !== 'none' && !state.railProjects?.projects.length) {
        const project = getRailProjects(state).map(p => ({
          project:p,
          option:p.options.find(o => o.id === railRoute && o.unlocked && state.cash >= o.cost + 5000000),
          relevant:railRoute === 'commerce'
            ? state.stores.filter(st => sites.find(l => l.id === st.lotId)?.district === p.districtId).length
            : state.properties.filter(a => sites.find(l => l.id === a.lotId)?.district === p.districtId && !state.stores.some(st => st.lotId === a.lotId)).length,
        })).filter(p => p.option && p.relevant > 0).sort((a,b) => b.relevant-a.relevant)[0];
        if (project) {
          act({type:'startRailProject',districtId:project.project.districtId,choiceId:railRoute},`Rail partnership ${project.project.districtId} (${railRoute})`);
          milestone.railProjectStart=state.week; lastInvestmentWeek=state.week;
        }
      }
      // Research a bounded shortlist with earned cash. Discovery is paid through the same action as UI.
      if (state.listed && state.subsidiaries.length >= 2) {
        const shortlist = getMarketAcquisitionTargets(state).filter(t => !t.researched && state.reputation >= t.minReputation).sort((a, b) => a.quotePrice - b.quotePrice).slice(0, 3);
        for (const t of shortlist) if (state.cash >= t.researchCost + 3000000) act({ type: 'researchMarketCompany', stockId: t.stockId });
      }
      const baseline = previewWeek(state).netProfit;
      const investments: { action: GameAction; cost: number; gain: number; label: string }[] = [];
      for (const store of state.stores.filter(s => s.level < 5)) {
        const cost = 1200000 * store.level; if (cost + 3000000 > state.cash) continue;
        const action: GameAction = { type: 'upgradeStore', storeId: store.id }; const candidate = applyAction(state, action);
        investments.push({ action, cost, gain: previewWeek(candidate).netProfit - baseline, label: `Upgrade ${store.lotId} level${store.level + 1}` });
      }
      for (const target of ACQUISITION_TARGETS.filter(t => state.reputation >= t.minReputation && !state.subsidiaries.some(s => s.id === t.id) && t.price + 5000000 <= state.cash)) {
        const action: GameAction = { type: 'acquire', targetId: target.id }; const candidate = applyAction(state, action);
        investments.push({ action, cost: target.price, gain: previewWeek(candidate).netProfit - baseline, label: `Acquire ${target.id}` });
      }
      for (const target of getMarketAcquisitionTargets(state).filter(t => t.unlocked)) {
        for (const mode of target.choices) {
          if (mode.upfrontCost + 5000000 > state.cash) continue;
          // Public researched range; no hidden-quality or future-market lookahead.
          const gain = (mode.weeklyProfitRange.min + mode.weeklyProfitRange.max) / 2;
          investments.push({ action: { type: 'acquireMarketCompany', stockId: target.stockId, mode: mode.mode }, cost: mode.upfrontCost + mode.weeklyIntegrationCost * mode.leadWeeks, gain, label: `Friendly ${target.stockId} (${mode.mode})` });
        }
      }
      const investment = investments.filter(i => i.gain > 0).sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0];
      if (investment) {
        act(investment.action, investment.label); lastInvestmentWeek = state.week;
        if (investment.action.type === 'acquireMarketCompany') milestone.firstMarketCompany ??= state.week;
        if (investment.action.type === 'acquire') {
          milestone.firstSubsidiary ??= state.week;
          if (state.subsidiaries.some(s => s.sector === 'rail')) milestone.firstRail ??= state.week;
          if (state.subsidiaries.some(s => s.id === 'metropolitan-rail')) milestone.majorRail ??= state.week;
        }
      } else rejectedInvestments++;
      // Finite city objectives compete for the same earned capital. Keep a 30m reserve,
      // and start after the operating group has at least two acquired subsidiaries.
      if (state.listed && state.subsidiaries.length >= 2) {
        const programs = getDevelopmentPrograms(state);
        for (const program of programs) {
          if (!program.active) {
            const property = sites.filter(l => l.district === program.districtId && !state.properties.some(p => p.lotId === l.id)).sort((a, b) => a.purchasePrice - b.purchasePrice)[0];
            if (property && state.cash >= property.purchasePrice + 30000000) {
              act({ type: 'buyProperty', lotId: property.id }, `District property ${program.districtId}`); lastInvestmentWeek = state.week;
            }
          }
          const current = getDevelopmentPrograms(state).find(p => p.districtId === program.districtId)!;
          const localStores = state.stores.filter(st => sites.find(l => l.id === st.lotId)?.district === program.districtId).length;
          const preferred = current.choices.find(c => c.id.endsWith(localStores ? 'commerce' : 'property'));
          if (preferred?.unlocked && state.cash >= preferred.cost + 30000000) {
            act({ type: 'startDevelopment', districtId: program.districtId, choiceId: preferred.id }, `Develop ${preferred.id}`);
            milestone.firstDevelopment ??= state.week; lastInvestmentWeek = state.week;
          }
        }
      }
      const system = getOffers(state).find(o => o.category === 'system' && !state.deals?.contracts.some(c => c.status === 'active' && c.offer.category === 'system'));
      if (system && state.cash > system.upfrontCost + system.investigationCost + 1000000) {
        if (!system.investigated) act({ type: 'investigateOffer', offerId: system.id });
        const inspected = getOffers(state).find(o => o.id === system.id)!;
        const conservativeValue = inspected.conservativeWeeklyBenefit * (inspected.termWeeks - inspected.leadWeeks) - inspected.weeklyFee * inspected.termWeeks - inspected.upfrontCost;
        if (conservativeValue > 0) act({ type: 'acceptOffer', offerId: system.id });
      }
    }
    const phasesBefore = getDevelopmentPrograms(state).reduce((n, p) => n + p.phase, 0);
    const beforeSettlement = state;
    state = advanceWeek(state);
    onTransition?.({ kind: 'advanceWeek', before: beforeSettlement, after: state });
    if (!railCompletion && getRailProjects(state).some(p => p.status === 'operating')) {
      milestone.railProjectComplete=state.week;
      railCompletion={week:state.week,cash:state.cash,weeklyProfit:previewWeek(state).netProfit,projects:getRailProjects(state).filter(p=>p.status==='operating').map(p=>({districtId:p.districtId,choice:p.choice?.id,effects:p.effects}))};
      record('First rail partnership operational');
    }
    const phasesAfter = getDevelopmentPrograms(state).reduce((n, p) => n + p.phase, 0);
    if (phasesAfter > phasesBefore) record(`Development complete: ${phasesAfter}/12 phases`);
    const worth = getSummary(state).netWorth; peakWorth = Math.max(peakWorth, worth); maxDrawdown = Math.max(maxDrawdown, (peakWorth - worth) / peakWorth);
    maxIdleWeeks = Math.max(maxIdleWeeks, state.week - lastInvestmentWeek);
    if (state.week % 52 === 1) {
      validateGame(state);
      checkpoints.push({ week: state.week, cash: state.cash, netWorth: worth, weeklyProfit: previewWeek(state).netProfit, reputation: Math.round(state.reputation), stores: state.stores.length, subsidiaries: state.subsidiaries.length });
    }
    if (getDevelopmentPrograms(state).every(p => p.phase === 3 && p.active)) milestone.allDistricts ??= state.week;
    if (ACQUISITION_TARGETS.every(t => state.subsidiaries.some(s => s.id === t.id))) milestone.allCompanies ??= state.week;
    if ((state.marketAcquisitions?.companies.length ?? 0) === STOCKS.length) milestone.allMarketAcquired ??= state.week;
    if (getMarketGroupFinancials(state).operating === STOCKS.length) milestone.allMarketOperating ??= state.week;
    if (getCampaignCompletion(state).complete && (railRoute === 'none' || !!railCompletion)) { milestone.campaignComplete = state.week; break; }
  }
  const decoded = await decodeEnvelope(await createEnvelope(state));
  const saveRoundTrip = JSON.stringify(state) === JSON.stringify(decoded);
  return { seed, railRoute, completion: getCampaignCompletion(state), railCompletion, railProjects:getRailProjects(state).filter(p=>p.choice).map(p=>({districtId:p.districtId,choice:p.choice?.id,status:p.status,effects:p.effects})), railFinancials:getRailProjectFinancials(state), salesContracts:(state.deals?.contracts??[]).map(c=>({id:c.id,context:getDealContext(c.offer),status:c.status,cumulativeBenefit:c.cumulativeBenefit,cumulativeFees:c.cumulativeFees,upfront:c.offer.upfrontCost})), milestone, completed: !!milestone.campaignComplete, marketCompanies: state.marketAcquisitions?.companies.length ?? 0, marketOperating: getMarketGroupFinancials(state).operating, actionCounts, executedActionCount: Object.values(actionCounts).reduce((n, count) => n + count, 0), development: getDevelopmentPrograms(state).map(p => ({ districtId: p.districtId, phase: p.phase, active: p.active, status: p.status })), finalWeek: state.week, finalCash: state.cash, finalWorth: getSummary(state).netWorth, weeklyProfit: previewWeek(state).netProfit, reputation: state.reputation, stores: state.stores.length, managers: state.stores.filter(s => s.manager).length, subsidiaries: state.subsidiaries.map(s => s.id), ruined: state.gameOver, reason: state.gameOverReason, maxDrawdown, maxIdleWeeks, rejectedInvestments, saveRoundTrip, propertyFlipProbe, events, checkpoints };
}
