#!/usr/bin/env python3
"""Immersive App real-render smoke. No scene/state injection or RAF overrides.
Use a disposable Firefox profile with the existing private Xorg runner; public TLS trust belongs only in that profile.
DEV diagnostics are read-only and optional; production/public runs use UI plus native IndexedDB only.
"""
import argparse,json,os,re,tempfile,shutil,time,traceback,hashlib,functools,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:5173');ap.add_argument('--out',default='/workspace/shared/shibuya-artifacts/immersive-v046/gpu');ap.add_argument('--profile');ap.add_argument('--dev-diagnostics',action='store_true');ap.add_argument('--expected-source');ap.add_argument('--expected-version');ap.add_argument('--production-csp',action='store_true');ap.add_argument('--include-real-city',action='store_true');ap.add_argument('--legacy-save');ap.add_argument('--legacy-only',action='store_true',help='Run only the affected native import/reload/CSP checks');ap.add_argument('--audio-backend-limitation',help='Explicit host limitation; preserves opt-in/preferences checks but skips native playback/timeline assertions');a=ap.parse_args();OUT=Path(a.out);OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];warnings=[];complete=False;data={'audioBackendLimitation':a.audio_backend_limitation};responses=[];blocked=[];violations=[];server=None;CSP=None
ROOT=Path(__file__).resolve().parents[1]
if a.production_csp:
 CSP=re.search(r'const csp = "([^"]+)";', (ROOT/'desktop/main.cjs').read_text()).group(1)
 assert "'wasm-unsafe-eval'" in CSP and "'unsafe-eval'" not in CSP
 class Handler(SimpleHTTPRequestHandler):
  extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.wasm':'application/wasm','.woff2':'font/woff2','.b3dm':'application/octet-stream'}
  def end_headers(self):self.send_header('Content-Security-Policy',CSP);self.send_header('X-Content-Type-Options','nosniff');super().end_headers()
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start();a.url=f'http://127.0.0.1:{server.server_port}/index.html';data['csp']=CSP;data['distIndexSHA256']=hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()
if a.dev_diagnostics:assert urlsplit(a.url).hostname in ['localhost','127.0.0.1'],'DEV reads must remain local'

def b(p,n):return p.get_by_role('button',name=n,exact=True)
def close(d):d.locator(':scope > section > header > button[aria-label="閉じる"]').click()
def menu(p,n):b(p,'経営').click();d=p.locator('dialog[open]').filter(has=p.get_by_role('heading',name='経営',exact=True));b(d,n).click();return p.locator('dialog[open]').filter(has=p.get_by_role('heading',name=('設定と会社データ' if n=='設定・保存' else n),exact=True))
def primary(p):return p.evaluate("()=>new Promise((resolve,reject)=>{let q=indexedDB.open('shibuya-capital-v1');q.onsuccess=()=>{let d=q.result,r=d.transaction('saves').objectStore('saves').get('primary');r.onsuccess=()=>{d.close();resolve(r.result)}};q.onerror=reject})")
def state(p):return json.loads(primary(p)['envelope']['payload'])
def shot(p,n):p.screenshot(path=str(OUT/(n+'.png')))
def ok(s):checks.append(s);print('PASS',s,flush=True)
def scene(p):return p.evaluate("()=>({uuid:window.__cityScene.uuid,camera:window.__cityCamera.position.toArray(),quaternion:window.__cityCamera.quaternion.toArray(),markers:window.__cityScene.getObjectByName('Game_economic_site_markers').children.map(x=>({id:x.userData.lotId,status:x.userData.siteStatus}))})")
def pose(p):
 return p.evaluate("()=>({uuid:window.__cityScene.uuid,camera:window.__cityCamera.position.toArray(),quaternion:window.__cityCamera.quaternion.toArray(),fov:window.__cityCamera.fov})")
def same_pose(left,right):
 return left['uuid']==right['uuid'] and left['fov']==right['fov'] and all(abs(x-y)<1e-7 for key in ['camera','quaternion'] for x,y in zip(left[key],right[key]))
def paused(p):
 if not a.dev_diagnostics:return
 p.wait_for_timeout(200);first=p.evaluate('window.__cityRenderer.info.render.frame');p.wait_for_timeout(350)
 assert p.evaluate('window.__cityRenderer.info.render.frame')==first,'Native dialog did not pause background renderer'
