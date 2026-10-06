"""Exercise self-contained architectural viewers over an internal HTTP server.

No file-policy or browser security bypasses. Every HTTP request must remain local.
"""
import functools
import argparse
import http.server
import json
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('/workspace/shared/shibuya-artifacts/architecture')
parser = argparse.ArgumentParser()
parser.add_argument('--assets', nargs='+', choices=['109', 'cafe', 'qfront'], default=['109', 'cafe'])
args = parser.parse_args()
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(out))
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
report = {}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                   args=['--enable-unsafe-swiftshader'])
        for asset in args.assets:
            context = browser.new_context(viewport={'width': 1120, 'height': 900}, accept_downloads=True)
            page = context.new_page(); page.set_default_timeout(60000)
            errors, external, requests = [], [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', lambda req: requests.append(req.url))
            def gate(route):
                if route.request.url.startswith(origin + '/'):
                    route.continue_()
                else:
                    external.append(route.request.url); route.abort()
            page.route('http://**/*', gate); page.route('https://**/*', gate)
            page.goto(f'{origin}/{asset}-viewer.html', wait_until='networkidle')
            page.wait_for_function('window.__modelViewer?.ready === true', timeout=90000)
            metrics = page.evaluate('''() => {const a=window.__modelViewer,r=a.renderer;r.render(a.scene,a.camera);
              const gl=r.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,px=new Uint8Array(w*h*4);
              gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);const colors=new Set();
              for(let i=0;i<px.length;i+=400)colors.add(px.slice(i,i+3).join(','));
              return {triangles:r.info.render.triangles,calls:r.info.render.calls,colors:colors.size};}''')
            assert metrics['triangles'] > 1000 and metrics['colors'] > 30, metrics
            positions = []
            for name in ('overview', 'crossing', 'station', 'park', 'roof'):
                btn = page.locator(f'[data-view="{name}"]'); btn.click()
                assert btn.get_attribute('aria-pressed') == 'true'
                positions.append(page.evaluate('window.__modelViewer.camera.position.toArray()'))
                if name == 'roof':
                    page.screenshot(path=str(out / f'{asset}-viewer-roof.png'))
            assert len({tuple(v) for v in positions}) == 5
            page.locator('#reset').click()
            page.screenshot(path=str(out / f'{asset}-viewer.png'))
            before = page.evaluate('window.__modelViewer.camera.position.toArray()')
            box = page.locator('canvas').bounding_box()
            page.mouse.move(box['x']+box['width']*.5, box['y']+box['height']*.55)
            page.mouse.down(); page.mouse.move(box['x']+box['width']*.62, box['y']+box['height']*.58, steps=4); page.mouse.up()
            after = page.evaluate('window.__modelViewer.camera.position.toArray()')
            assert before != after, 'Orbit drag did not move camera'
            page.locator('#quality').uncheck()
            assert page.evaluate('window.__modelViewer.renderer.shadowMap.enabled') is False
            page.locator('#quality').check()
            assert page.evaluate('window.__modelViewer.renderer.shadowMap.enabled') is True
            with page.expect_download() as pending:
                page.locator('#capture').click()
            capture = out / f'{asset}-viewer-capture.png'; pending.value.save_as(capture)
            assert capture.read_bytes().startswith(b'\x89PNG\r\n\x1a\n') and capture.stat().st_size > 10000
            reference = page.locator('details.reference')
            if asset in ('109', 'qfront'):
                assert reference.count() == 1
                reference.locator('summary').click()
                assert reference.evaluate('(e)=>e.open') is True
                assert reference.locator('img').evaluate('(e)=>e.complete && e.naturalWidth > 500')
                assert 'CC BY' in reference.inner_text()
                page.screenshot(path=str(out / f'{asset}-viewer-reference.png'))
                reference.locator('summary').click()
                assert reference.evaluate('(e)=>e.open') is False
            else:
                assert reference.count() == 0
            assert not external, external
            assert not errors, errors
            report[asset] = {'passed': ['rendered pixels', 'five viewpoints including roof', 'reset', 'orbit drag', 'shadow switch', 'PNG download', 'reference panel' if asset in ('109', 'qfront') else 'no reference panel'],
                             'render': metrics, 'externalRequests': external,
                             'httpRequests': [u for u in requests if u.startswith('http')], 'errors': errors}
            print('PASS', asset, json.dumps(report[asset], ensure_ascii=False), flush=True)
            context.close()
        browser.close()
finally:
    server.shutdown(); server.server_close()
    (out / 'viewer-smoke-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
