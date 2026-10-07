#!/usr/bin/env python3
"""City Burst v0.9.0 focused native WebKit acceptance.
Trusted public UI, unchanged production dist/desktop CSP, one software GPU.
--categories enables independent runs without repeating successful categories.
Natural long-save import is labelled prior CPU gameplay, never native playthrough.
"""
import argparse, base64, functools, hashlib, json, math, re, shutil, tempfile, threading, traceback
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import expect, sync_playwright
ROOT = Path(__file__).resolve().parents[1]
PHONE = {'width':390,'height':750}
DESKTOP = {'width':1280,'height':900}
MODEL_PATHS = ['models/external-v080/sakura-midrise/sakura-office.glb','models/external-v080/sakura-midrise/sakura-residential.glb','models/external-v080/dogenzaka-mixed/dogenzaka-akari-b.glb','models/external-v080/dogenzaka-mixed/dogenzaka-sakamichi-a.glb']
NAME = 'City Burst 実操作QA・長い会社名でも判断できる'
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--out',required=True)
ap.add_argument('--categories',default='property,weekly,finance,group,audio')
ap.add_argument('--natural-save',type=Path)
ap.add_argument('--resume-weekly-from',type=Path)
ap.add_argument('--resume-company-from',type=Path)
ap.add_argument('--skip-audio-pcm',action='store_true')
ap.add_argument('--url')
a=ap.parse_args(); CATEGORIES=set(a.categories.split(','))
assert CATEGORIES <= {'property','weekly','finance','market','group','tail','night','audio'}
OUT=Path(a.out);assert not OUT.exists();OUT.mkdir(parents=True)
shutil.copy2(__file__,OUT/Path(__file__).name)
expect.set_options(timeout=30000)
def hashes(base):
    return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for parent in base for p in sorted(parent.rglob('*')) if p.is_file()}
START=hashes([ROOT/'src',ROOT/'public']);DIST=hashes([ROOT/'dist'])
(OUT/'source-start.json').write_text(json.dumps(START,indent=2)+'\n')
(OUT/'dist-start.json').write_text(json.dumps(DIST,indent=2)+'\n')
result={'method':'Native Linux WebKit/software WebGL; trusted UI, no company/camera/RAF injection; native AudioContext observer forwards originals unchanged; actual production CSP','categories':sorted(CATEGORIES),'checks':[],'snapshots':[],'errors':[],'warnings':[],'requestFailures':[],'httpFailures':[],'assets':[],'observations':{},'exports':{},'limitations':['Software GPU is not physical iPhone/Windows or Ryzen performance','Accepted bundled cafe BGM is enabled; room bed and button/result cues remain original procedural audio; no human listening or physical iPhone check','Imported long-company save is previously generated CPU gameplay, not native playthrough evidence']}
profile=Path(tempfile.mkdtemp(prefix='shibuya-v090-native-',dir='/tmp'));server=context=pw=page=None;passed=False
csp=re.search(r'const csp = "([^"]+)";', (ROOT/'desktop/main.cjs').read_text()).group(1)
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.wasm':'application/wasm','.woff':'font/woff','.woff2':'font/woff2'}
    def translate_path(self,path):
        return super().translate_path(path.removeprefix('/-'))
    def end_headers(self):
        self.send_header('Content-Security-Policy',csp);self.send_header('X-Content-Type-Options','nosniff');super().end_headers()
    def log_message(self,*_):pass
if not a.url:
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'dist')))
    threading.Thread(target=server.serve_forever,daemon=True).start();a.url=f'http://127.0.0.1:{server.server_port}/-/index.html'
