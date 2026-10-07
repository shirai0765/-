import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LOTS } from '../src/data/district';
import { V080_NEIGHBORHOOD_LOTS } from '../src/data/neighborhoodsV080';
import { getSummary, managerPlan } from '../src/sim/engine';
import type { GameState, Lot } from '../src/model';
import { runScenario } from './balance-report';

// VITEST=1 ./node_modules/.bin/vite-node scripts/balance-neighborhood-comparison.ts
// An optional BALANCE_COMPARISON_OUTPUT is written exclusively, preserving any
// earlier successful or failed evidence. This is a two-route CPU diagnostic.
const baseline = JSON.parse(await readFile(fileURLToPath(new URL('../tests/fixtures/neighborhoods-v070-baseline.json', import.meta.url)), 'utf8')) as { sourceCommit: string; lots: { lot: Lot }[] };
const addedIds = new Set(V080_NEIGHBORHOOD_LOTS.map(lot => lot.id));
const oldIds = baseline.lots.map(({ lot }) => lot.id);

function compare(candidateLotIds: string[]) {
  let openingSpend = 0, actualEarnings = 0, previousCash = 12_000_000, final: GameState | null = null;
  const openings: { week: number; lotId: string; added: boolean; cost: number; footfall: number; affluence: number; rent: number; nearby: number; incrementalNeutralProfit: number }[] = [];
  const result = runScenario(7, 'managed-cafes', 104, {
    candidateLotIds,
    observeOpening(before, after, estimate) {
      const store = after.stores.at(-1)!, lot = LOTS.find(lot => lot.id === store.lotId)!;
      const cost = before.cash - after.cash;
      if (before.cash !== previousCash || cost !== 3_600_000) throw new Error('Unexpected opening funding');
      openingSpend += cost;
      previousCash = after.cash;
      openings.push({ week: before.week, lotId: lot.id, added: addedIds.has(lot.id), cost, footfall: lot.footfall, affluence: lot.affluence, rent: lot.rent, nearby: estimate.competition, incrementalNeutralProfit: estimate.expectedProfit });
    },
    observeSettlement(state) {
      const report = state.lastReport!;
      if (state.cash !== previousCash + report.netProfit || report.cashChange !== report.netProfit) throw new Error('Unexpected settlement funding');
      actualEarnings += report.netProfit;
      previousCash = state.cash;
      final = state;
    },
  });
  const state = final! as GameState;
  const bookValue = state.stores.length * 3_600_000 * .55;
  if (state.cash !== 12_000_000 - openingSpend + actualEarnings || result.netWorth !== state.cash + bookValue || state.listed || state.loans.length || state.properties.length || state.subsidiaries.length || state.positions.length) throw new Error('Unexpected final assets');
  return {
    candidates: candidateLotIds.length, result, openingSpend, actualEarnings, cash: state.cash, storeBookValue: bookValue, openings,
    finalStores: state.stores.map(store => {
      const lot = LOTS.find(lot => lot.id === store.lotId)!, plan = managerPlan(state, store);
      return { lotId: lot.id, added: addedIds.has(lot.id), footfall: lot.footfall, affluence: lot.affluence, rent: lot.rent, nearby: state.stores.filter(other => other.id !== store.id && Math.hypot(LOTS.find(lot => lot.id === other.lotId)!.x - lot.x, LOTS.find(lot => lot.id === other.lotId)!.z - lot.z) < 70).length,
        level: store.level, price: plan.price, quality: plan.quality, staff: plan.staff, marketing: plan.marketing, lastActualProfit: store.profit, lastActualSatisfaction: store.satisfaction };
    }),
    finalSummary: getSummary(state),
  };
}

const report = { baselineCommit: baseline.sourceCommit, scope: 'Seed 7, 104 weeks, normal cash/reputation, same adaptive managed-standard-store policy, no capital injection or IPO action; internal neutral evaluation is diagnostic only.', old48: compare(oldIds), current72: compare(LOTS.filter(lot => lot.available).map(lot => lot.id)) };
const output = process.env.BALANCE_COMPARISON_OUTPUT;
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
