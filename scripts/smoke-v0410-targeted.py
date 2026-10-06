#!/usr/bin/env python3
"""Two changed 0.4.10 flows in the real App and normal-sandbox Firefox.

Import ordinary-action fixtures through the native file chooser. No scene,
RAF, persistence, crypto or browser-security overrides; real weekly saves.
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
FIXTURES = Path('/workspace/shared/shibuya-artifacts/targeted-0.4.10/fixtures')
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://127.0.0.1:5173')
ap.add_argument('--out', default='/workspace/shared/shibuya-artifacts/targeted-0.4.10/production')
ap.add_argument('--profile', help='Optional temporary profile with ordinary CA trust for public HTTPS')
ap.add_argument('--production-csp', action='store_true', help='Serve the already built dist with the desktop CSP')
ap.add_argument('--batch-only', action='store_true', help='Only the affected managed-week policy/save slice; default exercises both changed slices')
ap.add_argument('--store-fixture', default=str(FIXTURES / 'store-settings.json'))
ap.add_argument('--batch-fixture', default=str(FIXTURES / 'batch-policy.json'))
ap.add_argument('--expected', default=str(FIXTURES / 'expected.json'))
a = ap.parse_args()
OUT = Path(a.out)
OUT.mkdir(parents=True, exist_ok=True)
facts = json.loads(Path(a.expected).read_text())
store_fixture,batch_fixture = Path(a.store_fixture),Path(a.batch_fixture)
assert hashlib.sha256(store_fixture.read_bytes()).hexdigest()==facts['storeFixtureSHA256']
assert hashlib.sha256(batch_fixture.read_bytes()).hexdigest()==facts['batchFixtureSHA256']
checks, errors, warnings, responses, external = [], [], [], [], []
data = {'fixtureMethod':facts['fixtureMethod'], 'storeFixtureSHA256':facts['storeFixtureSHA256'], 'batchFixtureSHA256':facts['batchFixtureSHA256'],
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


def primary(page):
    return next(row for row in rows(page) if row['key']=='primary')


def import_fixture(page,path,welcome=False):
    settle_assets(page,'before native fixture import')
    if welcome:
        trigger=button(page,'保存ファイルを読み込む')
    else:
        menu=open_menu(page)
        button(menu,'設定・保存').click()
        settings=page.locator('dialog[open]:has(.stack-buttons)')
        trigger=button(settings,'ファイルから読み込む')
        def confirm(native):
            data.setdefault('nativeConfirmations',[]).append(native.message)
            assert '現在の会社を読み込むファイルの内容で置き換えます' in native.message
            native.accept()
        page.once('dialog',confirm)
    with page.expect_file_chooser() as chosen:
        trigger.click()
    chosen.value.set_files(str(path))
    expect(page.locator('.immersive-game')).to_be_visible()
    expect(page.locator('.toast')).to_contain_text('会社データを読み込みました')
    guide=page.locator('dialog[open]:has(.first-play-steps)')
    if welcome:
        expect(guide).to_have_count(1)
    if guide.count():
        button(guide,'説明を閉じる').click()
    expect(dialogs(page)).to_have_count(0)


def manage_store(page):
    menu=open_menu(page)
    button(menu,'店舗経営').click()
    listing=page.locator('dialog[open]:has(.store-grid)')
    button(listing,'この店を経営').click()
    expect(page.locator('.store-management')).to_have_attribute('data-store-id',facts['storeId'])
    return page.locator('.store-management')


def purpose(panel,name,identifier):
    if panel.get_attribute('data-store-purpose')!='home':
        button(panel,'店舗トップへ').click()
    panel.locator('.store-management-purposes').get_by_role('button',name=re.compile('^'+re.escape(name))).click()
    expect(panel).to_have_attribute('data-store-purpose',identifier)


def feedback(panel,expected,identifier):
    current=panel.locator('.store-plan-feedback')
    expect(current).to_have_count(1)
    expect(current).to_have_attribute('data-feedback-group',identifier)
    expect(current.locator('.store-plan-feedback-range')).to_have_text(expected['text'])
    expect(current).to_contain_text('店舗利益見込み／週')
    expect(current).to_contain_text('第2週 · 反映済みの設定')
    expect(current).to_contain_text('本部費・利息などは含みません')
    return current


def fit(locator,label):
    dimensions=locator.evaluate('(e)=>({width:e.clientWidth,scrollWidth:e.scrollWidth})')
    data.setdefault('mobileBounds',{})[label]=dimensions
    assert dimensions['scrollWidth']<=dimensions['width']+1,dimensions


def week_dialog(page):
    page.locator('.hud-next-week').click()
    current=page.locator('dialog[open]:has(.week-intro)')
    expect(current).to_have_count(1)
    return current


def observe_busy(page):
    # Read-only DOM observation records short native saves without slowing them.
    page.evaluate("""() => {
      window.__qaBatchObservations=[];
      const record=()=>{
        const input=document.querySelector('input[aria-describedby="managed-offer-policy"]');
        const status=document.querySelector('.batch-progress');
        if(input?.disabled && status)window.__qaBatchObservations.push({disabled:input.disabled,status:status.textContent});
      };
      window.__qaBatchObserver=new MutationObserver(record);
      window.__qaBatchObserver.observe(document.body,{subtree:true,childList:true,attributes:true});record();
    }""")


def finish_observation(page,label):
    observations=page.evaluate('()=>{window.__qaBatchObserver.disconnect();return window.__qaBatchObservations}')
    assert observations, 'No native busy/disabled DOM state was observed'
    data.setdefault('busyObservations',{})[label]=observations


def batch_report(page,count):
    current=page.locator('dialog[open]').filter(has=page.get_by_role('heading',name='連続営業の報告',exact=True))
    expect(current).to_have_count(1)
    expect(current).to_contain_text(f'{count} 週間の営業を完了しました')
    expect(current.locator('table tbody tr')).to_have_count(count)
    return current


profile = Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix='targeted-v0410-firefox-',dir='/tmp'))
with sync_playwright() as pw:
    context=pw.firefox.launch_persistent_context(str(profile),headless=False,timeout=30000,
        viewport={'width':390,'height':844},firefox_user_prefs={'webgl.force-enabled':True,'gfx.webrender.software':True})
    origin=urlsplit(a.url)
    def route(request):
        url=urlsplit(request.request.url)
        if (url.scheme,url.netloc)==(origin.scheme,origin.netloc) or url.scheme in ['blob','data']:
            request.continue_()
        else:
            external.append(request.request.url);request.abort('blockedbyclient')
    context.route('**/*',route)
    context.add_init_script("window.__qaCsp=[];addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
    page=context.new_page();page.set_default_timeout(30000)
    page.on('pageerror',lambda error:errors.append(str(error)))
    def console_event(message):
        if message.type=='error':
            errors.append(message.text)
            data['consoleErrorEvents'].append({'text':message.text,'location':message.location,'phase':phase,'seconds':round(time.monotonic()-started,3),'pageURL':page.url})
        elif message.type=='warning':warnings.append(message.text)
    page.on('console',console_event)
    page.on('requestfailed',lambda request:data['requestFailures'].append({'url':request.url,'failure':request.failure,'phase':phase,'seconds':round(time.monotonic()-started,3),'resourceType':request.resource_type}))
    page.on('response',lambda response:responses.append({'url':response.url,'status':response.status}))
    try:
        response=page.goto(a.url,wait_until='domcontentloaded')
        assert response and response.status==200
        if csp:assert response.headers.get('content-security-policy')==csp
        expect(button(page,'保存ファイルを読み込む')).to_be_enabled()
        if not a.batch_only:
            import_fixture(page,store_fixture,welcome=True)
            settle_assets(page,'native store scene before settings')
            assert state(page)==facts['storeState']
            original_rows=rows(page)
            original_canvas=page.locator('.business-map canvas').element_handle()
            panel=manage_store(page)
            expect(panel.locator('.store-plan-feedback')).to_have_count(0)
            purpose(panel,'商品・価格','product')
            current=feedback(panel,facts['initial'],'product')
            fit(current,'initial-product')
            expect(panel.locator('.store-operating-insight')).not_to_have_attribute('open','')
            price=panel.locator('.store-management-field').filter(has_text='販売価格（円）').locator('input')
            price.fill('850')
            expect(panel.locator('.store-management-draft')).to_contain_text('編集中')
            feedback(panel,facts['initial'],'product')
            price.press('Enter')
            feedback(panel,facts['acceptedPrice'],'product')
            price.fill('9999');price.press('Enter')
            expect(price).to_have_attribute('aria-invalid','true')
            expect(panel.locator('.store-management-draft')).to_contain_text('現在の設定：850')
            feedback(panel,facts['acceptedPrice'],'product')
            current.screenshot(path=str(OUT/'01-rejected-price-keeps-accepted-forecast.png'))
            price.fill('850');price.press('Enter')
            assert rows(page)==original_rows
            purpose(panel,'人員・店長','people')
            feedback(panel,facts['acceptedPrice'],'people')
            staff=panel.locator('.store-management-field').filter(has_text='従業員数').locator('input')
            staff.fill('5');feedback(panel,facts['acceptedPrice'],'people')
            staff.press('Enter');feedback(panel,facts['acceptedStaff'],'people')
            panel.locator('label.toggle input[type="checkbox"]').check()
            current=feedback(panel,facts['acceptedManager'],'people')
            expect(current.locator('.store-plan-feedback-period')).to_contain_text('からの店長案')
            fit(current,'accepted-manager')
            current.screenshot(path=str(OUT/'02-manager-effective-current-store-profit.png'))
            purpose(panel,'広告・改装','promotion')
            current=feedback(panel,facts['acceptedManager'],'promotion')
            expect(panel.locator('.store-operating-insight')).not_to_have_attribute('open','')
            reasons=panel.locator('#store-insight-reasons-'+facts['lotId'])
            expect(reasons).not_to_have_attribute('open','')
            button(current,'見込みの理由').click()
            expect(reasons).to_have_attribute('open','')
            expect(panel.locator('.store-operating-insight')).to_have_attribute('open','')
            settings=panel.locator('.store-insight-manager-settings')
            effective=facts['acceptedManager']['insight']['effectiveSettings']
            for label,text in [('価格',f"{effective['price']:,}円"),('従業員数',f"{effective['staff']}人"),('品質',str(effective['quality'])),('広告費',f"{effective['marketing']:,}円／週")]:
                expect(settings.locator('div').filter(has=page.get_by_text(label,exact=True)).locator('dd')).to_have_text(text)
            fit(current,'promotion')
            panel.screenshot(path=str(OUT/'03-explicit-manager-reasons.png'))
            assert rows(page)==original_rows
            assert page.evaluate('(canvas)=>canvas===document.querySelector(".business-map canvas")',original_canvas)
            button(panel,'店舗トップへ').click()
            purpose(panel,'営業実績','results')
            expect(panel.locator('.store-plan-feedback')).to_have_count(0)
            expect(panel).to_contain_text('第1週に確定した')
            close_dialog(page.locator('dialog[open]:has(.store-management)'))
            menu=open_menu(page);button(menu,'設定・保存').click()
            settings_dialog=page.locator('dialog[open]:has(.stack-buttons)')
            with page.expect_download() as downloaded:
                button(settings_dialog,'保存ファイルを書き出す').click()
            export_path=OUT/'accepted-settings-export.json';downloaded.value.save_as(str(export_path))
            envelope=json.loads(export_path.read_text())
            assert hashlib.sha256(envelope['payload'].encode()).hexdigest()==envelope['checksum']
            exported=json.loads(envelope['payload'])
            assert exported==facts['managerState']
            assert exported['lastReport']==facts['storeState']['lastReport']
            assert rows(page)==original_rows
            close_dialog(settings_dialog)
            passed('390px product/people/promotion show one current store-profit range; pending/rejected drafts keep accepted values, accepted price/staff/manager match the effective plan, explicit reasons only open detail, and views/settings do not create results or write saves')

        import_fixture(page,batch_fixture,welcome=a.batch_only)
        assert state(page)==facts['batchState']
        before_checked=primary(page)['revision']
        week=week_dialog(page)
        expect(week.get_by_label('新しい営業提案で停止',exact=True)).to_have_count(0)
        week.locator('label').filter(has_text='営業を進める期間').locator('select').select_option('4')
        policy=week.get_by_label('新しい営業提案で停止',exact=True)
        expect(policy).to_be_checked()
        policy.uncheck();expect(week.locator('#managed-offer-policy')).to_contain_text('途中で提案の期限が過ぎる')
        close_dialog(week)
        week=week_dialog(page)
        week.locator('label').filter(has_text='営業を進める期間').locator('select').select_option('13')
        expect(week.locator('.week-intro')).to_have_text('お店に営業を任せて、結果を待ちましょう。')
        policy=week.get_by_label('新しい営業提案で停止',exact=True)
        expect(policy).to_be_checked()
        expect(week.locator('#managed-offer-policy')).to_contain_text('新しい提案が届くと')
        fit(week.locator('#managed-offer-policy'),'checked-policy')
        observe_busy(page)
        button(week,'最大13週間の営業を始める').click()
        report=batch_report(page,facts['checkedCount'])
        finish_observation(page,'checked')
        expect(report.locator('.warning')).to_contain_text('新しい営業提案')
        assert state(page)==facts['checkedState'] and primary(page)['revision']==before_checked+facts['checkedCount']
        report.screenshot(path=str(OUT/'04-checked-native-catalogue-stop.png'))
        close_dialog(report)
        import_fixture(page,batch_fixture)
        assert state(page)==facts['batchState']
        before_full=primary(page)['revision']
        week=week_dialog(page)
        week.locator('label').filter(has_text='営業を進める期間').locator('select').select_option('13')
        expect(week.locator('.week-intro')).to_have_text('お店に営業を任せて、結果を待ちましょう。')
        policy=week.get_by_label('新しい営業提案で停止',exact=True)
        expect(policy).to_be_checked();policy.uncheck()
        expect(week.locator('#managed-offer-policy')).to_contain_text('途中で提案の期限が過ぎる')
        week.screenshot(path=str(OUT/'05-unchecked-native-deadline-warning.png'))
        observe_busy(page)
        button(week,'最大13週間の営業を始める').click()
        report=batch_report(page,13)
        finish_observation(page,'unchecked')
        expect(report.locator('.warning')).to_have_count(0)
        assert state(page)==facts['finalBatchState'] and primary(page)['revision']==before_full+13
        backups=[json.loads(row['envelope']['payload']) for row in rows(page) if row['key'].startswith('backup:')]
        # Each save backs up its new snapshot, including the current primary.
        expected_backups={snapshot['week']:snapshot for snapshot in facts['batchWeeks'][-12:]}
        assert len(backups)==12 and {snapshot['week'] for snapshot in backups}==set(expected_backups)
        assert all(snapshot==expected_backups[snapshot['week']] for snapshot in backups)
        data['durableBatch']={'startWeek':facts['batchState']['week'],'checkedReports':facts['checkedCount'],'uncheckedReports':13,'revisionBefore':before_full,'revisionAfter':primary(page)['revision'],'backupWeeks':sorted(expected_backups),'finalWeek':facts['finalBatchState']['week']}
        report.screenshot(path=str(OUT/'06-thirteen-actual-weeks-saved.png'))
        close_dialog(report)
        exact_saved_rows=rows(page)
        settle_assets(page,'before planned durable-state reload')
        page.reload()
        page.locator('.welcome-actions > button').filter(has_text=facts['batchState']['companyName']+' を続ける').click()
        expect(page.locator('.immersive-game')).to_be_visible()
        expect(dialogs(page)).to_have_count(0)
        assert state(page)==facts['finalBatchState'] and rows(page)==exact_saved_rows
        week=week_dialog(page)
        expect(week.get_by_role('heading',name=f"第{facts['finalBatchState']['week']}週を営業する",exact=True)).to_be_visible()
        expect(week.get_by_label('新しい営業提案で停止',exact=True)).to_have_count(0)
        week.locator('label').filter(has_text='営業を進める期間').locator('select').select_option('4')
        expect(week.get_by_label('新しい営業提案で停止',exact=True)).to_be_checked()
        close_dialog(week)
        assert rows(page)==exact_saved_rows
        passed('Per-run offer-stop defaults checked and stays disabled while native saves run; checked stops on catalogue after one saved week, unchecked completes thirteen exact weekly states/backups, then reload restores exactly and the next dialog defaults checked again')

        settle_assets(page,'final assets before teardown')
        assert not errors,errors
        assert not warnings,warnings
        assert not external,external
        assert not data['requestFailures'],data['requestFailures']
        assert not [response for response in responses if response['status']>=400]
        assert not page.evaluate('window.__qaCsp')
        complete=True
    except Exception:
        data['failure']=traceback.format_exc();print(data['failure'],flush=True)
        try:page.screenshot(path=str(OUT/'failure.png'))
        except Exception:pass
    finally:
        data['responses'],data['externalRequests']=responses,external
        try:
            data['cspViolations']=page.evaluate('window.__qaCsp')
            (OUT/'last-stored-rows.json').write_text(json.dumps(rows(page),ensure_ascii=False,indent=2)+'\n')
        except Exception:pass
        (OUT/'results.json').write_text(json.dumps({'passed':complete,'checks':checks,'errors':errors,'warnings':warnings,'data':data,'url':a.url,'method':'normal-sandbox native Firefox/Mesa; actual App/Three scene/RAF, native dialogs/import/export, readonly IndexedDB and busy DOM observations. Ordinary-action fixtures, no state injection, scene/RAF/TLS/crypto mocks.'},ensure_ascii=False,indent=2)+'\n')
        context.close()
        if not a.profile:shutil.rmtree(profile,ignore_errors=True)
        if server:server.shutdown();server.server_close()
if not complete:raise SystemExit(1)
