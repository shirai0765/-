#!/usr/bin/env python3
"""Native App/Firefox program choices, exact payment, expiry and durable saves.

Ordinary-action fixtures enter through the native chooser. IndexedDB is read
only. No application state injection, scene/RAF/crypto/TLS/security overrides.
"""
import argparse
import functools
import hashlib
import json
import re
import shutil
import tempfile
import threading
import time
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://127.0.0.1:5173')
ap.add_argument('--out', default='/workspace/shared/shibuya-artifacts/business-review-v050/browser/production-01')
ap.add_argument('--expected', default='/workspace/shared/shibuya-artifacts/business-review-v050/campaign/run-01/browser-facts.json')
ap.add_argument('--profile', help='Temporary ordinary Firefox profile, optionally with normal CA trust for HTTPS')
ap.add_argument('--production-csp', action='store_true')
a = ap.parse_args()
OUT = Path(a.out)
if (OUT / 'results.json').exists():
    raise SystemExit('Choose a fresh --out; existing results are retained.')
OUT.mkdir(parents=True, exist_ok=True)
facts = json.loads(Path(a.expected).read_text())
base_fixture, expiry_fixture = Path(facts['baseFixture']['path']), Path(facts['expiryFixture']['path'])
for path, key in [(base_fixture, 'baseFixture'), (expiry_fixture, 'expiryFixture')]:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == facts[key]['sha256']
growth_states = {}
for path in sorted((base_fixture.parent / 'seed-1/growth/saves').glob('week-*.json')):
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    snapshot = json.loads(envelope['payload'])
    if snapshot['week'] <= facts['growthProject']['endWeek']:
        growth_states[snapshot['week']] = snapshot
assert len(growth_states) == 26
checks, errors, warnings, responses, external = [], [], [], [], []
data = {'fixtureMethod': facts['fixtureMethod'], 'fixtureSources': facts['sourceHashes'],
        'fixtureHashes': {key: facts[key]['sha256'] for key in ['baseFixture', 'expiryFixture']},
        'assetWaits': [], 'requestFailures': [], 'consoleErrorEvents': []}
started, phase, complete, server, csp = time.monotonic(), 'startup', False, None, None
if a.production_csp:
    csp = re.search(r'const csp = "([^"]+)";', (ROOT / 'desktop/main.cjs').read_text()).group(1)
    assert "'wasm-unsafe-eval'" in csp and "'unsafe-eval'" not in csp
    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.woff2': 'font/woff2'}
        def end_headers(self):
            self.send_header('Content-Security-Policy', csp)
            self.send_header('X-Content-Type-Options', 'nosniff')
            super().end_headers()
        def log_message(self, *_):
            pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT / 'dist')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    a.url = f'http://127.0.0.1:{server.server_port}/index.html'
    data['csp'], data['distIndexSHA256'] = csp, hashlib.sha256((ROOT / 'dist/index.html').read_bytes()).hexdigest()

def button(scope, name):
    return scope.get_by_role('button', name=name, exact=True)

def dialogs(page):
    return page.locator('dialog[open]')

def close_dialog(current):
    current.locator(':scope > section > header > button[aria-label="閉じる"]').click()
    expect(current).to_have_count(0)

def close_all(page):
    for _ in range(4):
        if not dialogs(page).count():
            return
        close_dialog(dialogs(page).last)
    assert not dialogs(page).count()

def rows(page):
    return page.evaluate("""() => new Promise((resolve,reject) => {
      const q=indexedDB.open('shibuya-capital-v1',1);q.onsuccess=()=>{
        const db=q.result,r=db.transaction('saves').objectStore('saves').getAll();
        r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=reject};q.onerror=reject;
    })""")

def primary(page):
    return next(row for row in rows(page) if row['key'] == 'primary')

def state(page):
    return json.loads(primary(page)['envelope']['payload'])

