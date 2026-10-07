#!/usr/bin/env python3
"""Focused v0.8.0 native WebKit city/search/save acceptance.

Use one software-WebGL browser at a time. DEV observations read the normal
renderer/camera; all company actions and camera gestures use trusted UI input.
Production mode serves the unchanged dist under the desktop package's CSP.
Linux WebKit/390px is supplementary evidence, not physical iPhone performance.
"""
import argparse
import functools
import hashlib
import json
import math
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
DESKTOP, PHONE = {'width': 1280, 'height': 900}, {'width': 390, 'height': 750}
NAME = '外周の初営業・実操作QA'
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url', default='http://127.0.0.1:5173')
ap.add_argument('--out', required=True)
ap.add_argument('--dev-diagnostics', action='store_true')
ap.add_argument('--production-csp', action='store_true')
ap.add_argument('--baseline', type=Path)
ap.add_argument('--expected-source')
a = ap.parse_args()
assert a.dev_diagnostics != a.production_csp, 'Choose DEV diagnostics or production CSP'
if a.dev_diagnostics:
    assert urlsplit(a.url).hostname in ['127.0.0.1', 'localhost']
OUT = Path(a.out)
assert not OUT.exists(), 'Preserve earlier evidence; choose a fresh directory'
OUT.mkdir(parents=True)
shutil.copy2(__file__, OUT / Path(__file__).name)
expect.set_options(timeout=30000)


def source_hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted((ROOT / 'src').rglob('*'))
            if p.is_file() and p.suffix in ['.ts', '.tsx', '.css']}


start = source_hashes()
(OUT / 'source-start.json').write_text(json.dumps(start, indent=2) + '\n')
result = {'method': 'One native Linux WebKit software-WebGL session; trusted company/UI/camera gestures; read-only DEV diagnostics and durable-row inspection; no injected funding/state/camera/RAF/TLS/sandbox changes',
          'quality': 'medium', 'limitations': ['Software GPU; not physical Ryzen or iPhone Safari performance', 'Funded high-price property coverage is CPU regression, not this native run'],
          'errors': [], 'warnings': [], 'requestFailures': [], 'checks': [], 'viewports': [], 'exports': {}, 'snapshots': [], 'phase': 'startup'}
server = context = page = pw = None
profile = Path(tempfile.mkdtemp(prefix='shibuya-v080-native-', dir='/tmp'))
passed = False
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
    result['csp'] = csp
    result['distIndexSHA256'] = hashlib.sha256((ROOT / 'dist/index.html').read_bytes()).hexdigest()


def ok(message):
    result['checks'].append(message)
    print('PASS', message, flush=True)


def button(scope, name):
    return scope.get_by_role('button', name=name, exact=True)


def current():
    return page.locator('dialog[open]').last


def close_all():
    for _ in range(6):
        dialogs = page.locator('dialog[open]')
        if not dialogs.count():
            return
        if dialogs.last.get_attribute('class') == 'weekly-review-screen':
            dialogs.last.locator('.weekly-review-exit').click()
        else:
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
    return json.loads(next(r for r in rows() if r['key'] == 'primary')['envelope']['payload'])


