#!/usr/bin/env python3
"""Verify the packaged offline real-city HTML while blocking every other HTTP request."""
import json,base64,threading,http.server,functools
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/workspace/shared/shibuya-artifacts');errors=[];requests=[]
repo=Path(__file__).resolve().parents[1]
ground_manifest=json.loads((repo/'public/models/real-shibuya-ground/manifest.json').read_text())
expected_ground_tiles=len(ground_manifest['tiles'])
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(out))
server=http.server.ThreadingHTTPServer(('127.0.0.1',8776),handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':980},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 def gate(route):
  url=route.request.url
  if url.startswith('http'):
   requests.append(url)
   if url!='http://127.0.0.1:8776/real-shibuya-viewer.html':route.abort();return
  route.continue_()
 page.route('**/*',gate)
 page.goto('http://127.0.0.1:8776/real-shibuya-viewer.html',wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('window.__realCity?.tiles===20',timeout=240000)
 info=page.evaluate('''()=>{const c=window.__realCity;c.renderer.render(c.scene,c.camera);let projected=0,visible=0; c.model.traverse(o=>{if(o.isMesh){projected++;if(o.material.map)visible++}});return{tiles:c.tiles,groundTiles:c.groundTiles,groundTextures:c.scene.getObjectByName('GSI_seamless_aerial_flat_ground').children.filter(m=>m.material.map?.image).length,bounds:c.bounds,triangles:c.renderer.info.render.triangles,drawCalls:c.renderer.info.render.calls,textures:c.renderer.info.memory.textures,meshes:projected,texturedMeshes:visible}}''')
 assert info['groundTiles']==expected_ground_tiles,info
 assert info['groundTextures']==expected_ground_tiles and info['texturedMeshes']>=10,info
 assert max(abs(v)for v in info['bounds']['min']+info['bounds']['max'])<5000,info
 assert page.evaluate('window.__realCity.renderer.toneMappingExposure')==1.15
 page.get_by_label('建物の明るさ',exact=True).evaluate("el=>{el.value='1.65';el.dispatchEvent(new Event('input',{bubbles:true}))}")
 assert page.evaluate('window.__realCity.renderer.toneMappingExposure')==1.65
 assert page.evaluate("window.__realCity.scene.getObjectByName('GSI_seamless_aerial_flat_ground').children.every(m=>m.material.toneMapped===false)")
 page.get_by_label('建物の明るさ',exact=True).evaluate("el=>{el.value='1.15';el.dispatchEvent(new Event('input',{bubbles:true}))}")
 positions=[]
 for preset in ['crossing','109','overhead']:
  page.locator(f'button[data-view="{preset}"]').click();page.wait_for_timeout(400)
  data=page.evaluate('''()=>{const c=window.__realCity;c.renderer.render(c.scene,c.camera);return{position:c.camera.position.toArray(),image:c.renderer.domElement.toDataURL('image/png').split(',')[1]}}''')
  positions.append(data['position']);(out/f'real-shibuya-offline-{preset}.png').write_bytes(base64.b64decode(data['image']))
 assert len({tuple(pos)for pos in positions})==3,positions
 page.mouse.move(800,500);before=page.evaluate('window.__realCity.camera.position.toArray()');page.mouse.wheel(0,-250);page.wait_for_timeout(400);after=page.evaluate('window.__realCity.camera.position.toArray()');assert before!=after
 assert len(requests)==1,requests
 assert not errors,errors
 manifest=page.locator('footer a').last.get_attribute('href');assert manifest.startswith('blob:'),manifest
 result={'checks':['20 embedded leaf tiles decoded with local Draco WASM',f'{expected_ground_tiles} embedded GSI aerial-ground image tiles rendered','Textured meshes and local coordinate bounds verified','All3 viewpoint presets render','Building brightness slider changes exposure1.15to1.65;ground photos remain toneMapped:false','Mouse-wheel camera interaction works','Only initial HTML HTTP request; no asset/external HTTP','Manifest link uses embedded blob','No console/page errors'],'render':info,'httpRequests':requests,'errors':errors,'fileBytes':(out/'real-shibuya-viewer.html').stat().st_size}
 (out/'real-shibuya-offline-qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
server.shutdown()
