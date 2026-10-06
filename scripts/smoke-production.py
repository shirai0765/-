#!/usr/bin/env python3
"""Linux browser verification of final dist under the exact desktop CSP.
An ephemeral internal server and same-origin-only network route simulate the
packaged policy; this is not a Windows/Electron runtime test.
PRODUCTION_BROWSER=firefox uses a temporary graphical display supplied by the
caller; Chromium with SwiftShader remains the default.
"""
import functools, hashlib, json, os, re, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUT = Path(os.environ.get('PRODUCTION_SMOKE_OUT', '/tmp/shibuya-production-smoke'))
OUT.mkdir(parents=True, exist_ok=True)
match = re.search(r'const csp = "([^"]+)";', (ROOT / 'desktop/main.cjs').read_text())
assert match, 'Desktop CSP declaration not found'
CSP = match.group(1)
assert "'wasm-unsafe-eval'" in CSP and "'unsafe-eval'" not in CSP

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.b3dm': 'application/octet-stream'}
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(DIST)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
checks, errors, blocked, responses, violations = [], [], [], [], []
legacy_result = None
legacy_path = os.environ.get('PRODUCTION_LEGACY_SAVE')
browser_name = os.environ.get('PRODUCTION_BROWSER', 'chromium')
assert browser_name in {'chromium', 'firefox'}, browser_name
def passed(name): checks.append(name); print('PASS', name, flush=True)
def button(root, name): return root.get_by_role('button', name=name, exact=True)
def snapshot(page):
    return page.evaluate('''async () => { const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('shibuya-capital-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}); return await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly');const r=tx.objectStore('saves').get('primary');r.onsuccess=()=>{db.close();resolve(JSON.parse(r.result.envelope.payload))};r.onerror=()=>reject(r.error)}) }''')