result['csp']=csp;result['distIndexSHA256']=hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest()
OBSERVER="""(()=>{
window.__qaCsp=[];addEventListener('securitypolicyviolation',e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
window.__qaAudioContexts=[];window.__qaAudioOutputs=[];window.__qaBuffers=[];window.__qaOscillators=[];window.__qaOscillatorRows=new WeakMap();window.__qaMonitorNodes=new WeakSet();
if(window.AudioContext){const Native=window.AudioContext;window.AudioContext=new Proxy(Native,{construct(target,args){const c=Reflect.construct(target,args);window.__qaAudioContexts.push(c);return c;}});}
if(window.AudioNode){const native=AudioNode.prototype.connect;AudioNode.prototype.connect=function(destination,...args){const v=Reflect.apply(native,this,[destination,...args]);if(destination===this.context.destination&&!window.__qaMonitorNodes.has(this)&&!window.__qaAudioOutputs.some(o=>o.node===this))window.__qaAudioOutputs.push({context:this.context,node:this});return v;};}
if(window.AudioBufferSourceNode){const native=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.__qaBuffers.push({time:this.context.currentTime,start:args[0]??0,offset:args[1]??0,loop:this.loop,loopStart:this.loopStart,loopEnd:this.loopEnd,duration:this.buffer?.duration??null,channels:this.buffer?.numberOfChannels??null,sampleRate:this.buffer?.sampleRate??null,playbackRate:this.playbackRate.value});return Reflect.apply(native,this,args);};}
if(window.OscillatorNode){const native=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(...args){const row={frequency:this.frequency.value,time:this.context.currentTime,start:args[0]??0,type:this.type};window.__qaOscillatorRows.set(this,row);window.__qaOscillators.push(row);return Reflect.apply(native,this,args);};const stop=OscillatorNode.prototype.stop;OscillatorNode.prototype.stop=function(...args){const row=window.__qaOscillatorRows.get(this);if(row&&args[0]!==undefined)row.duration=args[0]-row.start;return Reflect.apply(stop,this,args);};}
})()"""
def ok(message):result['checks'].append(message);print('PASS',message,flush=True)
def button(scope,name):return scope.get_by_role('button',name=name,exact=True)
def current():return page.locator('dialog[open]').last
def close_all():
    for _ in range(8):
        if not page.locator('dialog[open]').count():return
        panel=current()
        if panel.get_attribute('class')=='weekly-review-screen':panel.locator('.weekly-review-exit').click()
        elif panel.get_attribute('class')=='campaign-completion-screen':panel.locator('.campaign-completion-exit').click()
        else:panel.locator(':scope > section > header > button[aria-label="閉じる"]').click()
    assert not page.locator('dialog[open]').count()
def menu(name):
    close_all();button(page,'経営').click();button(current(),re.compile('^営業・提案(?: [0-9]+件)?$') if name=='営業・提案' else name).click();return current()
def rows():
    return page.evaluate("""()=>new Promise((resolve,reject)=>{const request=indexedDB.open('shibuya-capital-v1');request.onerror=reject;request.onsuccess=()=>{const db=request.result,read=db.transaction('saves').objectStore('saves').getAll();read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=reject};})""")
