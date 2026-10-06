#!/usr/bin/env python3
"""Real game Blender GLB swap, shared resources, UI mutations and save invariants."""
import base64,hashlib,json,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path(os.getenv('LOADED_ASSETS_OUT','/workspace/shared/shibuya-artifacts/blender-polish/game'));OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[]
REPO=Path(__file__).resolve().parents[1]
asset_files={name:{'bytes':(REPO/'public/models/authored'/name).stat().st_size,'sha256':hashlib.sha256((REPO/'public/models/authored'/name).read_bytes()).hexdigest()}for name in ['108-polished.glb','cafe-polished.glb']}
def ok(text):checks.append(text);print('PASS',text,flush=True)
def button(p,text):return p.get_by_role('button',name=text,exact=True)
def expected_action(p,action):
 p.evaluate("async a=>{const e=await import('/src/sim/engine.ts');window.__expectedState=e.applyAction(window.__expectedState,a)}",action)
def settled(p):
 p.wait_for_function('!!window.__cityScene',timeout=60000,polling=100)
 p.evaluate("async()=>{const a=await import('/src/city/loadedAsset.ts');await a.waitForLoadedAssets(window.__cityScene)}")
def snapshot(p):
 return p.evaluate("""()=>{const slots=[];window.__cityScene.traverse(o=>{if(o.userData.authoredAssetURL){const geometry=[],materials=[];o.traverse(m=>{if(m.isMesh){geometry.push(m.geometry.uuid);for(const material of Array.isArray(m.material)?m.material:[m.material])materials.push(material.uuid)}});slots.push({url:o.userData.authoredAssetURL,status:o.userData.assetStatus,visible:o.visible,position:o.position.toArray(),scale:o.scale.toArray(),geometry,materials,fictionalName:o.userData.fictionalName})}});return slots}""")
def save_and_compare(p):
 button(p,'設定・保存').click();dialog=p.get_by_role('dialog',name='設定と会社データ');button(dialog,'今すぐ保存する').click();expect(p.get_by_role('alert')).to_contain_text('保存しました');button(dialog,'閉じる').click()
 result=p.evaluate("async()=>{const persistence=await import('/src/persistence.ts');return {actual:await persistence.loadGame(),expected:window.__expectedState}}")
 assert result['actual']==result['expected'],'Save differs from engine-only expected state'
 return result['actual']