def attach(page):
    page.set_default_timeout(45000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.on('response', lambda response: responses.append({'url':response.url, 'status':response.status, 'mime':response.headers.get('content-type','')}))
def route(request_route):
    url = request_route.request.url
    if url.startswith(origin + '/') or url.startswith(('blob:', 'data:')): request_route.continue_()
    else: blocked.append(url); request_route.abort('blockedbyclient')

try:
    with sync_playwright() as playwright:
        browser = (playwright.firefox.launch(headless=False) if browser_name == 'firefox'
                   else playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--enable-unsafe-swiftshader']))
        context = browser.new_context(viewport={'width':1280,'height':900}, reduced_motion='reduce')
        context.route('**/*', route)
        context.add_init_script("window.__cspViolations=[];addEventListener('securitypolicyviolation',e=>window.__cspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
        # QA-only throttling avoids monopolizing the shared software GPU. Does not alter game state.
        context.add_init_script("""if (!location.pathname.endsWith('/real-shibuya.html')) { const raf=requestAnimationFrame.bind(window), caf=cancelAnimationFrame.bind(window), pending=new Map(); let sequence=0; window.requestAnimationFrame=fn=>{const id=++sequence, entry={timer:0,frame:0}; entry.timer=setTimeout(()=>{entry.frame=raf(t=>{pending.delete(id);fn(t)})},200);pending.set(id,entry);return id};window.cancelAnimationFrame=id=>{const entry=pending.get(id);if(entry){clearTimeout(entry.timer);if(entry.frame)caf(entry.frame);pending.delete(id)}} }""")
        page = context.new_page(); attach(page)
        response = page.goto(origin + '/index.html')
        assert response.headers['content-security-policy'] == CSP
        expect(button(page, '新しい会社を設立')).to_be_enabled()
        page.evaluate('document.fonts.ready')
        fonts = page.evaluate("({noto:document.fonts.check('16px \"Noto Sans JP Variable\"','渋谷珈琲'),manrope:document.fonts.check('16px \"Manrope Variable\"','SHIBUYA'),loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)})")
        assert fonts['noto'] and fonts['manrope'] and any('Noto Sans JP' in f for f in fonts['loaded']) and any('Manrope' in f for f in fonts['loaded']), fonts
        assert any('.woff2' in r['url'] and r['status'] == 200 for r in responses)
        passed('Final welcome screen and bundled Japanese/Latin fonts load under exact desktop CSP')
        page.get_by_label('会社名').fill('製品版保存検証株式会社')
        button(page, '新しい会社を設立').click()
        expect(page.locator('.company h1')).to_have_text('製品版保存検証株式会社')
        expect(page.locator('canvas')).to_be_visible()
        passed('Production company created and city canvas mounted')
        # Keep software-rendered GPU work low while testing the real UI and storage path.
        page.locator('.rail-settings').click()
        print('STEP settings opened', flush=True)
        settings = page.get_by_role('dialog', name='設定と会社データ')
        settings.get_by_label('3D描画').select_option('low')
        button(settings, '閉じる').click()
        chosen = False
        for name in page.locator('.site-list button strong').all_text_contents():
            if name == 'スクランブル西口': continue  # This landmark intentionally uses a different frontage.
            page.locator('.site-list button').filter(has_text=name).click()
            page.locator('.opening-option').filter(has_text='プレミアム').click()
            value = page.locator('.opening-option.selected .opening-option-profit strong').inner_text()
            if int(re.sub(r'[^0-9-]', '', value)) > 0: chosen = True; break
            button(page, '選択を解除').click()
        assert chosen, 'No profitable suggested opening site'
        button(page, 'この場所にカフェを開業').click()
        page.locator('.rail-settings').click()
        settings = page.get_by_role('dialog', name='設定と会社データ')
        button(settings, '今すぐ保存する').click()
        expect(page.get_by_role('alert')).to_contain_text('保存しました')
        expect(button(settings, '今すぐ保存する')).to_be_enabled()
        button(settings, '閉じる').click()
        expect(settings).to_have_count(0)
        pending = snapshot(page)
        assert len(pending.get('openingRecords', [])) == 1 and 'result' not in pending['openingRecords'][0]
        page.get_by_role('button', name=re.compile('週を終了する')).click()
        forecast = page.get_by_role('dialog', name='第1週の営業計画')
        button(forecast, '営業して週を進める').click()
        report = page.get_by_role('dialog', name='第1週の経営レポート')
        expect(report).to_be_visible()
        button(report, '街に戻る').click()
        saved = snapshot(page)
        assert saved['week'] == 2 and len(saved['stores']) == 1
        assert len(saved.get('openingRecords', [])) == 1
        opening = saved['openingRecords'][0]
        assert opening['decisionWeek'] == 1 and opening['result']['week'] == 1
        assert opening['id'] == pending['openingRecords'][0]['id']
        assert opening['result']['companyNetProfit'] == saved['lastReport']['netProfit']
        page.reload()
        page.get_by_role('button', name=re.compile('製品版保存検証株式会社 を続ける')).click()
        assert snapshot(page) == saved
        passed('Production premium cafe opening, weekly autosave and reload preserve the full state')
        authored = [r for r in responses if '/models/authored/' in r['url']]
        for filename in ['108-polished.glb', 'cafe-polished.glb']:
            assert any(r['url'].endswith('/'+filename) and r['status'] == 200 for r in authored), authored
        passed('Authored109 and premium cafe GLBs return HTTP200 under desktop CSP')
        violations.extend(page.evaluate('window.__cspViolations'))
        page.screenshot(path=str(OUT / 'game.png'))
        # Same App, same saved company: production-only build has no DEV controller hook.
        page.locator('.site-list button[data-lot-id="center-01"]').click()
        button(page, '実測の渋谷').click()
        integrated = page.locator('.real-city-view')
        expect(integrated).to_have_attribute('data-status', 'ready', timeout=180000)
        expect(integrated).to_have_attribute('data-focus-lot', 'center-01')
        expect(integrated).to_have_attribute('data-focus-status', 'focused')
        expect(integrated.locator('canvas')).to_be_visible()
        assert page.evaluate('!window.__realCityIntegrationQA && !window.__sceneLifecycleSnapshot')
        assert snapshot(page) == saved, 'Integrated map selection changed the saved company'
        page.screenshot(path=str(OUT / 'integrated-real-city.png'))
        button(page, 'ゲーム街').click()
        expect(page.locator('.city-world canvas')).to_be_visible()
        expect(page.locator('.inspector')).to_have_attribute('data-selected-lot-id', 'center-01')
        assert snapshot(page) == saved
        passed('Production same-App real-city map loads under CSP, focuses center-01 and returns to game map without changing the saved company; DEV hooks absent')
        page.locator('.rail-settings').click()
        print('STEP settings opened', flush=True)
        settings = page.get_by_role('dialog', name='設定と会社データ')
        button(settings, '保存して実際の渋谷を3Dで見る').click()
        page.wait_for_url('**/real-shibuya.html')
        page.locator('#loading.loaded').wait_for(state='visible', timeout=180000)
        expect(page.locator('#loading')).to_contain_text('実測の建物データを表示中')
        page.wait_for_function('window.__realCity?.renderer.info.render.triangles > 10000')
        expect(page.get_by_label('建物写真の精細さ')).to_have_value('1024')
        metrics = page.evaluate('''() => {const c=window.__realCity;c.renderer.render(c.scene,c.camera);const maps=new Set();c.model.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map?.image?.width>0)maps.add(m.map.uuid)});return {modelImageMaps:maps.size,tiles:c.tiles,ground:c.groundTiles,calls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles,textures:c.renderer.info.memory.textures,bounds:c.bounds,textureQuality:c.textureQuality,textureStats:c.textureStats}}''')
        assert metrics['tiles'] == 20 and metrics['ground'] == 72 and metrics['modelImageMaps'] >= 20 and metrics['triangles'] > 10000 and metrics['calls'] > 20, metrics
        assert metrics['textureQuality'] == '1024'
        buildings = metrics['textureStats']['buildings']
        assert buildings['images'] == 20 and all(max(size) <= 1024 for size in buildings['dimensions']), buildings
        assert buildings['rgbaBaseBytes'] < 80 * 1024 * 1024, buildings
        # Observe the product scheduler without replacing RAF or calling renderer.render.
        idle_before = None
        for _ in range(12):
            candidate = page.evaluate('window.__realCity.renderer.info.render.frame')
            page.wait_for_timeout(750)
            if page.evaluate('window.__realCity.renderer.info.render.frame') == candidate:
                idle_before = candidate; break
        assert idle_before is not None, 'Real viewer never stopped rendering while idle'
        brightness = page.get_by_label('建物の明るさ')
        brightness.focus(); brightness.press('ArrowRight')
        page.wait_for_function('(before)=>window.__realCity.renderer.info.render.frame > before', arg=idle_before)
        brightness_frame = page.evaluate('window.__realCity.renderer.info.render.frame')
        assert abs(page.evaluate('window.__realCity.renderer.toneMappingExposure') - 1.2) < .001
        page.set_viewport_size({'width':1000,'height':760})
        page.wait_for_function('(before)=>window.__realCity.renderer.info.render.frame > before && Math.abs(window.__realCity.camera.aspect-1000/760)<.000001', arg=brightness_frame)
        metrics['onDemand'] = {'idleFrame':idle_before,'brightnessFrame':brightness_frame,'resizeFrame':page.evaluate('window.__realCity.renderer.info.render.frame'),'resizedAspect':page.evaluate('window.__realCity.camera.aspect')}
        assert snapshot(page) == saved, 'Read-only real-city controls changed the saved company'
        page.set_viewport_size({'width':1280,'height':900})
        page.wait_for_function('Math.abs(window.__realCity.camera.aspect-1280/900)<.000001')
        wasm = [r for r in responses if r['url'].endswith('.wasm')]
        assert wasm and all(r['status'] == 200 and r['mime'].startswith('application/wasm') for r in wasm), wasm
        assert len({r['url'] for r in responses if '.b3dm' in r['url'] and r['status'] == 200}) == 20
        assert len({r['url'] for r in responses if '/real-shibuya-ground/' in r['url'] and r['url'].endswith('.jpg') and r['status'] == 200}) == 72
        passed('All20 PLATEAU tiles,72 GSI photos and Draco decode under CSP;1024 textures resize and on-demand rendering respond without changing save')
        page.screenshot(path=str(OUT / 'real-shibuya.png'))
        violations.extend(page.evaluate('window.__cspViolations'))
        page.get_by_role('link', name='ゲームへ戻る').click()
        page.wait_for_url('**/index.html')
        page.get_by_role('button', name=re.compile('製品版保存検証株式会社 を続ける')).click()
        assert snapshot(page) == saved
        passed('Return from real-city viewer preserves and resumes the game')
        if legacy_path:
            legacy_file = Path(legacy_path).resolve()
            legacy_envelope = json.loads(legacy_file.read_text())
            legacy_state = json.loads(legacy_envelope['payload'])
            assert legacy_state.get('stores') and 'openingRecords' not in legacy_state and 'railProjects' not in legacy_state, 'Use an older save with an existing store and no new optional records'
            page.locator('.rail-settings').click()
            page.locator('input[type=file]').set_input_files(str(legacy_file))
            expect(page.locator('.company h1')).to_contain_text(legacy_state['companyName'])
            assert snapshot(page) == legacy_state
            button(page, '経営記録').click()
            expect(page.locator('.opening-result-empty')).to_contain_text('後から作成しません')
            expect(page.locator('.opening-result')).to_have_count(0)
            page.reload()
            page.get_by_role('button', name=re.compile(re.escape(legacy_state['companyName']) + ' を続ける')).click()
            assert snapshot(page) == legacy_state
            legacy_result = {'file':str(legacy_file),'sha256':hashlib.sha256(legacy_file.read_bytes()).hexdigest(),'stateExactAfterImportAndReload':True,'historicalOpeningRecordsInvented':False}
            passed('Prior-version save imports and reloads exactly without invented opening records or rail projects')
        violations.extend(page.evaluate('window.__cspViolations'))
        assert not errors, errors
        assert not violations, violations
        assert not blocked, blocked
        assert not [r for r in responses if r['status'] >= 400], [r for r in responses if r['status'] >= 400]
        passed('No JavaScript/console errors, CSP violations, failed HTTP assets or external requests')
        result = {'platform':f'Linux {browser_name}; Windows/Electron runtime NOT tested','qaGameRAFDelayMs':200,'realViewerRAFModified':False,'csp':CSP,'checks':checks,'fonts':fonts,'realCity':metrics,'authoredAssets':authored,'wasm':wasm,'errors':errors,'cspViolations':violations,'blockedExternalRequests':blocked,'legacySave':legacy_result,'distIndexSHA256':hashlib.sha256((DIST/'index.html').read_bytes()).hexdigest()}
        (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(result,ensure_ascii=False),flush=True)
        browser.close()
finally:
    server.shutdown(); server.server_close()