def open_menu(page):
    button(page, '経営').click()
    current = page.locator('dialog[open]:has(.game-menu)')
    expect(current).to_have_count(1)
    assert current.evaluate('(e)=>e.matches(":modal")')
    return current

def settings(page):
    close_all(page)
    button(open_menu(page), '設定・保存').click()
    current = page.locator('dialog[open]:has(.stack-buttons)')
    expect(current).to_have_count(1)
    return current

def settle_assets(page, label):
    global phase
    phase = label + ': native network idle'
    before = time.monotonic()
    page.wait_for_load_state('networkidle', timeout=30000)
    page.evaluate('()=>document.fonts.ready')
    data['assetWaits'].append({'phase': label, 'elapsedSeconds': round(time.monotonic() - before, 3),
                             'documentReadyState': page.evaluate('document.readyState'), 'responsesObserved': len(responses)})

def import_fixture(page, path, welcome=False):
    settle_assets(page, 'before native fixture import')
    if welcome:
        trigger = button(page, '保存ファイルを読み込む')
    else:
        trigger = button(settings(page), 'ファイルから読み込む')
        def confirm(native):
            data.setdefault('nativeConfirmations', []).append(native.message)
            assert '現在の会社を読み込むファイルの内容で置き換えます' in native.message
            native.accept()
        page.once('dialog', confirm)
    with page.expect_file_chooser() as chosen:
        trigger.click()
    chosen.value.set_files(str(path))
    expect(page.locator('.immersive-game')).to_be_visible()
    expect(page.locator('.toast')).to_contain_text('会社データを読み込みました')
    guide = page.locator('dialog[open]:has(.first-play-steps)')
    if guide.count():
        button(guide, '説明を閉じる').click()
    expect(dialogs(page)).to_have_count(0)

def export_state(page, filename):
    current = settings(page)
    with page.expect_download() as downloaded:
        button(current, '保存ファイルを書き出す').click()
    path = OUT / filename
    downloaded.value.save_as(str(path))
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    exported = json.loads(envelope['payload'])
    close_dialog(current)
    return exported

def group(page, sector=None):
    close_all(page)
    button(open_menu(page), 'グループ').click()
    panel = page.locator('[data-group-operations]')
    expect(panel).to_have_count(1)
    if panel.get_attribute('data-operation-sector'):
        button(panel, '業種一覧へ').click()
    if sector is not None:
        row = panel.locator('[data-group-sector=' + json.dumps(sector, ensure_ascii=False) + ']')
        expect(row).to_have_count(1)
        button(row, '運営・投資を考える').click()
        expect(panel).to_have_attribute('data-operation-sector', sector)
    return panel

def owned_entry(page):
    close_all(page)
    button(open_menu(page), '株式市場').click()
    button(page, '友好的買収').click()
    page.get_by_label('買収候補の状態', exact=True).select_option('owned')
    card = page.locator('.ma-card').filter(has=page.get_by_text('稼働中', exact=True))
    expect(card).to_have_count(1)
    button(card, '事業の状況を見る').click()
    current = page.locator('dialog[open]:has(> section.ma-modal)')
    expect(current).to_have_count(1)
    button(current, 'この業種の運営を考える').click()
    panel = page.locator('[data-group-operations]')
    expect(panel).to_have_attribute('data-operation-sector', facts['sector'])
    expect(panel.locator('[data-operation-policy="retain"]')).to_have_attribute('aria-pressed', 'true')
    return panel

def choose(panel, policy):
    current = panel.locator(f'[data-operation-policy="{policy}"]')
    current.click()
    expect(current).to_have_attribute('aria-pressed', 'true')

def quote_costs(panel, policy):
    expected = facts['quotes'][policy]
    for selector, key in [('data-operation-upfront', 'upfrontCost'), ('data-operation-weekly-cost', 'weeklyCost'), ('data-operation-reserve', 'reserveRequired')]:
        expect(panel.locator(f'[{selector}]')).to_have_attribute(selector, str(expected[key]))

