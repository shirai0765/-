#!/usr/bin/env python3
"""Check standalone Blender comparisons without network-dependent assets."""
import functools, json, threading, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path('/workspace/shared/shibuya-artifacts/blender-polish')
OUT = ROOT / 'comparison-qa'
OUT.mkdir(parents=True, exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
results = []
SNAP = '''() => {const a=window.__modelViewer,c=a.comparison;return {current:c.current,before:c.before.visible,after:c.after.visible,camera:a.camera.position.toArray(),target:a.controls.target.toArray(),triangles:a.renderer.info.render.triangles,calls:a.renderer.info.render.calls}}'''
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--enable-unsafe-swiftshader'])
        for name in os.environ.get('POLISH_ASSETS', '109,cafe').split(','):
            errors, blocked, requests, checks = [], [], [], []
            context = browser.new_context(viewport={'width':1280,'height':900}, accept_downloads=True)
            url = f'{origin}/{name}/{name}-comparison.html'
            def route(r):
                u = r.request.url
                requests.append(u)
                if u == url or u.startswith(('data:', 'blob:')): r.continue_()
                else: blocked.append(u); r.abort()
            context.route('**/*', route)
            page = context.new_page()
            page.set_default_timeout(60000)
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(url, wait_until='load')
            page.wait_for_function('window.__modelViewer?.ready === true')
            start = page.evaluate(SNAP)
            assert start['after'] and not start['before'] and start['triangles'] > 0
            checks.append('Embedded GLBs loaded, after visible, nonzero triangles')
            if name == 'cafe':
                glass = page.evaluate("""() => {const found=[];window.__modelViewer.comparison.after.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.startsWith('Cafe_glazing'))found.push({name:m.name,transmission:m.transmission,opacity:m.opacity})});return found}""")
                assert glass and all(m['transmission'] == 0 and abs(m['opacity']-.08)<1e-8 for m in glass), glass
                checks.append('Exhibition Cafe_glazing uses transmission0 / opacity.08')
            views = page.locator('[data-view]').evaluate_all('(nodes)=>nodes.map(n=>n.dataset.view)')
            records = []
            for view in views:
                page.locator(f'[data-view="{view}"]').click()
                pose = page.evaluate(SNAP)
                for key, label in [('before','修正前'), ('after','Blender修正後')]:
                    page.get_by_role('button', name=label, exact=True).click()
                    state = page.evaluate(SNAP)
                    assert state['current'] == key and state[key] and not state['after' if key == 'before' else 'before']
                    assert state['camera'] == pose['camera'] and state['target'] == pose['target']
                    assert state['triangles'] > 0 and state['calls'] > 0
                    records.append({'view':view, **state})
                    if view in ['overview','station','roof']:
                        page.screenshot(path=str(OUT / f'{name}-{view}-{key}.png'))
            checks.append(f'{len(views)} presets × 2 comparisons: visible toggle and unchanged camera/target')
            page.locator('#reset').click()
            reset = page.evaluate(SNAP)
            assert reset['camera'] == start['camera'] and reset['target'] == start['target']
            checks.append('Reset restores initial view')
            with page.expect_download() as d:
                page.locator('#capture').click()
            png = OUT / f'{name}-download.png'; d.value.save_as(png)
            assert png.read_bytes().startswith(b'\x89PNG\r\n\x1a\n') and png.stat().st_size > 1000
            checks.append('PNG download valid')
            reference = page.locator('details.reference')
            if reference.count():
                reference.locator('summary').click()
                assert reference.locator('img').evaluate('(image)=>image.complete && image.naturalWidth>0')
                assert len(reference.locator('p').inner_text()) > 8
                assert reference.locator('a').get_attribute('href').startswith('https://')
                checks.append('Embedded reference photo and visible attribution/source link')
            else:
                assert name == 'cafe', '109 reference photograph required'
                checks.append('Fictional cafe: no reference-photo panel')
            assert not errors, errors
            assert not blocked, blocked
            assert requests == [url], requests
            checks.append('Only initial HTML requested; no external HTTP or browser errors')
            results.append({'asset':name,'checks':checks,'renders':records,'errors':errors,'blocked':blocked,'httpRequests':requests})
            print(f'PASS {name}: {len(checks)} checks', flush=True)
            context.close()
        browser.close()
finally:
    server.shutdown()
for result in results:
    (OUT / f'result-{result["asset"]}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
existing = json.loads((OUT / 'result.json').read_text()) if (OUT / 'result.json').exists() else []
merged = {r['asset']:r for r in existing}
merged.update({r['asset']:r for r in results})
(OUT / 'result.json').write_text(json.dumps(list(merged.values()), ensure_ascii=False, indent=2)+'\n')
print(str(OUT / 'result.json'))