def export_state(label):
    before = rows()
    panel = menu('設定・保存')
    with page.expect_download() as download:
        button(panel, '保存ファイルを書き出す').click()
    path = OUT / f'{label}.json'
    download.value.save_as(str(path))
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    assert rows() == before, 'Export changed durable rows'
    result['exports'][label] = {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    close_all()
    return json.loads(envelope['payload'])


def import_state(path):
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    expected = json.loads(envelope['payload'])
    panel = menu('設定・保存')
    page.once('dialog', lambda dialog: dialog.accept())
    with page.expect_file_chooser() as chooser:
        button(panel, 'ファイルから読み込む').click()
    chooser.value.set_files(str(path))
    expect(page.get_by_role('alert')).to_contain_text('会社データを読み込みました')
    expect(page.locator('dialog[open]')).to_have_count(0)
    assert saved() == expected
    return expected


def snapshot(label):
    result['phase'] = label
    page.evaluate('()=>document.fonts.ready')
    page.screenshot(path=str(OUT / f'{label}.png'))
    (OUT / f'{label}.txt').write_text(page.locator('body').inner_text() + '\n')
    result['snapshots'].append(label)
    print('SNAPSHOT', label, flush=True)


def fit(locator):
    size = locator.evaluate('e=>({width:e.clientWidth,scrollWidth:e.scrollWidth})')
    assert size['scrollWidth'] <= size['width'] + 1, size
    return size


def sites():
    close_all()
    page.get_by_role('button', name=re.compile('^(出店場所を探す|物件を探す)$')).click()
    expect(current().locator('.site-list button[data-lot-id]')).to_have_count(72)
    return current()


def camera():
    return page.evaluate('()=>({position:window.__cityCamera.position.toArray(),quaternion:window.__cityCamera.quaternion.toArray(),fov:window.__cityCamera.fov})')


def camera_close(left, right):
    return all(math.isclose(x, y, abs_tol=1e-7) for key in left for x, y in zip(left[key] if isinstance(left[key], list) else [left[key]], right[key] if isinstance(right[key], list) else [right[key]]))


def wait_camera_still():
    previous = camera()
    for _ in range(40):
        page.wait_for_timeout(100)
        now = camera()
        if camera_close(previous, now):
            return now
        previous = now
    raise AssertionError('Native camera did not settle')


def metrics():
    return page.evaluate('''()=>{
      const renderer=window.__cityRenderer,camera=window.__cityCamera,scene=window.__cityScene;
      const rect=renderer.domElement.getBoundingClientRect(),m=camera.matrixWorldInverse.elements,p=camera.projectionMatrix.elements;
      const group=scene.getObjectByName('Game_economic_site_markers');
      const markers=group.children.map(marker=>{
        const {x,y,z}=marker.position;
        const aa=m[0]*x+m[4]*y+m[8]*z+m[12],bb=m[1]*x+m[5]*y+m[9]*z+m[13],cc=m[2]*x+m[6]*y+m[10]*z+m[14];
        const w=p[3]*aa+p[7]*bb+p[11]*cc+p[15];
        const nx=(p[0]*aa+p[4]*bb+p[8]*cc+p[12])/w,ny=(p[1]*aa+p[5]*bb+p[9]*cc+p[13])/w;
        const sx=rect.x+(nx+1)*rect.width/2,sy=rect.y+(1-ny)*rect.height/2;
        return {id:marker.userData.lotId,enabled:group.visible&&marker.visible,inViewport:w>0&&Math.abs(nx)<=1&&Math.abs(ny)<=1,x:sx,y:sy,canvasAtAnchor:document.elementFromPoint(sx,sy)===renderer.domElement};
      });
      let objects=0,meshes=0,instanced=0;const scenery=[];
      scene.traverse(o=>{objects++;if(o.isMesh)meshes++;if(o.isInstancedMesh)instanced++;if(o.userData.sceneryStyles)scenery.push({styles:o.userData.sceneryStyles,instances:o.userData.sceneryInstances});});
      const gl=renderer.getContext();
      return {canvas:{width:rect.width,height:rect.height},camera:{position:camera.position.toArray(),fov:camera.fov,near:camera.near,far:camera.far},render:{...renderer.info.render},memory:{...renderer.info.memory},scene:{objects,meshes,instanced},scenery,markers,driver:{vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER)},visibleMarkerAnchors:markers.filter(r=>r.enabled&&r.inViewport).length,unobstructedMarkerAnchors:markers.filter(r=>r.enabled&&r.inViewport&&r.canvasAtAnchor).length};
    }''')


def measure_viewports():
    page.wait_for_function('window.__cityScene?.getObjectByName("Game_economic_site_markers")?.children.length===72')
    page.evaluate('async()=>await window.__cityScene[Symbol.for("shibuya.city.loadedAssetsReady")]?.()')
    for viewport in [DESKTOP, PHONE]:
        page.set_viewport_size(viewport)
        page.wait_for_load_state('networkidle')
        frame = page.evaluate('window.__cityRenderer.info.render.frame')
        page.wait_for_function('f=>window.__cityRenderer.info.render.frame>f+2', arg=frame)
        reading = {'viewport': viewport, **metrics()}
        assert reading['render']['calls'] > 0 and len(reading['markers']) == 72
        result['viewports'].append(reading)
        snapshot(f'city-{viewport["width"]}')
    if a.baseline:
        old = json.loads(a.baseline.read_text())
        assert old['passed'] and old['quality'] == result['quality']
        comparison = []
        for before, after in zip(old['viewports'], result['viewports']):
            assert before['viewport'] == after['viewport'] and before['canvas'] == after['canvas']
            assert before['camera'] == after['camera'], 'Default camera or lens changed'
            comparison.append({'viewport': after['viewport'], 'callsBefore': before['render']['calls'], 'callsAfter': after['render']['calls'], 'trianglesBefore': before['render']['triangles'], 'trianglesAfter': after['render']['triangles'], 'texturesBefore': before['memory']['textures'], 'texturesAfter': after['memory']['textures'], 'markersBefore': before['visibleMarkerAnchors'], 'markersAfter': after['visibleMarkerAnchors']})
        result['baselineComparison'] = comparison
        ok('Same quality, viewport, canvas, default camera and lens measured against original v070; counters describe software renderer cost')


def outer_street_click():
    page.set_viewport_size(DESKTOP)
    close_all()
    for attempt in range(8):
        stable = wait_camera_still()
        reading = metrics()
        visible = [m for m in reading['markers'] if m['enabled'] and m['inViewport'] and m['canvasAtAnchor']]
        targets = [m for m in visible if re.search(r'-(13|14|15|16|17|18)$', m['id']) and 90 < m['x'] < 1190 and 100 < m['y'] < 780
                   and all(n['id'] == m['id'] or math.hypot(m['x']-n['x'], m['y']-n['y']) > 40 for n in visible)]
        targets = [m for m in targets if page.evaluate('p=>document.elementFromPoint(p.x,p.y)===window.__cityRenderer.domElement', {'x': m['x'], 'y': m['y'] - 22})]
        if targets:
            target = targets[0]
            # Sprite.center is (.5,0): the projected world point is the pin's
            # base. Click its filled circular face, 22px above that anchor.
            point = {'x': target['x'], 'y': target['y'] - 22}
            assert page.evaluate('p=>document.elementFromPoint(p.x,p.y)===window.__cityRenderer.domElement', point)
            page.mouse.click(point['x'], point['y'])
            expect(current().locator('.facility-content')).to_have_attribute('data-selected-lot-id', target['id'])
            assert camera_close(stable, camera()), 'Selecting a street marker automatically moved/zoomed camera'
            result['outerStreetClick'] = {'target': target, 'clickPoint': point, 'cameraBefore': stable, 'cameraAfter': camera(), 'nativeWheelGestures': attempt}
            snapshot('outer-street-selection')
            close_all()
            ok('New outer marker hit by real mouse click selects its exact lot without automatic camera move/zoom')
            return
        page.mouse.move(640, 450)
        page.mouse.wheel(0, 200)
    raise AssertionError('No distinct new outer marker reachable by ordinary zoom-out')


def phone_search():
    page.set_viewport_size(PHONE)
    panel = sites()
    browser = panel.locator('.site-browser')
    result['phoneBrowserFit'] = fit(browser)
    search = browser.get_by_label('物件名・店舗名で検索', exact=True)
    result['phoneSearchFont'] = search.evaluate('e=>getComputedStyle(e).fontSize')
    assert float(result['phoneSearchFont'].removesuffix('px')) >= 16
    search.fill('生活')
    expect(browser.get_by_role('status')).to_contain_text('全72区画')
    ids = browser.locator('[data-lot-id]').evaluate_all('es=>es.map(e=>e.dataset.lotId)')
    assert ids and any(re.search(r'-(13|14|15|16|17|18)$', key) for key in ids)
    search.fill('存在しない候補xyz')
    expect(browser.locator('[data-lot-id]')).to_have_count(0)
    snapshot('phone-search-empty')
    button(browser, '条件を解除する').click()
    expect(browser.locator('[data-lot-id]')).to_have_count(72)
    browser.get_by_label('区画の並び順', exact=True).select_option('purchase')
    expect(browser.locator('[data-lot-id]').first).to_contain_text('物件購入価格')
    browser.get_by_label('区画の並び順', exact=True).select_option('district')
    district_ids = browser.locator('[data-lot-id]').evaluate_all('es=>es.map(e=>e.dataset.lotId.split("-")[0])')
    assert [district_ids.count(key) for key in ['center', 'dogenzaka', 'miyashita', 'sakuragaoka']] == [18]*4
    assert sum(x != y for x, y in zip(district_ids, district_ids[1:])) == 3
    browser.get_by_label('地区', exact=True).select_option('dogenzaka')
    expect(browser.locator('[data-lot-id]')).to_have_count(18)
    browser.get_by_label('区画の状態', exact=True).select_option('available')
    browser.get_by_label('物件名・店舗名で検索', exact=True).fill('坂西の生活')
    expect(browser.locator('[data-lot-id]')).to_have_count(1)
    expect(browser.locator('[data-lot-id]')).to_have_attribute('data-lot-id', 'dogenzaka-13')
    snapshot('phone-new-affordable-candidate')
    before_selection = wait_camera_still() if a.dev_diagnostics else None
    browser.locator('[data-lot-id="dogenzaka-13"]').tap()
    expect(current().locator('.facility-content')).to_have_attribute('data-selected-lot-id', 'dogenzaka-13')
    if before_selection:
        assert camera_close(before_selection, camera()), 'List selection automatically moved the camera'
    ok('390px search/filter/reset/purchase labels/grouped district sort reaches all72 and the new affordable candidate without horizontal overflow')


def explicit_candidate_pan():
    # Read the normal pose only in DEV. Production verifies the same trusted
    # controls and records screenshots without exposing diagnostic globals.
    durable = rows()
    page.set_viewport_size({'width': 360, 'height': 750})
    view = button(current(), '街でこの建物を見る')
    expect(view).to_be_visible()
    view.scroll_into_view_if_needed()
    bounds = view.evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,font:getComputedStyle(e).fontSize,withinViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};}')
    assert bounds['withinViewport'] and bounds['width'] > 100 and bounds['height'] >= 30
    result['phone360PanButton'] = bounds
    before = wait_camera_still() if a.dev_diagnostics else None
    snapshot('phone360-explicit-view-button')
    view.tap()
    expect(page.locator('dialog[open]')).to_have_count(0)
    expect(button(page, '街全体に戻る')).to_be_visible()
    after = wait_camera_still() if a.dev_diagnostics else None
    if before:
        assert before['fov'] == after['fov']
        assert all(math.isclose(x, y, abs_tol=1e-7) for x, y in zip(before['quaternion'], after['quaternion']))
        assert math.isclose(before['position'][1], after['position'][1], abs_tol=1e-7)
        assert math.isclose(after['position'][0] - before['position'][0], -360, abs_tol=1e-7)
        assert math.isclose(after['position'][2] - before['position'][2], -29, abs_tol=1e-7)
        result['explicitPanPose'] = {'before': before, 'after': after}
        marker = next(m for m in metrics()['markers'] if m['id'] == 'dogenzaka-13')
        assert marker['inViewport'] and marker['enabled']
    snapshot('phone360-explicit-outer-pan')
    page.set_viewport_size(PHONE)
    if after:
        assert camera_close(after, wait_camera_still()), 'Viewport resize changed the explicitly panned pose'
    panel = sites()
    panel.locator('[data-lot-id="center-18"]').tap()
    expect(current().locator('.facility-content')).to_have_attribute('data-selected-lot-id', 'center-18')
    if after:
        assert camera_close(after, wait_camera_still()), 'Second ordinary candidate selection replayed pan'
    close_all()
    button(page, '街全体に戻る').tap()
    if a.dev_diagnostics:
        reset = wait_camera_still()
        assert all(math.isclose(x, y, abs_tol=1e-7) for x, y in zip(reset['position'], [-290, 255, 325]))
        assert reset['fov'] == 36
    expect(button(page, '街全体に戻る')).to_have_count(0)
    assert rows() == durable
    ok('360px explicit view button pans horizontally while retaining angle/height/zoom; resize and second selection retain pose; overview returns without save changes' if a.dev_diagnostics else '360px explicit view and overview buttons operate through native taps without save changes')