def resumed(p):
 if not a.dev_diagnostics:return
 first=p.evaluate('window.__cityRenderer.info.render.frame');p.wait_for_function('f=>window.__cityRenderer.info.render.frame>f',arg=first)
def audio(p):
 return p.evaluate("()=>window.__qaAudioContexts.map(c=>({state:c.state,time:c.currentTime}))")
def play_audio(p):
 b(p,'街のBGMを設定').click();d=p.locator('dialog[open]');expect(b(d,'BGMを再生')).to_be_visible()
 b(d,'BGMを再生').click();expect(b(d,'BGMを一時停止')).to_be_visible()
 p.wait_for_function("window.__qaAudioContexts.length===1 && window.__qaAudioContexts[0].state==='running'")
 expect(d.locator('.city-audio-error')).to_have_count(0);close(d)
def point(p,id):return p.evaluate("id=>{let o=window.__cityScene.getObjectByName('Game_site_marker_'+id),v=o.getWorldPosition(o.position.clone()).project(window.__cityCamera),r=window.__cityRenderer.domElement.getBoundingClientRect();return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2-22}}",id)
profile=Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix='immersive-v046-firefox-',dir='/tmp'));owned=not a.profile
with sync_playwright() as pw:
 context=pw.firefox.launch_persistent_context(str(profile),headless=False,timeout=30000,viewport={'width':1000,'height':760},accept_downloads=True,firefox_user_prefs={'webgl.force-enabled':True,'gfx.webrender.software':True})
 origin=urlsplit(a.url)
 def route(r):
  u=urlsplit(r.request.url)
  if (u.scheme,u.netloc)==(origin.scheme,origin.netloc) or u.scheme in ['blob','data']:r.continue_()
  else:blocked.append(r.request.url);r.abort('blockedbyclient')
 context.route('**/*',route);context.add_init_script("window.__cspViolations=[];addEventListener('securitypolicyviolation',e=>window.__cspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));window.__qaAudioContexts=[];if(window.AudioContext){const Native=window.AudioContext;window.AudioContext=new Proxy(Native,{construct(target,args){const context=Reflect.construct(target,args);window.__qaAudioContexts.push(context);return context;}});}")
 p=context.new_page();p.on('response',lambda r:responses.append({'url':r.url,'status':r.status,'mime':r.headers.get('content-type','')}));p.set_default_timeout(60000);p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else warnings.append(m.text) if m.type=='warning' else None)
 try:
  response=p.goto(a.url,wait_until='domcontentloaded');assert response and response.status==200
  if CSP:assert response.headers.get('content-security-policy')==CSP
  p.evaluate('document.fonts.ready');fonts=p.evaluate("({noto:document.fonts.check('16px \"Noto Sans JP Variable\"','渋谷珈琲'),manrope:document.fonts.check('16px \"Manrope Variable\"','SHIBUYA')})");assert fonts['noto'] and fonts['manrope'];data['fonts']=fonts

  if a.expected_source or a.expected_version:
   release=p.evaluate("async()=>await (await fetch(new URL('release.json',location.href))).json()");data['release']=release
   if a.expected_source:assert release['sourceCommit']==a.expected_source
   if a.expected_version:assert release['version']==a.expected_version
  if a.legacy_only:
   assert a.legacy_save,'--legacy-only requires --legacy-save'
   p.get_by_label('会社名',exact=True).fill('保存互換QA');b(p,'新しい会社を設立').click();expect(p.locator('.immersive-game')).to_be_visible();b(p.locator('dialog[open]'),'街で始める').click();expect(p.locator('dialog[open]')).to_have_count(0);expect(p.locator('.city-world canvas')).to_be_visible();expect(p.locator('.city-webgl-error')).to_have_count(0)
  else:
   p.get_by_label('会社名',exact=True).fill('全面街の実操作QA');b(p,'新しい会社を設立').click();expect(p.locator('.immersive-game')).to_be_visible();expect(p.locator('.city-world canvas')).to_be_visible();expect(p.locator('.city-webgl-error')).to_have_count(0)
   guide=p.locator('dialog[open]');expect(guide.get_by_role('heading',name='経営のはじめ方',exact=True)).to_be_visible();expect(guide.locator('.first-play-steps > li')).to_have_count(3);assert guide.evaluate('(e)=>e.matches(":modal")');shot(p,'00-first-play-guide');b(guide,'街で始める').click();expect(p.locator('dialog[open]')).to_have_count(0);assert p.evaluate("localStorage.getItem('shibuya-first-play-guide-v1')")=='seen'
   assert audio(p)==[],'BGM must remain opt-in'
   canvas=p.locator('.city-world canvas').element_handle();assert canvas is not None
   expect(p.locator('.city-world canvas')).to_have_attribute('aria-label',re.compile('ドラッグで移動'))
   rect=p.locator('.immersive-city').bounding_box();assert rect=={'x':0,'y':0,'width':1000,'height':760};assert p.locator('.rail,.bottom-bar,.inspector,.topbar').count()==0
   if a.dev_diagnostics:
    p.wait_for_function("window.__cityScene?.getObjectByName('Game_economic_site_markers')?.children.length===32")
    p.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
    data['initialScene']=scene(p);assert len({x['id'] for x in data['initialScene']['markers']})==32
   p.wait_for_timeout(500);shot(p,'01-fullscreen-real-city');ok('Actual full viewport city; first-launch guide persists and BGM starts only on request')
   initialPose=pose(p) if a.dev_diagnostics else None
   if a.dev_diagnostics:
    pt=point(p,'center-01');data['markerClick']=pt;assert 0<pt['x']<1000 and 0<pt['y']<760;p.mouse.click(pt['x'],pt['y'])
   else:
    b(p,'出店場所を探す').click();sites=p.locator('dialog[open]');expect(sites.locator('.site-list button')).to_have_count(32);sites.locator('[data-lot-id="center-01"]').click()
   d=p.locator('dialog[open]').filter(has=p.locator('.facility-content'));expect(d.locator('.facility-content')).to_have_attribute('data-selected-lot-id','center-01');assert d.evaluate('(e)=>e.matches(":modal")');paused(p);shot(p,'02-facility-dialog')
   if a.dev_diagnostics:assert same_pose(initialPose,pose(p)),'Selecting a parcel moved the camera'
   b(d,'この場所にカフェを開業').click();expect(p.locator('dialog[open]')).to_have_count(0);expect(p.locator('.toast')).to_contain_text('カフェを開業');expect(b(p,'この店を経営')).to_be_visible()
   if a.dev_diagnostics:
    p.wait_for_function("window.__cityScene.getObjectByName('Game_site_marker_center-01').userData.siteStatus==='store'");p.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
   resumed(p)
   if a.dev_diagnostics:
    assert same_pose(initialPose,pose(p)),'Opening a cafe automatically moved the camera'
    markerWidth=p.evaluate("()=>{const marker=window.__cityScene.getObjectByName('Game_site_marker_center-01');return marker.scale.x*innerHeight/(2*Math.tan(window.__cityCamera.fov*Math.PI/360))}");assert abs(markerWidth-44)<.01;data['ownedMarkerWidthPixels']=markerWidth
   p.wait_for_timeout(300);shot(p,'03-opening-stable-city');ok('Parcel opens native detail and cafe opening returns to city; optional DEV verifies stable camera, 44px owned pin and pause/resume')
   b(p,'この店を経営').click();d=p.locator('dialog[open]');expect(d.locator('.store-management')).to_have_attribute('data-store-purpose','home');expect(d.locator('.store-management-purposes button')).to_have_count(4);expect(d.get_by_label('販売価格（円）',exact=True)).to_have_count(0)
   d.locator('.store-management-purposes button').filter(has_text='商品・価格').click();price=d.get_by_role('spinbutton',name=re.compile('^販売価格（円）'));price.fill('950');p.keyboard.press('Escape');expect(p.locator('dialog[open]')).to_have_count(0)
   b(p,'この店を経営').click();d=p.locator('dialog[open]');d.locator('.store-management-purposes button').filter(has_text='商品・価格').click();expect(d.get_by_role('spinbutton',name=re.compile('^販売価格（円）'))).to_have_value('950');b(d,'店舗トップへ').click();b(d,'街でこの店を見る').click();expect(p.locator('dialog[open]')).to_have_count(0)
   if a.dev_diagnostics:
    assert not same_pose(initialPose,pose(p)),'Explicit store view did not move camera';assert p.evaluate("window.__cityScene.getObjectByName('Settled_store_activity').userData.count")==0,'Unsettled opening showed invented patrons'
   closeup=pose(p) if a.dev_diagnostics else None;b(p,'この店を経営').click();d=p.locator('dialog[open]');paused(p)
   if a.dev_diagnostics:assert same_pose(closeup,pose(p)),'Reopening management from explicit store view moved camera'
   close(d)
   if a.dev_diagnostics:assert same_pose(closeup,pose(p)),'Closing management from explicit store view moved camera'
   shot(p,'03b-explicit-store-view');b(p,'街全体に戻る').click();resumed(p);ok('Store purpose home reveals requested inputs; focused price draft commits on Escape; explicit view reaches store exterior')
   before=scene(p) if a.dev_diagnostics else None
   for target in ['財務・不動産','店舗経営','株式市場']:
    d=menu(p,target);assert d.evaluate('(e)=>e.matches(":modal")');paused(p)
    if a.dev_diagnostics and target=='財務・不動産':
     buffer=p.locator('.city-world canvas').evaluate('(e)=>[e.width,e.height]');frame=p.evaluate('window.__cityRenderer.info.render.frame');p.set_viewport_size({'width':1100,'height':800});p.wait_for_timeout(200);assert p.locator('.city-world canvas').evaluate('(e)=>[e.width,e.height]')==buffer;assert p.evaluate('window.__cityRenderer.info.render.frame')==frame;shot(p,'04a-modal-resize-paused');data['pausedResize']={'beforeBuffer':buffer,'frame':frame,'viewport':[1100,800]}
    close(d);resumed(p);expect(p.locator('dialog[open]')).to_have_count(0)
    if a.dev_diagnostics and target=='財務・不動産':
     p.wait_for_function('window.__cityCamera.aspect===1100/800');assert p.locator('.city-world canvas').evaluate('(e)=>[e.width,e.height]')!=buffer;p.set_viewport_size({'width':1000,'height':760});p.wait_for_function('window.__cityCamera.aspect===1000/760')

    assert canvas.evaluate("e=>e.isConnected && e===document.querySelector('.city-world canvas')")
    if a.dev_diagnostics:assert scene(p)==before,'Management navigation reset real camera/scene/markers'
   shot(p,'04-return-same-city');ok('Finance/stores/market overlays return to same canvas; optional DEV verifies paused rendering, stable camera/scene and deferred resize')
   savedBeforeAudio=primary(p)
   if not a.audio_backend_limitation:
    play_audio(p);audioStarted=audio(p)[0]['time'];d=menu(p,'財務・不動産');paused(p);p.wait_for_timeout(200);assert audio(p)[0]['state']=='running' and audio(p)[0]['time']>audioStarted;close(d)
   b(p,'街のBGMを設定').click();d=p.locator('dialog[open]');volume=d.get_by_label('音量',exact=False);volume.focus();volume.press('End');b(d,'BGMを消音').click();expect(b(d,'BGMの消音を解除')).to_have_attribute('aria-pressed','true');b(d,'BGMの消音を解除').click()
   if not a.audio_backend_limitation:
    assert audio(p)[0]['state']=='running';b(d,'BGMを一時停止').click();p.wait_for_function("window.__qaAudioContexts[0].state==='suspended'");b(d,'BGMを再生').click();p.wait_for_function("window.__qaAudioContexts[0].state==='running'");assert len(audio(p))==1
   else:
    expect(b(d,'BGMを再生')).to_be_visible();assert audio(p)==[]
   close(d);assert primary(p)==savedBeforeAudio;data['audioPreferences']=p.evaluate("JSON.parse(localStorage.getItem('shibuya-capital-city-audio-v1'))");assert data['audioPreferences']=={'volume':1,'muted':False}
   if a.dev_diagnostics:
    managed=pose(p);p.mouse.move(700,500);p.mouse.down();p.mouse.move(800,520,steps=6);p.mouse.up();p.wait_for_timeout(200);panned=pose(p);assert any(abs(x-y)>1 for x,y in zip(managed['camera'],panned['camera']));assert all(abs(x-y)<1e-6 for x,y in zip(managed['quaternion'],panned['quaternion']))
    p.mouse.wheel(0,-300);p.wait_for_timeout(200);zoomed=pose(p);assert any(abs(x-y)>1 for x,y in zip(panned['camera'],zoomed['camera']));assert all(abs(x-y)<1e-6 for x,y in zip(panned['quaternion'],zoomed['quaternion']))
    b(p,'地図').click();b(p.locator('dialog[open]'),'街を眺める').click();expect(p.locator('.city-world canvas')).to_have_attribute('aria-label',re.compile('ドラッグで回転'));p.mouse.move(700,500);p.mouse.down();p.mouse.move(780,510,steps=6);p.mouse.up();p.wait_for_timeout(400);explored=pose(p);assert any(abs(x-y)>1e-4 for x,y in zip(zoomed['quaternion'],explored['quaternion']))
    b(p,'俯瞰で経営に戻る').click();p.wait_for_timeout(100);restored=pose(p);assert all(abs(x-y)<1e-6 for x,y in zip(managed['quaternion'],restored['quaternion']));b(p,'地図').click();b(p.locator('dialog[open]'),'街全体に戻る').click();data['cameraGestures']={'managed':managed,'panned':panned,'zoomed':zoomed,'explored':explored,'restored':restored}
   ok(('Native BGM timeline/context persists through dialogs and pause/resume; ' if not a.audio_backend_limitation else 'BGM opt-in/preferences verified; native Firefox playback SKIPPED with recorded backend limitation; ')+'mute/volume preserve company; optional DEV native gestures pan/zoom then explicitly rotate')
   d=menu(p,'設定・保存');b(d,'今すぐ保存する').click();expect(d.get_by_role('alert')).to_contain_text('保存しました');close(d);beforeState=state(p)
   outlook=None
   if a.dev_diagnostics:
    outlook=p.evaluate("async s=>(await import('/src/sim/engine.ts')).getWeekOutlook(s)",beforeState);data['outlook']=outlook
   p.locator('.hud-next-week').click();d=p.locator('dialog[open]');expect(d).to_contain_text('第1週を営業する');expect(d.locator('.week-outlook')).not_to_have_attribute('open','');shot(p,'05-week-before-results');b(d,'営業して週を進める').click();report=p.locator('dialog[open]').filter(has=p.get_by_role('heading',name='第1週の営業結果',exact=True));expect(report).to_be_visible();after=state(p);assert after['week']==2 and not after['gameOver'];assert after['cash']==round(beforeState['cash']+after['lastReport']['cashChange']);assert after['stores'][0]['price']==950
   if outlook:assert outlook['netProfit']['min']<=after['lastReport']['netProfit']<=outlook['netProfit']['max']
   expect(report.locator('.weekly-results-profit > strong')).to_have_attribute('data-profit-complete','true');expect(report.locator('.weekly-results-profit > strong')).to_have_attribute('aria-label','全社純利益 ¥'+f"{after['lastReport']['netProfit']:,}");expect(report.locator('.weekly-stores')).not_to_have_attribute('open','');expect(report.locator('.weekly-results-detail')).not_to_have_attribute('open','');expect(report.locator('.weekly-results-cash > div').nth(1).locator('dd')).to_have_text('¥'+f"{after['cash']:,}");paused(p);data['settledState']=after;shot(p,'06-first-real-result');settled=primary(p);(OUT/'autosaved-primary.json').write_text(json.dumps(settled,ensure_ascii=False,indent=2));ok('First week shows a settled result, cash reconciles actual report, autosave and optional outlook containment')
   if a.dev_diagnostics:
    report.locator('.weekly-stores > summary').click();b(report,'店の様子を見る').click();resumed(p);expectedPatrons=min(8,(after['stores'][0]['customers']+249)//250);assert expectedPatrons>0;activity=p.evaluate("window.__cityScene.getObjectByName('Settled_store_activity').userData");assert activity['count']==expectedPatrons and activity['sourceCustomers']==after['stores'][0]['customers'];shot(p,'06b-settled-store-patrons')
    b(p,'この店を経営').click();d=p.locator('dialog[open]');d.locator('.store-management-purposes button').filter(has_text='商品・価格').click();price=d.get_by_role('spinbutton',name=re.compile('^販売価格（円）'));price.fill('900');p.keyboard.press('Tab');price.fill('950');p.keyboard.press('Tab');b(d,'店舗トップへ').click();b(d,'街でこの店を見る').click();resumed(p);assert p.evaluate("window.__cityScene.getObjectByName('Settled_store_activity').userData")==activity;assert primary(p)==settled;data['settledStoreActivity']=activity;ok('DEV store view has zero patrons before settlement and max-eight actual patrons after; price edit preserves settled activity')
   p.reload(wait_until='domcontentloaded');p.get_by_role('button',name=re.compile('全面街の実操作QA を続ける')).click();expect(p.locator('.immersive-game')).to_be_visible();expect(p.locator('.city-world canvas')).to_be_visible();assert primary(p)==settled;expect(p.locator('dialog[open]')).to_have_count(0);assert audio(p)==[];assert p.evaluate("JSON.parse(localStorage.getItem('shibuya-capital-city-audio-v1'))")==data['audioPreferences'];shot(p,'07-reloaded-city');ok('Reload continues exact saved primary/envelope/payload')
   if a.include_real_city or a.production_csp:
    if not a.audio_backend_limitation:play_audio(p);realAudioBefore=audio(p)[0]['time']
    b(p,'物件を探す').click();p.locator('.site-list button[data-lot-id="center-01"]').click();close(p.locator('dialog[open]'));b(p,'地図').click();p.locator('dialog[open]').get_by_role('button',name=re.compile('実測の渋谷')).click();real=p.locator('.real-city-view');expect(real).to_have_attribute('data-status','ready',timeout=180000);expect(real).to_have_attribute('data-focus-status','idle');b(p,'この店を経営').click();expect(real).to_have_attribute('data-focus-status','idle')
    if a.dev_diagnostics:
     p.wait_for_timeout(200);realPaused=p.evaluate('window.__realCityIntegrationQA.snapshot().current');p.wait_for_timeout(350);assert p.evaluate('window.__realCityIntegrationQA.snapshot().current.renderCount')==realPaused['renderCount'] and not realPaused['visible'];data['realPaused']=realPaused
    b(p.locator('dialog[open]'),'街でこの店を見る').click();expect(real).to_have_attribute('data-focus-lot','center-01');expect(real).to_have_attribute('data-focus-status','focused');assert primary(p)==settled
    if not a.audio_backend_limitation:assert len(audio(p))==1 and audio(p)[0]['state']=='running' and audio(p)[0]['time']>realAudioBefore
    if not a.dev_diagnostics:assert p.evaluate('!window.__cityScene && !window.__realCityIntegrationQA && !window.__sceneLifecycleSnapshot')
    shot(p,'08-integrated-real-city');b(p,'地図').click();p.locator('dialog[open]').get_by_role('button',name=re.compile('ゲーム街')).click();expect(p.locator('.city-world canvas')).to_be_visible();assert primary(p)==settled
    if not a.audio_backend_limitation:assert len(audio(p))==1 and audio(p)[0]['state']=='running'
    ok('Same-App real city requires explicit store focus; game return preserves exact primary; production DEV hooks absent when applicable')
    settings=menu(p,'設定・保存');b(settings,'保存して実際の渋谷を3Dで見る').click();p.wait_for_url('**/real-shibuya.html');expect(p.locator('#loading.loaded')).to_be_visible(timeout=180000);p.wait_for_function('window.__realCity?.renderer.info.render.triangles>10000');assert state(p)==after
    metrics=p.evaluate("()=>{let c=window.__realCity;let materials=new Set();c.model.traverse(o=>{if(o.material)for(let m of Array.isArray(o.material)?o.material:[o.material])if(m.map)materials.add(m)});return {tiles:c.tiles,ground:c.groundTiles,textureQuality:c.textureQuality,textureStats:c.textureStats,triangles:c.renderer.info.render.triangles,materials:[...materials].map(m=>({basic:m.isMeshBasicMaterial===true,toneMapped:m.toneMapped,color:m.color.toArray()}))}}")
    assert metrics['tiles']==20 and metrics['ground']==72 and metrics['textureQuality']=='1024';assert len(metrics['materials'])==20 and all(m['basic'] and not m['toneMapped'] and all(abs(x-1.15)<.000001 for x in m['color']) for m in metrics['materials']);assert all(max(x)<=1024 for x in metrics['textureStats']['buildings']['dimensions']);data['viewer']=metrics
    idle=None
    for _ in range(12):
     frame=p.evaluate('window.__realCity.renderer.info.render.frame');p.wait_for_timeout(750)
     if p.evaluate('window.__realCity.renderer.info.render.frame')==frame:idle=frame;break
    assert idle is not None,'Viewer did not stop rendering at idle'
    brightness=p.get_by_label('建物の明るさ');brightness.focus();brightness.press('ArrowRight');p.wait_for_function('f=>window.__realCity.renderer.info.render.frame>f',arg=idle);assert abs(p.evaluate('window.__realCity.renderer.toneMappingExposure')-1.2)<.001
    assert p.evaluate("()=>{let good=true,n=0;window.__realCity.model.traverse(o=>{if(o.isMesh)for(let m of Array.isArray(o.material)?o.material:[o.material])if(m.map){n++;good&&=m.color.toArray().every(v=>Math.abs(v-1.2)<.000001)}});return good&&n>=20}")
    p.set_viewport_size({'width':1100,'height':800});p.wait_for_function('Math.abs(window.__realCity.camera.aspect-1100/800)<.00001');assert state(p)==after;shot(p,'09-standalone-real-city');violations.extend(p.evaluate('window.__cspViolations'))
    p.get_by_role('link',name='ゲームへ戻る').click();p.wait_for_url('**/index.html');p.get_by_role('button',name=re.compile('全面街の実操作QA を続ける')).click();expect(p.locator('.immersive-game')).to_be_visible();assert state(p)==after
    assert len({r['url'] for r in responses if '.b3dm' in r['url'] and r['status']==200})==20;assert len({r['url'] for r in responses if '/real-shibuya-ground/' in r['url'] and r['url'].endswith('.jpg') and r['status']==200})==72
    wasm=[r for r in responses if r['url'].endswith('.wasm')];assert wasm and all(r['status']==200 and r['mime'].startswith('application/wasm') for r in wasm)
    ok('Standalone 20 tiles/72 ground/Draco, Basic photo gain1.15→1.2,1024 textures,idle/resize and return preserve saved company')
  if a.legacy_save:
   path=Path(a.legacy_save).resolve();legacy=json.loads(json.loads(path.read_text())['payload']);assert legacy['stores'] and 'openingRecords' not in legacy and 'railProjects' not in legacy
   d=menu(p,'設定・保存');p.locator('input[type=file]').set_input_files(str(path));expect(p.locator('.toast')).to_contain_text('会社データを読み込みました');assert state(p)==legacy;d=menu(p,'経営記録');expect(d.locator('.opening-result-empty')).to_contain_text('後から作成しません');expect(d.locator('.opening-result')).to_have_count(0);p.reload();p.get_by_role('button',name=re.compile(re.escape(legacy['companyName'])+' を続ける')).click();expect(p.locator('.immersive-game')).to_be_visible();assert state(p)==legacy;data['legacy']={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'importAndReloadExact':True,'historyNotInvented':True};ok('Legacy save import/reload exact, no fabricated opening or rail records')
  violations.extend(p.evaluate('window.__cspViolations'));assert not violations,violations;assert not blocked,blocked;assert not [r for r in responses if r['status']>=400]
  assert any('.glb' in r['url'] and r['status']==200 for r in responses);assert any('.woff2' in r['url'] and r['status']==200 for r in responses)
  data['cspViolations']=violations;data['blockedExternal']=blocked;data['responses']=responses
  ok('Fonts and authored assets load with no CSP violations or external/HTTP failures')
  assert not errors,errors;complete=True
 except Exception:
  data['failure']=traceback.format_exc()
  try:data['audioContextsAtFailure']=audio(p)
  except:pass
  try:shot(p,'failure')
  except:pass
  raise
 finally:
  data['responses']=responses;data['blockedExternal']=blocked
  try:data['cspViolations']=violations+p.evaluate('window.__cspViolations')
  except:pass
  (OUT/'results.json').write_text(json.dumps({'passed':complete,'checks':checks,'errors':errors,'warnings':warnings,'data':data,'url':a.url,'devDiagnostics':a.dev_diagnostics,'legacyOnly':a.legacy_only,'skipped':['Native Firefox audio playback/timeline: '+a.audio_backend_limitation] if a.audio_backend_limitation else [],'method':'real Firefox/Mesa app; no asset stubs, no state injection, no RAF modification; optional DEV object reads; forwarding native AudioContext constructor observer only; API/timeline evidence is not an audible listening test'},ensure_ascii=False,indent=2));context.close()
  if owned:shutil.rmtree(profile,ignore_errors=True)
  if server:server.shutdown();server.server_close()
