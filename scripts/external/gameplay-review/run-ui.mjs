#!/usr/bin/env node
/** G01: trusted public UI only. No injected state, sim imports or renderer overrides. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const argv = process.argv.slice(2);
const opt = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
const scenario = opt('--scenario', 'all');
const out = path.resolve(opt('--out', 'docs/external/gameplay-review/runs/run-01'));
const url = opt('--url', 'https://shirai0765.github.io/-/?v=0.7.0');
const maxWeeks = Number(opt('--max-weeks', '1200'));
const executablePath = opt('--browser-path', '/usr/bin/chromium');
if (!['all', 'early', 'manager', 'expansion', 'probe'].includes(scenario)) throw Error('Unknown scenario');
await fs.mkdir(out, { recursive: true });
if ((await fs.readdir(out)).length) throw Error('Choose a fresh output directory; evidence is retained');
await fs.copyFile(new URL(import.meta.url), path.join(out, 'executed-script.mjs'));
const result = {
  status: 'running', startedAt: new Date().toISOString(), url, scenario, maxWeeks,
  browser: { executablePath, headless: true, chromiumSandbox: true },
  method: 'Native browser trusted clicks/inputs; natural new companies; normal export/import only',
  limitations: ['Automated play, not human 30-hour proof', 'Linux Chromium, not physical iPhone/Windows', 'No all-seed balance claim'],
  scenarios: {}, actions: [], reports: [], exports: [], errors: [], warnings: [], failedRequests: [],
};
let browser, context, page, scope = 'startup', sequence = 0;
const persist = () => fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
const log = async (action, data = {}) => {
  const row = { index: ++sequence, at: new Date().toISOString(), scope, action, ...data };
  result.actions.push(row);
  await fs.appendFile(path.join(out, 'actions.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify({ scope, action, ...data }));
};
const button = (root, name) => root.getByRole('button', { name, exact: true });
const current = () => page.locator('dialog[open]').last();
const integers = text => [...text.matchAll(/-?[0-9][0-9,]*/g)].map(m => Number(m[0].replaceAll(',', '')));
const cash = text => integers(text)[0] ?? NaN;
const latest = state => ({ week: state.week, cash: state.cash, seed: state.seed, listed: state.listed,
  stores: state.stores.length, subsidiaries: state.subsidiaries.length,
  marketCompanies: state.marketAcquisitions?.companies.length ?? 0, reputation: state.reputation,
  lastReportWeek: state.lastReport?.week, netProfit: state.lastReport?.netProfit,
  gameOver: state.gameOver, achievement: state.campaignAchievement ?? null });