def saved():return json.loads(next(r for r in rows() if r['key']=='primary')['envelope']['payload'])
def export_state(label):
    durable=rows();panel=menu('設定・保存')
    with page.expect_download() as download:button(panel,'保存ファイルを書き出す').click()
    path=OUT/f'{label}.save.json';download.value.save_as(str(path));envelope=json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest()==envelope['checksum'];assert rows()==durable
    result['exports'][label]={'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()};close_all();return json.loads(envelope['payload'])
def import_state(path,provenance='Prior actual public-action CPU gameplay; UI import only, not native 941-week playthrough'):
    envelope=json.loads(path.read_text());assert hashlib.sha256(envelope['payload'].encode()).hexdigest()==envelope['checksum']
    panel=menu('設定・保存');page.once('dialog',lambda d:d.accept())
    with page.expect_file_chooser() as chooser:button(panel,'ファイルから読み込む').click()
    chooser.value.set_files(str(path));expect(page.locator('dialog[open]')).to_have_count(0)
    expected=json.loads(envelope['payload']);assert saved()==expected
    result.setdefault('importedFixtures',[]).append({'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'provenance':provenance})
    return expected

def snapshot(label):
    page.evaluate('()=>document.fonts.ready');page.screenshot(path=str(OUT/f'{label}.png'))
    (OUT/f'{label}.txt').write_text(page.locator('body').inner_text()+'\n');result['snapshots'].append(label)
    result['observations'][label+'-icons']=page.locator('.game-icon').evaluate_all('es=>es.filter(e=>e.getBoundingClientRect().width>0).slice(0,8).map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {style:e.getAttribute("style"),mask:s.maskImage,webkitMask:s.webkitMaskImage,color:s.color,background:s.backgroundColor,display:s.display,width:r.width,height:r.height}})')
    print('SNAPSHOT',str(OUT/f'{label}.png'),flush=True)
def fit(locator):
    value=locator.evaluate('e=>({width:e.clientWidth,scrollWidth:e.scrollWidth})');assert value['scrollWidth']<=value['width']+1,value;return value

def contrast(locator,label,minimum=3):
    value=locator.evaluate("""e=>{const s=getComputedStyle(e);let p=e,bg='';while(p){const q=getComputedStyle(p);if(q.backgroundImage!=='none'){bg=q.backgroundImage;break}if(q.backgroundColor!=='rgba(0, 0, 0, 0)'){bg=q.backgroundColor;break}p=p.parentElement}return {text:e.textContent,color:s.color,background:bg,fontSize:s.fontSize,fontFamily:s.fontFamily};}""")
    def luminance(color):
        nums=list(map(float,re.findall(r'[\d.]+',color)))[:3];assert len(nums)==3,color
        rgb=[n/255 for n in nums];linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
        return .2126*linear[0]+.7152*linear[1]+.0722*linear[2]
    lum1=luminance(value['color']);backgrounds=re.findall(r'rgba?\([^)]*\)',value['background']);backgrounds=[b for b in backgrounds if not b.startswith('rgba') or float(re.findall(r'[\d.]+',b)[-1])>=.99]
    if not backgrounds:
        value['ratio']=None;value['method']='Translucent gradient over image; actual screenshot requires visual review, no solid-color ratio claimed';result['observations'][label]=value;return
    value['ratio']=min((max(lum1,luminance(b))+.05)/(min(lum1,luminance(b))+.05) for b in backgrounds)
    result['observations'][label]=value;assert value['ratio']>=minimum,value

def select_site(lot='dogenzaka-13'):
    close_all();page.get_by_role('button',name=re.compile('^(出店場所を探す|物件を探す)$')).click()
    current().locator(f'[data-lot-id="{lot}"]').click();expect(current().locator('.facility-content')).to_have_attribute('data-selected-lot-id',lot);return current()
def theme(choice):
    menu('設定・保存');button(current(),'デザインを選ぶ').click();current().locator(f'.design-{choice}').click();close_all()
def yen(v):return '¥'+format(round(v),',')
def oscillators():
    # Native cue duration .14 + .02 tail; BGM schedulers keep producing muted
    # voices, so oscillator totals cannot prove feedback deduplication.
    return page.evaluate('window.__qaOscillators.filter(o=>o.duration!==undefined&&Math.abs(o.duration-.16)<1e-7)')
def capture_pcm(label,audible=True):
    reading=page.evaluate("""async()=>{const output=window.__qaAudioOutputs.find(o=>o.context.state==='running');if(!output)throw Error('No real output');const c=output.context,a=c.createAnalyser(),zero=c.createGain();a.fftSize=2048;zero.gain.value=0;window.__qaMonitorNodes.add(zero);output.node.connect(a);a.connect(zero);zero.connect(c.destination);const values=new Float32Array(a.fftSize);let peak=0,sum=0,count=0;const start=c.currentTime;for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,50));a.getFloatTimeDomainData(values);for(const v of values){if(!Number.isFinite(v))throw Error('Nonfinite PCM');peak=Math.max(peak,Math.abs(v));sum+=v*v;count++}}output.node.disconnect(a);a.disconnect();zero.disconnect();return {peak,rms:Math.sqrt(sum/count),samples:count,start,end:c.currentTime,method:'Silent analyser tee; original destination unchanged, sampled native PCM'}}""")
    assert reading['end']>reading['start']
    if audible:assert reading['peak']>1e-6 and reading['rms']>1e-7
    else:assert reading['peak']<1e-8 and reading['rms']<1e-9
    result['observations'][label]=reading
    return reading

def enable_audio(light=False):
    assert page.evaluate('window.__qaAudioContexts.length')==0,'Autoplay created context before gesture'
    button(page,'カフェの音を再生').click();page.wait_for_function("window.__qaAudioContexts.length===1&&window.__qaAudioContexts[0].state==='running'",timeout=12000)
    expect(page.locator('.city-audio-start')).to_have_attribute('aria-label','カフェの音を一時停止',timeout=12000)
    button(page,'街のBGMを設定').click()
    if not light and any('audio/external' in asset['url'] for asset in result['assets']):
        buffers=page.evaluate('window.__qaBuffers');music=[b for b in buffers if b['loop'] and b['duration']>8.1];assert len(music)==1 and music[0]['loopStart']==0 and abs(music[0]['loopEnd']-2016000/44100)<=1/music[0]['sampleRate'];result['observations']['actualBundledMusicLoop']=music[0];assert page.evaluate('window.__qaOscillators.filter(o=>o.type==="triangle").length')==0
        ambience=current().get_by_label('店内音',exact=True);ambience.focus();ambience.press('Home');expect(ambience).to_have_value('0');close_all();capture_pcm('nativeBundledMusicSoloPCM');button(page,'街のBGMを設定').click();button(current(),'音を消音').click();close_all();page.wait_for_timeout(500);capture_pcm('nativeBundledMusicMutedPCM',audible=False);button(page,'街のBGMを設定').click();button(current(),'音の消音を解除').click();ambience=current().get_by_label('店内音',exact=True);ambience.focus();ambience.press('End');expect(ambience).to_have_value('100')
    volume=current().get_by_label('BGM',exact=True);volume.focus();volume.press('Home');expect(volume).to_have_value('0');close_all()
    result['observations']['nativeBufferSources']=page.evaluate('window.__qaBuffers');result['observations']['nativeAudioInitial']=page.evaluate("window.__qaAudioContexts.map(c=>({state:c.state,sampleRate:c.sampleRate}))")
    if light:
        ok('Targeted remainder uses one opt-in ready native context for loss/replay cue observation; prior successful PCM is not repeated')
        return
    capture_pcm('nativeAmbiencePCM')
    ok('One opt-in native AudioContext runs ambience and any enabled bundled music with nonzero real-time PCM; BGM independently set to zero for cue observations')

def property_checks():
    panel=select_site();before=export_state('before-property');panel=select_site()
    for vp in [PHONE,DESKTOP]:
        page.set_viewport_size(vp);panel.locator('.modal').evaluate('e=>e.scrollTop=0');snapshot(f'property-{vp["width"]}-hero')
        panel.locator('.opening-options').scroll_into_view_if_needed();fit(panel.locator('.property-scene-body'));snapshot(f'property-{vp["width"]}-styles')
    page.set_viewport_size({'width':360,'height':750});fit(panel.locator('.property-scene-body'))
    for label,cost in [('街角カフェ',3600000),('プレミアム',4800000),('テイクアウト',3000000)]:
        option=panel.locator('.opening-option').filter(has_text=label);option.click();expect(option).to_have_attribute('aria-pressed','true')
        assert panel.locator('.opening-option[aria-pressed="true"]').count()==1
        expect(panel.locator('.opening-primary-values')).to_contain_text(yen(cost));expect(panel.locator('.opening-primary-values')).to_contain_text(yen(before['cash']-cost))
    panel.locator('.facility-property-options > summary').click();expect(panel.locator('.property-scene-buy')).to_be_disabled();expect(panel.locator('.property-scene-purchase-facts')).to_contain_text(yen(before['cash']))
    snapshot('property-360-prices-and-insufficient-funds')
    assert export_state('property-view-only')==before
    page.set_viewport_size(PHONE);theme('night');panel=select_site();contrast(panel.locator('.opening-style-description'),'night-property-body',4.5);panel.locator('.opening-options').scroll_into_view_if_needed();snapshot('property-390-night')
    page.set_viewport_size(PHONE);close_all();theme('daylight');panel=select_site();panel.locator('.property-scene-view').click();expect(page.locator('dialog[open]')).to_have_count(0);button(page,'街全体に戻る').click()
    assert export_state('after-explicit-property-view')==before
    ok('Approved B property hero/three illustrated choices captured at390/1280;360prices/funds fit; styles and explicit view change no company state; night body contrast checked')

def open_store():
    panel=select_site();panel.locator('.opening-option').filter(has_text='テイクアウト').click();panel.locator('.opening-launch').click();expect(page.locator('dialog[open]')).to_have_count(0)
    opened=export_state('opened-takeaway');assert opened['week']==1 and opened['cash']==9000000 and len(opened['stores'])==1
    page.wait_for_timeout(8100);expect(page.locator('.toast')).to_have_count(0);expect(page.locator('.first-step-hint')).to_contain_text('1号店が開業');snapshot('first-store-hint-after-toast-disappeared');return opened

def run_week():
    close_all();page.locator('.hud-next-week').click();button(current(),re.compile('^(営業して週を進める|リスクを承知して営業する)$')).click()
    expect(page.locator('.weekly-review-screen[open]')).to_be_visible();return saved()
def assert_amounts(state):
    company=current().locator('.weekly-results-company');expect(company).to_have_attribute('data-settlement-animation','complete')
    report=state['lastReport'];cash=next(h['cash'] for h in state['history'] if h['week']==report['week'])
    expect(company.locator('.weekly-results-profit > strong')).to_have_attribute('aria-label','全社純利益 '+yen(report['netProfit']))
    expect(company.locator('[data-cash-complete]')).to_have_attribute('aria-label',yen(cash));return company

def weekly_checks(opened):
    if a.resume_weekly_from:
        prior=import_state(a.resume_weekly_from,'Prior production02 native UI opening + actual week1/autosave; exact exported stateweek2, not synthetic data')
        assert prior['week']==2 and prior['lastReport']['week']==1
        loss_and_reload()
        ok('Targeted continuation imports prior actual stateweek2 exactly, public advertising creates real loss and exactsave/export/reload; earlier positive/reduced-motion UI is not repeated')
        return
    notes=len(oscillators());settled=run_week();report=settled['lastReport']
    expect(page.locator('.first-step-hint')).to_have_count(0);assert settled['week']==2 and report['week']==1 and not settled['gameOver'];assert settled['cash']==round(opened['cash']+report['cashChange'])
    skip=button(current(),'結果をすぐ表示')
    if skip.count():skip.click();result['observations']['actualSkipClicked']=True
    company=assert_amounts(settled);expect(button(current(),'結果をすぐ表示')).to_have_count(0)
    assert company.get_attribute('data-settlement-outcome')==('positive' if report['netProfit']>0 else 'negative' if report['netProfit']<0 else 'neutral')
    for vp in [PHONE,DESKTOP]:
        page.set_viewport_size(vp);fit(current().locator('.weekly-review-surface'));snapshot(f'weekly-{vp["width"]}-actual-first-settlement')
        if vp==PHONE:
            glance=current().evaluate('e=>{const header=e.querySelector(".weekly-review-header").getBoundingClientRect(),footer=e.querySelector(".weekly-review-footer").getBoundingClientRect();return [...e.querySelectorAll(".weekly-results-customers,.weekly-review-detail-link")].map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,top:r.top,bottom:r.bottom,withinContent:r.top>=header.bottom-1&&r.bottom<=footer.top+1}})}')
            result['observations']['weekly390OneGlance']=glance;assert len(glance)==2 and all(g['withinContent'] for g in glance),glance
    if 'audio' in CATEGORIES:
        after=oscillators()[notes:];frequencies=[o['frequency'] for o in after];expected=[523.25,659.25,783.99] if report['netProfit']>0 else [293.66] if report['netProfit']<0 else [440]
        assert all(any(abs(f-x)<.1 for f in frequencies) for x in expected),frequencies;result['observations']['actualWeeklyCue']=after
    page.set_viewport_size(PHONE);button(current(),'今週の街のニュースへ').click();expect(current()).to_have_attribute('data-weekly-review-phase','news');fit(current().locator('.weekly-review-surface'));snapshot('weekly-390-news')
    button(current(),'決算に戻る').click();assert_amounts(settled);expect(button(current(),'結果をすぐ表示')).to_have_count(0)
    close_all();before_notes=len(oscillators());menu('直近の営業結果');assert_amounts(settled);expect(button(current(),'結果をすぐ表示')).to_have_count(0);page.wait_for_timeout(350);assert len(oscillators())==before_notes
    close_all();assert export_state('actual-first-settlement')==settled
    theme('night');menu('直近の営業結果');contrast(current().locator('.weekly-results-profit-label'),'night-weekly-label');snapshot('weekly-390-night');close_all();theme('daylight')
    # A genuine second settlement under a browser reduced-motion preference.
    page.emulate_media(reduced_motion='reduce');before_notes=len(oscillators());reduced=run_week();assert_amounts(reduced);expect(button(current(),'結果をすぐ表示')).to_have_count(0);assert len(oscillators())==before_notes;snapshot('weekly-390-reduced-motion');close_all();page.emulate_media(reduced_motion='no-preference')
    loss_and_reload()
    ok('Real settled positive/loss reports, skip/reopen/no-repeat, browser reduced motion, news and saved historical amounts operate; three actual weeks export/reload exactly and sound stays opt-in')

def loss_and_reload():
    # Public store settings produce actual loss without injected balances/report data.
    panel=select_site();button(panel,re.compile('^広告・改装')).click();field=panel.locator('.store-management-field').filter(has_text='週間広告費（円）').locator('input');field.fill('500000');field.press('Tab');close_all()
    before_loss=len(oscillators());loss=run_week();assert loss['lastReport']['netProfit']<0 and not loss['gameOver'];company=assert_amounts(loss);expect(company.locator('.weekly-results-reward-art')).to_have_count(0);snapshot('weekly-390-actual-loss')
    if 'audio' in CATEGORIES:
        notes=oscillators()[before_loss:];assert len(notes)==1 and abs(notes[0]['frequency']-293.66)<.1,notes;result['observations']['actualLossCue']=notes
    close_all()
    final=export_state('after-actual-loss-settlement');durable=rows();assert final==loss
    page.reload(wait_until='domcontentloaded');page.get_by_role('button',name=re.compile(re.escape(NAME)+' を続ける')).click();expect(page.locator('.immersive-game')).to_be_visible();assert rows()==durable and saved()==loss
    assert export_state('exact-reloaded-company')==loss
    assert page.evaluate('window.__qaAudioContexts.length')==0,'Reload autoplay'

def financial_checks():
    before=export_state('before-financial-ui');panel=menu('財務・不動産');fit(panel.locator('.page-content'));panel.locator('.capital-option').filter(has_text='銀行から借りる').click();expect(panel.locator('.capital-option[aria-pressed="true"]')).to_contain_text('銀行から借りる');snapshot('finance-390-capital-selection');close_all();theme('night')
    panel=select_site();panel.locator('.facility-property-options > summary').click();panel.locator('.property-scene-bank').click();expect(current().locator('[data-financial-service]')).to_have_attribute('data-financial-service','bank');panel=current()
    panel.get_by_label('借入希望額（円）',exact=True).fill('100000');panel.get_by_label('元本の返済期間（週）',exact=True).fill('52');expect(panel.locator('[data-loan-quote]')).to_contain_text('52週返済');contrast(panel.locator('.bank-application h3'),'night-bank-heading');snapshot('bank-390-night-quote')
    button(panel,'この条件で融資審査する').click();expect(panel.locator('[data-loan-review]')).to_have_attribute('data-loan-review','approved');snapshot('bank-390-night-approved');panel.locator('[data-loan-confirm]').click();expect(panel.locator('[data-loan-step]')).to_have_attribute('data-loan-step','receipt');snapshot('bank-390-night-receipt')
    borrowed=export_state('actual-bank-receipt');assert borrowed['cash']==before['cash']+100000 and borrowed['week']==before['week'] and len(borrowed['loans'])==len(before['loans'])+1
    # Re-enter retained loan list and repay before another week.
    panel=select_site();panel.locator('.facility-property-options > summary').click();panel.locator('.property-scene-bank').click();button(current(),'一括返済').click();assert export_state('loan-repaid')==before
    market_checks()
    ok('390px capital selection, bank quote/approval/exact100k receipt/repayment and searched10-share order preserve actual economics; night market heading checked')

def market_checks():
    before=export_state('before-stock-trade')
    theme('night');panel=menu('株式市場');contrast(panel.locator('.market-service-header h3'),'night-market-heading');panel.get_by_label('銘柄を検索',exact=True).fill('xyz条件なし');expect(panel.locator('tbody tr')).to_have_count(0);button(panel,'絞り込みを解除').click();panel.get_by_label('1株の購入予算',exact=True).select_option('500');row=panel.locator('tbody tr').first;stock_name=row.locator('td').first.locator('strong').inner_text();button(row,'買う').click();order=current();button(order,'10 株').click();snapshot('market-390-night-order')
    total=int(re.sub(r'[^\d]','',order.locator('.cost-list').filter(has_text='購入総額').locator('div').filter(has_text='購入総額').locator('dd').inner_text()))
    order.get_by_role('button',name=re.compile('^10株を購入する')).click();after=export_state('actual-ten-share-purchase');assert after['cash']==before['cash']-total and after['week']==before['week'];assert sum(p['shares'] for p in after['positions'])==10
    result['observations']['actualStockOrder']={'name':stock_name,'shares':10,'chargedCash':total};theme('daylight')
    ok('390px night market search/reset/order10 shares uses displayed exacttotal and currentfunds; actual image-backed heading captured for visual review')

def group_checks():
    assert a.natural_save and a.natural_save.exists(),'Group needs labelled prior natural-play save'
    state=import_state(a.natural_save);panel=menu('グループ');row=panel.locator('[data-group-sector]').first
    button(row,'運営・投資を考える').click();button(panel,'成長に投資').click();upfront=int(panel.locator('[data-operation-upfront]').get_attribute('data-operation-upfront'));weekly=int(panel.locator('[data-operation-weekly-cost]').get_attribute('data-operation-weekly-cost'));reserve=int(panel.locator('[data-operation-reserve]').get_attribute('data-operation-reserve'));assert reserve==upfront+weekly*26
    snapshot('group-390-growth-26week-comparison');button(panel,'開始前の支払と収支を確認').click();expect(panel.locator('[data-operation-confirm]')).to_have_attribute('data-operation-confirm','true');snapshot('group-390-growth-confirmation');button(panel,'比較に戻る').click()
    assert export_state('natural-group-view-only')==state
    theme('night');panel=menu('グループ');button(panel.locator('[data-group-sector]').first,'運営・投資を考える').click();button(panel,'変動を抑える').click();contrast(panel.locator('.group-operation-heading'),'night-group-heading');snapshot('group-390-night-stability');close_all();theme('daylight')
    panel=menu('街区開発');snapshot('development-390-natural-project-status');close_all()
    tail_checks(state)
    result['observations']['groupReserve']={'upfront':upfront,'weekly':weekly,'term':26,'reserve':reserve}
    ok('Prior natural-play save imports exactly; group growth/stability26-week amounts and nested confirmation, development/deals/historical achievement remain view-only')

def tail_checks(state):
    panel=menu('営業・提案');snapshot('deals-390-natural-offers');close_all()
    menu('直近の営業結果');assert_amounts(state);fit(current().locator('.weekly-results-company'));snapshot('weekly-390-natural-long-amounts');close_all()
    if state.get('campaignAchievement'):
        menu('街と企業の達成記録');snapshot('achievement-390-historical-natural-record');close_all()
    assert export_state('natural-long-save-ui-unchanged')==state
    ok('Targeted tail shows saved news/offers, historical long amounts and earned receipt; closes custom dialogs and exactexports unchanged without weeks/actions')

def night_checks():
    assert a.resume_company_from,'Use prior actual native company with ordinary funds'
    theme('night');panel=select_site();panel.locator('.facility-property-options > summary').click();panel.locator('.property-scene-bank').click();panel=current()
    contrast(panel.locator('.service-loans > h3'),'final-night-bank-loan-heading',4.5);contrast(panel.locator('.service-loans > .muted'),'final-night-bank-no-loan-text',4.5)
    panel.locator('.service-loans').scroll_into_view_if_needed();snapshot('bank-night-empty-loan-heading')
    panel.get_by_label('借入希望額（円）',exact=True).fill('100000');panel.get_by_label('元本の返済期間（週）',exact=True).fill('52');button(panel,'この条件で融資審査する').click();panel.locator('[data-loan-confirm]').click();expect(panel.locator('[data-loan-step]')).to_have_attribute('data-loan-step','receipt')
    page.wait_for_timeout(500);status=panel.locator('.bank-submitted');opacity=status.evaluate('e=>getComputedStyle(e).opacity');assert float(opacity)==1,opacity
    result['observations']['settledBankReceiptOpacity']=opacity;contrast(status,'final-night-bank-stable-receipt',4.5);status.scroll_into_view_if_needed();snapshot('bank-night-stable-receipt-and-loan-heading')
    contrast(panel.locator('.service-loans > h3'),'final-night-bank-owned-loan-heading',4.5)
    # Close the ephemeral receipt naturally, then inspect changed bare market text.
    panel=menu('株式市場');note=panel.locator('.investment-panel > .market-note').first;contrast(note,'final-night-market-bare-note',4.5);note.scroll_into_view_if_needed();contrast(panel.locator('.market-results > label'),'final-night-market-checkbox-label',4.5);snapshot('market-night-bare-note-checkbox')
    button(panel,'友好的買収').click();contrast(panel.locator('.ma-intro h3'),'final-night-acquisition-heading',4.5);contrast(panel.locator('.ma-intro p'),'final-night-acquisition-intro',4.5);snapshot('market-night-acquisition-bare-intro');close_all()
    # Prior CPU natural-play import supplies eligible businesses; no campaign replay.
    import_state(a.natural_save);panel=menu('グループ');button(panel.locator('[data-group-sector]').first,'運営・投資を考える').click();button(panel,'成長に投資').click()
    notes=panel.locator('.group-operations > .group-operation-note');assert notes.count()>=3
    for i in range(min(3,notes.count())):contrast(notes.nth(i),f'final-night-group-bare-note-{i}',4.5)
    contrast(panel.locator('.group-operation-comparison .group-operation-note'),'final-night-group-inner-white-card-note',4.5)
    notes.first.scroll_into_view_if_needed();snapshot('group-night-count-policy-description');close_all()
    panel=menu('営業・提案');heading=panel.locator('.deal-contracts > h3');contrast(heading,'final-night-deals-contract-heading',4.5);heading.scroll_into_view_if_needed();snapshot('deals-night-bare-contract-heading');close_all()
    ok('Final scoped night surfaces: loan/no-loan headings, fully settled receipt opacity1, market bare notes/checkbox/acquisition intro, group directwhite/nesteddark notes and deals heading read with measured contrast')

def assets_checks():
    fonts=page.evaluate("""async()=>{await document.fonts.ready;return {dela:document.fonts.check('400 20px "Dela Gothic One"','営業結果'),barlow:document.fonts.check('italic 900 30px "Barlow Condensed Game"','123456789'),faces:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight,style:f.style}))}}""")
    assert fonts['dela'] and fonts['barlow'];assert any(f['family'].strip(chr(34)+chr(39))=='Dela Gothic One' and f['status']=='loaded' for f in fonts['faces']);assert any(f['family'].strip(chr(34)+chr(39))=='Barlow Condensed Game' and f['status']=='loaded' for f in fonts['faces']);result['observations']['actualFonts']=fonts
    icons=page.locator('.game-icon').evaluate_all('es=>es.map(e=>({hidden:e.getAttribute("aria-hidden"),mask:getComputedStyle(e).maskImage}))');assert icons and all(i['hidden']=='true' and i['mask']!='none' for i in icons);result['observations']['decorativeIcons']=icons[:20];assert all('/-/icons/phosphor/' in i['mask'] for i in icons),icons[:3]
    requested=page.evaluate('performance.getEntriesByType("resource").map(e=>e.name)');result['observations']['requestedUIAssets']=[u for u in requested if re.search(r'(Dela|Barlow|icons/phosphor|city-hero|cafe-hero|cafe-options)',u)]
    assert any('city-hero' in u for u in requested)
    if CATEGORIES & {'property','weekly','finance','night'}:assert any('cafe-hero' in u for u in requested)
    if 'property' in CATEGORIES:assert any('cafe-options' in u for u in requested)
    ok('Actual bundled Dela/Barlow faces loaded; relevant visible backgrounds and decorative icon masks load without assetHTTP/CSP failures')

def observe_response(response):
    if response.status>=400:result['httpFailures'].append({'url':response.url,'status':response.status})
    if re.search(r'(icons/phosphor|Dela|Barlow|city-hero|cafe-hero|cafe-options|audio/external|models/external-v080)',response.url):result['assets'].append({'url':response.url,'status':response.status,'mime':response.headers.get('content-type')})

try:
    pw=sync_playwright().start();context=pw.webkit.launch_persistent_context(str(profile),headless=True,viewport=PHONE,has_touch=True,accept_downloads=True);context.add_init_script(OBSERVER);page=context.pages[0]
    page.on('pageerror',lambda e:result['errors'].append(str(e)));page.on('console',lambda m:result['errors' if m.type=='error' else 'warnings'].append(m.text) if m.type in ['error','warning'] else None)
    page.on('requestfailed',lambda r:result['requestFailures'].append({'url':r.url,'error':r.failure}));page.on('response',observe_response)
    response=page.goto(a.url,wait_until='domcontentloaded');assert response.status==200
    page.get_by_label('会社名',exact=True).fill(NAME);button(page,'新しい会社を設立').click();expect(page.locator('.immersive-game')).to_be_visible();button(page,'説明を閉じる').click();page.wait_for_load_state('networkidle');assert page.evaluate('()=>!["__cityScene","__cityCamera","__cityRenderer"].some(k=>k in window)')
    snapshot('city-390-approved-B-chrome');page.set_viewport_size(DESKTOP);snapshot('city-1280-four-real-backgrounds');page.set_viewport_size(PHONE)
    loaded={asset['url'].split('/-/')[-1] for asset in result['assets'] if asset['status']==200};assert set(MODEL_PATHS)<=loaded,loaded
    ok('Four reviewed real GLB backgrounds load200 in unchanged production under /-/; default390/1280 city captured without diagnostic globals')
    if a.resume_company_from:import_state(a.resume_company_from,'Prior production04 native real loss + exact bank receipt/repayment; current company export, not synthetic data')
    if 'audio' in CATEGORIES:enable_audio(light=a.skip_audio_pcm)
    if 'property' in CATEGORIES:property_checks()
    if 'weekly' in CATEGORIES:weekly_checks(None if a.resume_weekly_from else open_store())
    if 'finance' in CATEGORIES:financial_checks()
    elif 'market' in CATEGORIES:market_checks()
    if 'night' in CATEGORIES:night_checks()
    if 'group' in CATEGORIES:group_checks()
    elif 'tail' in CATEGORIES:tail_checks(import_state(a.natural_save))
    assets_checks();result['cspViolations']=page.evaluate('window.__qaCsp');assert not result['errors'] and not result['warnings'] and not result['requestFailures'] and not result['httpFailures'] and not result['cspViolations'];passed=True
except Exception:
    result['failure']=traceback.format_exc();print(result['failure'],flush=True)
    if page and not page.is_closed():
        try:snapshot('failure')
        except Exception:pass
finally:
    if context:
        try:context.close();result['contextClosed']=True
        except Exception as e:result['cleanupError']=str(e)
    if pw:
        try:pw.stop();result['driverStopped']=True
        except Exception as e:result['driverCleanupError']=str(e)
    if server:server.shutdown();server.server_close()
    shutil.rmtree(profile,ignore_errors=True);result['profileRemoved']=not profile.exists();result['sourceStable']=hashes([ROOT/'src',ROOT/'public'])==START;result['distStable']=hashes([ROOT/'dist'])==DIST
    result['functionalPassed']=passed;result['passed']=passed and result['sourceStable'] and result['distStable'] and result['profileRemoved'] and result.get('contextClosed',False) and result.get('driverStopped',False) and not result.get('cleanupError') and not result.get('driverCleanupError')
    (OUT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':result['passed'],'checks':len(result['checks']),'errors':len(result['errors']),'warnings':len(result['warnings']),'requestFailures':len(result['requestFailures']),'httpFailures':len(result['httpFailures']),'sourceStable':result['sourceStable'],'distStable':result['distStable'],'profileRemoved':result['profileRemoved']},ensure_ascii=False),flush=True)
raise SystemExit(0 if result['passed'] else 1)