def first_week():
    panel = current()
    panel.locator('.opening-option').filter(has_text='テイクアウト').tap()
    button(panel, 'この場所にカフェを開業').tap()
    expect(page.locator('dialog[open]')).to_have_count(0)
    opened = export_state('opened-new-outer-store')
    assert opened['week'] == 1 and len(opened['stores']) == 1
    assert opened['stores'][0]['lotId'] == 'dogenzaka-13' and opened['stores'][0]['style'] == 'takeaway'
    assert opened['cash'] == 9_000_000, 'Opening must charge the ordinary takeaway cost once'
    page.locator('.hud-next-week').tap()
    button(current(), re.compile('^(営業して週を進める|リスクを承知して営業する)$')).tap()
    expect(page.locator('.weekly-review-screen[open]')).to_be_visible()
    expect(page.locator('.weekly-results-profit > strong')).to_have_attribute('data-profit-complete', 'true')
    settled = saved()
    assert settled['week'] == 2 and settled['lastReport']['week'] == 1 and not settled['gameOver']
    assert settled['cash'] == round(opened['cash'] + settled['lastReport']['cashChange'])
    assert settled['lastReport']['storeResults'][0]['id'] == opened['stores'][0]['id']
    snapshot('phone-first-outer-week-saved')
    close_all()
    assert export_state('settled-new-outer-store') == settled
    durable = rows()
    page.reload(wait_until='domcontentloaded')
    page.get_by_role('button', name=re.compile(re.escape(NAME) + ' を続ける')).tap()
    expect(page.locator('.immersive-game')).to_be_visible()
    assert saved() == settled and rows() == durable
    assert export_state('reloaded-new-outer-store') == settled
    ok('Ordinary starting funds open new takeaway site, real first week auto-saves, export/reload preserve exact settled state and durable rows')