async function snapshot(label) {
  await fs.writeFile(path.join(out, `${scope}-${label}.txt`), await page.locator('body').innerText());
  await page.screenshot({ path: path.join(out, `${scope}-${label}.png`), fullPage: false });
}
async function closeAll() {
  const milestone = page.getByRole('button', { name: '上場の結果を閉じる', exact: true });
  if (await milestone.isVisible()) await milestone.click();
  for (let i = 0; i < 8; i++) {
    if (!await page.locator('dialog[open]').count()) return;
    const dialog = current();
    const cls = await dialog.getAttribute('class') || '';
    if (cls.includes('first-play-guide')) await button(dialog, '説明を閉じる').click();
    else if (cls.includes('weekly-review-screen')) await dialog.locator('.weekly-review-exit').click();
    else if (cls.includes('campaign-completion-screen')) await dialog.locator('.campaign-completion-exit').click();
    else await dialog.locator(':scope > section > header > button[aria-label="閉じる"]').click();
  }
  throw Error('Dialogs remain open');
}
async function menu(name) {
  await closeAll(); await button(page, '経営').click(); await button(current(), name).click(); return current();
}
async function exportState(label) {
  const panel = await menu('設定・保存');
  const pending = page.waitForEvent('download'); await button(panel, '保存ファイルを書き出す').click();
  const download = await pending;
  const filename = `${scope}-${String(result.exports.length + 1).padStart(4, '0')}-${label}.json`;
  const file = path.join(out, filename); await download.saveAs(file);
  const envelope = JSON.parse(await fs.readFile(file, 'utf8'));
  if (crypto.createHash('sha256').update(envelope.payload).digest('hex') !== envelope.checksum) throw Error('Export checksum mismatch');
  const state = JSON.parse(envelope.payload);
  result.exports.push({ file: filename, label, ...latest(state), checksum: envelope.checksum });
  await closeAll(); await persist(); return { state, file };
}
async function importNatural(file) {
  const panel = await menu('設定・保存');
  const choose = page.waitForEvent('filechooser');
  page.once('dialog', async dialog => {
    if (!dialog.message().includes('現在の会社')) throw Error('Unexpected import prompt');
    await dialog.accept();
  });
  await button(panel, 'ファイルから読み込む').click();
  await (await choose).setFiles(file);
  await page.locator('.immersive-game').waitFor();
  await page.locator('dialog[open]').last().waitFor({ state: 'hidden' });
  await log('import-unchanged-own-natural-export', { file: path.basename(file) });
}
async function newContext(name) {
  if (context) await context.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => result.errors.push({ scope, message: String(error) }));
  page.on('console', message => { if (message.type() === 'error') result.errors.push({ scope, message: message.text() }); else if (message.type() === 'warning') result.warnings.push({ scope, message: message.text() }); });
  page.on('requestfailed', request => result.failedRequests.push({ scope, url: request.url(), error: request.failure()?.errorText }));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('会社名', { exact: true }).fill(name);
  await page.getByRole('button', { name: /新しい会社を設立/ }).first().click();
  await page.locator('.immersive-game').waitFor();
  await closeAll();
  const settings = await menu('設定・保存'); await settings.getByLabel('3D描画').selectOption('low'); await closeAll();
  await log('new-company-through-ui', { name }); return exportState('initial');
}
async function selectLot(id) {
  await closeAll(); await page.locator('.hud-context-actions').getByRole('button', { name: /出店場所を探す|物件を探す/ }).click();
  await page.locator(`.site-browser button[data-lot-id="${id}"]`).click(); return current();
}
async function openStore(id, style = 'takeaway') {
  const panel = await selectLot(id);
  const label = { standard: '街角カフェ', premium: 'プレミアム', takeaway: 'テイクアウト' }[style];
  await panel.locator('.opening-options').getByRole('button', { name: new RegExp(label) }).click();
  const beforeText = await panel.innerText();
  const submit = button(panel, 'この場所にカフェを開業');
  if (!await submit.isEnabled()) { await closeAll(); return false; }
  await submit.click(); await log('open-store', { lotId: id, style, visiblePlan: beforeText }); return true;
}
async function setStore(id, changes) {
  const panel = await selectLot(id);
  if (changes.price != null || changes.quality != null) {
    await panel.getByRole('button', { name: /商品・価格/ }).click();
    if (changes.price != null) { const input = panel.getByLabel('販売価格（円）'); await input.fill(String(changes.price)); await input.press('Tab'); }
    if (changes.quality != null) {
      const range = panel.locator('input[type="range"]'); await range.press('Home');
      for (let i = 20; i < changes.quality; i += 5) await range.press('ArrowRight');
    }
    await button(panel, '店舗トップへ').click();
  }
  if (changes.staff != null || changes.manager != null) {
    await panel.getByRole('button', { name: /人員・店長/ }).click();
    if (changes.staff != null) { const input = panel.getByLabel('従業員数'); await input.fill(String(changes.staff)); await input.press('Tab'); }
    if (changes.manager != null) await panel.getByRole('checkbox', { name: /店長に運営を委任/ }).setChecked(changes.manager);
    await button(panel, '店舗トップへ').click();
  }
  if (changes.marketing != null || changes.upgrade) {
    await panel.getByRole('button', { name: /広告・改装/ }).click();
    if (changes.marketing != null) { const input = panel.getByLabel('週間広告費（円）'); await input.fill(String(changes.marketing)); await input.press('Tab'); }
    if (changes.upgrade) await panel.getByRole('button', { name: /設備を増強/ }).click();
  }
  await log('store-settings', { lotId: id, changes }); await closeAll();
}
async function savedRows() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('shibuya-capital-v1'); request.onerror = () => reject(request.error?.message);
    request.onsuccess = () => {
      const db = request.result; const read = db.transaction('saves', 'readonly').objectStore('saves').getAll();
      read.onsuccess = () => { db.close(); resolve(read.result); }; read.onerror = () => { db.close(); reject(read.error?.message); };
    };
  }));
}
async function settle(weeks = 1) {
  await closeAll(); await page.locator('.hud-next-week').click(); const plan = current();
  if (weeks > 1) {
    const period = plan.getByLabel('営業を進める期間');
    if (await period.count()) {
      await period.selectOption(String(weeks));
      await plan.getByRole('checkbox', { name: /新しい営業提案で停止/ }).uncheck();
    } else weeks = 1;
  }
  const title = weeks > 1 ? `最大${weeks}週間の営業を始める` : /営業して週を進める|リスクを承知して営業する/;
  await plan.getByRole('button', { name: title, exact: weeks > 1 }).click();
  await page.locator('dialog.weekly-review-screen[open], dialog.campaign-completion-screen[open], dialog[open]:has-text("連続営業の報告")').last().waitFor({ timeout: 40000 });
  await log('settle-through-ui', { requestedWeeks: weeks, reportText: await current().innerText() });
  const rows = await savedRows();
  for (const row of rows) {
    const state = JSON.parse(row.envelope.payload);
    if (state.lastReport && !result.reports.some(r => r.scope === scope && r.week === state.lastReport.week)) {
      result.reports.push({ scope, stateWeek: state.week, cash: state.cash, week: state.lastReport.week, report: state.lastReport });
    }
  }
  const state = JSON.parse(rows.find(r => r.key === 'primary').envelope.payload);
  await closeAll(); await persist(); return state;
}
async function early() {
  scope = 'early'; const initial = await newContext('G01 序盤公開操作株式会社');
  await openStore('dogenzaka-02', 'standard');
  await setStore('dogenzaka-02', { price: 750, quality: 85, staff: 4, marketing: 0 });
  const before = await exportState('opened-configured'); await snapshot('opening-and-settings');
  await closeAll(); await page.locator('.city-world').getByRole('button', { name: '渋谷銀行を開く', exact: true }).click();
  const bank = current(); await button(bank, '100万円').click(); await button(bank, '52週').click();
  await button(bank, 'この条件で融資審査する').click(); await snapshot('loan-screening');
  if (await bank.locator('[data-loan-review="approved"]').count()) await bank.locator('[data-loan-confirm]').click();
  else { await log('loan-declined', { text: await bank.innerText() }); await closeAll(); }
  const afterLoan = await exportState('loan-contract');
  await log('loan-cash-difference', { before: before.state.cash, after: afterLoan.state.cash, loans: afterLoan.state.loans });
  let state = await settle(); await exportState('first-settled');
  if (!state.gameOver) {
    await setStore('dogenzaka-02', { price: 850, staff: 5 }); state = await settle(); await exportState('second-settled-settings-change');
  }
  await snapshot('final'); result.scenarios.early = { status: 'completed', initial: latest(initial.state), final: latest(state), warning: 'Adjacent weeks have different natural conditions; settings changes alone do not establish a causal profit delta.' };
}
async function manager() {
  scope = 'manager-base'; await newContext('G01 店長比較株式会社'); await openStore('dogenzaka-02', 'standard');
  await setStore('dogenzaka-02', { price: 850, quality: 85, staff: 5, marketing: 40000, manager: false });
  const base = await exportState('natural-before-first-settlement'); result.scenarios.manager = { base: latest(base.state), branches: {} };
  for (const delegated of [false, true]) {
    scope = delegated ? 'manager-delegated' : 'manager-manual'; await newContext(`G01 比較先 ${delegated}`); await importNatural(base.file);
    await setStore('dogenzaka-02', { manager: delegated }); const configured = await exportState('configured');
    const final = await settle(); await snapshot('settled'); await exportState('settled');
    result.scenarios.manager.branches[delegated ? 'delegated' : 'manual'] = { before: latest(configured.state), settingsBefore: configured.state.stores, final: latest(final), settingsAfter: final.stores, actual: final.lastReport };
  }
  result.scenarios.manager.status = 'completed'; await persist();
}
async function ipoOrEquity(state) {
  const panel = await menu('財務・不動産');
  const equity = panel.locator('.capital-options button').filter({ hasText: state.listed ? '10%増資する' : '株式公開する' });
  if (!await equity.count()) { await closeAll(); return false; }
  await equity.click(); const submit = panel.locator('.capital-submit');
  if (!await submit.isEnabled()) { await closeAll(); return false; }
  await snapshot(state.listed ? 'equity-plan' : 'ipo-plan'); await submit.click();
  await log(state.listed ? 'issue-shares-10-percent' : 'ipo'); await closeAll(); return true;
}
async function purchaseProperty(id) {
  const panel = await selectLot(id); await panel.locator('summary').filter({ hasText: 'この建物を不動産として購入' }).click();
  const submit = button(panel, '物件を購入する');
  if (!await submit.isEnabled()) { await closeAll(); return false; }
  await submit.click(); await log('buy-property', { lotId: id }); await closeAll(); return true;
}
async function tryDirectAcquisition(state) {
  const panel = await menu('グループ'); await panel.locator('summary').filter({ hasText: '飲食・不動産・鉄道を買収する' }).click();
  const cards = panel.locator('.acquisition'); const choices = [];
  for (let i = 0; i < await cards.count(); i++) {
    const card = cards.nth(i), buy = button(card, '買収する');
    if (await buy.count() && await buy.isEnabled()) {
      const numbers = await card.locator('.mini-metrics strong').allTextContents();
      const price = cash(numbers[0]), gain = cash(numbers[1]);
      if (price + 5000000 <= state.cash) choices.push({ index: i, id: await card.getAttribute('data-target-id'), price, gain, ratio: gain / price });
    }
  }
  const choice = choices.sort((a, b) => b.ratio - a.ratio)[0];
  if (choice) { await button(cards.nth(choice.index), '買収する').click(); await log('direct-acquisition', choice); }
  await closeAll(); return Boolean(choice);
}
async function tryMarketAcquisition(state) {
  const panel = await menu('株式市場'); await button(panel, '友好的買収').click();
  await panel.getByLabel('買収候補の状態').selectOption('unowned');
  const cards = panel.locator('.ma-card'); const choices = [];
  for (let i = 0; i < await cards.count(); i++) {
    const card = cards.nth(i); const values = await card.locator('.ma-card-strategy dd').allTextContents();
    if (!values.length) continue;
    const budget = cash(values[0]), lower = cash(values[1]);
    if (budget + 5000000 <= state.cash) choices.push({ index: i, budget, lower, ratio: lower / budget, text: await card.innerText() });
  }
  const choice = choices.sort((a, b) => b.ratio - a.ratio)[0];
  if (!choice) { await closeAll(); return false; }
  await button(cards.nth(choice.index), '調査・買収条件を見る').click(); let detail = current();
  const research = detail.getByRole('button', { name: /有料調査の支払を確認/ });
  if (await research.count()) {
    if (!await research.isEnabled()) { await closeAll(); return false; }
    await research.click(); await button(current(), '調査費を支払う').click();
    await log('paid-market-research', { text: choice.text }); detail = current();
  }
  const confirm = button(detail, '買収と引継ぎを確認');
  if (!await confirm.isEnabled()) { await log('market-acquisition-not-yet-eligible', { text: await detail.innerText() }); await closeAll(); return false; }
  await confirm.click(); const visible = await current().innerText(); await button(current(), '友好的買収を実行する').click();
  await log('market-acquisition-autonomous', { text: visible }); await closeAll(); return true;
}
async function tryDevelopment(state) {
  const panel = await menu('街区開発'); const cards = panel.locator('.development-choice');
  for (let i = 0; i < await cards.count(); i++) {
    const card = cards.nth(i), submit = button(card, '計画と支払を確認');
    const price = cash(await card.locator('dd').first().innerText());
    if (await submit.isEnabled() && price + 30000000 <= state.cash) {
      const text = await card.innerText();
      await submit.click(); await current().getByRole('button', { name: /着工する/ }).click();
      await log('start-development', { price, text }); await closeAll(); return true;
    }
  }
  await closeAll(); return false;
}
async function expansion() {
  scope = 'expansion'; let { state } = await newContext('G01 公開UI拡大株式会社');
  const lots = ['dogenzaka-02', 'sakuragaoka-03', 'dogenzaka-04', 'miyashita-04', 'center-04', 'sakuragaoka-02'];
  const propertyLots = ['dogenzaka-02', 'sakuragaoka-03', 'miyashita-04', 'center-04'];
  result.scenarios.expansion = { status: 'running', milestones: [], policy: 'Up to six stores; 5m reserve for business investments; 30m for district projects; no loans, stock speculation or save edits.' };
  let lastInvestmentWeek = state.week, longestIdleWeeks = 0, firstListed = false;
  while (state.week <= maxWeeks && !state.gameOver && !state.campaignAchievement) {
    let changed = false;
    if (state.stores.length < lots.length && state.cash > 6500000) {
      const id = lots[state.stores.length];
      if (await openStore(id, 'takeaway')) {
        await setStore(id, { manager: true, quality: 85, price: 750, staff: 5, marketing: 0 }); changed = true;
        state = (await exportState('store-opening')).state;
      }
    }
    if (!state.listed && state.stores.length >= 3 && state.profitableWeeks >= 12) {
      if (await ipoOrEquity(state)) { state = (await exportState('ipo-milestone')).state; changed = true; firstListed = true; }
    }
    if (state.listed && state.cash < 35000000 && state.founderShares / state.sharesOutstanding > .23) {
      if (await ipoOrEquity(state)) { state = (await exportState('equity-funding')).state; changed = true; }
    }
    const upgrade = state.stores.find(s => s.level < 5 && state.cash > 1200000 * s.level + 5000000);
    if (upgrade) { await setStore(upgrade.lotId, { upgrade: true }); state = (await exportState('store-upgrade')).state; changed = true; }
    if (state.listed) {
      if (await tryDirectAcquisition(state)) { state = (await exportState('direct-acquisition-milestone')).state; changed = true; }
      if (state.subsidiaries.length >= 2 && (state.marketAcquisitions?.companies.length ?? 0) < 100) {
        if (await tryMarketAcquisition(state)) { state = (await exportState('market-acquisition-milestone')).state; changed = true; }
      }
      if (state.subsidiaries.length >= 2) {
        const nextProperty = propertyLots.find(id => !state.properties.some(p => p.lotId === id));
        if (nextProperty && state.cash > 200000000 && await purchaseProperty(nextProperty)) { state = (await exportState('district-property')).state; changed = true; }
        if (await tryDevelopment(state)) { state = (await exportState('development-start')).state; changed = true; }
      }
    }
    if (changed) lastInvestmentWeek = state.week;
    longestIdleWeeks = Math.max(longestIdleWeeks, state.week - lastInvestmentWeek);
    const before = state; state = await settle(state.profitableWeeks >= 12 ? 4 : 1);
    if (state.week === before.week) { await log('progression-stopped', { state: latest(state) }); break; }
    if (firstListed || state.week % 52 < 5 || state.campaignAchievement || state.gameOver) {
      await exportState('settlement-checkpoint'); firstListed = false;
      result.scenarios.expansion.milestones.push(latest(state));
    }
    await log('progress', latest(state));
  }
  await exportState('final'); await snapshot('final');
  result.scenarios.expansion = { ...result.scenarios.expansion, status: state.campaignAchievement ? 'completed-all-objectives' : state.gameOver ? 'company-ended' : 'incomplete-at-bound', final: latest(state), longestIdleWeeks };
}
try {
  await persist();
  const launch = { executablePath, headless: true, chromiumSandbox: true };
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY };
  browser = await chromium.launch(launch); result.browser.version = browser.version();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); page = await context.newPage();
  const releaseURL = new URL('release.json', url).href;
  const response = await context.request.get(releaseURL); result.releaseBefore = { status: response.status(), ...(await response.json()) };
  if (scenario === 'probe') { scope = 'probe'; await newContext('G01 起動確認株式会社'); await snapshot('native-new-company'); }
  if (['all', 'early'].includes(scenario)) await early();
  if (['all', 'manager'].includes(scenario)) await manager();
  if (['all', 'expansion'].includes(scenario)) await expansion();
  const after = await context.request.get(releaseURL); result.releaseAfter = { status: after.status(), ...(await after.json()) };
  result.status = 'finished';
} catch (error) {
  result.status = 'failed'; result.failure = { scope, message: String(error), stack: error.stack };
  if (page) { try { await snapshot('failure'); } catch {} }
  console.error(String(error)); process.exitCode = 1;
} finally {
  result.finishedAt = new Date().toISOString(); await persist();
  if (context) await context.close(); if (browser) await browser.close();
}
