#!/usr/bin/env node
// Preparation only until the parent grants the single native-browser slot.
// Normal HTTP pages, native decode/output, trusted pointer clicks. No runtime,
// AudioContext, RAF, TLS, timers, codecs or renderer replacement.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const repo = path.resolve(option('--repo', '/workspace/shibuya-news-research-20261007T054410Z'));
const out = path.resolve(option('--out', '/tmp/shibuya-audio-native-results'));
const cycles = Number(option('--real-cycles', '0'));
assert.ok([0, 3].includes(cycles), '--real-cycles must be 0 or 3');
fs.mkdirSync(out, { recursive: true });
const started = performance.now();
const result = {
  mode: 'native-headless-Chromium-local-HTTP', startedAt: new Date().toISOString(),
  method: 'Original audition HTML, trusted mouse clicks, read-only native AudioContext/AudioBuffer observation',
  browser: { executablePath: '/usr/bin/chromium', chromiumSandbox: true, headless: true, muteAudioFlagRemoved: true },
  noAudioOrRendererReplacement: true, newDependencyInstalled: false, requestedRealCycles: cycles,
  humanListening: 'not-performed', physicalSafari: 'not-performed', physicalSpeakerOutput: 'not-measured',
  gameRuntimeIntegration: 'not-tested; original standalone asset audition pages only',
  checks: [], events: [], errors: [], sourceHashes: {},
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function hashFiles(directory, target = result.sourceHashes) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) hashFiles(absolute, target);
    else if (/\.(m4a|mp3|ogg|wav|html|js|json)$/.test(entry.name)) target[path.relative(repo, absolute)] = hash(fs.readFileSync(absolute));
  }
}
hashFiles(path.join(repo, 'public/audio/external-v080'));
function save() { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n'); }
function note(name, data = {}) {
  const row = { at: new Date().toISOString(), scriptSeconds: (performance.now() - started) / 1000, name, ...data };
  result.events.push(row); fs.appendFileSync(path.join(out, 'events.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify({ name, ...data })); save();
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
const root = path.join(repo, 'public');
const server = http.createServer((request, response) => {
  try {
    const filename = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const stat = fs.statSync(filename); if (!stat.isFile()) { response.writeHead(404).end(); return; }
    const headers = { 'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    let first = 0, last = stat.size - 1;
    if (request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!match) { response.writeHead(416).end(); return; }
      if (match[1]) { first = Number(match[1]); if (match[2]) last = Math.min(last, Number(match[2])); }
      else if (match[2]) first = Math.max(0, stat.size - Number(match[2]));
      if (first > last || first >= stat.size) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      headers['Content-Range'] = `bytes ${first}-${last}/${stat.size}`;
    }
    headers['Content-Length'] = last - first + 1;
    response.writeHead(request.headers.range ? 206 : 200, headers);
    if (request.method === 'HEAD') response.end(); else fs.createReadStream(filename, { start: first, end: last }).pipe(response);
  } catch { response.writeHead(404).end(); }
});
let browser, context, page;
async function snapshot() {
  return page.evaluate(() => {
    const ctx = typeof context === 'undefined' ? null : context;
    const activeSource = typeof source !== 'undefined' ? source : typeof room !== 'undefined' ? room : null;
    const activeCue = typeof cue !== 'undefined' ? cue : null;
    const buffers = typeof cache === 'undefined' ? [] : [...cache.entries()].map(([key, buffer]) => ({ key, duration: buffer.duration, sampleRate: buffer.sampleRate, frames: buffer.length, channels: buffer.numberOfChannels }));
    const describe = node => node ? { loop: node.loop, loopStart: node.loopStart, loopEnd: node.loopEnd, duration: node.buffer?.duration, sampleRate: node.buffer?.sampleRate } : null;
    return { url: location.href, status: document.querySelector('#status')?.textContent,
      userActivation: { hasBeenActive: navigator.userActivation?.hasBeenActive, isActive: navigator.userActivation?.isActive },
      context: ctx ? { state: ctx.state, currentTime: ctx.currentTime, sampleRate: ctx.sampleRate, baseLatency: ctx.baseLatency, outputLatency: ctx.outputLatency } : null,
      activeSource: describe(activeSource), activeCue: describe(activeCue),
      legacyEffects: typeof effects === 'undefined' ? null : effects.size,
      media: [...document.querySelectorAll('audio')].map(a => ({ currentSrc: a.currentSrc, paused: a.paused, ended: a.ended, currentTime: a.currentTime, loop: a.loop, readyState: a.readyState, error: a.error ? { code: a.error.code, message: a.error.message } : null })),
      decodedBuffers: buffers, trustedClicks: window.__audioQAClicks ?? [] };
  });
}
async function freshPage(relative) {
  if (context) await context.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 1000 } }); page = await context.newPage();
  page.on('pageerror', error => result.errors.push({ type: 'pageerror', url: page.url(), message: error.message }));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) result.errors.push({ type: message.type(), url: page.url(), message: message.text() }); });
  page.on('requestfailed', request => result.errors.push({ type: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  await page.goto(base + relative, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__audioQAClicks = [];
    document.addEventListener('click', event => window.__audioQAClicks.push({ trusted: event.isTrusted, tag: event.target.tagName, id: event.target.id, text: event.target.textContent?.slice(0, 60), at: performance.now() }), true);
  });
  await page.waitForTimeout(700);
  const initial = await snapshot();
  assert.equal(initial.context, null, 'No AudioContext should be created before a gesture');
  assert.ok(initial.media.every(a => a.paused && a.currentTime === 0 && !a.loop), 'No initial media autoplay or implicit loop');
  note('no-autoplay', { relative, initial });
}
async function pointer(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox(); assert.ok(box && box.width > 0 && box.height > 0);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function stop() {
  await pointer(page.locator('#stop')); await page.waitForTimeout(100);
  const state = await snapshot();
  assert.equal(state.activeSource, null); assert.equal(state.activeCue, null);
  assert.ok(state.legacyEffects === null || state.legacyEffects === 0);
  assert.ok(state.media.every(a => a.paused)); note('stop', { state });
}
async function playing(label) {
  await page.waitForFunction(() => {
    const s = typeof source !== 'undefined' ? source : typeof room !== 'undefined' ? room : null;
    return Boolean(s) || /失敗|一致しません|未測定|収まりません/.test(document.querySelector('#status')?.textContent ?? '');
  }, null, { timeout: 20000 });
  const first = await snapshot(); assert.ok(first.activeSource, first.status);
  assert.equal(first.context.state, 'running'); assert.equal(first.trustedClicks.at(-1)?.trusted, true);
  await page.waitForTimeout(1200); const after = await snapshot();
  assert.ok(after.context.currentTime - first.context.currentTime > .5, 'Native AudioContext time should progress');
  note('native-playback-progress', { label, first, after }); return after;
}
async function loopSignal(label) {
  const measured = await page.evaluate(() => {
    const s = typeof source !== 'undefined' ? source : room;
    const b = s.buffer, first = Math.round(s.loopStart * b.sampleRate), last = Math.round(s.loopEnd * b.sampleRate);
    if (!(first >= 0 && last > first && last <= b.length)) return { error: 'Loop interval exceeds native decoded frame range', first, last, frames: b.length };
    const channels = [];
    for (let c = 0; c < b.numberOfChannels; c++) {
      const pcm = b.getChannelData(c); let sum = 0, peak = 0, clipped = 0;
      for (let i = first; i < last; i++) { const v = pcm[i]; sum += v * v; peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) >= 1) clipped++; }
      const rms = Math.sqrt(sum / (last - first)), joinDelta = Math.abs(pcm[first] - pcm[last - 1]);
      const windows = []; const n = Math.round(b.sampleRate * .02);
      for (let offset = -5; offset < 5; offset++) {
        let energy = 0;
        for (let i = 0; i < n; i++) { const index = first + ((last - first + offset * n + i) % (last - first)); energy += pcm[index] ** 2; }
        windows.push(20 * Math.log10(Math.max(1e-12, Math.sqrt(energy / n))));
      }
      channels.push({ rmsDbfs: 20 * Math.log10(Math.max(rms, 1e-12)), samplePeakDbfs: 20 * Math.log10(Math.max(peak, 1e-12)), clipped,
        generatedThreePeriodRmsDbfs: Array(3).fill(20 * Math.log10(Math.max(rms, 1e-12))),
        generatedTwoJoinDeltas: [joinDelta, joinDelta], joinDeltaDbfs: 20 * Math.log10(Math.max(joinDelta, 1e-12)),
        adjacent20msRmsDbfs: windows, silent20msWindowsBelowMinus80: windows.filter(v => v < -80).length });
    }
    return { basis: 'Read native decoded AudioBuffer and mathematically repeat selected period; no browser output capture or human listening', sampleRate: b.sampleRate, decodedFrames: b.length, decodedDuration: b.duration, loopFirstFrame: first, loopLastFrame: last, channels };
  });
  assert.ok(!measured.error, measured.error); note('native-decoded-generated-three-period-check', { label, measured });
}
async function realCycles(label) {
  if (!cycles) return;
  const first = await snapshot(); const period = first.activeSource.loopEnd - first.activeSource.loopStart;
  const required = period * cycles;
  while (true) {
    const current = await snapshot(); const elapsed = current.context.currentTime - first.context.currentTime;
    assert.ok(current.activeSource && current.context.state === 'running');
    note('real-time-loop-progress', { label, period, required, observedContextSeconds: elapsed, completedPeriods: elapsed / period });
    if (elapsed >= required) break;
    await page.waitForTimeout(Math.min(10000, Math.ceil((required - elapsed) * 1000)));
  }
  note('real-time-three-period-observed', { label, basis: 'Native AudioContext clock and live source; no captured speaker waveform or human listening', first, after: await snapshot() });
}
async function check(name, fn) {
  try { await fn(); result.checks.push({ name, passed: true }); }
  catch (error) {
    result.checks.push({ name, passed: false, message: error.stack });
    if (page) { try { note('failure-state', { name, state: await snapshot() }); await page.screenshot({ path: path.join(out, name.replace(/[^a-z0-9_-]/gi, '_') + '.png') }); } catch {} }
  }
  save();
}
let base;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  const launch = { executablePath: '/usr/bin/chromium', headless: true, chromiumSandbox: true, ignoreDefaultArgs: ['--mute-audio'] };
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY, bypass: '127.0.0.1,localhost,[::1]' };
  browser = await chromium.launch(launch); result.browser.version = browser.version(); note('native-browser-started');
  for (const track of ['cafe-lounge', 'shibuya-citypop']) {
    await check(`${track}-initial`, () => freshPage(`/audio/external-v080/bgm/${track}-preview.html`));
    for (const format of ['m4a', 'ogg', 'mp3', 'wav']) {
      await check(`${track}-${format}`, async () => {
        await page.locator('article select').selectOption(format);
        await pointer(page.locator('article .play')); await playing(`${track}-${format}`); await loopSignal(`${track}-${format}`);
        if (format === 'm4a') await realCycles(`${track}-${format}`);
        await stop();
      });
    }
    await check(`${track}-AAC-media-playhead`, async () => {
      const media = page.locator('audio[src$="-audition-24s.m4a"]');
      await media.scrollIntoViewIfNeeded(); const box = await media.boundingBox(); assert.ok(box);
      // Native HTMLAudioElement play control, not element.play() or event dispatch.
      await page.mouse.click(box.x + 22, box.y + box.height / 2);
      await page.waitForFunction(() => !document.querySelector('audio[src$="-audition-24s.m4a"]').paused, null, { timeout: 10000 });
      const first = await snapshot(); await page.waitForTimeout(1200); const after = await snapshot();
      const priorMedia = first.media.find(a => a.currentSrc.endsWith('-audition-24s.m4a'));
      const currentMedia = after.media.find(a => a.currentSrc.endsWith('-audition-24s.m4a'));
      assert.ok(currentMedia.currentTime > priorMedia.currentTime + .5, 'Native AAC media playhead should advance');
      assert.equal(currentMedia.loop, false); note('native-AAC-media-playhead', { track, first, after }); await stop();
    });
    await check(`${track}-reload-no-autoplay`, () => freshPage(`/audio/external-v080/bgm/${track}-preview.html`));
  }
  // Pages expose one track each. Switching pages is tested; game music-selector,
  // crossfade and simultaneous BGM/ambience integration remain outside this QA.
  note('track-switch-scope', { scope: 'Explicit stop then fresh original page/new gesture for next track; not an in-game music switch' });
  await check('delivery-kit-initial', async () => {
    await freshPage('/audio/external-v080/sfx/listen-delivery.html');
    assert.ok((await page.locator('#cards article').count()) === 11, 'Final delivery-kit must list 11 sounds');
  });
  for (const format of ['.m4a', '.mp3', '.ogg']) {
    await check(`floor-${format.slice(1)}`, async () => {
      await page.locator('#format').selectOption(format); await pointer(page.locator('#loop'));
      await playing(`floor-${format}`); await loopSignal(`floor-${format}`);
      if (format === '.m4a') await realCycles(`floor-${format}`);
      await stop();
    });
  }
  for (let i = 1; i < 11; i++) {
    await check(`sfx-${i}`, async () => {
      await pointer(page.locator('#loop')); await playing(`sfx-${i}-bed`);
      const card = page.locator('#cards article').nth(i); const title = await card.locator('h2').textContent();
      await pointer(card.locator('button'));
      await page.waitForFunction(() => /再生:/.test(document.querySelector('#status').textContent), null, { timeout: 10000 });
      const state = await snapshot();
      assert.ok(state.decodedBuffers.some(b => !b.key.includes('floor-loop')));
      assert.equal(state.trustedClicks.at(-1)?.trusted, true);
      note('native-sfx-trigger', { title, state, limits: 'Short cue may have ended before snapshot; decoded buffer + page status proves trigger, not audible quality' });
      await stop();
    });
  }
  await check('delivery-kit-reload-no-autoplay', () => freshPage('/audio/external-v080/sfx/listen-delivery.html'));
  await check('legacy-wav-ui-sfx', async () => {
    await freshPage('/audio/external-v080/sfx/listen.html'); await pointer(page.locator('#loop')); await playing('legacy-WAV-floor');
    await pointer(page.getByRole('button', { name: 'WAV効果音を再生', exact: true }).first());
    await page.waitForTimeout(300); note('legacy-wav-sfx', { state: await snapshot() }); await stop();
  });
  result.finishedAt = new Date().toISOString(); result.scriptElapsedSeconds = (performance.now() - started) / 1000;
  result.passed = result.checks.every(c => c.passed); note('complete', { passed: result.passed, checks: result.checks.length });
} catch (error) {
  result.fatalError = error.stack; note('fatal-failure', { message: error.message });
} finally {
  if (context) await context.close(); if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  const afterHashes = {}; hashFiles(path.join(repo, 'public/audio/external-v080'), afterHashes);
  result.sourceHashesAfter = afterHashes;
  result.assetFilesUnchanged = JSON.stringify(result.sourceHashes) === JSON.stringify(afterHashes);
  save();
}
