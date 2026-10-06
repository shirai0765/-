#!/usr/bin/env python3
"""0.4.3 integrated real-city QA. Development server only; outputs never replace 0.4.2.

DOM mode explicitly replaces renderers. GPU mode uses real renderers and requires
an exclusive browser/GPU slot. Synthetic legacy fixtures are labelled separately
from four ordinary new-company opening paths. No production state-write hook.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

PARSER = argparse.ArgumentParser(description=__doc__)
PARSER.add_argument('--mode', choices=['dom', 'gpu', 'fault'], default='dom')
PARSER.add_argument('--browser', choices=['chromium','firefox'], default='chromium')
PARSER.add_argument('--low', action='store_true', help='Select the product low-quality setting through the normal UI before operating')
PARSER.add_argument('--url', default=os.getenv('PLAYTEST_URL', 'http://127.0.0.1:5173'))
PARSER.add_argument('--out', default=os.getenv('REALCITY_INTEGRATION_OUT', '/workspace/shared/shibuya-artifacts/integration-v043'))
ARGS = PARSER.parse_args()
if urlsplit(ARGS.url).hostname not in ('127.0.0.1', 'localhost'):
    PARSER.error('This source-import QA requires a local development server; use a separate public-origin smoke after deployment.')
OUT = Path(ARGS.out) / ARGS.mode
OUT.mkdir(parents=True, exist_ok=True)
SUPPORTED = ['center-01', 'dogenzaka-01', 'miyashita-01', 'sakuragaoka-01']
REAL_WRAPPER = os.getenv('REALCITY_WRAPPER_PATH', '/src/ui/RealCityView.tsx')
MAP_NAMES = {'real': '実測の渋谷', 'game': 'ゲーム街'}
checks, errors, expected_errors, evidence = [], [], [], []
ROOT=Path(__file__).resolve().parents[1]
SOURCE_FILES=['src/App.tsx','src/ui/RealCityView.tsx','src/realcity/RealCityScene.ts','src/realcity/gameSites.ts','src/city/sceneLifecycle.ts','src/ui/real-city-view.css']
def source_hashes():
    return {name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in SOURCE_FILES}
SOURCE_BEFORE=source_hashes()


def button(root, name):
    return root.get_by_role('button', name=name, exact=isinstance(name, str))


def passed(name, **details):
    checks.append(name)
    evidence.append({'check': name, **details})
    print('PASS', name, flush=True)


def engine(page, operation, state, action=None):
    return page.evaluate('''async x => {
      const e=await import('/src/sim/engine.ts');
      return x.operation==='action'?e.applyAction(x.state,x.action):
        x.operation==='advance'?e.advanceWeek(x.state):e.previewWeek(x.state);
    }''', {'operation': operation, 'state': state, 'action': action})


def stored_rows(page):
    return page.evaluate('''async()=>new Promise((resolve,reject)=>{
      const r=indexedDB.open('shibuya-capital-v1',1);
      r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;
      const q=db.transaction('saves','readonly').objectStore('saves').getAll();
      q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>{db.close();reject(q.error)}}
    })''')


def primary(page):
    return next(row for row in stored_rows(page) if row['key'] == 'primary')


def decode(row):
    e = row['envelope']
    assert hashlib.sha256(e['payload'].encode()).hexdigest() == e['checksum']
    return json.loads(e['payload'])


def export_live(page, label):
    """Public UI export observes unsaved App state without causing a manual save."""
    button(page, '設定・保存').click()
    dialog = page.get_by_role('dialog', name='設定と会社データ')
    with page.expect_download() as info:
        button(dialog, '保存ファイルを書き出す').click()
    path = OUT / (label + '.json')
    info.value.save_as(str(path))
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    button(dialog, '閉じる').click()
    return json.loads(envelope['payload'])


def map_mode(page, mode):
    control = button(page, MAP_NAMES[mode])
    control.click()
    expect(control).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('.business-map')).to_have_attribute('data-map-mode', mode)


def select_lot(page, lot_id):
    """Contract: full catalog has stable lot IDs; selecting never performs an action."""
    control = page.locator(f'.site-list button[data-lot-id="{lot_id}"]')
    if not control.count() and button(page, '全32区画の一覧へ').count():
        button(page, '全32区画の一覧へ').click()
    expect(control).to_have_count(1)
    control.click()
    expect(page.locator('.inspector')).to_have_attribute('data-selected-lot-id', lot_id)


def screenshot(page, name):
    page.screenshot(path=str(OUT / (name + '.png')), timeout=5000)


def stub_renderers(context):
    # App and all panels/actions/persistence remain real. Renderer output proves nothing about 3D.
    context.route('**/src/city/CityView.tsx*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body='export default function CityView(){return null}'))
    context.route('**' + REAL_WRAPPER + '*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body='''
          import React from '/node_modules/.vite/deps/react.js';
          export function RealCityView(props){
            window.__realcityDomStubProps=props;
            return React.createElement('div',{'data-testid':'realcity-dom-stub','data-status':'ready'},'QA: renderer stub');
          }
          export default RealCityView;'''))


def make_page(browser, *, fault=None):
    context = browser.new_context(viewport={'width':1000,'height':760} if ARGS.mode=='gpu' else {'width':1280,'height':960}, accept_downloads=True)
    if ARGS.mode == 'dom':
        stub_renderers(context)
    if fault == 'http':
        context.route('**/models/real-shibuya/tileset.json', lambda route: route.fulfill(status=503,body='QA injected tileset failure'))
    if fault == 'webgl':
        context.add_init_script('''const get=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(kind,...args){
            return /^(webgl2?|experimental-webgl)$/.test(kind)?null:get.call(this,kind,...args)
          };''')
    page = context.new_page()
    page.set_default_timeout(60000 if ARGS.mode=='gpu' else 20000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    def console_message(message):
        if message.type != 'error':
            return
        anticipated = fault == 'webgl' and bool(re.search(r'WebGL|webgl', message.text))
        anticipated = anticipated or (fault == 'http' and bool(re.search(r'503|tileset|QA injected', message.text)))
        (expected_errors if anticipated else errors).append(message.text)
    page.on('console', console_message)
    page.on('dialog', lambda dialog: dialog.accept())
    return context, page


def new_company(page, name):
    page.goto(ARGS.url, wait_until='domcontentloaded')
    page.get_by_label('会社名', exact=True).fill(name)
    button(page, '新しい会社を設立').click()
    expect(page.locator('.company h1')).to_have_text(name)
    initial=decode(primary(page))
    print('STEP company ready',name,flush=True)
    if ARGS.low:
        button(page,'設定・保存').click()
        dialog=page.get_by_role('dialog',name='設定と会社データ')
        dialog.get_by_label('3D描画').select_option('low')
        button(dialog,'閉じる').click()
        initial=engine(page,'action',initial,{'type':'settings','changes':{'quality':'low'}})
        print('STEP normal UI low quality selected',flush=True)
    return initial


def finish_week(page, expected):
    week = expected['week'] - 1
    page.get_by_role('button', name=re.compile('週を終了する')).click()
    button(page.get_by_role('dialog', name=f'第{week}週の営業計画'), '営業して週を進める').click()
    report = page.get_by_role('dialog', name=f'第{week}週の経営レポート')
    expect(report).to_be_visible()
    rows = stored_rows(page)
    assert decode(next(r for r in rows if r['key']=='primary')) == expected
    backups = [r for r in rows if r['key'].startswith('backup:') and r['week']==expected['week']]
    assert len(backups)==1 and decode(backups[0])==expected
    return report


def ordinary_opening(browser, lot_id, *, fault=None):
    context, page = make_page(browser, fault=fault)
    try:
        name = '実測通常経路 ' + lot_id + (' '+fault if fault else '')
        initial = new_company(page, name)
        assert initial['cash']==12000000 and not initial['stores']
        before_rows = stored_rows(page)
        map_mode(page, 'real')
        if fault:
            expect(page.locator('.real-city-view')).to_have_attribute('data-status', 'failed', timeout=30000)
            expect(button(page, 'ゲーム街で続ける')).to_be_visible()
        select_lot(page, lot_id)
        assert export_live(page, 'before-open-'+lot_id+(fault or '')) == initial
        assert stored_rows(page) == before_rows
        page.locator('.opening-option').filter(has_text='街角カフェ').click()
        opened = engine(page, 'action', initial, {'type':'openStore','lotId':lot_id,'style':'standard'})
        button(page, 'この場所にカフェを開業').click()
        price = page.get_by_label('販売価格（円）', exact=True)
        price.fill('950'); price.press('Tab')
        changed = engine(page, 'action', opened, {'type':'updateStore','storeId':opened['stores'][0]['id'],'changes':{'price':950}})
        assert export_live(page, 'opened-'+lot_id+(fault or '')) == changed
        expected = engine(page, 'advance', changed)
        report = finish_week(page, expected)
        assert not expected['gameOver']
        result = report.locator('.opening-result')
        expect(result).to_contain_text(expected['stores'][0]['name'])
        button(result, '店の様子を見る').click()
        expect(page.locator('.inspector')).to_have_attribute('data-selected-lot-id', lot_id)
        expect(button(page, MAP_NAMES['real'])).to_have_attribute('aria-pressed','true')
        assert export_live(page, 'after-week-'+lot_id+(fault or '')) == expected
        saved = primary(page)
        page.reload()
        page.get_by_role('button', name=re.compile(re.escape(name)+' を続ける')).click()
        assert primary(page)==saved
        passed('普通の新会社から実測地点の出店・価格変更・週末保存・同一lot表示・再読込', lotId=lot_id, fault=fault, synthetic=False, week=expected['week'],cash=expected['cash'])
        screenshot(page,'ordinary-'+lot_id+(('-'+fault) if fault else ''))
    except Exception:
        try:
            screenshot(page,'failure')
            (OUT/'failure-dom.txt').write_text(page.locator('body').inner_text(timeout=5000))
        except Exception:
            pass
        raise
    finally:
        context.close()


def legacy_catalog(browser):
    context, page = make_page(browser)
    try:
        initial = new_company(page, '32区画一覧検証')
        lots = page.evaluate("async()=> (await import('/src/data/district.ts')).LOTS.filter(x=>x.available).map(({id,name})=>({id,name}))")
        assert len(lots)==32 and len({x['id'] for x in lots})==32
        catalog = page.locator('.site-list button[data-lot-id]')
        assert sorted(catalog.evaluate_all('(els)=>els.map(e=>e.dataset.lotId)'))==sorted(x['id'] for x in lots)
        for lot in lots:
            select_lot(page,lot['id'])
            expect(page.locator('.inspector h2')).to_have_text(lot['name'])
            button(page,'選択を解除').click()
        assert export_live(page,'all-32-selection-no-mutation')==initial
        passed('全32区画をDOM一覧から個別選択でき、選択だけでは会社を変更しない', lotIds=[x['id'] for x in lots])

        # Explicit synthetic legacy fixture: cash injection is not ordinary-play progression evidence.
        fixture = page.evaluate('''async()=>{
          const e=await import('/src/sim/engine.ts'),d=await import('/src/data/district.ts');
          let s=e.createGame('旧保存32店舗の合成会社',43032);s.cash=1000000000;
          for(const lot of d.LOTS.filter(x=>x.available))s=e.applyAction(s,{type:'openStore',lotId:lot.id,style:'standard'});
          return s;
        }''')
        envelope = page.evaluate("async s=>(await import('/src/persistence.ts')).createEnvelope(s)",fixture)
        path=OUT/'synthetic-legacy-32-stores.json';path.write_text(json.dumps(envelope,ensure_ascii=False))
        button(page,'設定・保存').click()
        button(page.get_by_role('dialog',name='設定と会社データ'),'ファイルから読み込む').click()
        page.locator('input[type=file]').set_input_files(str(path))
        expect(page.locator('.company h1')).to_have_text(fixture['companyName'])
        before=primary(page)
        missing=[s for s in fixture['stores'] if s['lotId'] not in SUPPORTED]
        assert len(missing)==28
        for store in missing:
            button(page,'街を探索').click();map_mode(page,'real')
            button(page,'店舗経営').click()
            button(page,store['name']+'の様子を見る').click()
            expect(page.locator('.inspector')).to_have_attribute('data-selected-lot-id',store['lotId'])
            expect(button(page,MAP_NAMES['game'])).to_have_attribute('aria-pressed','true')
            expect(page.get_by_label('販売価格（円）',exact=True)).to_have_value(str(store['price']))
        assert primary(page)==before
        assert export_live(page,'legacy-28-fallback-no-mutation')==fixture
        passed('旧保存の未対応28店舗は元lotのゲーム街へ戻り、会社・保存全値を維持',synthetic=True,injectedCash=1000000000,lotIds=[s['lotId'] for s in missing])
    except Exception:
        try:
            screenshot(page,'failure')
            (OUT/'failure-dom.txt').write_text(page.locator('body').inner_text(timeout=5000))
        except Exception:
            pass
        raise
    finally:
        context.close()


def diagnostics(page):
    return page.evaluate('window.__realCityIntegrationQA.snapshot()')


def wait_current(page, predicate="d && d.status==='ready'"):
    page.wait_for_function("()=>{const d=window.__realCityIntegrationQA?.snapshot().current;return "+predicate+"}",timeout=180000)
    return diagnostics(page)['current']


def wait_idle(page):
    for _ in range(20):
        before=diagnostics(page)['current']['renderCount']
        page.wait_for_timeout(400)
        if diagnostics(page)['current']['renderCount']==before:
            return before
    raise AssertionError('Real controller did not become idle without RAF modification')


def gpu_lifecycle(browser):
    context,page=make_page(browser)
    held=[]
    holding={'enabled':True}
    def gate(route):
        if holding['enabled']:
            held.append(route)
        else:
            route.continue_()
    context.route('**/models/real-shibuya/tileset.json',gate)
    try:
        initial=new_company(page,'実測切替と保存の通常会社')
        expected=initial
        for lot_id in SUPPORTED[:2]:
            print('STEP opening',lot_id,flush=True)
            select_lot(page,lot_id)
            page.locator('.opening-option').filter(has_text='街角カフェ').click()
            button(page,'この場所にカフェを開業').click()
            expected=engine(page,'action',expected,{'type':'openStore','lotId':lot_id,'style':'standard'})
            price=page.get_by_label('販売価格（円）',exact=True)
            price.fill('950');price.press('Tab')
            expected=engine(page,'action',expected,{'type':'updateStore','storeId':expected['stores'][-1]['id'],'changes':{'price':950}})
        assert export_live(page,'gpu-two-shops-before-map')==expected
        saved_before=primary(page)
        print('STEP opening complete, switching to real map',flush=True)
        map_mode(page,'real')
        wait_current(page,'d && !d.disposed')
        def view_store(lot_id):
            store=next(s for s in expected['stores'] if s['lotId']==lot_id)
            page.locator('.real-city-view-site-picker summary').click()
            page.get_by_role('navigation',name='実測街のゲーム内地点').get_by_role('button',name=re.compile(re.escape(store['name']))).click()
            button(page.locator('.inspector'),'店の様子を見る').click()
        view_store(SUPPORTED[0]);view_store(SUPPORTED[1])
        page.wait_for_function('(id)=>window.__realCityIntegrationQA.snapshot().current.queuedFocusLotId===id',arg=SUPPORTED[1])
        button(page,'実測街の全景').click()
        page.wait_for_function('()=>!window.__realCityIntegrationQA.snapshot().current.queuedFocusLotId')
        view_store(SUPPORTED[0]);view_store(SUPPORTED[1])
        page.wait_for_function('(id)=>window.__realCityIntegrationQA.snapshot().current.queuedFocusLotId===id',arg=SUPPORTED[1])
        assert held,'The delayed-load race was not actually exercised'
        holding['enabled']=False
        for route in held:
            route.continue_()
        held.clear()
        ready=wait_current(page)
        assert ready['buildingTiles']==20 and ready['groundTiles']==72,ready
        assert set(ready['sitePositions'])==set(SUPPORTED),ready
        assert all(len(v)==3 and all(isinstance(n,(int,float)) and abs(n)<5000 for n in v) for v in ready['sitePositions'].values()),ready
        page.wait_for_function('(id)=>window.__realCityIntegrationQA.snapshot().current.focusLotId===id',arg=SUPPORTED[1])
        expect(page.locator('.inspector')).to_have_attribute('data-selected-lot-id',SUPPORTED[1])
        expect(page.locator('.real-city-view-canvas canvas')).to_be_visible()
        assert page.locator('.business-map-body canvas').count()==1
        screenshot(page,'gpu-latest-focus')
        assert primary(page)==saved_before
        assert export_live(page,'gpu-latest-focus-state')==expected
        passed('実ロードを保留した A→B→全景→A→B は最後の B のみへ移動、表示操作で保存不変',snapshot=diagnostics(page),syntheticTiming='tileset request held then released')

        idle=wait_idle(page)
        page.wait_for_timeout(700)
        assert diagnostics(page)['current']['renderCount']==idle
        # This synthetic visibility event is not an OS/tab-background experiment.
        page.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))}")
        page.wait_for_function('()=>window.__realCityIntegrationQA.snapshot().current.visible===false')
        hidden_before=diagnostics(page)['current']['renderCount']
        page.set_viewport_size({'width':1100,'height':850})
        page.wait_for_timeout(900)
        assert diagnostics(page)['current']['renderCount']==hidden_before
        page.evaluate("()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))}")
        page.wait_for_function('()=>window.__realCityIntegrationQA.snapshot().current.visible===true')
        page.wait_for_function('(n)=>window.__realCityIntegrationQA.snapshot().current.renderCount>n',arg=hidden_before)
        passed('要求時描画の idle 停止と合成 document hidden 通知中の停止、復帰後 resize 描画',syntheticVisibility=True,noRafOverride=True,hiddenRenderCount=hidden_before)

        after=engine(page,'advance',expected)
        report=finish_week(page,after)
        button(report,'街に戻る').click()
        assert export_live(page,'gpu-weekly-state')==after
        passed('実測 renderer 表示中の通常2店舗週決算が engine・primary・backup と全一致',synthetic=False,week=after['week'],cash=after['cash'])

        old=diagnostics(page)['current']
        button(page,'財務・不動産').click()
        page.wait_for_function('(id)=>{const s=window.__realCityIntegrationQA.snapshot();return !s.current && s.retired.some(d=>d.instanceId===id&&d.disposed&&d.pendingJobs===0)}',arg=old['instanceId'],timeout=180000)
        retired=next(x for x in diagnostics(page)['retired'] if x['instanceId']==old['instanceId'])
        count=retired['renderCount'];page.wait_for_timeout(900)
        final=next(x for x in diagnostics(page)['retired'] if x['instanceId']==old['instanceId'])
        assert final['renderCount']==count and page.locator('.business-map-body canvas').count()==0
        assert export_live(page,'gpu-after-unmount')==after
        passed('実 UI の財務ページ移動で controller を破棄、pending job 完了後の render は増えず保存不変',retired=final,syntheticVisibility=False)

        holding['enabled']=True
        button(page,'街を探索').click()
        map_mode(page,'real')
        loading=wait_current(page,'d && !d.disposed')
        page.wait_for_timeout(100)
        assert held,'Expected an outstanding request before cancelling'
        map_mode(page,'game');map_mode(page,'real');map_mode(page,'game')
        page.wait_for_function('(id)=>{const s=window.__realCityIntegrationQA.snapshot();return s.retired.some(d=>d.instanceId===id&&d.disposed&&d.pendingJobs===0)}',arg=loading['instanceId'],timeout=30000)
        expect(page.locator('.business-map')).to_have_attribute('data-map-mode','game')
        assert not diagnostics(page)['current']
        assert export_live(page,'gpu-cancelled-load-state')==after
        passed('未完了ロード中の real→game→real→game 切替は最後の game を維持し旧ロードを破棄',retired=diagnostics(page)['retired'])
        # Resolve QA-held protocol routes after the product has already aborted its fetch.
        for route in held:
            route.abort('aborted')
        held.clear()
        context.unroute_all(behavior='wait')
    except Exception:
        try:
            screenshot(page,'failure')
            (OUT/'failure-dom.txt').write_text(page.locator('body').inner_text(timeout=5000))
        except Exception:
            pass
        raise
    finally:
        context.close()


def run():
    with sync_playwright() as pw:
        browser=(pw.firefox.launch(headless=False,firefox_user_prefs={'webgl.force-enabled':True,'gfx.webrender.software':True}) if ARGS.browser=='firefox' else pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--disable-gpu'] if ARGS.mode=='dom' else ['--enable-unsafe-swiftshader']))
        try:
            if ARGS.mode=='dom':
                legacy_catalog(browser)
                for lot_id in SUPPORTED:ordinary_opening(browser,lot_id)
            elif ARGS.mode=='fault':
                for fault in ['http','webgl']:ordinary_opening(browser,'center-01',fault=fault)
            else:
                gpu_lifecycle(browser)
            assert not errors,errors
        finally:
            browser.close()


if __name__=='__main__':
    complete=False
    failure_detail=None
    try:
        run();complete=True
    except Exception as error:
        failure_detail={'type':type(error).__name__,'message':str(error)}
        raise
    finally:
        (OUT/'results.json').write_text(json.dumps({'passed':complete,'failure':failure_detail,'mode':ARGS.mode,'sourceBefore':SOURCE_BEFORE,'sourceAfter':source_hashes(),'checks':checks,'evidence':evidence,'errors':errors,'injectedFaultConsole':expected_errors,'browser':ARGS.browser,'rendererStub':ARGS.mode=='dom','normalUILowSetting':ARGS.low,'sourceImports':True,'limitations':['Local development QA, not deployed URL validation','Synthetic legacy fixture is not ordinary progression','No physical-PC performance or human-duration claim']},ensure_ascii=False,indent=2))