try:
    pw = sync_playwright().start()
    context = pw.webkit.launch_persistent_context(str(profile), headless=True, viewport=DESKTOP, has_touch=True, accept_downloads=True)
    context.add_init_script('window.__qaCsp=[];addEventListener("securitypolicyviolation",e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));')
    page = context.pages[0]
    page.on('pageerror', lambda error: result['errors'].append(str(error)))
    page.on('console', lambda message: result['errors' if message.type == 'error' else 'warnings'].append(message.text) if message.type in ['error', 'warning'] else None)
    page.on('requestfailed', lambda request: result['requestFailures'].append({'url': request.url, 'error': request.failure}))
    response = page.goto(a.url, wait_until='domcontentloaded')
    assert response.status == 200
    if a.expected_source:
        result['release'] = page.evaluate('async()=>await(await fetch("release.json",{cache:"no-store"})).json()')
        assert result['release']['sourceCommit'] == a.expected_source
    page.get_by_label('会社名', exact=True).fill(NAME)
    button(page, '新しい会社を設立').click()
    expect(page.locator('.immersive-game')).to_be_visible()
    expect(page.locator('.city-webgl-error')).to_have_count(0)
    button(page, '説明を閉じる').click()
    if a.dev_diagnostics:
        measure_viewports()
        outer_street_click()
    else:
        assert page.evaluate('()=>!["__cityScene","__cityCamera","__cityRenderer"].some(key=>key in window)')
        page.wait_for_load_state('networkidle')
        snapshot('production-default-city')
    initial = export_state('initial-company')
    assert initial['cash'] == 12_000_000 and initial['week'] == 1 and not initial['stores']
    phone_search()
    explicit_candidate_pan()
    close_all()
    assert export_state('after-view-only-search') == initial
    panel = sites()
    panel.locator('[data-lot-id="dogenzaka-13"]').tap()
    first_week()
    legacy_path = ROOT / 'tests/fixtures/legacy-0.3.2-envelope.json'
    expected = import_state(legacy_path)
    assert export_state('old-version-exact-export') == expected
    original_envelope = json.loads(legacy_path.read_text())
    actual_envelope = json.loads((OUT / 'old-version-exact-export.json').read_text())
    assert actual_envelope['payload'] == original_envelope['payload'] and actual_envelope['checksum'] == original_envelope['checksum']
    sites()
    snapshot('phone-old-save-all72-candidates')
    close_all()
    ok('Original legacy0.3.2 save imports/exports payload and checksum exactly while exposing all72 current candidates')
    result['cspViolations'] = page.evaluate('window.__qaCsp')
    assert not result['errors'] and not result['warnings'] and not result['requestFailures'] and not result['cspViolations']
    passed = True
