"""Architecture integration QA against Vite; all state fixtures use engine actions."""
import base64, json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
OUT=Path('/workspace/shared/shibuya-artifacts/architecture');OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def ok(s): checks.append(s);print('PASS',s,flush=True)
def btn(p,s): return p.get_by_role('button',name=s,exact=True)
def ready(p):
 p.wait_for_function('window.__cityRenderer?.info.render.triangles>0',timeout=120000)
 p.evaluate('window.__exportPause=true')
def render(p,name):
 data=p.evaluate("()=>{const r=window.__cityRenderer;r.render(window.__cityScene,window.__cityCamera);return r.domElement.toDataURL('image/png').split(',')[1]}")
 (OUT/name).write_bytes(base64.b64decode(data))
def city(p):
 p.evaluate('window.__exportPause=false');p.locator('nav button').first.click();ready(p)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
 p=b.new_page(viewport={'width':1600,'height':1000});p.set_default_timeout(60000)
 p.add_init_script("const raf=window.requestAnimationFrame.bind(window);window.__exportPause=false;window.requestAnimationFrame=cb=>raf(t=>{if(!window.__exportPause)cb(t)});")
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 p.goto(os.getenv('PLAYTEST_URL','http://127.0.0.1:5173'))
 fixture=p.evaluate("""async()=>{const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');let s=e.createGame('建築検証株式会社');s=e.applyAction(s,{type:'openStore',lotId:'center-01',style:'premium'});s=e.applyAction(s,{type:'settings',changes:{quality:'low'}});return p.createEnvelope(s)}""")
 path=OUT/'architecture-fixture.json';path.write_text(json.dumps(fixture,ensure_ascii=False));p.locator('input[type=file]').set_input_files(str(path));ready(p)
 p.evaluate("async()=>{const m=await import('/src/city/landmarks/Building109Materials.ts');await m.waitFor109Textures()}")
 render(p,'city-integrated.png')
 metrics=p.evaluate('({triangles:window.__cityRenderer.info.render.triangles,drawCalls:window.__cityRenderer.info.render.calls,textures:window.__cityRenderer.info.memory.textures})')
 inspect=p.evaluate("""()=>{const s=window.__cityScene,g=s.getObjectByName('HOSHI_COFFEE_reusable_shopfront'),o=s.getObjectByName('original_storefront_center-01');return {originalVisible:o.visible,children:g.children.length,glass:g.children.filter(x=>x.material?.transparent).length,meshIds:g.children.map(x=>x.geometry.uuid)}}""")
 assert not inspect['originalVisible'] and inspect['glass']==1 and inspect['children']==16,inspect
 ok('Premium café replaces original frontage with 16 merged batches and transparent physical interior')
 p.evaluate("()=>{const c=window.__cityCamera;c.position.set(-82,3.1,-50.8);c.fov=85;c.updateProjectionMatrix();c.lookAt(-82,2,-58);c.updateMatrixWorld()}")
 render(p,'cafe-integrated-closeup.png')
 if os.getenv('ARCH_CAPTURE_ONLY')=='1':
  (OUT/'architecture-capture-qa.json').write_text(json.dumps({'checks':checks,'renderLow':metrics,'cafe':inspect,'errors':errors,'screenshots':['city-integrated.png','cafe-integrated-closeup.png']},ensure_ascii=False,indent=2))
  assert not errors,errors
  b.close();raise SystemExit(0)
 # Choose a camera directly above the special building, then click through the public UI.
 p.evaluate("()=>{const c=window.__cityCamera;c.position.set(15,95,-30);c.lookAt(15,13,-38);c.updateMatrixWorld();window.__cityRenderer.render(window.__cityScene,c)}")
 canvas=p.locator('.city-world canvas');rect=canvas.bounding_box();p.mouse.click(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
 expect(p.locator('.inspector')).to_contain_text('スクランブル西口');ok('center-03 real pointer picking selects special media building')
 btn(p,'店舗経営').click();p.get_by_label('店舗名',exact=True).fill('建築検証ロースタリー');p.get_by_label('店舗名',exact=True).press('Tab')
 # Return through actual nav label (read title to remain aligned with public UI).
 p.evaluate('window.__exportPause=false');p.locator('nav button').first.click();ready(p)
 assert p.evaluate("()=>{let found=false;window.__cityScene.traverse(x=>{if(x.userData.displayedText==='建築検証ロースタリー')found=true});return found}")
 ok('Renamed store title survives city remount and is displayed on dynamic sign')
 btn(p,'設定・保存').click();d=p.get_by_role('dialog',name='設定と会社データ');p.evaluate('window.__exportPause=false');d.get_by_label('3D描画').select_option('high');btn(d,'閉じる').click();ready(p)
 assert p.evaluate("()=>window.__cityScene.getObjectByName('HOSHI_COFFEE_reusable_shopfront').children.length")==16
 assert not p.evaluate("()=>window.__cityScene.getObjectByName('original_storefront_center-01').visible")
 ok('High quality scene reconstruction preserves café and hidden original frontage')
 btn(p,'設定・保存').click();d=p.get_by_role('dialog',name='設定と会社データ');p.evaluate('window.__exportPause=false');d.get_by_label('3D描画').select_option('low');btn(d,'閉じる').click();ready(p)
 btn(p,'店舗経営').click();p.on('dialog',lambda d:d.accept());btn(p,'閉店').click();p.evaluate('window.__exportPause=false');p.locator('nav button').first.click();ready(p)
 assert p.evaluate("()=>window.__cityScene.getObjectByName('original_storefront_center-01').visible")
 ok('Closing store restores original ground-floor frontage')
 results={'checks':checks,'renderLow':metrics,'errors':errors,'screenshots':['city-integrated.png','cafe-integrated-closeup.png']};(OUT/'architecture-qa.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
 assert not errors,errors;ok('No browser/GLSL console errors');results['checks']=checks;(OUT/'architecture-qa.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));b.close()
