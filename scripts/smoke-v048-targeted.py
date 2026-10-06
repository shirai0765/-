#!/usr/bin/env python3
"""Real-App 0.4.8 recovery/guide QA with explicitly labeled persistence faults.

Normal-sandbox Firefox, real Three scene and native RAF. Controlled faults only:
IndexedDB checksum corruption/backup removal, and one deferred native SHA digest.
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
ap.add_argument('--out', default='/workspace/shared/shibuya-artifacts/targeted-0.4.8/production')
ap.add_argument('--profile')
ap.add_argument('--production-csp', action='store_true')
ap.add_argument('--guide-only', action='store_true', help='Only normal established-company import, contextual guide, reload and manual Help; no persistence faults')
ap.add_argument('--legacy-save', default=str(ROOT / 'tests/fixtures/legacy-0.3.2-envelope.json'))
a = ap.parse_args()
OUT = Path(a.out)
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, warnings, responses, external, confirms = [], [], [], [], [], []
data, complete, server, csp = {'faultInjection':[], 'assetWaits':[], 'requestFailures':[], 'consoleErrorEvents':[]}, False, None, None
started, phase = time.monotonic(), 'startup'
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


def close(page):
    dialogs(page).locator(':scope > section > header > button[aria-label="閉じる"]').click()
    expect(dialogs(page)).to_have_count(0)


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


def shot(page, name):
    page.screenshot(path=str(OUT / (name + '.png')))


def passed(message):
    global phase
    checks.append(message)
    print('PASS', message, flush=True)
    phase = 'after category ' + str(len(checks))


def settle_assets(page, label):
    global phase
    phase = label + ': waiting for native network idle'
    before = time.monotonic()
    page.wait_for_load_state('networkidle', timeout=30000)
    page.evaluate('()=>document.fonts.ready')
    data['assetWaits'].append({'phase':label, 'elapsedSeconds':round(time.monotonic()-before, 3),
                              'documentReadyState':page.evaluate('document.readyState'), 'responsesObserved':len(responses)})


def reload_settled(page):
    global phase
    label = 'planned reload ' + str(len(data['assetWaits']) + 1)
    settle_assets(page, label)
    phase = label + ': navigation'
    page.reload()


def import_file(page, path, confirm=None):
    previous = len(confirms)
    if confirm is not None:
        def answer(native):
            confirms.append({'message':native.message, 'accepted':confirm})
            native.accept() if confirm else native.dismiss()
        page.once('dialog', answer)
    with page.expect_file_chooser() as chosen:
        button(page, '保存ファイルを読み込む').click()
    chosen.value.set_files(str(path))
    if confirm is not None:
        assert len(confirms) == previous + 1
        assert '読み取れない現在のセーブ' in confirms[-1]['message']


def corrupt_primary(page, name):
    before = rows(page)
    page.evaluate("""() => new Promise((resolve,reject) => {
      const q=indexedDB.open('shibuya-capital-v1',1);q.onsuccess=()=>{
        const db=q.result,tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),r=store.getAll();
        r.onsuccess=()=>{for(const row of r.result){if(row.key==='primary'){
          row.envelope.checksum='0'.repeat(64);store.put(row)
        }else if(row.key.startsWith('backup:'))store.delete(row.key)}};
        tx.oncomplete=()=>{db.close();resolve()};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error)};
      };q.onerror=reject;
    })""")
    after = rows(page)
    assert len(after) == 1 and after[0]['key'] == 'primary'
    original = next(row for row in before if row['key'] == 'primary')
    expected = json.loads(json.dumps(original))
    expected['envelope']['checksum'] = '0' * 64
    assert after == [expected]
    data['faultInjection'].append({'case':name, 'fault':'primary checksum=64 zeroes; backup rows removed',
                                 'revision':after[0]['revision'], 'payloadUnchanged':True})
    return after


def recovery_warning(page):
    warning = page.locator('.welcome-actions .warning[role="alert"]')
    expect(warning).to_contain_text('現在のセーブを読み取れません')
    expect(warning).to_contain_text('置き換えを確定するまで、現在のデータは変更しません')
    return warning


def arm_digest(page, name):
    page.evaluate("()=>{window.__qaDigest.armed=true}")
    data['faultInjection'].append({'case':name, 'fault':'defer one SHA digest, then forward original native digest unchanged'})


def await_digest(page):
    page.wait_for_function('window.__qaDigest.held===true')
    expect(page.locator('.welcome-actions [role="status"]')).to_have_text('会社データを保存・読み込み中…')


def release_digest(page):
    page.evaluate('()=>window.__qaDigest.release()')


def continue_button(page, company):
    return page.locator('.welcome-actions > button').filter(has_text=company + ' を続ける')


def guide(page, context, destination):
    current = dialogs(page).filter(has=page.locator('.first-play-steps'))
    expect(current.locator('.first-play-steps')).to_have_attribute('data-guide-context', context)
    expect(current.locator('[data-guide-destination]')).to_have_attribute('data-guide-destination', destination)
    return current


profile = Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix='targeted-v048-firefox-', dir='/tmp'))
with sync_playwright() as pw:
    context = pw.firefox.launch_persistent_context(str(profile), headless=False, timeout=30000,
        viewport={'width':1000, 'height':760}, firefox_user_prefs={'webgl.force-enabled':True, 'gfx.webrender.software':True})
    origin = urlsplit(a.url)
    def route(request):
        url = urlsplit(request.request.url)
        if (url.scheme, url.netloc) == (origin.scheme, origin.netloc) or url.scheme in ['blob','data']:
            request.continue_()
        else:
            external.append(request.request.url)
            request.abort('blockedbyclient')
    context.route('**/*', route)
    context.add_init_script("""
      window.__qaCsp=[];addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
      window.__qaDigest={armed:false,held:false,release:null};
      const nativeDigest=crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest=(...args)=>{
        if(!window.__qaDigest.armed)return nativeDigest(...args);
        window.__qaDigest.armed=false;window.__qaDigest.held=true;
        return new Promise((resolve,reject)=>{window.__qaDigest.release=()=>{
          window.__qaDigest.held=false;window.__qaDigest.release=null;nativeDigest(...args).then(resolve,reject);
        }});
      };
    """)
    page = context.new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    def console_event(message):
        if message.type == 'error':
            errors.append(message.text)
            data['consoleErrorEvents'].append({'text':message.text, 'location':message.location,
                                              'phase':phase, 'seconds':round(time.monotonic()-started, 3), 'pageURL':page.url})
        elif message.type == 'warning':
            warnings.append(message.text)
    page.on('console', console_event)
    page.on('requestfailed', lambda request: data['requestFailures'].append({'url':request.url, 'failure':request.failure,
                          'phase':phase, 'seconds':round(time.monotonic()-started, 3), 'resourceType':request.resource_type}))
    page.on('response', lambda response: responses.append({'url':response.url, 'status':response.status}))
    try:
        response = page.goto(a.url, wait_until='domcontentloaded')
        assert response and response.status == 200
        if csp:
            assert response.headers.get('content-security-policy') == csp
        legacy_path = Path(a.legacy_save)
        legacy_envelope = json.loads(legacy_path.read_text())
        legacy = json.loads(legacy_envelope['payload'])
        data['legacyFixtureSHA256'] = hashlib.sha256(legacy_path.read_bytes()).hexdigest()
        expect(button(page, '保存ファイルを読み込む')).to_be_enabled()
        import_file(page, legacy_path)
        reported = guide(page, 'reported', 'report')
        expect(reported.get_by_role('heading', name='この会社で続ける', exact=True)).to_be_visible()
        assert state(page) == legacy
        settle_assets(page, 'initial established company')
        shot(page, '01-fresh-established-context-guide')
        button(reported, '営業結果を見る').click()
        expect(dialogs(page).get_by_role('heading', name='第1週の営業結果', exact=True)).to_be_visible()
        assert page.evaluate("localStorage.getItem('shibuya-first-play-guide-v1')") == 'seen'
        assert state(page) == legacy
        close(page)
        reload_settled(page)
        continue_button(page, legacy['companyName']).click()
        expect(page.locator('.immersive-game')).to_be_visible()
        expect(dialogs(page)).to_have_count(0)
        button(page, '経営').click()
        button(dialogs(page), '遊び方').click()
        reported = guide(page, 'reported', 'report')
        button(reported, '営業結果を見る').click()
        expect(dialogs(page).get_by_role('heading', name='第1週の営業結果', exact=True)).to_be_visible()
        assert state(page) == legacy
        close(page)
        passed('Fresh-browser established-company guide routes to its report; global seen suppression and manual Help preserve exact company data')

        if not a.guide_only:
            damaged = corrupt_primary(page, 'cancel-and-invalid-import')
            reload_settled(page)
            warning = recovery_warning(page)
            expect(continue_button(page, legacy['companyName'])).to_have_count(0)
            if page.locator('.toast').count():
                page.locator('.toast > button[aria-label="閉じる"]').click()
            expect(warning).to_be_visible()
            assert rows(page) == damaged
            page.set_viewport_size({'width':390,'height':844})
            shot(page, '02-persistent-mobile-recovery-explanation')
            button(page, '新しい会社を設立').click()
            expect(dialogs(page)).to_contain_text('読み取れない現在のセーブを新しい会社で置き換えます')
            page.keyboard.press('Escape')
            expect(dialogs(page)).to_have_count(0)
            assert rows(page) == damaged
            import_file(page, legacy_path, confirm=False)
            assert rows(page) == damaged
            invalid_path = OUT / 'malformed-input.json'
            invalid_path.write_text('{broken')
            import_file(page, invalid_path, confirm=True)
            expect(page.locator('.toast')).to_contain_text('有効なセーブJSON')
            expect(warning).to_be_visible()
            assert rows(page) == damaged
            passed('Fault-injected corrupt primary without backups shows persistent recovery explanation; canceled new/import and invalid import leave every row untouched')

            import_file(page, legacy_path, confirm=True)
            expect(page.locator('.immersive-game')).to_be_visible()
            expect(page.locator('.toast')).to_contain_text('会社データを読み込みました')
            assert state(page) == legacy and primary(page)['revision'] == damaged[0]['revision'] + 1
            reload_settled(page)
            expect(page.locator('.welcome-actions .warning')).to_have_count(0)
            expect(continue_button(page, legacy['companyName'])).to_be_enabled()
            passed('Explicit valid import replaces only the observed damaged revision and reloads an exact legacy company normally')

            before = rows(page)
            arm_digest(page, 'pending-welcome-import')
            import_file(page, legacy_path)
            await_digest(page)
            expect(continue_button(page, legacy['companyName'])).to_be_disabled()
            expect(button(page, '新しい会社を設立')).to_be_disabled()
            expect(page.locator('input[type="file"]')).to_be_disabled()
            page.keyboard.press('Escape')
            expect(page.locator('.immersive-game')).to_have_count(0)
            assert rows(page) == before
            shot(page, '03-pending-import-continue-disabled')
            release_digest(page)
            expect(page.locator('.immersive-game')).to_be_visible()
            assert state(page) == legacy and primary(page)['revision'] == next(row for row in before if row['key']=='primary')['revision'] + 1
            expect(page.get_by_role('status')).to_have_count(0)
            passed('Deferred native digest import keeps old Continue and competing actions disabled; original native digest completes one exact commit')

            damaged = corrupt_primary(page, 'explicit-new-company')
            reload_settled(page)
            recovery_warning(page)
            page.get_by_label('会社名', exact=True).fill('復旧して設立した会社')
            button(page, '新しい会社を設立').click()
            button(dialogs(page), '設立する').click()
            expect(page.locator('.immersive-game')).to_be_visible()
            created = state(page)
            assert created['companyName'] == '復旧して設立した会社' and created['week'] == 1 and created['cash'] == 12000000 and created['stores'] == []
            assert primary(page)['revision'] == damaged[0]['revision'] + 1
            expect(dialogs(page)).to_have_count(0)
            reload_settled(page)
            expect(continue_button(page, created['companyName'])).to_be_enabled()
            expect(page.locator('.welcome-actions .warning')).to_have_count(0)
            passed('Explicit confirmed new company replaces corrupt data successfully; global guide-seen preference remains respected')

            before = rows(page)
            page.get_by_label('会社名', exact=True).fill('保存待ち中の新会社')
            button(page, '新しい会社を設立').click()
            arm_digest(page, 'pending-confirmed-new-company-save')
            button(dialogs(page), '設立する').click()
            await_digest(page)
            expect(continue_button(page, created['companyName'])).to_be_disabled()
            expect(button(dialogs(page), '保存中…')).to_be_disabled()
            page.keyboard.press('Escape')
            expect(dialogs(page)).to_have_count(1)
            assert dialogs(page).evaluate('(e)=>e.matches(":modal")')
            dialogs(page).locator(':scope > section > header > button[aria-label="閉じる"]').click()
            expect(dialogs(page)).to_have_count(1)
            assert rows(page) == before
            shot(page, '04-pending-new-company-native-close-guard')
            release_digest(page)
            expect(page.locator('.immersive-game')).to_be_visible()
            newest = state(page)
            assert newest['companyName'] == '保存待ち中の新会社' and newest['id'] != created['id']
            assert primary(page)['revision'] == next(row for row in before if row['key']=='primary')['revision'] + 1
            button(page, '経営').click()
            button(dialogs(page), '遊び方').click()
            empty = guide(page, 'empty', 'sites')
            button(empty, '出店場所を見る').click()
            expect(dialogs(page).locator('.site-list button')).to_have_count(32)
            assert state(page) == newest
            shot(page, '05-empty-company-manual-guide-sites-action')
            close(page)
            passed('Deferred new-company save guards native Escape/header close and disables old Continue; empty-company manual guide opens sites without altering the new save')

        settle_assets(page, 'final company assets')
        assert not errors, errors
        assert not external, external
        assert not [response for response in responses if response['status']>=400]
        assert not page.evaluate('window.__qaCsp')
        complete = True
    except Exception:
        data['failure'] = traceback.format_exc()
        print(data['failure'], flush=True)
        try:
            shot(page, 'failure')
        except Exception:
            pass
    finally:
        data['responses'], data['externalRequests'], data['nativeConfirmations'] = responses, external, confirms
        try:
            data['cspViolations'] = page.evaluate('window.__qaCsp')
            (OUT / 'last-stored-rows.json').write_text(json.dumps(rows(page), ensure_ascii=False, indent=2))
        except Exception:
            pass
        (OUT / 'results.json').write_text(json.dumps({'passed':complete, 'checks':checks, 'errors':errors, 'warnings':warnings,
            'data':data, 'url':a.url, 'guideOnly':a.guide_only, 'method':'normal-sandbox native Firefox/Mesa; actual App, scenes, RAF, and UI file chooser/confirmations; explicitly labeled IndexedDB checksum/backup and native crypto delay faults only; no scene/RAF/TLS overrides'}, ensure_ascii=False, indent=2))
        context.close()
        if not a.profile:
            shutil.rmtree(profile, ignore_errors=True)
        if server:
            server.shutdown()
            server.server_close()
if not complete:
    raise SystemExit(1)