except Exception:
    result['failure'] = traceback.format_exc()
    print(result['failure'], flush=True)
    if page and not page.is_closed():
        try:
            snapshot('failure')
        except Exception:
            pass
finally:
    if context:
        try:
            context.close()
            result['contextClosed'] = True
        except Exception as error:
            result['cleanupError'] = str(error)
    if pw:
        try:
            pw.stop()
            result['driverStopped'] = True
        except Exception as error:
            result['driverCleanupError'] = str(error)
    if server:
        server.shutdown()
        server.server_close()
    shutil.rmtree(profile, ignore_errors=True)
    result['profileRemoved'] = not profile.exists()
    result['sourceStable'] = source_hashes() == start
    result['functionalPassed'] = passed
    result['passed'] = passed and result['profileRemoved'] and result['sourceStable'] and result.get('contextClosed', False) and result.get('driverStopped', False) and not result.get('cleanupError') and not result.get('driverCleanupError')
    (OUT / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': result['passed'], 'checks': len(result['checks']), 'errors': result['errors'], 'warnings': result['warnings'], 'requestFailures': result['requestFailures'], 'sourceStable': result['sourceStable'], 'profileRemoved': result['profileRemoved']}, ensure_ascii=False), flush=True)
raise SystemExit(0 if result['passed'] else 1)
