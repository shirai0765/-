#!/usr/bin/env python3
"""Two changed 0.4.9 flows in the real App and normal-sandbox Firefox.

Import a labeled, valid display fixture through the native file chooser. No
scene, RAF, persistence, crypto, or browser-security overrides. No IPO is run.
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
FIXTURES = Path('/workspace/shared/shibuya-artifacts/targeted-0.4.9/fixtures')
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://127.0.0.1:5173')
ap.add_argument('--out', default='/workspace/shared/shibuya-artifacts/targeted-0.4.9/production')
ap.add_argument('--profile', help='Optional temporary profile with ordinary CA trust for public HTTPS')
ap.add_argument('--production-csp', action='store_true', help='Serve the already built dist with the desktop CSP')
ap.add_argument('--fixture', default=str(FIXTURES / 'unlisted-three-store.json'))
ap.add_argument('--expected', default=str(FIXTURES / 'expected.json'))
a = ap.parse_args()
OUT = Path(a.out)
OUT.mkdir(parents=True, exist_ok=True)
facts = json.loads(Path(a.expected).read_text())
fixture = Path(a.fixture)
assert hashlib.sha256(fixture.read_bytes()).hexdigest() == facts['envelopeSHA256']
checks, errors, warnings, responses, external = [], [], [], [], []
data = {'fixtureMethod':facts['method'], 'fixtureSHA256':facts['envelopeSHA256'],
        'assetWaits':[], 'requestFailures':[], 'consoleErrorEvents':[]}
started, phase, complete, server, csp = time.monotonic(), 'startup', False, None, None
if a.production_csp:
    csp = re.search(r'const csp = "([^"]+)";', (ROOT / 'desktop/main.cjs').read_text()).group(1)
    assert "'wasm-unsafe-eval'" in csp and "'unsafe-eval'" not in csp
    class Handler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm':'application/wasm', '.woff2':'font/woff2'}
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


def rows(page):
    return page.evaluate("""() => new Promise((resolve,reject) => {
      const q=indexedDB.open('shibuya-capital-v1',1);q.onsuccess=()=>{
        const db=q.result,r=db.transaction('saves').objectStore('saves').getAll();
        r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=reject};q.onerror=reject;
    })""")


def state(page):
    return json.loads(next(row for row in rows(page) if row['key']=='primary')['envelope']['payload'])


def open_menu(page):
    button(page, '経営').click()
    current = page.locator('dialog[open]:has(.game-menu)')
    expect(current).to_have_count(1)
    assert current.evaluate('(e)=>e.matches(":modal")')
    return current


def menu_offer_name(count):
    return '営業・提案' + (f' {count}件' if count else '')


def settle_assets(page, label):
    global phase
    phase = label + ': native network idle'
    before = time.monotonic()
    page.wait_for_load_state('networkidle', timeout=30000)
    page.evaluate('()=>document.fonts.ready')
    data['assetWaits'].append({'phase':label, 'elapsedSeconds':round(time.monotonic()-before, 3),
                              'documentReadyState':page.evaluate('document.readyState'), 'responsesObserved':len(responses)})


def passed(message):
    global phase
    checks.append(message)
    print('PASS', message, flush=True)
    phase = 'after category ' + str(len(checks))


profile = Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix='targeted-v049-firefox-', dir='/tmp'))
with sync_playwright() as pw:
    context = pw.firefox.launch_persistent_context(str(profile), headless=False, timeout=30000,
        viewport={'width':390, 'height':844}, firefox_user_prefs={'webgl.force-enabled':True, 'gfx.webrender.software':True})
    origin = urlsplit(a.url)
    def route(request):
        url = urlsplit(request.request.url)
        if (url.scheme, url.netloc)==(origin.scheme, origin.netloc) or url.scheme in ['blob','data']:
            request.continue_()
        else:
            external.append(request.request.url)
            request.abort('blockedbyclient')
    context.route('**/*', route)
    context.add_init_script("window.__qaCsp=[];addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
    page = context.new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    def console_event(message):
        if message.type=='error':
            errors.append(message.text)
            data['consoleErrorEvents'].append({'text':message.text, 'location':message.location,
                'phase':phase, 'seconds':round(time.monotonic()-started,3), 'pageURL':page.url})
        elif message.type=='warning':
            warnings.append(message.text)
    page.on('console', console_event)
    page.on('requestfailed', lambda request: data['requestFailures'].append({'url':request.url, 'failure':request.failure,
        'phase':phase, 'seconds':round(time.monotonic()-started,3), 'resourceType':request.resource_type}))
    page.on('response', lambda response: responses.append({'url':response.url, 'status':response.status}))
    try:
        response = page.goto(a.url, wait_until='domcontentloaded')
        assert response and response.status==200
        if csp:
            assert response.headers.get('content-security-policy')==csp
        expect(button(page, '保存ファイルを読み込む')).to_be_enabled()
        with page.expect_file_chooser() as chosen:
            button(page, '保存ファイルを読み込む').click()
        chosen.value.set_files(str(fixture))
        expect(page.locator('.immersive-game')).to_be_visible()
        guide = page.locator('dialog[open]:has(.first-play-steps)')
        expect(guide.locator('.first-play-steps')).to_have_attribute('data-guide-context','reported')
        button(guide, '説明を閉じる').click()
        expect(dialogs(page)).to_have_count(0)
        settle_assets(page, 'imported real scene before changed UI')
        assert state(page)==facts['state']
        original_rows = rows(page)
        phase = 'mobile growth and read-only IPO comparison'
        menu = open_menu(page)
        expect(button(menu, menu_offer_name(facts['offerCount']))).to_be_visible()
        close_dialog(menu)
        assert rows(page)==original_rows
        menu = open_menu(page)
        button(menu, '成長戦略').click()
        growth = page.locator('dialog[open]:has(.progression-panel)')
        expect(growth).to_have_count(1)
        capital = growth.locator('section[data-capital-kind="ipo"]')
        expect(capital).to_contain_text('現在の上場条件を満たしています')
        expect(capital).not_to_contain_text('投資額')
        expect(capital).not_to_contain_text('目標まであと')
        optional = growth.locator('[data-roadmap-step="property"]')
        expect(optional.locator('.eyebrow')).to_have_text('上場前は任意')
        assert 'is-next' not in (optional.get_attribute('class') or '')
        ipo = growth.locator('[data-roadmap-step="ipo"]')
        expect(ipo).to_have_class('is-next')
        expect(ipo.locator('[data-ipo-requirement]')).to_have_count(4)
        for index, requirement in enumerate(facts['requirements'],1):
            row = ipo.locator(f'[data-ipo-requirement="{index}"]')
            expect(row).to_contain_text(requirement['text'])
            expect(row).to_have_attribute('data-met',str(requirement['met']).lower())
        data['mobileGrowthDimensions'] = growth.locator('.progression-panel').evaluate('(e)=>({width:e.clientWidth,scrollWidth:e.scrollWidth})')
        assert data['mobileGrowthDimensions']['scrollWidth'] <= data['mobileGrowthDimensions']['width']+1
        ipo.scroll_into_view_if_needed()
        ipo.screenshot(path=str(OUT / '01-mobile-actual-ipo-requirements.png'))
        optional.screenshot(path=str(OUT / '02-property-optional-before-ipo.png'))
        assert rows(page)==original_rows
        button(capital, '公開条件と資金を確認').click()
        finance = page.locator('dialog[open]:has(.capital-planning)')
        expect(finance).to_have_count(1)
        expect(finance.locator('.capital-planning')).to_be_visible()
        button(finance.locator('.capital-options'), re.compile('^株式公開する')).click()
        expect(finance.locator('.capital-key-values')).to_contain_text('80.0%')
        expect(finance.locator('.capital-submit')).to_be_enabled()
        finance.locator('.capital-options').screenshot(path=str(OUT / '03-ipo-preview-only.png'))
        assert rows(page)==original_rows and state(page)['listed'] is False
        close_dialog(finance)
        assert rows(page)==original_rows
        passed('390px growth view shows all four current IPO facts and optional property, selects IPO as the next goal, and opens/chooses an IPO comparison without saving or listing the company')

        phase = 'available offer badge and one explicit decline'
        menu = open_menu(page)
        expect(button(menu, menu_offer_name(facts['offerCount']))).to_be_visible()
        menu.screenshot(path=str(OUT / '04-menu-current-offer-count.png'))
        button(menu, menu_offer_name(facts['offerCount'])).click()
        deals = page.locator('dialog[open]:has(.deals-panel)')
        expect(deals.locator('.deal-card')).to_have_count(facts['offerCount'])
        expect(deals.locator('.summary-strip .metric').first).to_contain_text(f"{facts['offerCount']} 件")
        assert rows(page)==original_rows
        offer = deals.locator('.deal-card').filter(has=page.get_by_role('heading',name=facts['declinedOfferTitle'],exact=True))
        expect(offer).to_have_count(1)
        button(offer, '見送る').click()
        confirmation = page.locator('dialog[open]:has(> section.deal-modal)')
        expect(confirmation.get_by_role('heading',name='提案を見送る',exact=True)).to_be_visible()
        assert confirmation.evaluate('(e)=>e.matches(":modal")')
        expect(confirmation).to_contain_text('費用は発生しません')
        assert rows(page)==original_rows
        button(confirmation, 'この提案を見送る').click()
        expect(confirmation).to_have_count(0)
        expect(deals.locator('.deal-card')).to_have_count(facts['remainingOfferCount'])
        expect(deals.locator('.summary-strip .metric').first).to_contain_text(f"{facts['remainingOfferCount']} 件")
        close_dialog(deals)
        menu = open_menu(page)
        expect(button(menu,menu_offer_name(facts['remainingOfferCount']))).to_be_visible()
        menu.screenshot(path=str(OUT / '05-menu-updated-after-decline.png'))
        assert rows(page)==original_rows
        close_dialog(menu)
        data['offerCountBefore'],data['offerCountAfter'] = facts['offerCount'],facts['remainingOfferCount']
        data['declinePersistence'] = 'The explicit decline updates the current App; no automatic save is requested by this action. All saved rows remain unchanged through menu/comparison/decline browsing.'
        passed('Menu badge equals currently available offer cards, and one native confirmed decline updates both the cards and reopened menu count; opening/closing views and the IPO preview never write the save')

        settle_assets(page,'final real scene before teardown')
        assert not errors,errors
        assert not warnings,warnings
        assert not external,external
        assert not data['requestFailures'],data['requestFailures']
        assert not [response for response in responses if response['status']>=400]
        assert not page.evaluate('window.__qaCsp')
        complete = True
    except Exception:
        data['failure'] = traceback.format_exc()
        print(data['failure'],flush=True)
        try:
            page.screenshot(path=str(OUT / 'failure.png'))
        except Exception:
            pass
    finally:
        data['responses'],data['externalRequests'] = responses,external
        try:
            data['cspViolations'] = page.evaluate('window.__qaCsp')
            (OUT / 'last-stored-rows.json').write_text(json.dumps(rows(page),ensure_ascii=False,indent=2)+'\n')
        except Exception:
            pass
        (OUT / 'results.json').write_text(json.dumps({'passed':complete,'checks':checks,'errors':errors,'warnings':warnings,
            'data':data,'url':a.url,'method':'normal-sandbox native Firefox/Mesa; real App, Three scene, RAF, native dialogs and UI file chooser. Labeled valid synthetic display fixture; no persistence/crypto/scene/RAF/TLS mocks; no IPO transaction.'},ensure_ascii=False,indent=2)+'\n')
        context.close()
        if not a.profile:
            shutil.rmtree(profile,ignore_errors=True)
        if server:
            server.shutdown()
            server.server_close()
if not complete:
    raise SystemExit(1)
