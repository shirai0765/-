#!/usr/bin/env node
/** Node24 strips existing TypeScript; this resolve hook supplies extensionless .ts imports. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !path.extname(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const seed = Number(option('--seed', '1'));
const maxWeeks = Number(option('--max-weeks', '1400'));
const midWeek = Number(option('--mid-week', '104'));
const out = path.resolve(option('--out', 'docs/external/gameplay-review/traces/run-01'));
const root = fileURLToPath(new URL('../../../', import.meta.url));
if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(maxWeeks) || !Number.isSafeInteger(midWeek)) throw Error('Invalid integer option');
fs.mkdirSync(out, { recursive: true });
if (fs.readdirSync(out).length) throw Error('Use a new output directory');
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const append = (name, value) => fs.appendFileSync(path.join(out, name), JSON.stringify(value) + '\n');
function sourceFiles(directory, relative = '') {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name), key = path.join(relative, entry.name);
    return entry.isDirectory() ? Object.entries(sourceFiles(filename, key)) : /\.(ts|tsx|css)$/.test(filename) ? [[key, hash(fs.readFileSync(filename, 'utf8'))]] : [];
  }).sort(([a], [b]) => a.localeCompare(b)));
}
function checkoutSha() {
  const head = fs.readFileSync(path.join(root, '.git/HEAD'), 'utf8').trim();
  if (!head.startsWith('ref: ')) return head;
  const ref = head.slice(5), loose = path.join(root, '.git', ref);
  if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim();
  const line = fs.readFileSync(path.join(root, '.git/packed-refs'), 'utf8').split('\n').find(row => row.endsWith(' ' + ref));
  return line?.split(' ')[0] ?? null;
}
const started = performance.now(), startedAt = new Date().toISOString();
const sourcesBefore = sourceFiles(path.join(root, 'src'));
write('source-hashes-before.json', sourcesBefore);
const meta = { status: 'running', seed, startedAt, sourceSha: checkoutSha(), version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  runtimeSourceTreeSha256: hash(sourcesBefore), mode: 'public-engine-actions', node: process.version,
  policy: 'Copied six-store campaignV4; only trace hooks/import paths, selected-settings replay and removal of unrelated property-flip probe differ.',
  publicEntryPoints: ['createGame', 'applyAction', 'advanceWeek', 'createEnvelope', 'decodeEnvelope'],
  humanPlaySeconds: null, humanPlayNote: 'No timed human gameplay in this engine trace', humanThirtyHours: 'unmeasured',
  maxWeeks, midWeek, syntheticStateUsed: false, fundingInjectionUsed: false, futureOutcomeLookahead: false,
  selectionInputs: 'Current public estimates, affordability/reputation and research ranges; speculative applyAction/previewWeek comparisons are selection calculations, not executed trace actions.',
  nativeBrowserEvidence: 'Separate probe-01; no engine trace is counted as native UI evidence.',
  traces: {}, saves: [], limits: ['Seed-specific automated progress; no all-strategy or 30-hour enjoyment proof', 'Per-transition compact before/after state plus full-state hashes; full saves at boundaries and milestones enable action replay'],
};
write('summary.json', meta);
let index = 0, lastState, managerBase, lastInvestmentWeek = 1, longestIdleWeeks = 0;
const saveQueue = [];
const filenames = ['trace-01-founder.jsonl', 'trace-02-ipo-investment.jsonl', 'trace-03-late-growth.jsonl'];
for (const name of filenames) fs.writeFileSync(path.join(out, name), '');
const phase = row => row.before == null || row.before.week === 1 ? 0 : row.before.week < midWeek ? 1 : 2;
function compact(state) {
  if (!state) return null;
  return { id: state.id, week: state.week, cash: state.cash, reputation: state.reputation,
    stores: state.stores.map(({ revenue, profit, customers, satisfaction, ...store }) => store),
    properties: state.properties, loans: state.loans, subsidiaries: state.subsidiaries.map(s => s.id),
    marketAcquisitions: state.marketAcquisitions, development: state.development, railProjects: state.railProjects,
    listed: state.listed, sharesOutstanding: state.sharesOutstanding, founderShares: state.founderShares,
    profitableWeeks: state.profitableWeeks, totalCustomers: state.totalCustomers, gameOver: state.gameOver,
    gameOverReason: state.gameOverReason, campaignAchievement: state.campaignAchievement,
    lastReportWeek: state.lastReport?.week, netProfit: state.lastReport?.netProfit,
  };
}
function noteSave(label, state) {
  if (!saveQueue.some(row => row.label === label)) saveQueue.push({ label, state });
}
function transition(row) {
  const stage = phase(row), name = filenames[stage], stageName = name.replace('.jsonl', '');
  const record = { index: ++index, kind: row.kind, action: row.action ?? null,
    beforeState: compact(row.before), afterState: compact(row.after), beforeStateSHA256: row.before ? hash(row.before) : null, afterStateSHA256: hash(row.after),
    cashDelta: row.before ? row.after.cash - row.before.cash : null,
    actualReport: row.kind === 'advanceWeek' ? row.after.lastReport : null };
  append(name, record);
  const stats = meta.traces[stageName] ??= { fromWeek: row.before?.week ?? 1, toStateWeek: row.after.week, actions: 0, settlements: 0, idleSettlements: 0, positiveSettlements: 0, nonpositiveSettlements: 0, minCash: row.after.cash, minNetProfit: null, firstStateSHA256: record.beforeStateSHA256 ?? record.afterStateSHA256, finalStateSHA256: record.afterStateSHA256 };
  stats.toStateWeek = row.after.week; stats.finalStateSHA256 = record.afterStateSHA256; stats.minCash = Math.min(stats.minCash, row.after.cash);
  if (row.kind === 'applyAction') { stats.actions++; lastInvestmentWeek = row.after.week; }
  if (row.kind === 'advanceWeek') {
    stats.settlements++; if (row.after.week - lastInvestmentWeek > 1) stats.idleSettlements++;
    const actual = row.after.lastReport;
    if (actual.netProfit > 0) stats.positiveSettlements++; else stats.nonpositiveSettlements++;
    stats.minNetProfit = stats.minNetProfit == null ? actual.netProfit : Math.min(stats.minNetProfit, actual.netProfit);
    longestIdleWeeks = Math.max(longestIdleWeeks, row.after.week - lastInvestmentWeek);
    if (!managerBase) { managerBase = row.before; noteSave('founder-first-settlement', row.after); }
    if (row.after.week === midWeek) noteSave('middle-boundary', row.after);
    if (row.after.week % 52 === 1) noteSave(`year-${(row.after.week - 1) / 52}`, row.after);
  }
  if (!row.before) noteSave('natural-new-company', row.after);
  if (row.action?.type === 'ipo') noteSave('ipo', row.after);
  if (row.action?.type === 'acquire' && !row.before?.subsidiaries.length) noteSave('first-direct-acquisition', row.after);
  if (row.action?.type === 'acquireMarketCompany' && !row.before?.marketAcquisitions?.companies.length) noteSave('first-market-acquisition', row.after);
  if ((row.after.marketAcquisitions?.companies.length ?? 0) === 100) noteSave('all-market-acquired', row.after);
  if (row.after.campaignAchievement) noteSave('campaign-achievement', row.after);
  if (row.after.week % 104 === 1 && row.kind === 'advanceWeek') console.log(JSON.stringify({ index, week: row.after.week, cash: row.after.cash, subsidiaries: row.after.subsidiaries.length, market: row.after.marketAcquisitions?.companies.length ?? 0 }));
  lastState = row.after;
}
try {
  const { campaignV4 } = await import('./policy.ts');
  const engine = await import('../../../src/sim/engine.ts');
  const persistence = await import('../../../src/persistence.ts');
  const summary = await campaignV4(seed, maxWeeks, 'none', transition);
  meta.campaign = summary;
  noteSave('final-natural-state', lastState);
  for (const { label, state } of saveQueue) {
    const envelope = await persistence.createEnvelope(state); const restored = await persistence.decodeEnvelope(envelope);
    assert.deepEqual(restored, state);
    const filename = `save-${label}.json`; write(filename, envelope);
    meta.saves.push({ label, file: filename, week: state.week, checksum: envelope.checksum, payloadSHA256: hash(state), exactRoundTrip: true });
  }
  if (managerBase?.stores.length) {
    const baselineEnvelope = await persistence.createEnvelope(managerBase);
    write('save-manager-natural-baseline.json', baselineEnvelope);
    const comparison = { baselineWeek: managerBase.week, baselineSeed: managerBase.seed, baselineSHA256: hash(managerBase), separation: 'Branch-only comparison; outcomes excluded from main campaign funds/reputation/achievements', branches: {} };
    for (const delegated of [false, true]) {
      const restored = await persistence.decodeEnvelope(baselineEnvelope); assert.deepEqual(restored, managerBase);
      const action = { type: 'updateStore', storeId: restored.stores[0].id, changes: { manager: delegated } };
      const configured = engine.applyAction(restored, action), settled = engine.advanceWeek(configured);
      const name = delegated ? 'delegated' : 'manual';
      comparison.branches[name] = { action, beforeState: compact(restored), configuredState: compact(configured), afterState: compact(settled), actualReport: settled.lastReport, actualSettings: settled.stores, cashDelta: settled.cash - configured.cash };
      const save = await persistence.createEnvelope(settled); assert.deepEqual(await persistence.decodeEnvelope(save), settled);
      write(`save-manager-${name}.json`, save);
    }
    write('manager-comparison.json', comparison); meta.managerComparison = comparison;
    const borrowBefore = await persistence.decodeEnvelope(baselineEnvelope);
    const borrowingAction = { type: 'borrow', amount: 1000000, weeks: 52 };
    const borrowed = engine.applyAction(borrowBefore, borrowingAction);
    const loanSettled = engine.advanceWeek(borrowed);
    const loanSave = await persistence.createEnvelope(loanSettled);
    assert.deepEqual(await persistence.decodeEnvelope(loanSave), loanSettled);
    write('save-founder-loan-branch.json', loanSave);
    meta.founderLoanBranch = { mode: 'public-engine-actions; does not cover native bank screening UI',
      action: borrowingAction, separation: 'Natural initial-company branch only; no outcome merged into campaign',
      beforeState: compact(borrowBefore), borrowedState: compact(borrowed), afterState: compact(loanSettled),
      actualReport: loanSettled.lastReport, saveExactRoundTrip: true };
    write('founder-loan-branch.json', meta.founderLoanBranch);
  }
  meta.longestIdleGameWeeks = longestIdleWeeks;
  meta.status = lastState.campaignAchievement ? 'completed-all-objectives' : lastState.gameOver ? 'company-ended' : 'incomplete-at-bound';
  meta.finalActual = { stateWeek: lastState.week, cash: lastState.cash, report: lastState.lastReport, achievement: lastState.campaignAchievement ?? null };
} catch (error) {
  meta.status = 'failed'; meta.failure = { message: String(error), stack: error.stack, transitionsPreserved: index }; process.exitCode = 1;
  console.error(String(error));
} finally {
  meta.finishedAt = new Date().toISOString(); meta.scriptElapsedSeconds = (performance.now() - started) / 1000;
  meta.gameWeeksSettled = Object.values(meta.traces).reduce((n, row) => n + row.settlements, 0);
  const sourcesAfter = sourceFiles(path.join(root, 'src')); write('source-hashes-after.json', sourcesAfter);
  meta.runtimeSourcesUnchanged = JSON.stringify(sourcesBefore) === JSON.stringify(sourcesAfter);
  write('summary.json', meta);
  console.log(JSON.stringify({ status: meta.status, gameWeeksSettled: meta.gameWeeksSettled, scriptElapsedSeconds: meta.scriptElapsedSeconds, saves: meta.saves.length, runtimeSourcesUnchanged: meta.runtimeSourcesUnchanged }));
}
