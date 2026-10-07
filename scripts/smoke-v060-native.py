#!/usr/bin/env python3
"""v0.6.0 native acceptance. Run only against the agreed final runtime.

Normal new-company UI, renderer/RAF/crypto and sandbox. DOM and IndexedDB reads
only. Optional DEV scene reads project physical service markers for real clicks;
production can reuse recorded points at the same viewport. No economic injection.
Use a private authenticated Xorg runner. Every invocation requires a fresh --out.
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
DEFAULT_LEGACY = '/workspace/shared/shibuya-artifacts/completion-v051/first-play/run-03/natural-first-week-with-manager-export.json'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5173')
parser.add_argument('--out', required=True)
parser.add_argument('--production-csp', action='store_true')
parser.add_argument('--dev-diagnostics', action='store_true')
parser.add_argument('--profile', help='Disposable externally prepared ordinary Firefox profile')
parser.add_argument('--service-points', help='Prior DEV output, same viewport and unchanged camera/scene')
parser.add_argument('--legacy-save', default=DEFAULT_LEGACY)
parser.add_argument('--ipo-fixture', help='Manifest from prepare-v060-ipo.ts; ordinary-action unlisted eligible save')
parser.add_argument('--expected-version')
parser.add_argument('--expected-source')
a = parser.parse_args()
OUT = Path(a.out)
if OUT.exists() and any(OUT.iterdir()):
    raise SystemExit('Choose a fresh --out; prior evidence is retained.')
OUT.mkdir(parents=True, exist_ok=True)
shutil.copy2(Path(__file__), OUT / 'smoke-v060-native.py')
source_hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in ROOT.joinpath('src').rglob('*') if path.is_file() and path.suffix in ['.ts', '.tsx', '.css']}
(OUT / 'source-start.json').write_text(json.dumps(source_hashes, indent=2) + '\n')
if a.dev_diagnostics:
    assert not a.production_csp and urlsplit(a.url).hostname in ['localhost', '127.0.0.1']
checks, errors, warnings, responses, failures = [], [], [], [], []
data = {'viewport': {'width': 1280, 'height': 900}, 'snapshots': {}, 'exports': {}, 'servicePoints': {}, 'phase': 'startup'}
passed, server, csp = False, None, None
FORBIDDEN_ORACLE = re.compile(r'店舗利益見込み|全社利益見込み|全社利益の変化|利益幅|利益の幅|現金増減の幅|週末の(?:手元資金|現金)の(?:幅|見込み)|基準の見込み / 週')
if a.production_csp:
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
    a.url = f'http://127.0.0.1:{server.server_port}/index.html'
    data['csp'] = csp
    data['distIndexSHA256'] = hashlib.sha256((ROOT / 'dist/index.html').read_bytes()).hexdigest()
service_points = json.loads(Path(a.service_points).read_text()) if a.service_points else None
if service_points:
    assert service_points['viewport'] == data['viewport']


def button(scope, name):
    return scope.get_by_role('button', name=name, exact=True)


def current():
    return page.locator('dialog[open]').last


def close_all():
    for _ in range(5):
        dialogs = page.locator('dialog[open]')
        if not dialogs.count():
            return
        dialogs.last.locator(':scope > section > header > button[aria-label="閉じる"]').click()
    assert not page.locator('dialog[open]').count()


def menu(name):
    close_all()
    button(page, '経営').click()
    button(current(), name).click()
    return current()


def rows():
    return page.evaluate("""()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('shibuya-capital-v1');request.onerror=reject;
      request.onsuccess=()=>{const db=request.result,read=db.transaction('saves').objectStore('saves').getAll();
      read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=reject};})""")


def saved():
    return json.loads(next(row for row in rows() if row['key'] == 'primary')['envelope']['payload'])


def snapshot(name):
    data['phase'] = name
    page.evaluate('()=>document.fonts.ready')
    page.screenshot(path=str(OUT / f'{name}.png'))
    text = page.locator('body').inner_text()
    (OUT / f'{name}.txt').write_text(text + '\n')
    data['snapshots'][name] = {'textFile': f'{name}.txt', 'imageFile': f'{name}.png'}
    print('SNAPSHOT', name, flush=True)


def ok(message):
    checks.append(message)
    print('PASS', message, flush=True)


def no_oracle(scope, label):
    content = scope.text_content()
    matches = FORBIDDEN_ORACLE.findall(content)
    assert not matches, {'scope': label, 'oracleLabels': matches}
    data.setdefault('noOracleScopes', []).append(label)


def no_company_forecast(scope, label):
    # Contract/asset-only estimates remain legitimate on these surfaces.
    forbidden = re.compile(r'全社(?:の今週|の)?利益(?:見込み|幅|の幅)|今週の利益見込み|週末の現金見込み|全社の今週利益幅')
    matches = forbidden.findall(scope.text_content())
    assert not matches, {'scope': label, 'companyForecastLabels': matches}
    data.setdefault('noCompanyForecastScopes', []).append(label)


def fit(scope, label):
    bounds = scope.evaluate('(e)=>({width:e.clientWidth,scrollWidth:e.scrollWidth})')
    data.setdefault('bounds', {})[label] = bounds
    ranges = scope.locator('input[type=range]')
    if ranges.count():
        data.setdefault('rangeStyles', {})[label] = ranges.evaluate_all("es=>es.map(e=>{const s=getComputedStyle(e);return {marginInlineStart:s.marginInlineStart,marginInlineEnd:s.marginInlineEnd,width:s.width,rectWidth:e.getBoundingClientRect().width}})")
    if bounds['scrollWidth'] > bounds['width'] + 1:
        data.setdefault('overflowElements', {})[label] = scope.evaluate("""e=>{const box=e.getBoundingClientRect();return [...e.querySelectorAll('*')].map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.tagName,class:n.className,type:n.getAttribute('type'),width:r.width,left:r.left-box.left,right:r.right-box.right,marginLeft:s.marginLeft,marginRight:s.marginRight}}).filter(r=>r.width&& (r.left<-.5||r.right>.5)).slice(0,30)}""")
    assert bounds['scrollWidth'] <= bounds['width'] + 1, bounds


def export_state(label):
    stored_before = rows()
    panel = menu('設定・保存')
    with page.expect_download() as download:
        button(panel, '保存ファイルを書き出す').click()
    path = OUT / f'{label}.json'
    download.value.save_as(str(path))
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    state = json.loads(envelope['payload'])
    assert rows() == stored_before, 'Export changed IndexedDB'
    data['exports'][label] = {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'week': state['week']}
    close_all()
    return state


def site_list():
    close_all()
    # The label depends on whether a store is selected; both open the same list.
    entry = page.get_by_role('button', name=re.compile('^(出店場所を探す|物件を探す)$'))
    expect(entry).to_have_count(1)
    entry.click()
    expect(current().locator('.site-list button[data-lot-id]')).to_have_count(48)
    return current()


def site(lot_id):
    listing = site_list()
    listing.locator(f'[data-lot-id="{lot_id}"]').click()
    expect(current().locator('.facility-content')).to_have_attribute('data-selected-lot-id', lot_id)
    return current()


def manage(purpose_name=None):
    panel = menu('店舗経営')
    button(panel, 'この店を経営').click()
    panel = page.locator('.store-management')
    if purpose_name:
        panel.locator('.store-management-purposes button').filter(has_text=purpose_name).click()
    return panel


def pose():
    return page.evaluate("()=>({uuid:window.__cityScene.uuid,camera:window.__cityCamera.position.toArray(),quaternion:window.__cityCamera.quaternion.toArray(),fov:window.__cityCamera.fov})")


def service(kind, title):
    close_all()
    before = pose() if a.dev_diagnostics else None
    accessible = page.locator('.city-world').get_by_role('button', name=title + 'を開く', exact=True)
    if a.dev_diagnostics:
        point = page.evaluate("""kind=>{
          const obj=window.__cityScene.getObjectByName('Game_service_marker_'+kind);
          if(!obj)throw new Error('Missing physical service marker '+kind);
          const v=obj.getWorldPosition(obj.position.clone()).project(window.__cityCamera);
          const r=window.__cityRenderer.domElement.getBoundingClientRect();
          return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2-22,userData:obj.userData};} """, kind)
        data['servicePoints'][kind + ('-portrait' if page.viewport_size['width'] != 1280 else '')] = point
    elif accessible.count():
        expect(accessible).to_be_visible()
        bounds = accessible.bounding_box()
        point = {'x': bounds['x'] + bounds['width'] / 2, 'y': bounds['y'] + bounds['height'] / 2, 'method': 'accessible target aligned to physical marker'}
        data['servicePoints'][kind + ('-portrait' if page.viewport_size['width'] != 1280 else '')] = point
    elif service_points:
        point = service_points['points'][kind]
    else:
        raise AssertionError('Missing accessible physical service target and no read-only projected point fixture; no menu substitute')
    assert 0 < point['x'] < 1280 and 0 < point['y'] < 900, point
    if accessible.count():
        expect(accessible).to_be_visible()
        accessible.click()
    else:
        page.mouse.click(point['x'], point['y'])
    expect(current().get_by_role('heading', name=title, exact=True)).to_be_visible()
    if before:
        assert pose() == before, 'Service selection moved/replaced camera'
    no_oracle(current(), 'physical-' + kind)
    return current()


def import_state(path):
    expected_envelope = json.loads(path.read_text())
    assert hashlib.sha256(expected_envelope['payload'].encode()).hexdigest() == expected_envelope['checksum']
    expected_state = json.loads(expected_envelope['payload'])
    panel = menu('設定・保存')
    def confirm(dialog):
        assert '現在の会社を読み込むファイルの内容で置き換えます' in dialog.message
        dialog.accept()
    page.once('dialog', confirm)
    with page.expect_file_chooser() as chooser:
        button(panel, 'ファイルから読み込む').click()
    chooser.value.set_files(str(path))
    expect(page.locator('.immersive-game')).to_be_visible()
    expect(page.get_by_role('alert')).to_contain_text('会社データを読み込みました')
    # Successful import already closes settings; await that native transition.
    expect(page.locator('dialog[open]')).to_have_count(0)
    assert saved() == expected_state
    return expected_state


profile = Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix='v060-native-', dir='/tmp'))
with sync_playwright() as pw:
    context = pw.firefox.launch_persistent_context(str(profile), headless=False, viewport=data['viewport'], accept_downloads=True,
        firefox_user_prefs={'webgl.force-enabled': True, 'gfx.webrender.software': True})
    context.add_init_script("window.__qaCsp=[];addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
    page = context.new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else warnings.append(message.text) if message.type == 'warning' else None)
    page.on('requestfailed', lambda request: failures.append({'url': request.url, 'error': request.failure, 'phase': data['phase']}))
    page.on('response', lambda response: responses.append({'url': response.url, 'status': response.status}))
    try:
        response = page.goto(a.url, wait_until='domcontentloaded')
        assert response and response.status == 200
        if csp:
            assert response.headers.get('content-security-policy') == csp
        page.wait_for_load_state('networkidle')
        if a.expected_version or a.expected_source:
            release = page.evaluate("async()=>await(await fetch(new URL('release.json',location.href))).json()")
            data['release'] = release
            if a.expected_version:
                assert release['version'] == a.expected_version
            if a.expected_source:
                assert release['sourceCommit'] == a.expected_source
        page.get_by_label('会社名', exact=True).fill('街を見て選ぶQA')
        button(page, '新しい会社を設立').click()
        expect(page.locator('.immersive-game')).to_be_visible()
        expect(page.locator('.city-world canvas')).to_be_visible()
        expect(page.locator('.city-webgl-error')).to_have_count(0)
        button(current(), '説明を閉じる').click()
        page.wait_for_load_state('networkidle')
        if a.dev_diagnostics:
            page.wait_for_function("window.__cityScene?.getObjectByName('Game_economic_site_markers')?.children.length===48")
            page.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
        initial = export_state('01-initial-company')
        assert initial['cash'] == 12000000 and initial['week'] == 1 and not initial['stores']
        initial_rows = rows()
        snapshot('01b-unobscured-city-services')
        listing = site_list()
        ids = listing.locator('[data-lot-id]').evaluate_all('(es)=>es.map(e=>e.dataset.lotId)')
        assert len(set(ids)) == 48
        outer = [f'{district}-{index:02}' for district in ['center', 'dogenzaka', 'miyashita', 'sakuragaoka'] for index in range(9, 13)]
        assert all(lot_id in ids for lot_id in outer)
        snapshot('02-all-48-sites')
        # Final labels/options are coordinated with SiteBrowser; unknown values fail.
        sort = listing.get_by_label('区画の並び順', exact=True)
        sort.select_option('footfall')
        footfalls = listing.locator('[data-site-footfall]').evaluate_all('(es)=>es.map(e=>Number(e.dataset.siteFootfall))')
        assert len(footfalls) == 48 and footfalls == sorted(footfalls, reverse=True)
        data['trafficSortedIds'] = listing.locator('[data-lot-id]').evaluate_all('(es)=>es.map(e=>e.dataset.lotId)')
        snapshot('03-traffic-sorted-sites')
        sort.select_option('rent')
        rents = listing.locator('[data-site-rent]').evaluate_all('(es)=>es.map(e=>Number(e.dataset.siteRent))')
        assert len(rents) == 48 and rents == sorted(rents)
        data['rentSortedValues'] = rents
        for lot_id in ['center-02', 'sakuragaoka-06', *outer]:
            panel = site(lot_id)
            no_oracle(panel.locator('.facility-content'), 'opening-' + lot_id)
            expect(panel.locator('[data-site-context]')).to_be_visible()
            expect(panel.locator('.store-opening')).to_contain_text('開業費')
            expect(button(panel, 'この場所にカフェを開業')).to_be_visible()
            if lot_id in ['center-02', 'sakuragaoka-06', outer[-1]]:
                snapshot('04-site-' + lot_id)
        assert rows() == initial_rows
        assert export_state('05-after-only-site-comparisons') == initial
        ok('48 sites, all 16 outer plots reachable; primary opening facts/costs have no financial oracle; view/export preserve exact company and durable rows')

        # Optional traffic view is deliberately display-only.
        button(page, '地図').click()
        traffic = current().get_by_role('button', name=re.compile('通行量|人通り'))
        expect(traffic).to_have_count(1)
        traffic.click()
        close_all()
        if a.dev_diagnostics:
            footfall = page.evaluate("()=>{const g=window.__cityScene.getObjectByName('Street_baseline_footfall');return {visible:g.visible,...g.userData}}")
            assert footfall['visible'] and footfall['source'] == 'authored-lot-footfall'
            assert len(footfall['sites']) == 48
            by_id = {row['lotId']: row for row in footfall['sites']}
            assert by_id['center-02']['symbolicPeople'] > by_id['sakuragaoka-06']['symbolicPeople']
            data['footfall'] = footfall
        snapshot('06-optional-base-traffic')
        page.mouse.move(640, 450)
        page.mouse.wheel(0, 500)
        page.wait_for_timeout(700)
        snapshot('06b-expanded-outer-city')
        button(page, '地図').click()
        button(current(), '街全体に戻る').click()
        page.wait_for_timeout(400)
        assert export_state('07-after-traffic-view') == initial and rows() == initial_rows
        bank = service('bank', '渋谷銀行')
        expect(bank.get_by_label('借入希望額（円）')).to_be_visible()
        expect(button(bank, '¥3,000,000を借り入れる')).to_be_visible()
        snapshot('08-physical-bank-preview')
        exchange = service('exchange', '渋谷証券市場')
        expect(exchange).to_contain_text('株式公開')
        snapshot('09-physical-exchange-unmet-ipo')
        close_all()
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(400)
        snapshot('09a-portrait-physical-services')
        for kind, title in [('bank', '渋谷銀行'), ('exchange', '渋谷証券市場')]:
            portrait_service = service(kind, title)
            fit(portrait_service.locator('.financial-service'), 'mobile-' + kind)
            snapshot('09b-portrait-' + kind)
        close_all()
        page.set_viewport_size(data['viewport'])
        page.wait_for_timeout(400)
        assert export_state('10-after-service-preview') == initial and rows() == initial_rows
        ok('Optional traffic and physical bank/exchange routes are display/preview only; native clicks reach correct dialogs and leave exact economic state/save unchanged')

        panel = site('center-01')
        button(panel, 'この場所にカフェを開業').click()
        expect(page.locator('dialog[open]')).to_have_count(0)
        opened = export_state('11-opened-before-first-week')
        assert opened['cash'] == 8400000 and opened['week'] == 1 and len(opened['stores']) == 1
        panel = manage('商品・価格')
        no_oracle(panel, 'product-before-results')
        price = panel.locator('.store-management-field').filter(has_text='販売価格（円）').locator('input')
        old_price = price.input_value()
        price.fill('850')
        expect(panel.locator('.store-management-draft')).to_contain_text('編集中')
        snapshot('12-price-pending')
        price.press('Enter')
        snapshot('13-price-applied-before-real-result')
        no_oracle(panel, 'product-applied-no-result')
        after_price = export_state('14-price-applied')
        assert after_price['stores'][0]['price'] == 850 and after_price['lastReport'] is None
        assert after_price['week'] == opened['week'] and after_price['cash'] == opened['cash']
        panel = manage('人員・店長')
        panel.locator('label.toggle input[type="checkbox"]').check()
        no_oracle(panel, 'manager-before-result')
        snapshot('15-manager-controls')
        panel = manage('広告・改装')
        no_oracle(panel, 'promotion-before-result')
        menu('経営記録')
        no_oracle(current(), 'pending-opening-journal')
        snapshot('16-pending-opening-journal')
        before_week = export_state('17-before-first-actual-week')
        assert before_week['lastReport'] is None
        before_deals_rows = rows()
        close_all()
        button(page, '経営').click()
        current().get_by_role('button', name=re.compile(r'^営業・提案(?: \d+件)?$')).click()
        deals = current().locator('.deals-panel')
        expect(deals.locator('.summary-strip')).not_to_contain_text('利益見込み')
        no_company_forecast(deals, 'deals-before-first-week')
        expect(deals.locator('.deal-card')).to_have_count(2)
        expect(deals.locator('.deal-claim').first).to_contain_text('営業担当の提示効果')
        snapshot('17a-deals-no-company-profit-forecast')
        button(deals.locator('.deal-card').first, '契約条件を確認').click()
        expect(current().get_by_role('heading', name='契約内容の確認', exact=True)).to_be_visible()
        no_company_forecast(current(), 'contract-conditions-preview')
        expect(current()).to_contain_text('今回の支払')
        snapshot('17b-contract-quote-without-company-oracle')
        close_all()
        assert export_state('17c-after-contract-preview-only') == before_week and rows() == before_deals_rows
        ok('Before first settlement, deals and contract preview show costs and scoped salesperson estimates without company-profit forecasts; preview leaves exact company/save unchanged')
        close_all()
        page.locator('.hud-next-week').click()
        no_oracle(current(), 'first-week-confirmation')
        snapshot('18-first-week-confirmation')
        button(current(), '営業して週を進める').click()
        report = page.locator('dialog[open]').filter(has=page.get_by_role('heading', name='第1週の営業結果', exact=True))
        expect(report).to_be_visible()
        expect(report.locator('.weekly-results-profit > strong')).to_have_attribute('data-profit-complete', 'true')
        first = saved()
        assert first['week'] == 2 and not first['gameOver'] and first['lastReport']['week'] == 1
        assert first['cash'] == round(before_week['cash'] + first['lastReport']['cashChange'])
        data['firstActual'] = {'profit': first['lastReport']['netProfit'], 'cashChange': first['lastReport']['cashChange'], 'cash': first['cash']}
        snapshot('19-first-actual-result')
        panel = manage('商品・価格')
        no_oracle(panel, 'product-after-real-result')
        price = panel.locator('.store-management-field').filter(has_text='販売価格（円）').locator('input')
        price.fill(old_price)
        price.press('Enter')
        after_edit = export_state('20-post-result-settings')
        assert after_edit['lastReport'] == first['lastReport'] and after_edit['history'] == first['history']
        assert saved() == first
        ok('Opening, pending/applied price and manager choices disclose no oracle; first actual settlement reconciles cash, settings preserve historical result and durable save until explicit save')

        for purpose_name in ['商品・価格', '人員・店長', '広告・改装', '営業実績']:
            panel = manage(purpose_name)
            page.set_viewport_size({'width': 390, 'height': 844})
            fit(panel, 'mobile-' + purpose_name)
            snapshot('21-mobile-' + purpose_name)
            page.set_viewport_size(data['viewport'])
        panel = site(outer[-1])
        page.set_viewport_size({'width': 390, 'height': 844})
        fit(panel.locator('.facility-content'), 'mobile-outer-site')
        snapshot('22-mobile-outer-site')
        page.set_viewport_size(data['viewport'])
        panel = menu('設定・保存')
        button(panel, '今すぐ保存する').click()
        expect(page.get_by_role('alert')).to_contain_text('現在の経営状況を保存しました')
        exact_rows = rows()
        assert saved() == after_edit
        close_all()
        page.reload(wait_until='domcontentloaded')
        page.get_by_role('button', name=re.compile('街を見て選ぶQA を続ける')).click()
        expect(page.locator('.immersive-game')).to_be_visible()
        assert rows() == exact_rows and saved() == after_edit
        snapshot('23-exact-save-reload')
        ok('390px store purposes and far outer site fit; explicit save/reload restores exact primary/envelope/rows')

        # Small actual loan follows real profitable operation, never injected wealth.
        panel = service('bank', '渋谷銀行')
        panel.get_by_label('借入希望額（円）').fill('100000')
        pre_borrow = export_state('24-before-actual-loan')
        panel = service('bank', '渋谷銀行')
        panel.get_by_label('借入希望額（円）').fill('100000')
        button(panel, '¥100,000を借り入れる').click()
        loan = export_state('25-after-actual-loan')
        assert loan['cash'] == pre_borrow['cash'] + 100000
        assert loan['week'] == pre_borrow['week'] and len(loan['loans']) == len(pre_borrow['loans']) + 1
        assert loan['lastReport'] == pre_borrow['lastReport']
        panel = service('bank', '渋谷銀行')
        expect(panel.locator('.service-loans button')).to_have_count(1)
        button(panel.locator('.service-loans'), '一括返済').click()
        repaid = export_state('25b-after-explicit-repayment')
        assert repaid['cash'] == pre_borrow['cash'] and repaid['loans'] == pre_borrow['loans']
        assert repaid['week'] == pre_borrow['week'] and repaid['lastReport'] == pre_borrow['lastReport']
        ok('Physical bank explicitly borrows ¥100,000 then repays it; original cash/loans are restored, week and past report unchanged')

        if a.ipo_fixture:
            manifest_path = Path(a.ipo_fixture)
            manifest = json.loads(manifest_path.read_text())
            assert manifest['method'] == 'ordinary-action-transcript-replay-until-before-ipo'
            fixture = Path(manifest['fixture']['path'])
            assert hashlib.sha256(fixture.read_bytes()).hexdigest() == manifest['fixture']['sha256']
            eligible = import_state(fixture)
            assert not eligible['listed'] and len(eligible['stores']) >= 3 and eligible['profitableWeeks'] >= 12
            stored_before_ipo = rows()
            panel = service('exchange', '渋谷証券市場')
            snapshot('26-ordinary-earned-ipo-preview')
            assert export_state('27-ipo-preview-unchanged') == eligible and rows() == stored_before_ipo
            panel = service('exchange', '渋谷証券市場')
            expect(panel.locator('button.capital-submit')).to_have_text('株式公開する')
            panel.locator('button.capital-submit').click()
            receipt = page.locator('.growth-milestone')
            expect(receipt.get_by_role('heading', name='上場しました', exact=True)).to_be_visible()
            no_company_forecast(receipt, 'actual-ipo-receipt')
            snapshot('28a-explicit-ipo-receipt')
            button(receipt, '上場の結果を閉じる').click()
            expect(receipt).to_have_count(0)
            close_all()
            listed = export_state('28-explicit-ipo-completed')
            assert listed['listed'] and listed['week'] == eligible['week'] and listed['lastReport'] == eligible['lastReport']
            data['ipoFixtureManifest'] = manifest
            ok('Ordinary earned pre-IPO save imports exactly; physical exchange preview preserves it and explicit IPO alone lists company')
            listed_rows = rows()
            group = menu('グループ')
            group.locator('.group-acquisition-options > summary').click()
            card = group.locator('[data-target-id="metropolitan-rail"]')
            expect(card.locator('[data-reputation-met]')).to_have_attribute('data-reputation-met', 'false')
            assert listed['reputation'] < 88
            shown_reputation = f"{int(listed['reputation'] * 10) / 10:.1f}"
            expect(card).to_contain_text(f'ブランド評価 {shown_reputation} / 必要 88.0')
            expect(button(card, '買収する')).to_be_disabled()
            expect(card).to_contain_text('店舗の満足度と全社の黒字・赤字')
            page.set_viewport_size({'width': 390, 'height': 844})
            card.scroll_into_view_if_needed()
            fit(card, 'mobile-locked-final-rail-card')
            snapshot('28b-ordinary-earned-rail-gate-mobile')
            button(card, '店舗の営業実績を確認').click()
            expect(current().get_by_role('heading', name='店舗経営', exact=True)).to_be_visible()
            expect(current().locator('.store-grid > article')).to_have_count(len(listed['stores']))
            expect(current()).to_contain_text(shown_reputation)
            button(current(), 'この店を経営').first.click()
            panel = page.locator('.store-management')
            panel.locator('.store-management-purposes button').filter(has_text='営業実績').click()
            expect(panel).to_contain_text('満足度と全社の黒字・赤字が、毎週のブランド評価に影響します')
            snapshot('28c-brand-condition-to-actual-store-results')
            page.set_viewport_size(data['viewport'])
            assert export_state('28d-rail-gate-view-only') == listed and rows() == listed_rows
            ok('Ordinary earned company sees exact unmet final-rail reputation requirement and disabled purchase; 390px card routes to owned-store actual results without changing state/save')

        else:
            data.setdefault('unrun', []).append('Eligible IPO execution: no ordinary-action --ipo-fixture supplied; fresh unmet-condition physical route was tested')

        legacy = import_state(Path(a.legacy_save))
        assert export_state('29-old-32-site-save-exact-export') == legacy
        listing = site_list()
        expect(listing.locator('[data-lot-id]')).to_have_count(48)
        listing.locator(f'[data-lot-id="{outer[-1]}"]').click()
        assert export_state('30-legacy-new-outer-site-view-only') == legacy
        snapshot('31-legacy-save-current-map')
        ok('Old ordinary native v0.5.0 save imports/exports exactly while all 48 current sites and new outer plots remain accessible')
        page.wait_for_load_state('networkidle')
        data['cspViolations'] = page.evaluate('window.__qaCsp')
        assert not errors and not warnings and not failures
        assert not [response for response in responses if response['status'] >= 400]
        assert not data['cspViolations']
        passed = True
    except Exception:
        data['failure'] = traceback.format_exc()
        print(data['failure'], flush=True)
        try:
            snapshot('failure')
        except Exception:
            pass
    finally:
        data['responses'], data['requestFailures'] = responses, failures
        try:
            data['cspViolations'] = page.evaluate('window.__qaCsp')
            (OUT / 'last-stored-rows.json').write_text(json.dumps(rows(), ensure_ascii=False, indent=2) + '\n')
        except Exception:
            pass
        (OUT / 'service-click-points.json').write_text(json.dumps({'viewport': data['viewport'], 'points': data['servicePoints'], 'method': 'Read-only native marker projection followed by real mouseclick; no camera mutation'}, ensure_ascii=False, indent=2) + '\n')
        (OUT / 'results.json').write_text(json.dumps({'passed': passed, 'checks': checks, 'errors': errors, 'warnings': warnings, 'data': data, 'url': a.url, 'method': __doc__}, ensure_ascii=False, indent=2) + '\n')
        context.close()
        if not a.profile:
            shutil.rmtree(profile, ignore_errors=True)
        if server:
            server.shutdown()
            server.server_close()
if not passed:
    raise SystemExit(1)
