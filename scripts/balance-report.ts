import { createGame, applyAction, advanceWeek, getSummary, evaluateSite } from '../src/sim/engine';
import { STOCKS } from '../src/data/stocks';
import { LOTS } from '../src/data/district';
import type { GameState, SiteEstimate } from '../src/model';

export interface ScenarioOptions {
  /** Freeze the opportunity set when comparing historical authored maps. */
  candidateLotIds?: readonly string[];
  observeOpening?: (before: GameState, after: GameState, estimate: SiteEstimate) => void;
  observeSettlement?: (state: GameState) => void;
}

export function runScenario(seed: number, strategy: 'cash' | 'basket' | 'growth' | 'cafes' | 'managed-cafes' | 'overstaffed-debt', weeks = 104, options: ScenarioOptions = {}) {
  let s = createGame('Balance laboratory', seed), peak = s.cash, drawdown = 0, ipoWeek: number | null = null;
  const candidateIds = options.candidateLotIds ? new Set(options.candidateLotIds) : null;
  if (strategy === 'basket' || strategy === 'growth') {
    const selected = strategy === 'basket' ? STOCKS : STOCKS.filter(x => x.volatility >= .06);
    const budget = s.cash * .8 / selected.length;
    for (const stock of selected) {
      const shares = Math.floor(budget / stock.basePrice);
      if (shares > 0) s = applyAction(s, { type: 'buyStock', stockId: stock.id, shares });
    }
  }
  if (strategy === 'overstaffed-debt') {
    s = applyAction(s, { type: 'openStore', lotId: LOTS.find(l => l.available)!.id, style: 'standard' });
    s = applyAction(s, { type: 'updateStore', storeId: s.stores[0].id, changes: { staff: 30, marketing: 500000 } });
    s = applyAction(s, { type: 'borrow', amount: 1000000, weeks: 52 });
  }
  for (let i = 0; i < weeks && !s.gameOver; i++) {
    if ((strategy === 'cafes' || strategy === 'managed-cafes') && s.stores.length < 8 && s.cash >= 4_600_000) {
      const candidates = LOTS.filter(l => l.available && (!candidateIds || candidateIds.has(l.id)) && !s.stores.some(st => st.lotId === l.id)).map(l => ({ l, e: evaluateSite(s, l.id, 'standard', strategy === 'managed-cafes') })).sort((a, b) => b.e.expectedProfit - a.e.expectedProfit);
      const next = candidates[0];
      if (next && next.e.expectedProfit > 0 && s.cash >= next.e.openingCost + 1_000_000) { const before = s; s = applyAction(s, { type: 'openStore', lotId: next.l.id, style: 'standard' }); if (strategy === 'managed-cafes') s = applyAction(s, { type: 'updateStore', storeId: s.stores.at(-1)!.id, changes: { manager: true } }); options.observeOpening?.(before, s, next.e); }
    }
    s = advanceWeek(s);
    options.observeSettlement?.(s);
    const worth = getSummary(s).netWorth;
    peak = Math.max(peak, worth); drawdown = Math.max(drawdown, (peak - worth) / peak);
    if (ipoWeek === null && getSummary(s).ipoEligible) ipoWeek = s.week - 1;
  }
  return { seed, strategy, weeks: s.week - 1, netWorth: getSummary(s).netWorth, drawdown, ruined: s.gameOver, stores: s.stores.length, weeklyProfit: getSummary(s).weeklyProfit, ipoWeek };
}
export function balanceReport(seeds = 32) {
  return (['cash', 'basket', 'growth', 'cafes', 'managed-cafes', 'overstaffed-debt'] as const).map(strategy => {
    const runs = Array.from({ length: seeds }, (_, i) => runScenario(i + 1, strategy));
    const values = runs.map(r => r.netWorth).sort((a, b) => a - b);
    const storeCounts = runs.map(r => r.stores).sort((a, b) => a - b);
    const weeklyProfits = runs.map(r => r.weeklyProfit).sort((a, b) => a - b);
    return { strategy, seeds, weeks: 104, medianNetWorth: values[Math.floor(seeds / 2)], medianStores: storeCounts[Math.floor(seeds / 2)], medianWeeklyProfit: weeklyProfits[Math.floor(seeds / 2)], minNetWorth: values[0], maxNetWorth: values.at(-1), meanMaxDrawdown: runs.reduce((a, r) => a + r.drawdown, 0) / seeds, ruinRate: runs.filter(r => r.ruined).length / seeds, ipoWeeks: [...new Set(runs.map(r => r.ipoWeek))] };
  });
}
const runtime = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
if (!runtime.process?.env?.VITEST) console.log(JSON.stringify(balanceReport(), null, 2));
