#!/usr/bin/env python3
"""Narrow v0.7.0 native acceptance; launch only after the root GPU handoff.

Native trusted UI actions/imports, IndexedDB/DOM reads, unmodified WebGL/RAF,
crypto, TLS verification and browser sandbox. Preserved natural-action campaign
saves are imported unchanged; they are not a human playthrough or 30-hour proof.
No company/wealth injection, rendering substitutes, or audio/RAF instrumentation.
Linux WebKit is browser evidence, not a physical iPhone or device FPS benchmark.
Every run needs a fresh --out. --validate-inputs-only never launches a browser.
"""
import argparse
import functools
import hashlib
import json
import os
import re
import shutil
import tempfile
import threading
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = {'width': 1280, 'height': 900}
PHONE = {'width': 390, 'height': 750}
NAME = '達成記録と契約の実操作QA'
expect.set_options(timeout=30000)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5173')
parser.add_argument('--out')
parser.add_argument('--browser', choices=['webkit', 'firefox'], default='webkit')
parser.add_argument('--profile', help='Disposable external profile; its wrapper owns cleanup')
parser.add_argument('--headless', action='store_true')
parser.add_argument('--production-csp', action='store_true')
parser.add_argument('--dev-diagnostics', action='store_true', help='Read existing DEV camera/renderer only')
parser.add_argument('--expected-version', default='0.7.0')
parser.add_argument('--expected-source')
parser.add_argument('--ipo-fixture', required=True, help='Preserved ordinary-action pre-IPO fixture manifest')
parser.add_argument('--campaign-fixture', required=True, help='Unedited natural penultimate save envelope')
parser.add_argument('--campaign-evidence', required=True, help='Matching preserved current-campaign summary.json')
parser.add_argument('--build-manifest', help='Approved frozen production build manifest, with files and sourceFiles')
parser.add_argument('--scope', choices=['full', 'completion', 'batch-news', 'public-receipt'], default='full')
parser.add_argument('--reference-achievement', help='Preserved native single-week exact export for batch-news continuation')
parser.add_argument('--validate-inputs-only', action='store_true')
args = parser.parse_args()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_envelope(path):
    envelope = json.loads(Path(path).read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum'], path
    return json.loads(envelope['payload'])


ipo_manifest_path = Path(args.ipo_fixture).resolve()
ipo_manifest = json.loads(ipo_manifest_path.read_text())
assert ipo_manifest['method'] == 'ordinary-action-transcript-replay-until-before-ipo'
ipo_path = Path(ipo_manifest['fixture']['path']).resolve()
assert sha(ipo_path) == ipo_manifest['fixture']['sha256']
ipo_input = read_envelope(ipo_path)
assert not ipo_input['listed'] and not ipo_input['gameOver']
assert ipo_input['lastReport']['netProfit'] > 0 and ipo_input['profitableWeeks'] >= 12
assert len(ipo_input['stores']) >= 3
campaign_path = Path(args.campaign_fixture).resolve()
campaign_input = read_envelope(campaign_path)
campaign_evidence_path = Path(args.campaign_evidence).resolve()
campaign_evidence = json.loads(campaign_evidence_path.read_text())
assert campaign_evidence['saveRoundTrip'] and campaign_evidence['runtimeSourceHashesUnchanged']
assert campaign_evidence['completed'] and not campaign_evidence['ruined']
assert campaign_evidence['seed'] == campaign_input['seed']
assert campaign_evidence['penultimate']['week'] == campaign_input['week']
assert campaign_evidence['penultimate']['cash'] == campaign_input['cash']
assert campaign_evidence['penultimate']['lastReportWeek'] == campaign_input['lastReport']['week']
assert not campaign_evidence['penultimate']['hasAchievement']
assert campaign_input['listed'] and not campaign_input['gameOver']
assert not campaign_input.get('campaignAchievement'), 'Use the original save, without a backfilled achievement'
assert len(campaign_input['subsidiaries']) == 8
assert len(campaign_input['marketAcquisitions']['companies']) == 100
assert all(c['readyWeek'] <= campaign_input['week'] for c in campaign_input['marketAcquisitions']['companies'])
assert len(campaign_input['development']['programs']) == 4
assert all(len(p['completedChoiceIds']) == 3 for p in campaign_input['development']['programs'])
fixture_metadata = {
    'ipo': {'manifest': str(ipo_manifest_path), 'manifestSHA256': sha(ipo_manifest_path),
            'envelope': str(ipo_path), 'sha256': sha(ipo_path), 'week': ipo_input['week'],
            'method': ipo_manifest['method'], 'scope': ipo_manifest.get('scope')},
    'campaign': {'envelope': str(campaign_path), 'sha256': sha(campaign_path),
                 'evidence': str(campaign_evidence_path), 'evidenceSHA256': sha(campaign_evidence_path),
                 'seed': campaign_input['seed'], 'week': campaign_input['week'],
                 'method': 'preserved current-engine natural-action automated campaign penultimate save, imported unchanged',
                 'scope': 'Native import and subsequent real UI settlements; not a human full campaign or pacing proof'},
}
reference_path = Path(args.reference_achievement).resolve() if args.reference_achievement else None
reference_actual = read_envelope(reference_path) if reference_path else None
if args.scope == 'batch-news':
    assert reference_actual, '--reference-achievement is required for the two-check continuation'
    assert reference_actual['campaignAchievement'] == campaign_evidence['campaignAchievement']
    assert reference_actual['week'] == campaign_input['week'] + 1
    fixture_metadata['nativeSingleWeekReference'] = {'envelope': str(reference_path), 'sha256': sha(reference_path),
        'method': 'Preserved exact export from the preceding successful real native UI settlement',
        'scope': 'Read-only deterministic equality reference; imported campaign fixture remains unchanged'}
build_manifest_path = Path(args.build_manifest).resolve() if args.build_manifest else None
build_manifest = json.loads(build_manifest_path.read_text()) if build_manifest_path else None


def verify_build():
    assert build_manifest, '--build-manifest is required for production-CSP acceptance'
    assert build_manifest['version'] == args.expected_version and build_manifest['build'] == 'passed'
    assert build_manifest['sourceUnchangedDuringBuild']
    assert json.loads((ROOT / 'package.json').read_text())['version'] == args.expected_version
    for root, key in [(ROOT / 'dist', 'files'), (ROOT, 'sourceFiles')]:
        for name, expected in build_manifest[key].items():
            path = root / name
            assert path.stat().st_size == expected['bytes'] and sha(path) == expected['sha256'], path
    actual_files = {str(p.relative_to(ROOT / 'dist')) for p in (ROOT / 'dist').rglob('*') if p.is_file()}
    assert actual_files == set(build_manifest['files'])
    return {'manifest': str(build_manifest_path), 'manifestSHA256': sha(build_manifest_path),
            'version': build_manifest['version'], 'files': len(build_manifest['files']),
            'bytes': sum(f['bytes'] for f in build_manifest['files'].values()),
            'indexSHA256': sha(ROOT / 'dist/index.html'), 'matchesApprovedBuild': True}


build_start = verify_build() if args.production_csp else None
if args.validate_inputs_only:
    print(json.dumps({'validated': True, 'fixtures': fixture_metadata, 'build': build_start,
                     'browserLaunched': False}, ensure_ascii=False, indent=2))
    raise SystemExit(0)
if not args.out:
    parser.error('--out is required for a native run')
OUT = Path(args.out).resolve()
if OUT.exists() and any(OUT.iterdir()):
    raise SystemExit('Choose a fresh --out; historical evidence is retained.')
OUT.mkdir(parents=True, exist_ok=True)
shutil.copy2(__file__, OUT / Path(__file__).name)
(OUT / 'fixture-provenance.json').write_text(json.dumps(fixture_metadata, ensure_ascii=False, indent=2) + '\n')


def source_hashes():
    return {str(p.relative_to(ROOT)): sha(p) for p in sorted((ROOT / 'src').rglob('*'))
            if p.is_file() and p.suffix in ['.ts', '.tsx', '.css']}


start_hashes = source_hashes()
(OUT / 'source-start.json').write_text(json.dumps(start_hashes, indent=2) + '\n')
checks, errors, warnings, failures, responses = [], [], [], [], []
data = {'phase': 'startup', 'browser': args.browser, 'headless': args.headless, 'buildStart': build_start,
        'scope': args.scope,
        'viewport': DESKTOP, 'phoneViewport': PHONE, 'fixtures': fixture_metadata,
        'exports': {}, 'snapshots': {}, 'unrun': [],
        'limitations': ['No physical iPhone Safari, Windows device performance, or human 30-hour playthrough'],
        'method': {'actions': 'native trusted UI only, including unchanged fixture import',
                   'renderer': 'normal application WebGL/RAF; no replacements', 'tls': 'verification enabled'}}
if args.scope != 'full':
    data['unrun'] = ['Ordinary loan collision/save sequence', 'Actual IPO/news/exchange sequence']
if args.scope == 'batch-news':
    data['unrun'] += ['Single-week receipt/replay/navigation', 'Later-loan/settlement immutable achievement sequence']
if args.scope == 'public-receipt':
    data['unrun'] += ['Detailed result/site routes', 'Later-loan/settlement immutable achievement sequence',
                     'Independent 13-week request', 'Group-plan first-week news']
server, context, passed, page = None, None, False, None
csp = None
if args.dev_diagnostics:
    assert not args.production_csp and urlsplit(args.url).hostname in ['localhost', '127.0.0.1']
if args.production_csp:
    csp = re.search(r'const csp = "([^"]+)";', (ROOT / 'desktop/main.cjs').read_text()).group(1)

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
    args.url = f'http://127.0.0.1:{server.server_port}/index.html'
    data['csp'] = csp
    data['distIndexSHA256'] = sha(ROOT / 'dist/index.html')


def button(scope, name):
    return scope.get_by_role('button', name=name, exact=True)


def click(locator):
    locator.tap() if args.browser == 'webkit' else locator.click()


def current():
    return page.locator('dialog[open]').last


def close_all():
    for _ in range(8):
        dialogs = page.locator('dialog[open]')
        if not dialogs.count():
            return
        dialog = dialogs.last
        if 'campaign-completion-screen' in (dialog.get_attribute('class') or ''):
            click(dialog.locator('.campaign-completion-exit'))
        elif 'weekly-review-screen' in (dialog.get_attribute('class') or ''):
            click(dialog.locator('.weekly-review-exit'))
        else:
            click(dialog.locator(':scope > section > header > button[aria-label="閉じる"]'))
    assert not page.locator('dialog[open]').count()


def menu(name):
    close_all()
    click(button(page, '経営'))
    click(button(current(), name))
    return current()


def rows():
    return page.evaluate("""()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('shibuya-capital-v1');request.onerror=reject;
      request.onsuccess=()=>{const db=request.result,read=db.transaction('saves').objectStore('saves').getAll();
      read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=reject};})""")


def saved():
    return json.loads(next(r for r in rows() if r['key'] == 'primary')['envelope']['payload'])


def snapshot(name):
    data['phase'] = name
    page.evaluate('()=>document.fonts.ready')
    page.screenshot(path=str(OUT / f'{name}.png'))
    (OUT / f'{name}.txt').write_text(page.locator('body').inner_text() + '\n')
    data['snapshots'][name] = {'viewport': page.viewport_size, 'imageFile': f'{name}.png', 'textFile': f'{name}.txt'}
    print('SNAPSHOT', name, flush=True)


def ok(message):
    checks.append(message)
    print('PASS', message, flush=True)


def export_state(label):
    before = rows()
    panel = menu('設定・保存')
    with page.expect_download() as download:
        click(button(panel, '保存ファイルを書き出す'))
    path = OUT / f'{label}.json'
    download.value.save_as(str(path))
    state = read_envelope(path)
    assert rows() == before, 'Export changed durable rows'
    data['exports'][label] = {'file': path.name, 'sha256': sha(path), 'week': state['week']}
    close_all()
    return state


def import_state(path):
    expected = read_envelope(path)
    panel = menu('設定・保存')

    def confirm(dialog):
        assert '現在の会社を読み込むファイルの内容で置き換えます' in dialog.message
        dialog.accept()

    page.once('dialog', confirm)
    with page.expect_file_chooser() as chooser:
        click(button(panel, 'ファイルから読み込む'))
    chooser.value.set_files(str(path))
    expect(page.locator('.immersive-game')).to_be_visible()
    expect(page.get_by_role('alert')).to_contain_text('会社データを読み込みました')
    expect(page.locator('dialog[open]')).to_have_count(0)
    assert saved() == expected
    return expected


def save_now(expected):
    panel = menu('設定・保存')
    click(button(panel, '今すぐ保存する'))
    expect(page.get_by_role('alert')).to_contain_text('現在の経営状況を保存しました')
    assert saved() == expected
    close_all()
    return rows()


def reload_company(expected, expected_rows):
    close_all()
    page.reload(wait_until='domcontentloaded')
    click(page.get_by_role('button', name=re.compile(re.escape(expected['companyName']) + ' を続ける')))
    expect(page.locator('.immersive-game')).to_be_visible()
    assert saved() == expected and rows() == expected_rows


def service(kind='bank'):
    close_all()
    label, title = ('渋谷銀行を開く', '渋谷銀行') if kind == 'bank' else ('渋谷証券市場を開く', '渋谷証券市場')
    target = page.locator('.city-world').get_by_role('button', name=label, exact=True)
    expect(target).to_be_visible()
    click(target)
    expect(current().get_by_role('heading', name=title, exact=True)).to_be_visible()
    return current()


def borrow():
    panel = service()
    click(button(panel, '10万円'))
    click(button(panel, '13週'))
    click(button(panel, 'この条件で融資審査する'))
    expect(panel.locator('[data-loan-review="approved"]')).to_be_visible()
    click(panel.locator('[data-loan-confirm]'))
    close_all()


def repay(index=0):
    panel = service()
    click(button(panel.locator('.service-loans > article').nth(index), '一括返済'))
    close_all()


def loan_checks(initial):
    data['phase'] = 'loan-identity'
    durable = rows()
    page.set_viewport_size(PHONE)
    borrow()
    first = export_state('02-loan-A')
    borrow()
    second = export_state('03-loan-A-B')
    assert len(second['loans']) == 2 and second['cash'] == initial['cash'] + 200000
    assert second['loans'][0] == first['loans'][0]
    repay(0)
    after_first_repay = export_state('04-loan-B')
    assert after_first_repay['loans'] == [second['loans'][1]]
    borrow()
    third = export_state('05-loan-B-C')
    assert len(third['loans']) == 2 and len({loan['id'] for loan in third['loans']}) == 2
    assert third['loans'][0] == second['loans'][1]
    assert third['cash'] == second['cash'] and third['week'] == initial['week']
    assert third['lastReport'] == initial['lastReport'] and rows() == durable
    snapshot('06-phone-two-distinct-outstanding-contracts')
    exact_rows = save_now(third)
    reload_company(third, exact_rows)
    assert export_state('07-loan-exact-reload') == third
    repay(0)
    only_third = export_state('08-loan-C-after-repaying-B')
    assert only_third['loans'] == [third['loans'][1]]
    assert only_third['cash'] == third['cash'] - third['loans'][0]['remaining']
    assert rows() == exact_rows
    repay(0)
    assert export_state('09-loans-repaid') == initial
    save_now(initial)
    page.set_viewport_size(DESKTOP)
    ok('Ordinary borrow A/B, repay A, reborrow C preserves unique outstanding contract IDs; exact save/reload and repaying B removes only B, then repaying C restores the fresh company')


def weekly_screen():
    return page.locator('dialog.weekly-review-screen[open]')


def completion_screen():
    return page.locator('dialog.campaign-completion-screen[open]')


def scene_pose():
    if not args.dev_diagnostics:
        return None
    return page.evaluate("()=>({position:window.__cityCamera.position.toArray(),quaternion:window.__cityCamera.quaternion.toArray(),fov:window.__cityCamera.fov})")


def fullscreen(screen, label):
    bounds, viewport = screen.bounding_box(), page.viewport_size
    assert bounds and abs(bounds['x']) <= 1 and abs(bounds['y']) <= 1, bounds
    assert abs(bounds['width'] - viewport['width']) <= 1 and abs(bounds['height'] - viewport['height']) <= 1, bounds
    details = screen.evaluate("""e=>{const style=getComputedStyle(e);
      const points=[[1,1],[innerWidth-2,1],[1,innerHeight-2],[innerWidth-2,innerHeight-2],[innerWidth/2,innerHeight/2]];
      return {background:style.backgroundColor,modal:e.matches(':modal'),focusInside:e.contains(document.activeElement),
        hits:points.map(([x,y])=>{const top=document.elementFromPoint(x,y);return {x,y,inside:e.contains(top),tag:top?.tagName,class:top?.className}})};}""")
    assert details['modal'] and details['focusInside'] and all(hit['inside'] for hit in details['hits']), details
    assert details['background'].startswith('rgb') and not details['background'].startswith('rgba'), details
    hud = page.locator('.game-hud button,.hud-context button,.hud-next-week').evaluate_all("""es=>es.map(e=>{
      const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);
      return {label:e.getAttribute('aria-label')||e.innerText,onscreen:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,
        oldHudHit:!!top?.closest('.game-hud,.hud-context,.hud-next-week')};})""")
    assert hud and not any(hit['onscreen'] and hit['oldHudHit'] for hit in hud), hud
    control = screen.locator('.campaign-completion-continue')
    control_bounds = control.evaluate("""e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {width:r.width,height:r.height,withinViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,unoccluded:e.contains(top)};}""")
    assert control_bounds['withinViewport'] and control_bounds['unoccluded'], control_bounds
    fit = screen.evaluate('(e)=>({width:e.clientWidth,scrollWidth:e.scrollWidth})')
    assert fit['scrollWidth'] <= fit['width'] + 1, fit
    data.setdefault('fullscreen', {})[label] = {'bounds': bounds, **details, 'hudHitTests': hud, 'continueBounds': control_bounds, 'fit': fit}
    for _ in range(5):
        page.keyboard.press('Tab')
        active = screen.evaluate("""e=>{const n=document.activeElement;return {inside:e.contains(n),tag:n?.tagName,
          oldHud:!!n?.closest('.game-hud,.hud-context,.hud-next-week'),label:n?.getAttribute('aria-label')||n?.innerText?.slice(0,120)};}""")
        assert not active['oldHud'] and (active['inside'] or active['tag'] == 'BODY'), active
        data.setdefault('tabFocus', []).append({'label': label, **active})
    if any(not item['inside'] for item in data.get('tabFocus', [])):
        limitation = 'Native WebKit Tab briefly focused BODY/browser chrome; no underlying app control received focus'
        if limitation not in data['limitations']:
            data['limitations'].append(limitation)


def ipo_checks():
    data['phase'] = 'actual-ipo-eligibility'
    eligible = import_state(ipo_path)
    durable = rows()
    panel = menu('成長戦略')
    condition = panel.locator('[data-ipo-requirement="4"]')
    expect(condition).to_have_attribute('data-met', 'true')
    expect(condition).to_contain_text(f"第{eligible['lastReport']['week']}週")
    expect(condition).to_contain_text(f"¥{eligible['lastReport']['netProfit']:,}")
    assert export_state('10-actual-ipo-condition-view') == eligible and rows() == durable
    menu('直近の営業結果')
    click(button(weekly_screen(), '今週の街のニュースへ'))
    expect(weekly_screen()).to_have_attribute('data-weekly-review-phase', 'news')
    opportunity = weekly_screen().locator('.weekly-review-opportunity[aria-label="現在の上場機会"]')
    expect(opportunity).to_be_visible()
    page.set_viewport_size(PHONE)
    snapshot('11-phone-current-ipo-opportunity')
    click(button(opportunity, '証券市場で条件を確認'))
    expect(current().get_by_role('heading', name='渋谷証券市場', exact=True)).to_be_visible()
    conditions = current().locator('.service-listing-conditions li')
    expect(conditions).to_have_count(4)
    assert all(conditions.nth(index).get_attribute('data-met') == 'true' for index in range(4))
    expect(conditions.nth(3)).to_contain_text(f"第{eligible['lastReport']['week']}週")
    expect(conditions.nth(3)).to_contain_text(f"¥{eligible['lastReport']['netProfit']:,}")
    snapshot('12-phone-exchange-actual-eligibility')
    assert export_state('13-exchange-route-view-only') == eligible and rows() == durable
    panel = service('exchange')
    expect(panel.locator('button.capital-submit')).to_have_text('株式公開する')
    click(panel.locator('button.capital-submit'))
    milestone = page.locator('.growth-milestone')
    expect(milestone.get_by_role('heading', name='上場しました', exact=True)).to_be_visible()
    click(button(milestone, '上場の結果を閉じる'))
    listed = export_state('14-ordinary-explicit-ipo')
    assert listed['listed'] and listed['week'] == eligible['week']
    assert listed['lastReport'] == eligible['lastReport'] and rows() == durable
    menu('直近の営業結果')
    click(button(weekly_screen(), '今週の街のニュースへ'))
    expect(weekly_screen().locator('.weekly-review-opportunity')).to_have_count(0)
    close_all()
    page.set_viewport_size(DESKTOP)
    ok('Preserved ordinary earned IPO state shows the last actual profitable report; current news opportunity routes to exchange without mutation, explicit IPO alone lists, and reopening then removes the current opportunity')


def settle(requested=1):
    close_all()
    click(page.locator('.hud-next-week'))
    panel = current()
    if requested > 1:
        panel.locator('label').filter(has_text='営業を進める期間').locator('select').select_option(str(requested))
        panel.get_by_label('新しい営業提案で停止', exact=True).uncheck()
    click(button(panel, '営業して週を進める' if requested == 1 else f'最大{requested}週間の営業を始める'))


def assert_record(actual, before):
    record = actual['campaignAchievement']
    report = actual['lastReport']
    assert actual['week'] == before['week'] + 1 and report['week'] == before['week']
    assert record['week'] == report['week'] and record['netProfit'] == report['netProfit'] > 0
    assert record['cash'] == actual['cash'] == before['cash'] + report['cashChange']
    assert record['totalCustomers'] == actual['totalCustomers']
    assert record['storeCount'] == len(actual['stores']) and record['propertyCount'] == len(actual['properties'])
    assert (record['subsidiaries'], record['marketBusinesses'], record['districts']) == (8, 100, 4)
    assert record == campaign_evidence['campaignAchievement'], 'Native settlement differs from current-engine campaign evidence'
    expect(completion_screen()).to_have_attribute('data-achievement-week', str(record['week']))
    expect(completion_screen().locator('.campaign-completion-settlement')).to_contain_text(f"¥{record['netProfit']:,}")
    expect(completion_screen().locator('.campaign-completion-settlement')).to_contain_text(f"¥{record['cash']:,}")
    return record


def completion_checks():
    before = import_state(campaign_path)
    durable = rows()
    assert not saved().get('campaignAchievement') and export_state('15-natural-endstate-import') == before
    menu('成長戦略')
    expect(current().locator('.progression-achievement')).to_have_count(0)
    close_all()
    pose = scene_pose()
    page.set_viewport_size(PHONE)
    settle()
    expect(completion_screen()).to_be_visible()
    actual = saved()
    record = assert_record(actual, before)
    settled_rows = rows()
    assert settled_rows != durable
    fullscreen(completion_screen(), 'phone-completion')
    snapshot('16-phone-first-durable-completion')
    page.set_viewport_size(DESKTOP)
    fullscreen(completion_screen(), 'desktop-completion')
    snapshot('17-desktop-first-durable-completion')
    assert saved() == actual and rows() == settled_rows
    if pose is not None:
        assert scene_pose() == pose, 'Completion moved the camera'
    click(completion_screen().locator('.campaign-completion-review'))
    expect(weekly_screen()).to_have_attribute('data-settled-week', str(record['week']))
    click(button(weekly_screen(), '店舗・収支の詳しい記録'))
    expect(weekly_screen()).to_have_attribute('data-weekly-review-phase', 'details')
    click(button(weekly_screen(), '次の出店候補を見る'))
    expect(current().get_by_role('heading', name='物件を探す', exact=True)).to_be_visible()
    assert rows() == settled_rows
    close_all()
    menu('街と企業の達成記録')
    expect(completion_screen()).to_be_visible()
    click(button(completion_screen(), '街で経営を続ける'))
    assert export_state('18-first-achievement-exact-export') == actual and rows() == settled_rows
    reload_company(actual, settled_rows)
    expect(completion_screen()).to_have_count(0)
    panel = menu('成長戦略')
    expect(panel.locator('.progression-achievement')).to_be_visible()
    click(button(panel.locator('.progression-achievement'), '達成記録を見る'))
    expect(completion_screen()).to_have_attribute('data-achievement-week', str(record['week']))
    close_all()
    ok('Unchanged natural penultimate import does not backfill achievement; one real saved settlement creates exact 108-business/4-district record and opaque phone/desktop native receipt, and supplies result/site/replay routes')

    # An explicit later contract changes present cash. The historic achievement
    # must survive exactly, including after another real weekly settlement.
    borrow()
    borrowed = export_state('19-later-contract-preserves-achievement')
    assert borrowed['campaignAchievement'] == record and borrowed['cash'] == actual['cash'] + 100000
    exact_rows = save_now(borrowed)
    reload_company(borrowed, exact_rows)
    menu('街と企業の達成記録')
    expect(completion_screen().locator('.campaign-completion-settlement')).to_contain_text(f"¥{record['cash']:,}")
    assert saved() == borrowed and rows() == exact_rows
    close_all()
    repay(len(borrowed['loans']) - 1)
    after_repay = export_state('20-later-repayment-preserves-achievement')
    assert after_repay == actual
    settle()
    expect(weekly_screen()).to_have_attribute('data-weekly-review-phase', 'summary')
    expect(completion_screen()).to_have_count(0)
    later = saved()
    assert later['week'] == actual['week'] + 1 and later['campaignAchievement'] == record
    later_rows = rows()
    menu('街と企業の達成記録')
    expect(completion_screen().locator('.campaign-completion-review')).to_have_count(0)
    receipt_text = completion_screen().locator('.campaign-completion-settlement').inner_text()
    assert f"¥{record['cash']:,}" in receipt_text and f"¥{record['netProfit']:,}" in receipt_text
    close_all()
    assert export_state('21-later-week-exact-achievement') == later and rows() == later_rows
    reload_company(later, later_rows)
    expect(completion_screen()).to_have_count(0)
    menu('街と企業の達成記録')
    assert completion_screen().locator('.campaign-completion-settlement').inner_text() == receipt_text
    close_all()
    assert import_state(OUT / '21-later-week-exact-achievement.json') == later
    assert export_state('22-exact-reimported-achievement') == later
    ok('Achievement replay is view-only and does not auto-reopen after reload; later borrowing/repayment and a further saved settlement keep the original record immutable through exact export/save/reload/import')
    completion_batch_news_checks(actual, record)


def completion_batch_news_checks(actual, record):

    # Independent unchanged natural import, then a 13-week request. Achievement
    # takes precedence and stops after its first successful durable commit.
    batch_before = import_state(campaign_path)
    assert not batch_before.get('campaignAchievement')
    page.set_viewport_size(PHONE)
    settle(13)
    expect(completion_screen()).to_be_visible()
    batch_after = saved()
    assert assert_record(batch_after, batch_before) == record
    assert batch_after == actual, 'Single and batch first settlement differ'
    snapshot('23-phone-batch-stopped-at-first-achievement')
    close_all()
    assert export_state('24-batch-one-durable-commit') == batch_after
    page.set_viewport_size(DESKTOP)
    ok('Independent natural penultimate import plus a native 13-week request stops after one durable achievement settlement; result equals the ordinary single-week path exactly')

    # One real first week of an existing 26-week plan exercises only the newly
    # added saved news path, without claiming a new full-plan validation.
    durable = rows()
    panel = menu('グループ')
    sector_row = panel.locator('.group-sector-row[data-group-sector]').first
    sector = sector_row.get_attribute('data-group-sector')
    click(button(sector_row, '運営・投資を考える'))
    click(panel.locator('[data-operation-policy="stability"]'))
    upfront = int(panel.locator('[data-operation-upfront]').get_attribute('data-operation-upfront'))
    click(button(panel, '開始前の支払と収支を確認'))
    click(panel.get_by_role('button', name=re.compile('^26週の計画を始める ·')))
    started = export_state('25-explicit-group-plan-start')
    assert started['cash'] == actual['cash'] - upfront and started['campaignAchievement'] == record
    assert started['week'] == actual['week'] and started['lastReport'] == actual['lastReport'] and rows() == durable
    settle()
    expect(weekly_screen()).to_have_attribute('data-weekly-review-phase', 'summary')
    planned = saved()
    operation = planned['lastReport']['marketOperation']
    assert operation['week'] == started['week'] == operation['startWeek']
    assert operation['sector'] == sector and operation['policy'] == 'stability'
    assert operation['endWeek'] - operation['startWeek'] == 26
    assert planned['campaignAchievement'] == record
    difference = f"{'+' if operation['profitDelta'] > 0 else ''}{operation['profitDelta']:,}円"
    event = next(e for e in planned['lastReport']['news']['events']
                 if e['category'] == 'company' and sector in e['text'] and '安定運営を開始（1/26週）' in e['text'])
    assert f'今週の利益差 {difference}' in event['text']
    click(button(weekly_screen(), '今週の街のニュースへ'))
    card = weekly_screen().locator('.weekly-news-group-events[aria-label="グループ企業のニュース"]')
    expect(card).to_contain_text(event['text'])
    page.set_viewport_size(PHONE)
    card.scroll_into_view_if_needed()
    expect(card).to_be_visible()
    snapshot('26-phone-first-actual-group-plan-news')
    planned_rows = rows()
    assert export_state('27-saved-actual-group-news') == planned and rows() == planned_rows
    reload_company(planned, planned_rows)
    menu('直近の営業結果')
    click(button(weekly_screen(), '今週の街のニュースへ'))
    expect(weekly_screen().locator('.weekly-news-group-events')).to_contain_text(event['text'])
    assert export_state('28-exact-group-news-after-reload') == planned
    data['actualGroupNews'] = {'reportWeek': operation['week'], 'operation': operation, 'savedEvent': event}
    ok('One explicit plan start and real first-week settlement save a group news event matching actual lastReport.marketOperation.profitDelta; the same historical event survives exact save/reload, with the earned achievement unchanged')


def public_receipt_check():
    before = import_state(campaign_path)
    assert not saved().get('campaignAchievement')
    page.set_viewport_size(PHONE)
    settle()
    expect(completion_screen()).to_be_visible()
    actual = saved()
    record = assert_record(actual, before)
    exact_rows = rows()
    fullscreen(completion_screen(), 'public-phone-completion')
    snapshot('public-phone-actual-durable-completion')
    click(completion_screen().locator('.campaign-completion-continue'))
    assert export_state('public-exact-achievement-export') == actual and rows() == exact_rows
    reload_company(actual, exact_rows)
    expect(completion_screen()).to_have_count(0)
    assert export_state('public-exact-achievement-after-reload') == actual and rows() == exact_rows
    data['publicAchievement'] = record
    ok('Expected public release ID, unchanged natural import, one real durable achievement settlement and opaque phone receipt, exact export/reload without automatic receipt reopening')


profile = Path(args.profile) if args.profile else Path(tempfile.mkdtemp(prefix='v070-completion-native-', dir='/tmp'))
try:
    with sync_playwright() as playwright:
        options = {'headless': args.headless, 'viewport': DESKTOP, 'accept_downloads': True}
        if args.browser == 'webkit':
            options.update(is_mobile=True, has_touch=True)
        else:
            options['firefox_user_prefs'] = {'webgl.force-enabled': True, 'gfx.webrender.software': True}
        context = getattr(playwright, args.browser).launch_persistent_context(str(profile), **options)
        context.add_init_script("window.__qaCsp=[];addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
        page = context.new_page()
        page.set_default_timeout(30000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else warnings.append(message.text) if message.type == 'warning' else None)
        page.on('requestfailed', lambda request: failures.append({'url': request.url, 'error': request.failure, 'phase': data['phase']}))
        page.on('response', lambda response: responses.append({'url': response.url, 'status': response.status}))
        try:
            response = page.goto(args.url, wait_until='domcontentloaded')
            assert response and response.status == 200
            if csp:
                assert response.headers.get('content-security-policy') == csp
            page.wait_for_load_state('networkidle')
            data['browserIdentity'] = page.evaluate('()=>({userAgent:navigator.userAgent,secureContext:isSecureContext,devicePixelRatio,touchPoints:navigator.maxTouchPoints})')
            if not args.production_csp and (args.expected_version or args.expected_source):
                release = page.evaluate("async()=>await(await fetch(new URL('release.json',location.href))).json()")
                data['release'] = release
                if args.expected_version:
                    assert release['version'] == args.expected_version
                if args.expected_source:
                    assert release['sourceCommit'] == args.expected_source
            page.get_by_label('会社名', exact=True).fill(NAME)
            click(button(page, '新しい会社を設立'))
            expect(page.locator('.immersive-game')).to_be_visible()
            expect(page.locator('.city-world canvas')).to_be_visible()
            expect(page.locator('.city-webgl-error')).to_have_count(0)
            click(button(current(), '説明を閉じる'))
            page.wait_for_load_state('networkidle')
            if args.dev_diagnostics:
                page.wait_for_function("window.__cityScene?.getObjectByName('Game_economic_site_markers')?.children.length===48")
                page.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
                first_frame = page.evaluate('window.__cityRenderer.info.render.frame')
                page.wait_for_function('f=>window.__cityRenderer.info.render.frame>f', arg=first_frame)
                data['nativeFrameProgress'] = {'first': first_frame, 'later': page.evaluate('window.__cityRenderer.info.render.frame')}
            initial = export_state('01-fresh-company')
            assert initial['cash'] == 12000000 and initial['week'] == 1 and not initial['loans'] and not initial['stores']
            if args.scope != 'public-receipt':
                ok('Ordinary new company starts with native crypto/save and a real visible renderer; source fixtures remain distinct from native actions')
            if args.scope == 'full':
                loan_checks(initial)
                ipo_checks()
            if args.scope == 'batch-news':
                completion_batch_news_checks(reference_actual, reference_actual['campaignAchievement'])
            elif args.scope == 'public-receipt':
                public_receipt_check()
            else:
                completion_checks()
            page.wait_for_load_state('networkidle')
            data['cspViolations'] = page.evaluate('window.__qaCsp')
            # Retain the native warning verbatim. WebKit can advise that this
            # existing modulepreload is unused during a game-only session.
            expected_preload = re.compile(r'^The resource ' + re.escape(args.url.split('?', 1)[0].rsplit('/', 1)[0])
                + r'/assets/RealCityScene-[A-Za-z0-9_-]+\.js was preloaded using link preload but not used within a few seconds from the window\'s load event\. Please make sure it wasn\'t preloaded for nothing\.$')
            data['classifiedPreloadAdvisories'] = [warning for warning in warnings if expected_preload.match(warning)]
            unexpected_warnings = [warning for warning in warnings if not expected_preload.match(warning)]
            assert not errors and not unexpected_warnings and not failures, {'errors': errors, 'warnings': unexpected_warnings, 'failures': failures}
            assert not [response for response in responses if response['status'] >= 400]
            assert not data['cspViolations']
            assert len(checks) == {'full': 7, 'completion': 5, 'batch-news': 3, 'public-receipt': 1}[args.scope]
            passed = True
        except Exception:
            data['failure'] = traceback.format_exc()
            print(data['failure'], flush=True)
            try:
                snapshot('failure')
            except Exception:
                pass
        finally:
            try:
                data['cspViolations'] = page.evaluate('window.__qaCsp')
                (OUT / 'last-stored-rows.json').write_text(json.dumps(rows(), ensure_ascii=False, indent=2) + '\n')
            except Exception:
                pass
            context.close()
            context = None
except Exception:
    data['launchFailure'] = traceback.format_exc()
    print(data['launchFailure'], flush=True)
finally:
    if args.production_csp:
        try:
            data['buildEnd'] = verify_build()
            assert data['buildEnd'] == build_start
        except Exception:
            data['buildVerificationFailure'] = traceback.format_exc()
            passed = False
    end_hashes = source_hashes()
    (OUT / 'source-end.json').write_text(json.dumps(end_hashes, indent=2) + '\n')
    data['sourceStable'] = start_hashes == end_hashes
    if not data['sourceStable']:
        passed = False
        data['sourceChangedPaths'] = sorted(k for k in set(start_hashes) | set(end_hashes) if start_hashes.get(k) != end_hashes.get(k))
    data['responses'], data['requestFailures'] = responses, failures
    (OUT / 'results.json').write_text(json.dumps({'passed': passed, 'checks': checks, 'errors': errors, 'warnings': warnings,
        'data': data, 'url': args.url, 'method': __doc__}, ensure_ascii=False, indent=2) + '\n')
    if context:
        context.close()
    if not args.profile:
        shutil.rmtree(profile, ignore_errors=True)
    if server:
        server.shutdown()
        server.server_close()
if not passed:
    raise SystemExit(1)
