#!/usr/bin/env node
/** Recreate the recorded public action sequence; no imported late-game fixture. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { gunzipSync } from 'node:zlib';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith('.') && !path.extname(specifier) ? `${specifier}.ts` : specifier, context);
} });
const args = process.argv.slice(2);
let trace = null, directoryArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--trace') {
    trace = args[++i];
    assert.ok(['01', '02', '03'].includes(trace), '--trace must be 01, 02 or 03');
  } else {
    assert.ok(!args[i].startsWith('-') && directoryArg === null, `Unexpected argument: ${args[i]}`);
    directoryArg = args[i];
  }
}
const directory = path.resolve(directoryArg ?? 'docs/external/gameplay-review/traces/run-02');
const phases = {
  '01': { stem: 'trace-01-founder', start: 'save-natural-new-company.json', end: 'save-founder-first-settlement.json' },
  '02': { stem: 'trace-02-ipo-investment', start: 'save-founder-first-settlement.json', end: 'save-middle-boundary.json' },
  '03': { stem: 'trace-03-late-growth', start: 'save-middle-boundary.json', end: 'save-final-natural-state.json' },
};
const selected = trace ? [phases[trace]] : Object.values(phases);
const startSave = selected[0].start, endSave = selected.at(-1).end;
const optionalJson = filename => fs.existsSync(path.join(directory, filename))
  ? JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8')) : null;
const meta = optionalJson('summary.json');
const phaseMeta = trace ? optionalJson(`${phases[trace].stem}.summary.json`) : null;
const provenance = phaseMeta ?? meta;
const engine = await import('../../../src/sim/engine.ts');
const persistence = await import('../../../src/persistence.ts');
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const checkedSaveFiles = new Set();
async function checkedSave(filename, expectedPayloadSHA256) {
  const restored = await persistence.decodeEnvelope(JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8')));
  if (expectedPayloadSHA256) assert.equal(sha(restored), expectedPayloadSHA256, filename);
  assert.deepEqual(await persistence.decodeEnvelope(await persistence.createEnvelope(restored)), restored, `save round trip: ${filename}`);
  checkedSaveFiles.add(filename);
  return restored;
}
const started = performance.now();
const natural = await checkedSave(startSave);
const beginsAtCreation = trace === null || trace === '01';
let state = beginsAtCreation ? engine.createGame(natural.companyName, natural.seed) : natural;
if (beginsAtCreation) assert.deepEqual(state, natural, 'createGame must exactly match natural initial save');
let steps = 0, settlements = 0, actions = 0, lastIndex = null;
const checkedTraceFiles = [];
for (const phase of selected) {
  const plain = `${phase.stem}.jsonl`, compressed = `${plain}.gz`;
  const filename = fs.existsSync(path.join(directory, compressed)) ? compressed : plain;
  const raw = fs.readFileSync(path.join(directory, filename));
  const bytes = filename.endsWith('.gz') ? gunzipSync(raw) : raw;
  const evidenceMeta = trace ? phaseMeta : optionalJson(`${phase.stem}.summary.json`);
  if (evidenceMeta?.evidence?.sha256) {
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), evidenceMeta.evidence.sha256, `decompressed JSONL SHA: ${filename}`);
  }
  checkedTraceFiles.push(filename);
  for (const line of bytes.toString('utf8').trim().split('\n').filter(Boolean)) {
    const record = JSON.parse(line);
    if (lastIndex !== null) assert.equal(record.index, lastIndex + 1, 'transition indexes must be consecutive');
    lastIndex = record.index;
    if (record.kind === 'createGame') {
      assert.ok(beginsAtCreation && steps === 0, 'createGame is valid only at the initial-company boundary');
      assert.equal(record.beforeStateSHA256, null);
      assert.equal(sha(state), record.afterStateSHA256);
    }
    else {
      assert.ok(['applyAction', 'advanceWeek'].includes(record.kind), `Unknown transition kind: ${record.kind}`);
      assert.equal(sha(state), record.beforeStateSHA256, `before transition ${record.index}`);
      state = record.kind === 'applyAction' ? engine.applyAction(state, record.action) : engine.advanceWeek(state);
      assert.equal(sha(state), record.afterStateSHA256, `after transition ${record.index}`);
      if (record.kind === 'advanceWeek') {
        assert.ok(record.actualReport, `missing actual report at transition ${record.index}`);
        assert.deepEqual(state.lastReport, record.actualReport);
        settlements++;
      } else actions++;
    }
    steps++;
  }
}
assert.ok(steps > 0, 'trace must contain transitions');
const final = await checkedSave(endSave);
assert.deepEqual(state, final);
assert.deepEqual(await persistence.decodeEnvelope(await persistence.createEnvelope(state)), state);
// Individual submissions require only their own start/end saves. In full mode,
// a supplied campaign manifest additionally requires its listed milestone saves.
if (trace === null) {
  for (const save of meta?.saves ?? []) await checkedSave(save.file, save.payloadSHA256);
}
const result = { passed: true, trace: trace ?? 'all',
  method: beginsAtCreation
    ? 'createGame matched natural initial save, then recorded public actions; full before/after SHA, actual reports and save round trips checked'
    : 'Limited phase replay from the unmodified previous-phase natural save; recorded public actions, full before/after SHA, actual reports and boundary save round trips checked',
  provesNaturalCreationInThisReplay: beginsAtCreation,
  sourceSha: provenance?.sourceSha ?? null, version: provenance?.version ?? null, seed: natural.seed,
  provenanceNote: provenance ? 'Recorded provenance; transition hashes verify runtime behavior' : 'No optional metadata supplied; recorded source/version are unknown',
  transitions: steps, executedActions: actions, gameWeeksSettled: settlements,
  initialStateWeek: natural.week, finalStateWeek: state.week, finalCash: state.cash,
  achievement: state.campaignAchievement ?? null, checkedSaves: checkedSaveFiles.size,
  checkedSaveFiles: [...checkedSaveFiles], checkedTraceFiles,
  scriptElapsedSeconds: (performance.now() - started) / 1000, humanThirtyHours: 'unmeasured' };
// Preserve the original 1,741-transition replay-result.json as historical evidence.
const resultFile = trace ? `replay-trace-${trace}-result.json` : 'replay-full-result.json';
fs.writeFileSync(path.join(directory, resultFile), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