def select(p,name):
 if p.get_by_role('button',name='選択を解除',exact=True).count():button(p,'選択を解除').click()
 candidate=p.locator('.site-list button').filter(has_text=name)
 if candidate.count():candidate.click()
 else:
  p.evaluate("async name=>{const {LOTS}=await import('/src/data/district.ts');const lot=LOTS.find(l=>l.name===name),c=window.__cityCamera;c.position.set(lot.x,lot.height+60,lot.z+.01);c.lookAt(lot.x,lot.height/2,lot.z);c.updateMatrixWorld();window.__cityScene.updateMatrixWorld(true)}",name)
  rect=p.locator('.city-world canvas').bounding_box();p.mouse.click(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
 expect(p.locator('.inspector h2')).to_have_text(name)
 print('SELECT',name,flush=True)

def render(p,filename):
 data=p.evaluate("()=>{const r=window.__cityRenderer;r.render(window.__cityScene,window.__cityCamera);return r.domElement.toDataURL('image/png').split(',')[1]}")
 (OUT/filename).write_bytes(base64.b64decode(data))
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(60000)
 # Tests render deliberately: prevent continuously rasterizing a large city on software GPU.
 page.add_init_script('window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{}')
 page.on('pageerror',lambda error:errors.append(str(error)));page.on('console',lambda message:errors.append(message.text) if message.type=='error' else None)
 page.on('request',lambda request:requests.append(request.url) if '/models/authored/' in request.url else None)
 page.on('dialog',lambda dialog:dialog.accept())
 page.goto(os.getenv('PLAYTEST_URL','http://127.0.0.1:5173'))
 fixture=page.evaluate("""async()=>{const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');let s=e.createGame('Blender実装検証');s.cash=100000000;s=e.applyAction(s,{type:'settings',changes:{quality:'low'}});s=e.applyAction(s,{type:'openStore',lotId:'center-01',style:'premium'});window.__expectedState=s;return p.createEnvelope(s)}""")
 path=OUT/'fixture.json';path.write_text(json.dumps(fixture,ensure_ascii=False));page.locator('input[type=file]').set_input_files(str(path));settled(page)
 slots=snapshot(page);assert len(slots)==2 and all(slot['status']=='loaded' for slot in slots),slots
 tower=next(s for s in slots if s['url'].endswith('108-polished.glb'));assert tower['fictionalName']=='SHIBUYA 108',tower
 assert sum(url.endswith('cafe-polished.glb')for url in requests)==1,requests
 assert not page.evaluate("window.__cityScene.getObjectByName('static_terrace_center-01').visible")
 assert page.evaluate("window.__cityScene.getObjectByName('static_terrace_center-03').visible")
 initial=save_and_compare(page);ok('108 and one café load real GLBs; loading preserves every saved economic field')
 # Add two cafés without remounting the city. The same cached geometry/materials serve all three.
 for lot_id,name in [('center-02','センター街入口'),('center-04','神南の路面店')]:
  select(page,name);page.locator('.opening-option').filter(has_text='プレミアム').click();button(page,'この場所にカフェを開業').click();expected_action(page,{'type':'openStore','lotId':lot_id,'style':'premium'});settled(page)
 cafes=[s for s in snapshot(page)if s['url'].endswith('cafe-polished.glb')];assert len(cafes)==3 and all(s['status']=='loaded'for s in cafes),cafes
 assert all(s['geometry']==cafes[0]['geometry'] and s['materials']==cafes[0]['materials']for s in cafes),cafes
 assert sum(url.endswith('cafe-polished.glb')for url in requests)==1,requests
 ok('Three visible cafés share geometry/materials from one fetch and parse')
 select(page,'宇田川の角店');store_id=page.evaluate("window.__expectedState.stores.find(s=>s.lotId==='center-01').id")
 name=page.get_by_label('店舗名',exact=True);name.fill('仕上げ確認ロースタリー');name.press('Tab');expected_action(page,{'type':'updateStore','storeId':store_id,'changes':{'name':'仕上げ確認ロースタリー'}})
 assert page.evaluate("()=>{let found=false;window.__cityScene.traverse(o=>{if(o.userData.displayedText==='仕上げ確認ロースタリー')found=true});return found}")
 geometry_before=[s['geometry']for s in snapshot(page)if s['url'].endswith('cafe-polished.glb')]
 style=page.get_by_label('内装・営業スタイル（変更80万円）',exact=False);style.select_option('takeaway');expected_action(page,{'type':'updateStore','storeId':store_id,'changes':{'style':'takeaway'}})
 assert sum(s['visible']for s in snapshot(page)if s['url'].endswith('cafe-polished.glb'))==2
 assert page.evaluate("window.__cityScene.getObjectByName('static_terrace_center-01').visible")
 style.select_option('premium');expected_action(page,{'type':'updateStore','storeId':store_id,'changes':{'style':'premium'}});settled(page)
 assert [s['geometry']for s in snapshot(page)if s['url'].endswith('cafe-polished.glb')]==geometry_before
 ok('Dynamic rename survives independently; restyling hides/reactivates the existing polished café')
 button(page,'閉店').click();expected_action(page,{'type':'closeStore','storeId':store_id})
 assert page.evaluate("window.__cityScene.getObjectByName('original_storefront_center-01').visible")
 assert page.evaluate("window.__cityScene.getObjectByName('static_terrace_center-01').visible")
 assert sum(s['visible']for s in snapshot(page)if s['url'].endswith('cafe-polished.glb'))==2
 page.locator('.opening-option').filter(has_text='プレミアム').click();button(page,'この場所にカフェを開業').click();expected_action(page,{'type':'openStore','lotId':'center-01','style':'premium'});settled(page)
 assert sum(s['visible']for s in snapshot(page)if s['url'].endswith('cafe-polished.glb'))==3
 assert [s['geometry']for s in snapshot(page)if s['url'].endswith('cafe-polished.glb')]==geometry_before
 assert sum(url.endswith('cafe-polished.glb')for url in requests)==1
 assert not page.evaluate("window.__cityScene.getObjectByName('static_terrace_center-01').visible")
 state=save_and_compare(page);ok('Close/reopen keeps siblings intact and reuses cached model; costs match engine-only expectations exactly')
 style=page.get_by_label('内装・営業スタイル（変更80万円）',exact=False)
 style.select_option('standard');expected_action(page,{'type':'updateStore','storeId':store_id,'changes':{'style':'standard'}})
 assert page.evaluate("window.__cityScene.getObjectByName('static_terrace_center-01').visible")
 page.get_by_role('button',name=re.compile('^設備増強')).click();expected_action(page,{'type':'upgradeStore','storeId':store_id})
 assert not page.evaluate("window.__cityScene.getObjectByName('static_terrace_center-01').visible")
 style.select_option('premium');expected_action(page,{'type':'updateStore','storeId':store_id,'changes':{'style':'premium'}});settled(page)
 state=save_and_compare(page);ok('Static tables hide for premium or level2 terrace, restore for level1 other styles and closure; unrelated lots keep tables')
 # Camera is in the alley immediately in front of the café, never hides city objects.
 button(page,'選択を解除').click()
 page.evaluate("()=>{const c=window.__cityCamera;c.position.set(-79.5,1.72,-53.7);c.fov=60;c.updateProjectionMatrix();c.lookAt(-80,1.85,-58);c.updateMatrixWorld()}")
 render(page,'cafe-polished-in-game.png')
 # Geometry validation of high-quality reconstruction does not require another expensive GPU frame.
 old_ids=geometry_before[0]
 for quality in ['high','low']:
  button(page,'設定・保存').click();dialog=page.get_by_role('dialog',name='設定と会社データ');dialog.get_by_label('3D描画').select_option(quality);expected_action(page,{'type':'settings','changes':{'quality':quality}});button(dialog,'閉じる').click();settled(page)
  current=[s for s in snapshot(page)if s['url'].endswith('cafe-polished.glb')];assert len(current)==3 and all(s['status']=='loaded'for s in current)
  assert current[0]['geometry']!=old_ids;old_ids=current[0]['geometry'];assert all(s['geometry']==current[0]['geometry']for s in current)
 ok('High then low quality reconstruct fresh scene-owned geometry with all three cafés restored')
 final=save_and_compare(page);assert final['cash']==state['cash'];assert final['week']==initial['week']
 ok('Rendering changes do not alter cash/week or serialized game state')
 render(page,'city-polished-in-game.png')
 assert not errors,errors
 result={'assetFiles':asset_files,'checks':checks+['No console/page errors'],'errors':errors,'requests':requests,'slots':snapshot(page),'cash':final['cash'],'week':final['week'],'screenshots':['cafe-polished-in-game.png','city-polished-in-game.png']}
 (OUT/'loaded-assets-qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close();print('PASS No console/page errors',flush=True)