def fit(locator, label):
    dimensions = locator.evaluate('(e)=>({width:e.clientWidth,scrollWidth:e.scrollWidth})')
    data.setdefault('mobileBounds', {})[label] = dimensions
    assert dimensions['scrollWidth'] <= dimensions['width'] + 1, dimensions

def passed(message):
    global phase
    checks.append(message)
    print('PASS', message, flush=True)
    phase = 'after category ' + str(len(checks))

def observe_busy(page):
    page.evaluate("""() => {
      window.__qaProgramBusy=[];
      const record=()=>{const input=document.querySelector('input[aria-describedby="managed-offer-policy"]');
        const status=document.querySelector('.batch-progress');
        if(input?.disabled&&status)window.__qaProgramBusy.push({disabled:input.disabled,status:status.textContent});};
      window.__qaProgramObserver=new MutationObserver(record);
      window.__qaProgramObserver.observe(document.body,{subtree:true,childList:true,attributes:true});record();
    }""")

profile = Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix='v050-native-firefox-', dir='/tmp'))
with sync_playwright() as pw:
    context = pw.firefox.launch_persistent_context(str(profile), headless=False, timeout=30000,
        viewport={'width': 390, 'height': 844}, firefox_user_prefs={'webgl.force-enabled': True, 'gfx.webrender.software': True})
    origin = urlsplit(a.url)
    def route(request):
        url = urlsplit(request.request.url)
        if (url.scheme, url.netloc) == (origin.scheme, origin.netloc) or url.scheme in ['blob', 'data']:
            request.continue_()
        else:
            external.append(request.request.url); request.abort('blockedbyclient')
    context.route('**/*', route)
    context.add_init_script("window.__qaCsp=[];addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
    page = context.new_page(); page.set_default_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    def console_event(message):
        if message.type == 'error':
            errors.append(message.text)
            data['consoleErrorEvents'].append({'text': message.text, 'location': message.location, 'phase': phase, 'seconds': round(time.monotonic() - started, 3), 'pageURL': page.url})
        elif message.type == 'warning':
            warnings.append(message.text)
    page.on('console', console_event)
    page.on('requestfailed', lambda request: data['requestFailures'].append({'url': request.url, 'failure': request.failure, 'phase': phase, 'seconds': round(time.monotonic() - started, 3), 'resourceType': request.resource_type}))
    page.on('response', lambda response: responses.append({'url': response.url, 'status': response.status}))
    try:
        response = page.goto(a.url, wait_until='domcontentloaded')
        assert response and response.status == 200
        if csp:
            assert response.headers.get('content-security-policy') == csp
        import_fixture(page, base_fixture, welcome=True)
        settle_assets(page, 'earned owned-company scene')
        assert state(page) == facts['baseState']
        original_rows = rows(page)
        original_canvas = page.locator('.business-map canvas').element_handle()
        owned_entry(page)
        assert rows(page) == original_rows
        panel = group(page)
        expect(panel.locator('[data-group-sector]')).to_have_count(len(facts['sectors']))
        fit(panel, 'sector-list')
        for sector in facts['sectors']:
            if sector['eligibleCount'] == 0:
                panel = group(page, sector['sector'])
                choose(panel, 'growth')
                expect(button(panel, '開始前の支払と収支を確認')).to_be_disabled()
                expect(panel).to_contain_text('稼働済みの傘下企業がありません')
        panel = group(page, facts['sector'])
        expect(panel.locator('[data-operation-policy="retain"]')).to_have_attribute('aria-pressed', 'true')
        for policy in ['growth', 'stability', 'retain', 'growth']:
            choose(panel, policy)
            if policy != 'retain':
                quote_costs(panel, policy)
                fit(panel.locator('.group-operation-comparison'), policy + '-comparison')
        button(panel, '開始前の支払と収支を確認').click()
        expect(panel.locator('[data-operation-confirm="true"]')).to_have_count(1)
        quote_costs(panel, 'growth')
        panel.screenshot(path=str(OUT / '01-earned-sector-growth-confirmation.png'))
        button(panel, '比較に戻る').click()
        button(panel, 'この計画の資金調達を比較').click()
        button(page, 'この事業計画に戻る').click()
        panel = page.locator('[data-group-operations]')
        expect(panel).to_have_attribute('data-operation-sector', facts['sector'])
        expect(panel.locator('[data-operation-policy="growth"]')).to_have_attribute('aria-pressed', 'true')
        expect(panel.locator('[data-operation-confirm="true"]')).to_have_count(0)
        quote_costs(panel, 'growth')
        assert rows(page) == original_rows
        assert page.evaluate('(canvas)=>canvas===document.querySelector(".business-map canvas")', original_canvas)
        assert export_state(page, 'comparison-only-export.json') == facts['baseState']
        assert rows(page) == original_rows
        passed('Naturally earned IPO/mature ownership routes from owned acquisition detail to sector default retain;390px sector choices and funding return preserve selected growth; integrating-only sector cannot start; comparisons change neither company/export nor saves or canvas identity')

        panel = group(page, facts['sector'])
        choose(panel, 'growth'); button(panel, '開始前の支払と収支を確認').click()
        panel.get_by_role('button', name=re.compile('^26週の計画を始める')).click()
        project = facts['growthProject']
        history = panel.locator(f'[data-operation-start-week="{project["startWeek"]}"][data-operation-end-week="{project["endWeek"]}"]')
        expect(history).to_have_count(1)
        expect(history).to_contain_text('0 / 26週')
        expect(panel.locator('[data-operation-policy]')).to_have_count(0)
        fit(history, 'active-history')
        history.screenshot(path=str(OUT / '02-started-exact-cost-active-program.png'))
        assert export_state(page, 'started-program-export.json') == facts['startState']
        assert facts['startState']['cash'] == facts['baseState']['cash'] - facts['quotes']['growth']['upfrontCost']
        assert facts['startState']['lastReport'] == facts['baseState']['lastReport']
        assert rows(page) == original_rows
        current = settings(page); before_saved = primary(page)['revision']
        button(current, '今すぐ保存する').click()
        expect(current.get_by_role('alert')).to_contain_text('現在の経営状況を保存しました')
        assert state(page) == facts['startState'] and primary(page)['revision'] == before_saved + 1
        close_dialog(current)
        active_saved_rows = rows(page)
        settle_assets(page, 'before active-program reload')
        page.reload(); page.locator('.welcome-actions > button').filter(has_text=facts['startState']['companyName'] + ' を続ける').click()
        expect(page.locator('.immersive-game')).to_be_visible()
        assert state(page) == facts['startState'] and rows(page) == active_saved_rows
        panel = group(page, facts['sector'])
        expect(panel.locator('[data-operation-start-week]')).to_contain_text('0 / 26週')
        passed('Starting one26week program deducts only the exact116400yen initial payment, preserves immutable historical report, prevents overlapping start, exports exact public-action state and restores it through native save/reload')

        close_all(page)
        assert state(page) == facts['startState']
        revision = primary(page)['revision']
        native_batches, all_busy, program_stops, saved_weeks = [], [], 0, 0
        validated_saved_weeks = set()
        for batch_number in range(10):
            before_state, before_revision = state(page), primary(page)['revision']
            remaining = project['endWeek'] - before_state['week']
            requested = 4 if remaining > 4 else 13
            page.locator('.hud-next-week').click()
            week = page.locator('dialog[open]:has(.week-intro)')
            week.locator('label').filter(has_text='営業を進める期間').locator('select').select_option(str(requested))
            offer_policy = week.get_by_label('新しい営業提案で停止', exact=True)
            expect(offer_policy).to_be_checked()
            offer_policy.uncheck()
            observe_busy(page)
            button(week, f'最大{requested}週間の営業を始める').click()
            report = dialogs(page).filter(has=page.get_by_role('heading', name='連続営業の報告', exact=True))
            expect(report).to_have_count(1)
            after_state = state(page)
            count = after_state['week'] - before_state['week']
            assert 0 < count <= requested and count <= remaining
            expect(report).to_contain_text(f'{count} 週間の営業を完了しました')
            expect(report.locator('table tbody tr')).to_have_count(count)
            for index, table_row in enumerate(report.locator('table tbody tr').all()):
                actual_report = growth_states[before_state['week'] + index + 1]['lastReport']
                assert table_row.locator('td').all_text_contents() == [f'第{actual_report["week"]}週', '¥' + f'{actual_report["netProfit"]:,}', '¥' + f'{actual_report["cashChange"]:,}']
            assert after_state == growth_states[after_state['week']]
            assert primary(page)['revision'] == before_revision + count
            busy = page.evaluate('()=>{window.__qaProgramObserver.disconnect();return window.__qaProgramBusy}')
            assert busy, 'Native disabled/busy save state was not observed'
            all_busy.extend(busy); saved_weeks += count
            reason = report.locator('.warning').inner_text() if report.locator('.warning').count() else None
            native_batches.append({'startWeek': before_state['week'], 'requested': requested, 'completed': count, 'finalWeek': after_state['week'], 'revisionBefore': before_revision, 'revisionAfter': primary(page)['revision'], 'stopReason': reason})
            backups = [json.loads(row['envelope']['payload']) for row in rows(page) if row['key'].startswith('backup:')]
            for expected_week in range(max(facts['startState']['week'] + 1, after_state['week'] - 11), after_state['week'] + 1):
                assert any(snapshot == growth_states[expected_week] for snapshot in backups)
                validated_saved_weeks.add(expected_week)
            if after_state['week'] == project['endWeek']:
                assert requested == 13 and count <= 4
                expect(report.locator('.warning')).to_contain_text('事業')
                program_stops += 1
                break
            assert after_state['week'] < project['endWeek']
            close_dialog(report)
        assert saved_weeks == 26 and program_stops == 1
        assert validated_saved_weeks == set(range(project['startWeek'] + 1, project['endWeek'] + 1))
        data['busyObservations'] = all_busy
        assert state(page) == facts['endState'] and primary(page)['revision'] == revision + 26
        backups = [json.loads(row['envelope']['payload']) for row in rows(page) if row['key'].startswith('backup:')]
        assert any(snapshot == facts['endState'] for snapshot in backups)
        data['durableExpiry'] = {'startWeek': facts['startState']['week'], 'completed': 26, 'finalWeek': facts['endState']['week'], 'revisionBefore': revision, 'revisionAfter': primary(page)['revision'], 'programExpiryStops': program_stops, 'validatedSavedWeeks': sorted(validated_saved_weeks), 'batches': native_batches,
                                'scope': '4-week requests preserve every exact weekly state for inspection under12-backup retention; final13-week request stops after<=4 actual weeks atprogram expiry. This run does not claim a full13-week native span.'}
        report.screenshot(path=str(OUT / '03-durable-managed-program-expiry.png'))
        button(report, '最後の週の詳細').click()
        detail = page.locator('[data-market-operation-result]')
        expect(detail).to_have_attribute('data-market-operation-result', facts['sector'])
        detail_summary = detail.locator(':scope > summary')
        expect(detail_summary).to_have_count(1)
        expect(detail_summary).to_contain_text('26週完了')
        detail_summary.click()
        actual = facts['endReport']['marketOperation']
        for label, value in [('グループ事業利益・計画実行中', actual['operatingProfit']), ('同じ週に現状を維持した場合', actual['baselineProfit']), ('今週の計画による差額・運営費込み', actual['profitDelta']), ('今週の計画運営費・計上済み', actual['weeklyCost'])]:
            formatted = ('+' if label == '今週の計画による差額・運営費込み' and value > 0 else '') + '¥' + f'{value:,}'
            expect(detail.locator('dl > div').filter(has=page.get_by_text(label, exact=True)).locator('dd')).to_have_text(formatted)
        fit(detail, 'immutable-expiry-report')
        detail.screenshot(path=str(OUT / '04-final-settled-program-results.png'))
        exact_rows = rows(page)
        assert export_state(page, 'completed-program-export.json') == facts['endState']
        assert rows(page) == exact_rows
        settle_assets(page, 'before completed-program reload')
        page.reload(); page.locator('.welcome-actions > button').filter(has_text=facts['endState']['companyName'] + ' を続ける').click()
        expect(page.locator('.immersive-game')).to_be_visible()
        assert state(page) == facts['endState'] and rows(page) == exact_rows
        panel = group(page, facts['sector'])
        history = panel.locator('[data-operation-start-week]')
        expect(history).to_have_count(1)
        history_summary = history.locator('xpath=..').locator(':scope > summary')
        expect(history_summary).to_have_count(1)
        history_summary.click()
        expect(history).to_contain_text('26 / 26週')
        expect(history).to_contain_text('通常運営に戻りました')
        expect(panel.locator('[data-operation-policy="retain"]')).to_have_attribute('aria-pressed', 'true')
        fit(history, 'completed-history-reload')
        panel.screenshot(path=str(OUT / '05-completed-restored-no-auto-renewal.png'))
        assert rows(page) == exact_rows
        passed('Fresh offer policy defaults checked; unchecked native4-week requests save all26 exact actual states, final13-week request stops after<=4 actual weeks at expiry; immutable report fees/delta,26revisions/backups, export/reload agree atweek105 without automatic renewal')

        settle_assets(page, 'final assets before teardown')
        assert not errors, errors
        assert not warnings, warnings
        assert not external, external
        assert not data['requestFailures'], data['requestFailures']
        assert not [response for response in responses if response['status'] >= 400]
        assert not page.evaluate('window.__qaCsp')
        complete = True
    except Exception:
        data['failure'] = traceback.format_exc(); print(data['failure'], flush=True)
        try:
            page.screenshot(path=str(OUT / 'failure.png'))
        except Exception:
            pass
    finally:
        data['responses'], data['externalRequests'] = responses, external
        data['sourceHashes'] = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in [ROOT / 'src/App.tsx', ROOT / 'src/ui/GroupOperationsPanel.tsx', ROOT / 'src/ui/GroupWeeklyResults.tsx', ROOT / 'src/sim/engine.ts', ROOT / 'src/sim/managedWeeks.ts', ROOT / 'src/persistence.ts'] if path.exists()}
        data['qaScriptSHA256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
        try:
            data['cspViolations'] = page.evaluate('window.__qaCsp')
            (OUT / 'last-stored-rows.json').write_text(json.dumps(rows(page), ensure_ascii=False, indent=2) + '\n')
        except Exception:
            pass
        (OUT / 'results.json').write_text(json.dumps({'passed': complete, 'checks': checks, 'errors': errors, 'warnings': warnings, 'data': data, 'url': a.url,
          'method': 'Normal-sandbox native Firefox/Mesa; final-dist CSP when requested; actual App/Three/RAF/native modal/import/export; read-only IndexedDB and busy DOM observations. Ordinary earned acquisition/program fixtures; no application state injection or security/scene/RAF/TLS/crypto mocks.'}, ensure_ascii=False, indent=2) + '\n')
        context.close()
        if not a.profile:
            shutil.rmtree(profile, ignore_errors=True)
        if server:
            server.shutdown(); server.server_close()
if not complete:
    raise SystemExit(1)
