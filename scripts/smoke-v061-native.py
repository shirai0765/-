#!/usr/bin/env python3
"""Targeted v0.6.1 native acceptance; run only after the agreed GPU handoff.

Ordinary new-company/actions and native IndexedDB/DOM reads, normal renderer,
RAF, crypto, TLS verification and browser sandbox. A forwarding Web Audio
observer records native contexts/output nodes; a silent analyser tee samples
their real-time PCM without replacing the original destination connection.
Linux WebKit is supplementary browser evidence, never physical iPhone Safari.
Every invocation requires a fresh --out; historical evidence is retained.
"""
import argparse
import base64
import functools
import hashlib
import json
import math
import os
import re
import shutil
import tempfile
import threading
import traceback
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

expect.set_options(timeout=30000)

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = {'width': 1280, 'height': 900}
PHONE = {'width': 390, 'height': 750}
NAME = '全面決算と音の実操作QA'
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url', default='http://127.0.0.1:5173')
ap.add_argument('--out', required=True)
ap.add_argument('--browser', choices=['firefox', 'webkit'], default='firefox')
ap.add_argument('--profile', help='Disposable externally prepared profile; the wrapper owns its cleanup')
ap.add_argument('--headless', action='store_true', help='Native headless renderer; no RAF or scene substitutions')
ap.add_argument('--production-csp', action='store_true')
ap.add_argument('--dev-diagnostics', action='store_true')
ap.add_argument('--expected-version')
ap.add_argument('--expected-source')
ap.add_argument('--audio-backend-limitation', help='Diagnosed native host limitation; success/PCM is explicitly unrun')
a = ap.parse_args()
OUT = Path(a.out)
if OUT.exists() and any(OUT.iterdir()):
    raise SystemExit('Choose a fresh --out; prior evidence is retained.')
OUT.mkdir(parents=True, exist_ok=True)
shutil.copy2(__file__, OUT / Path(__file__).name)


def source_hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted((ROOT / 'src').rglob('*'))
            if p.is_file() and p.suffix in ['.ts', '.tsx', '.css']}


start_hashes = source_hashes()
(OUT / 'source-start.json').write_text(json.dumps(start_hashes, indent=2) + '\n')
checks, errors, warnings, failures, responses = [], [], [], [], []
data = {'browser': a.browser, 'headless': a.headless, 'viewport': DESKTOP, 'phoneViewport': PHONE,
        'snapshots': {}, 'exports': {}, 'phase': 'startup', 'unrun': [],
        'limitations': ['No physical iPhone Safari or hardware speaker/headphone listening test'],
        'audioBackendLimitation': a.audio_backend_limitation,
        'method': {'companyActions': 'native trusted UI only; no injected cash/reputation/state',
                   'renderer': 'normal application WebGL/RAF', 'tls': 'verification enabled',
                   'audio': 'forwarding native constructor/connect observer plus silent real-output analyser tee'}}
if a.browser == 'webkit':
    data['limitations'].append('Playwright Linux WebKit with mobile/touch configuration; not the iOS Safari process or hardware')
server, csp, context, passed = None, None, None, False
if a.dev_diagnostics:
    assert not a.production_csp and urlsplit(a.url).hostname in ['localhost', '127.0.0.1']
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
    data['csp'] = csp
    data['distIndexSHA256'] = hashlib.sha256((ROOT / 'dist/index.html').read_bytes()).hexdigest()

AUDIO_OBSERVER = """(() => {
  window.__qaCsp=[];
  addEventListener('securitypolicyviolation', e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
  window.__qaAudioContexts=[]; window.__qaAudioOutputs=[]; window.__qaMonitorNodes=new WeakSet();
  if(window.AudioContext){
    const Native=window.AudioContext;
    window.AudioContext=new Proxy(Native,{construct(target,args){
      const context=Reflect.construct(target,args);
      window.__qaAudioContexts.push(context); return context;
    }});
  }
  if(window.AudioNode){
    const nativeConnect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(destination,...args){
      const result=Reflect.apply(nativeConnect,this,[destination,...args]);
      if(destination===this.context.destination && !window.__qaMonitorNodes.has(this) && !window.__qaAudioOutputs.some(o=>o.node===this))
        window.__qaAudioOutputs.push({context:this.context,node:this});
      return result;
    };
  }
})()"""


def button(scope, name):
    return scope.get_by_role('button', name=name, exact=True)


def click(locator):
    if a.browser == 'webkit':
        locator.tap()
    else:
        locator.click()


def current():
    return page.locator('dialog[open]').last


def close_all():
    for _ in range(6):
        dialogs = page.locator('dialog[open]')
        if not dialogs.count():
            return
        if dialogs.last.get_attribute('class') == 'weekly-review-screen':
            click(dialogs.last.locator('.weekly-review-exit'))
        else:
            click(dialogs.last.locator(':scope > section > header > button[aria-label="閉じる"]'))
    assert not page.locator('dialog[open]').count()


def menu(name):
    close_all()
    click(button(page, '経営'))
    click(button(current(), name))
    return current()


def rows():
    return page.evaluate("""()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('shibuya-capital-v1');request.onerror=reject;
      request.onsuccess=()=>{const db=request.result,read=db.transaction('saves').objectStore('saves').getAll();
      read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=reject};})""")


def saved():
    return json.loads(next(r for r in rows() if r['key'] == 'primary')['envelope']['payload'])


def snapshot(name):
    data['phase'] = name
    page.evaluate('()=>document.fonts.ready')
    page.screenshot(path=str(OUT / f'{name}.png'))
    (OUT / f'{name}.txt').write_text(page.locator('body').inner_text() + '\n')
    data['snapshots'][name] = {'textFile': f'{name}.txt', 'imageFile': f'{name}.png', 'viewport': page.viewport_size}
    print('SNAPSHOT', name, flush=True)


def ok(message):
    checks.append(message)
    print('PASS', message, flush=True)


def fit(scope, label):
    bounds = scope.evaluate('(e)=>({width:e.clientWidth,scrollWidth:e.scrollWidth})')
    data.setdefault('bounds', {})[label] = bounds
    assert bounds['scrollWidth'] <= bounds['width'] + 1, {'label': label, **bounds}


def export_state(label):
    before = rows()
    panel = menu('設定・保存')
    with page.expect_download() as download:
        click(button(panel, '保存ファイルを書き出す'))
    path = OUT / f'{label}.json'
    download.value.save_as(str(path))
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    state = json.loads(envelope['payload'])
    assert rows() == before, 'Export changed durable rows'
    data['exports'][label] = {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'week': state['week']}
    close_all()
    return state


def import_state(path):
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    expected = json.loads(envelope['payload'])
    panel = menu('設定・保存')

    def confirm(dialog):
        assert '現在の会社を読み込むファイルの内容で置き換えます' in dialog.message
        dialog.accept()

    page.once('dialog', confirm)
    with page.expect_file_chooser() as chooser:
        click(button(panel, 'ファイルから読み込む'))
    chooser.value.set_files(str(path))
    expect(page.locator('.immersive-game')).to_be_visible()
    expect(page.get_by_role('alert')).to_contain_text('会社データを読み込みました')
    expect(page.locator('dialog[open]')).to_have_count(0)
    assert saved() == expected
    return expected


def service():
    close_all()
    target = page.locator('.city-world').get_by_role('button', name='渋谷銀行を開く', exact=True)
    expect(target).to_be_visible()
    click(target)
    expect(current().get_by_role('heading', name='渋谷銀行', exact=True)).to_be_visible()
    return current()


def site(lot_id):
    close_all()
    click(page.get_by_role('button', name=re.compile('^(出店場所を探す|物件を探す)$')))
    expect(current().locator('.site-list button[data-lot-id]')).to_have_count(48)
    click(current().locator(f'[data-lot-id="{lot_id}"]'))
    expect(current().locator('.facility-content')).to_have_attribute('data-selected-lot-id', lot_id)
    return current()


def audio_state():
    return page.evaluate("()=>window.__qaAudioContexts.map(c=>({state:c.state,time:c.currentTime,sampleRate:c.sampleRate,baseLatency:c.baseLatency??null}))")


def pcm(label, audible=True):
    # Observe the actual node feeding the original destination. The original
    # output connection is untouched; the analysis branch adds only silence.
    reading = page.evaluate("""async()=>{
      const outputs=window.__qaAudioOutputs.filter(o=>o.context.state==='running');
      if(!outputs.length)throw Error('No running real output node');
      const c=outputs[0].context,a=c.createAnalyser(),zero=c.createGain();
      a.fftSize=2048;zero.gain.value=0;window.__qaMonitorNodes.add(zero);
      const nodes=outputs.filter(o=>o.context===c).map(o=>o.node);
      nodes.forEach(n=>n.connect(a));a.connect(zero);zero.connect(c.destination);
      const start=c.currentTime,values=new Float32Array(a.fftSize);
      let count=0,nonzero=0,peak=0,sum=0;const blocks=[],times=[];
      for(let i=0;i<35;i++){
        await new Promise(r=>setTimeout(r,50));a.getFloatTimeDomainData(values);
        blocks.push(new Float32Array(values));times.push(c.currentTime);
        for(const sample of values){if(!Number.isFinite(sample))throw Error('Nonfinite native PCM');
          const v=Math.abs(sample);peak=Math.max(peak,v);sum+=sample*sample;count++;if(v>1e-8)nonzero++;}
      }
      nodes.forEach(n=>n.disconnect(a));a.disconnect();zero.disconnect();
      const packed=new Float32Array(count);blocks.forEach((block,i)=>packed.set(block,i*a.fftSize));
      let binary='';for(const byte of new Uint8Array(packed.buffer))binary+=String.fromCharCode(byte);
      return {state:c.state,start,end:c.currentTime,sampleRate:c.sampleRate,outputNodes:nodes.length,
        samples:count,nonzeroSamples:nonzero,peak,rms:Math.sqrt(sum/count),blockSize:a.fftSize,blockTimes:times,
        pcmBase64:btoa(binary),method:'silent analyser tee on native destination input; sampled blocks, not a continuous device recording'};
    }""")
    raw = OUT / f'{label}.f32le'
    raw.write_bytes(base64.b64decode(reading.pop('pcmBase64')))
    reading['file'] = raw.name
    reading['fileSHA256'] = hashlib.sha256(raw.read_bytes()).hexdigest()
    (OUT / f'{label}-pcm.json').write_text(json.dumps(reading, indent=2) + '\n')
    data.setdefault('pcm', {})[label] = reading
    assert reading['state'] == 'running' and reading['end'] > reading['start'] + 1
    if audible:
        assert reading['nonzeroSamples'] > 0 and 0 < reading['rms'] < 1 and 0 < reading['peak'] < 1, reading
    else:
        assert reading['peak'] < 1e-6 and reading['rms'] < 1e-7, reading
    return reading


def audio_checks():
    before, durable = export_state('02-before-audio'), rows()
    assert audio_state() == [], 'Audio must remain opt-in on fresh mount'
    page.set_viewport_size(PHONE)
    play = button(page, 'カフェの音を再生')
    expect(play).to_be_visible()
    click(play)  # Exactly one trusted HUD tap/click; no settings visit required.
    if a.audio_backend_limitation:
        expect(button(page, 'カフェの音を再試行')).to_be_visible(timeout=12000)
        assert all(c['state'] == 'closed' for c in audio_state())
        click(button(page, 'カフェの音を再試行'))
        expect(button(page, '音の開始をキャンセル')).to_be_visible()
        click(button(page, '音の開始をキャンセル'))
        page.wait_for_function("window.__qaAudioContexts.every(c=>c.state==='closed')")
        data['unrun'].append('Successful native audio/PCM: ' + a.audio_backend_limitation)
        expect(button(page, 'カフェの音を再生')).to_be_visible()
        snapshot('03-phone-audio-truthful-retry')
    else:
        page.wait_for_function("window.__qaAudioContexts.length===1 && window.__qaAudioContexts[0].state==='running'", timeout=12000)
        expect(button(page, 'カフェの音を一時停止')).to_be_visible()
        pcm('one-HUD-click-cafe-and-BGM')
        snapshot('03-phone-audio-one-tap-playing')
        click(button(page, 'カフェの音を一時停止'))
        page.wait_for_function("window.__qaAudioContexts[0].state==='suspended'")
        paused = audio_state()[0]['time']
        page.wait_for_timeout(250)
        assert audio_state()[0]['time'] == paused
        click(button(page, 'カフェの音を再生'))
        page.wait_for_function("window.__qaAudioContexts[0].state==='running'")
        pcm('one-click-resume-existing-context')
        assert len(audio_state()) == 1, 'Resume duplicated native contexts'
        # Ask the browser to change the foreground tab. Some headless hosts do
        # not deliver document visibility changes; record that limit honestly.
        foreground = context.new_page()
        try:
            foreground.goto('about:blank')
            foreground.bring_to_front()
            page.wait_for_timeout(300)
            hidden = page.evaluate('document.hidden')
            data['nativeForegroundTabVisibility'] = {'hiddenDelivered': hidden}
            if hidden:
                page.wait_for_function("window.__qaAudioContexts[0].state==='suspended'")
            page.bring_to_front()
            if hidden:
                page.wait_for_function("!document.hidden && window.__qaAudioContexts[0].state==='running'")
                expect(button(page, 'カフェの音を一時停止')).to_be_visible()
                pcm('native-foreground-return-recovery')
                assert len(audio_state()) == 1
            else:
                data['unrun'].append('OS/tab audio interruption recovery: headless host did not deliver hidden-tab visibility; trusted pause/resume and native output were verified')
        finally:
            foreground.close()
            page.bring_to_front()
    click(button(page, '街のBGMを設定'))
    audio = current().locator('.city-audio-control')
    expect(current().get_by_role('heading', name='カフェの音とBGM', exact=True)).to_be_visible()
    fit(audio, 'phone-audio-settings')
    expect(audio.locator('input[type=range]')).to_have_count(3)
    if not a.audio_backend_limitation:
        audio.get_by_role('slider', name='音量', exact=True).press('End')
        audio.get_by_role('slider', name='BGM', exact=True).press('Home')
        audio.get_by_role('slider', name='店内音', exact=True).press('End')
        pcm('cafe-ambience-only')
        audio.get_by_role('slider', name='BGM', exact=True).press('End')
        audio.get_by_role('slider', name='店内音', exact=True).press('Home')
        pcm('BGM-only')
    # Native range keyboard events exercise all three preference controls.
    for name in ['音量', 'BGM', '店内音']:
        control = audio.get_by_role('slider', name=name, exact=True)
        control.focus()
        control.press('Home')
        control.press('ArrowRight')
        assert control.input_value() == '1'
    click(button(audio, 'BGMを消音'))
    if not a.audio_backend_limitation:
        page.wait_for_timeout(500)
        pcm('muted-running-native-output', audible=False)
        click(button(audio, 'カフェの音を一時停止'))
        page.wait_for_function("window.__qaAudioContexts[0].state==='suspended'")
    prefs = page.evaluate("()=>JSON.parse(localStorage.getItem('shibuya-capital-city-audio-v1'))")
    assert prefs['muted'] and all(math.isclose(prefs[k], .01) for k in ['volume', 'music', 'ambience'])
    data['audioPreferences'] = prefs
    snapshot('04-phone-audio-independent-preferences')
    close_all()
    assert export_state('05-after-audio') == before and rows() == durable
    page.reload(wait_until='domcontentloaded')
    click(page.get_by_role('button', name=re.compile(re.escape(NAME) + ' を続ける')))
    expect(page.locator('.immersive-game')).to_be_visible()
    assert audio_state() == []
    expect(button(page, 'カフェの音を再生')).to_be_visible()
    assert page.evaluate("()=>JSON.parse(localStorage.getItem('shibuya-capital-city-audio-v1'))") == prefs
    assert saved() == before and rows() == durable
    page.set_viewport_size(DESKTOP)
    ok('Audio uses one native HUD gesture, truthful native context/retry state, three independent persistent preferences, no autoplay on reload, and no company/save changes' + ('; successful PCM explicitly unrun due to diagnosed host limitation' if a.audio_backend_limitation else '; running native output has nonzero real-time PCM and one-context pause/resume'))


def review_geometry(panel, result):
    reading = panel.locator(f'[data-loan-review="{result}"] h4').evaluate("""e=>{
      const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      const header=e.closest('dialog').querySelector('section.modal > header').getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,viewportHeight:innerHeight,text:e.innerText,
        withinViewport:r.top>=0&&r.bottom<=innerHeight,unoccluded:e.contains(top),
        headerBottom:header.bottom,hit:{tag:top?.tagName,class:top?.className},
        ancestors:[...function*(n){while(n){yield n;n=n.parentElement}}(e)].filter(n=>n.scrollHeight>n.clientHeight)
          .map(n=>({class:n.className,top:n.scrollTop,height:n.clientHeight,scrollHeight:n.scrollHeight}))};}""")
    data.setdefault('bankImmediateReviewBounds', {})[result] = reading
    (OUT / f'bank-{result}-immediate-bounds.json').write_text(json.dumps(reading, ensure_ascii=False, indent=2) + '\n')
    assert reading['withinViewport'] and reading['unoccluded'], {'result': result, **reading}
    return reading


def bank_checks():
    initial, durable = export_state('06-before-bank'), rows()
    page.set_viewport_size(PHONE)
    panel = service()
    amount = panel.get_by_label('借入希望額（円）', exact=True)
    input_styles = panel.locator('.bank-settings input').evaluate_all("es=>es.map(e=>({label:e.closest('label').innerText,fontSize:getComputedStyle(e).fontSize}))")
    data['phoneBankInputStyles'] = input_styles
    assert len(input_styles) == 2 and all(float(s['fontSize'].removesuffix('px')) >= 16 for s in input_styles)
    expect(amount).to_have_value('3000000')
    amount.fill('6000000')
    click(button(panel, 'この条件で融資審査する'))
    expect(panel.locator('[data-loan-review="declined"]')).to_be_visible()
    review_geometry(panel, 'declined')
    expect(panel.locator('[data-loan-confirm]')).to_have_count(0)
    fit(panel.locator('.financial-service'), 'phone-bank-declined')
    snapshot('07-phone-bank-rejected-no-contract')
    assert export_state('08-after-rejected-screen') == initial and rows() == durable
    panel = service()
    click(button(panel, '10万円'))
    click(button(panel, '13週'))
    quote = panel.locator('[data-loan-quote]')
    expect(quote).to_be_visible()
    details = quote.locator('summary').filter(has_text='支払額と計算の詳細')
    if details.count():
        click(details)
    for field in ['annual-rate', 'initial-interest', 'weekly-principal', 'total-interest']:
        expect(quote.locator(f'[data-loan-field="{field}"]')).to_be_visible()
    quote_data = quote.evaluate('(e)=>({...e.dataset,text:e.innerText})')
    data['loanQuote'] = quote_data
    if details.count():
        click(details)
    click(button(panel, 'この条件で融資審査する'))
    expect(panel.locator('[data-loan-review="approved"]')).to_be_visible()
    review_geometry(panel, 'approved')
    expect(panel.locator('[data-loan-review="approved"] [data-loan-field="annual-rate"]')).to_be_visible()
    fit(panel.locator('.financial-service'), 'phone-bank-approved')
    snapshot('09-phone-bank-approved-quote-no-borrow')
    assert export_state('10-after-approved-screen') == initial and rows() == durable
    panel = service()
    click(button(panel, '10万円'))
    click(button(panel, '13週'))
    click(button(panel, 'この条件で融資審査する'))
    # Changing term invalidates approval without changing company state.
    change = button(panel, '条件を変更する')
    if change.count():
        click(change)
    click(button(panel, '26週'))
    expect(panel.locator('[data-loan-confirm]')).to_have_count(0)
    click(button(panel, '13週'))
    click(button(panel, 'この条件で融資審査する'))
    click(panel.locator('[data-loan-confirm]'))
    borrowed = export_state('11-after-explicit-bank-contract')
    assert borrowed['cash'] == initial['cash'] + 100000 and borrowed['week'] == initial['week']
    assert len(borrowed['loans']) == 1 and borrowed['loans'][0]['principal'] == 100000
    assert borrowed['loans'][0]['weeksLeft'] == 13 and borrowed['loans'][0]['weeklyPayment'] == 100000 / 13
    assert borrowed['lastReport'] == initial['lastReport'] and rows() == durable
    # The actual created loan must match the visible quote, not a hidden default.
    annual_rate = borrowed['loans'][0]['annualRate']
    assert f'{annual_rate * 100:.2f}%' in quote_data['text'], quote_data
    panel = service()
    expect(panel.locator('.service-loans')).to_contain_text('残り13週')
    snapshot('12-phone-bank-explicit-loan')
    click(button(panel.locator('.service-loans'), '一括返済'))
    repaid = export_state('13-after-explicit-bank-repayment')
    assert repaid == initial and rows() == durable
    page.set_viewport_size(DESKTOP)
    panel = service()
    fit(panel.locator('.financial-service'), 'desktop-bank')
    snapshot('14-desktop-bank-entry')
    close_all()
    ok('Phone bank rejects an over-limit request without cash/week/save effects; approved visible amount/13-week/rate quote remains preview-only, changed terms invalidate approval, explicit contract alone borrows, explicit repay restores exact state')


def reopen_report():
    return menu('直近の営業結果')


def fullscreen(scope, label):
    bounds = scope.bounding_box()
    viewport = page.viewport_size
    assert bounds and abs(bounds['x']) <= 1 and abs(bounds['y']) <= 1, bounds
    assert abs(bounds['width'] - viewport['width']) <= 1 and abs(bounds['height'] - viewport['height']) <= 1, bounds
    details = scope.evaluate("""e=>{
      const style=getComputedStyle(e),r=e.getBoundingClientRect();
      const points=[[1,1],[innerWidth-2,1],[1,innerHeight-2],[innerWidth-2,innerHeight-2],[innerWidth/2,innerHeight/2]];
      return {background:style.backgroundColor,position:style.position,dialogModal:e.closest('dialog')?.matches(':modal'),
        hits:points.map(([x,y])=>{const top=document.elementFromPoint(x,y);return {x,y,inside:e.contains(top),tag:top?.tagName,class:top?.className}}),
        focusInside:e.contains(document.activeElement),width:r.width,height:r.height};
    }""")
    data.setdefault('fullscreen', {})[label] = {'bounds': bounds, **details}
    assert details['dialogModal'], details
    assert details['focusInside'], 'Native focus escaped the weekly modal'
    assert all(p['inside'] for p in details['hits']), details
    assert details['background'] != 'rgba(0, 0, 0, 0)' and not re.search(r',\s*(0(?:\.\d+)?)\)$', details['background']), details
    # At every prior HUD control location, native hit testing must resolve to
    # the fullscreen layer. No force click or event dispatch is used.
    hit_test = page.locator('.game-hud button,.hud-context button,.hud-next-week').evaluate_all("""es=>es.map(e=>{
      const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      const top=document.elementFromPoint(x,y);return {label:e.getAttribute('aria-label')||e.innerText,
        onscreen:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,oldHudHit:!!top?.closest('.game-hud,.hud-context,.hud-next-week')};})""")
    data.setdefault('hudHitTests', {})[label] = hit_test
    assert hit_test, 'Expected actual underlying HUD controls'
    assert not any(p['onscreen'] and p['oldHudHit'] for p in hit_test), hit_test
    if scope.get_attribute('data-weekly-review-phase') == 'summary':
        content = scope.locator('.weekly-review-content').evaluate('(e)=>({height:e.clientHeight,scrollHeight:e.scrollHeight})')
        data.setdefault('summaryContentFit', {})[label] = content
        assert content['scrollHeight'] <= content['height'] + 1, {'label': label, **content}
    primary = scope.locator('.weekly-review-primary').evaluate("""e=>{const r=e.getBoundingClientRect();
      const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,width:r.width,height:r.height,
        withinViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,unoccluded:e.contains(hit),text:e.innerText};}""")
    data.setdefault('weeklyPrimaryBounds', {})[label] = primary
    assert primary['withinViewport'] and primary['unoccluded'], {'label': label, **primary}
    fit(scope, label)


def weekly_screen():
    return page.locator('dialog.weekly-review-screen[open]')


def show_news():
    click(button(current(), '今週の街のニュースへ'))
    expect(weekly_screen()).to_have_attribute('data-weekly-review-phase', 'news')
    return weekly_screen()


def weekly_checks():
    page.set_viewport_size(PHONE)
    panel = site('center-01')
    click(button(panel, 'この場所にカフェを開業'))
    expect(page.locator('dialog[open]')).to_have_count(0)
    panel = menu('店舗経営')
    click(button(panel, 'この店を経営'))
    management = page.locator('.store-management')
    click(management.locator('.store-management-purposes button').filter(has_text='商品・価格'))
    expect(management).to_have_attribute('data-store-purpose', 'product')
    price = management.locator('.store-management-field').filter(has_text='販売価格（円）').locator('input')
    price_style = price.evaluate('(e)=>getComputedStyle(e).fontSize')
    data['phoneStorePriceInputFont'] = price_style
    assert float(price_style.removesuffix('px')) >= 16
    price.fill('850')
    snapshot('15a-phone-native-touch-product-draft')
    click(management.locator('.store-management-back'))
    expect(management).to_have_attribute('data-store-purpose', 'home')
    edited = export_state('15b-phone-native-touch-price-applied')
    assert edited['stores'][0]['price'] == 850 and edited['lastReport'] is None
    # This explicit small contract creates a real interest/principal movement,
    # so actual cash must differ from profit and the screen must reconcile it.
    panel = service()
    click(button(panel, '10万円'))
    click(button(panel, '13週'))
    click(button(panel, 'この条件で融資審査する'))
    click(panel.locator('[data-loan-confirm]'))
    before = export_state('15-before-actual-settlement')
    durable_before = rows()
    page.set_viewport_size(PHONE)
    close_all()
    click(page.locator('.hud-next-week'))
    click(button(current(), '営業して週を進める'))
    screen = weekly_screen()
    expect(screen).to_have_attribute('data-weekly-review-phase', 'summary')
    expect(screen.locator('[data-profit-complete]')).to_have_attribute('data-profit-complete', 'true')
    expect(screen.locator('[data-cash-complete]')).to_have_attribute('data-cash-complete', 'true')
    expect(screen.locator('[data-cash-change-complete]')).to_have_attribute('data-cash-change-complete', 'true')
    first = saved()
    assert first['week'] == before['week'] + 1 and first['lastReport']['week'] == before['week']
    report = first['lastReport']
    assert first['cash'] == round(before['cash'] + report['cashChange'])
    assert report['loanRepayment'] > 0 and report['interest'] > 0
    assert report['cashChange'] != report['netProfit'], report
    assert rows() != durable_before
    settled_rows = rows()
    fullscreen(screen, 'phone-weekly-summary')
    for _ in range(5):
        page.keyboard.press('Tab')
        active = screen.evaluate("""e=>{const n=document.activeElement;return {inside:e.contains(n),tag:n?.tagName,
          class:n?.className,label:n?.getAttribute('aria-label'),text:n?.innerText?.slice(0,150),
          oldHud:!!n?.closest('.game-hud,.hud-context,.hud-next-week'),html:n?.outerHTML?.slice(0,450)}}""")
        data.setdefault('nativeTabFocus', []).append(active)
        assert not active['oldHud'], {'nativeTabReachedOldHud': active}
        assert active['inside'] or active['tag'] == 'BODY', {'nativeTabReachedOtherAppControl': active}
    if any(not n['inside'] for n in data['nativeTabFocus']):
        data['limitations'].append('Linux WebKit native Tab briefly focused BODY/browser chrome; no underlying HUD control received focus and native modal hit testing remained exclusive')
    # Full yen amounts, not abbreviated units, must be visible in the summary.
    summary_text = screen.inner_text()
    for value in [report['netProfit'], report['cashChange'], first['cash']]:
        assert f'¥{round(value):,}' in summary_text, {'missingActualAmount': value, 'text': summary_text}
    data['firstActual'] = {'cashBefore': before['cash'], 'cashAfter': first['cash'], 'report': report}
    snapshot('16-phone-fullscreen-actual-summary')
    news = show_news()
    fullscreen(news, 'phone-weekly-news')
    expect(news.locator('.weekly-news')).to_be_visible()
    digest = report['news']
    assert digest['week'] == report['week']
    expected_market = {'advances': 0, 'declines': 0, 'unchanged': 0}
    for stock_id, previous in before['stockPrices'].items():
        actual = first['stockPrices'][stock_id]
        expected_market['advances' if actual > previous else 'declines' if actual < previous else 'unchanged'] += 1
    assert digest['market'] == expected_market
    expect(news.locator('.weekly-news')).to_have_attribute('data-news-week', str(report['week']))
    for category in ['city', 'market', 'company']:
        expect(news.locator(f'[data-news-category="{category}"]')).to_be_visible()
    for movement in digest['companies']:
        stock_id = movement['stockId']
        assert movement['previousPrice'] == before['stockPrices'][stock_id]
        assert movement['currentPrice'] == first['stockPrices'][stock_id]
        assert math.isclose(movement['percentChange'], (movement['currentPrice'] / movement['previousPrice'] - 1) * 100, rel_tol=1e-12)
        shown = news.locator(f'[data-news-stock-id="{stock_id}"]').inner_text()
        assert f"{movement['percentChange']:+.1f}%" in shown if movement['percentChange'] > 0 else f"{movement['percentChange']:.1f}%" in shown
    data['actualNewsReconciliation'] = {'beforePrices': before['stockPrices'], 'afterPrices': first['stockPrices'], 'digest': digest}
    news_text = news.locator('.weekly-news').inner_text()
    data['newsFirstText'] = news_text
    snapshot('17-phone-fullscreen-real-news')
    assert saved() == first and rows() == settled_rows
    click(button(current(), '決算に戻る'))
    expect(weekly_screen()).to_have_attribute('data-weekly-review-phase', 'summary')
    assert saved() == first and rows() == settled_rows
    page.set_viewport_size(DESKTOP)
    fullscreen(weekly_screen(), 'desktop-weekly-summary')
    snapshot('18-desktop-fullscreen-summary')
    news = show_news()
    fullscreen(news, 'desktop-weekly-news')
    assert news.locator('.weekly-news').inner_text() == news_text
    snapshot('19-desktop-fullscreen-news')
    assert saved() == first and rows() == settled_rows
    click(button(current(), f"第{report['week'] + 1}週の経営を始める"))
    expect(page.locator('dialog[open]')).to_have_count(0)
    assert export_state('20-settled-report-and-news') == first and rows() == settled_rows
    ok('390×750 and desktop weekly summary/news occupy an opaque native modal full viewport; old HUD is excluded from hit testing, full actual profit/cash values reconcile, and all phase transitions preserve exact company/save')

    # Change present cash after settlement, then prove reopening still presents
    # recorded settlement cash/news, without another simulation or autosave.
    panel = service()
    remaining = first['loans'][0]['remaining']
    click(button(panel.locator('.service-loans'), '一括返済'))
    after_repay = export_state('21-after-settlement-repayment')
    assert after_repay['cash'] == round(first['cash'] - remaining)
    assert after_repay['lastReport'] == report and rows() == settled_rows
    reopen_report()
    expect(weekly_screen()).to_have_attribute('data-weekly-review-phase', 'summary')
    assert f"¥{round(first['cash']):,}" in weekly_screen().inner_text()
    assert show_news().locator('.weekly-news').inner_text() == news_text
    close_all()
    exact = export_state('22-exact-report-news-save')
    assert exact == after_repay
    panel = menu('設定・保存')
    click(button(panel, '今すぐ保存する'))
    expect(page.get_by_role('alert')).to_contain_text('現在の経営状況を保存しました')
    assert saved() == exact
    saved_rows = rows()
    close_all()
    page.reload(wait_until='domcontentloaded')
    click(page.get_by_role('button', name=re.compile(re.escape(NAME) + ' を続ける')))
    expect(page.locator('.immersive-game')).to_be_visible()
    assert saved() == exact and rows() == saved_rows
    reopen_report()
    assert show_news().locator('.weekly-news').inner_text() == news_text
    snapshot('23-news-exact-reload')
    close_all()
    assert import_state(OUT / '22-exact-report-news-save.json') == exact
    assert export_state('24-exact-reimported-report-news') == exact
    imported_rows = rows()
    page.set_viewport_size(PHONE)
    reopen_report()
    fullscreen(weekly_screen(), 'phone-reimported-summary')
    assert show_news().locator('.weekly-news').inner_text() == news_text
    assert saved() == exact and rows() == imported_rows
    snapshot('25-news-exact-import-and-reopen')
    close_all()
    ok('Recorded actual weekly news and settlement cash survive later explicit repayment, report reopening, exact export/save/reload/import, and phone reopening without recomputation or view-side economic/save changes')


profile = Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix=f'v061-native-{a.browser}-', dir='/tmp'))
try:
    with sync_playwright() as pw:
        options = {'headless': a.headless, 'viewport': DESKTOP, 'accept_downloads': True}
        if a.browser == 'firefox':
            options['firefox_user_prefs'] = {'webgl.force-enabled': True, 'gfx.webrender.software': True}
        else:
            options.update(is_mobile=True, has_touch=True)
        context = getattr(pw, a.browser).launch_persistent_context(str(profile), **options)
        context.add_init_script(AUDIO_OBSERVER)
        page = context.new_page()
        page.set_default_timeout(30000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else warnings.append(msg.text) if msg.type == 'warning' else None)
        page.on('requestfailed', lambda req: failures.append({'url': req.url, 'error': req.failure, 'phase': data['phase']}))
        page.on('response', lambda res: responses.append({'url': res.url, 'status': res.status}))
        try:
            response = page.goto(a.url, wait_until='domcontentloaded')
            assert response and response.status == 200
            if csp:
                assert response.headers.get('content-security-policy') == csp
            page.wait_for_load_state('networkidle')
            data['browserIdentity'] = page.evaluate('()=>({userAgent:navigator.userAgent,secureContext:isSecureContext,devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},touchPoints:navigator.maxTouchPoints})')
            if a.expected_version or a.expected_source:
                release = page.evaluate("async()=>await(await fetch(new URL('release.json',location.href))).json()")
                data['release'] = release
                if a.expected_version:
                    assert release['version'] == a.expected_version
                if a.expected_source:
                    assert release['sourceCommit'] == a.expected_source
            page.get_by_label('会社名', exact=True).fill(NAME)
            click(button(page, '新しい会社を設立'))
            expect(page.locator('.immersive-game')).to_be_visible()
            expect(page.locator('.city-world canvas')).to_be_visible()
            expect(page.locator('.city-webgl-error')).to_have_count(0)
            click(button(current(), '説明を閉じる'))
            page.wait_for_load_state('networkidle')
            if a.dev_diagnostics:
                page.wait_for_function("window.__cityScene?.getObjectByName('Game_economic_site_markers')?.children.length===48")
                page.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
                first_frame = page.evaluate('window.__cityRenderer.info.render.frame')
                page.wait_for_function('f=>window.__cityRenderer.info.render.frame>f', arg=first_frame)
                data['normalRAFFrameProgress'] = {'first': first_frame, 'later': page.evaluate('window.__cityRenderer.info.render.frame')}
            initial = export_state('01-fresh-company')
            assert initial['cash'] == 12000000 and initial['week'] == 1 and not initial['stores'] and not initial['loans']
            snapshot('01-desktop-fresh-renderer')
            ok('Ordinary fresh company starts with native crypto/save and visible real WebGL renderer; no company state injection')
            audio_checks()
            bank_checks()
            weekly_checks()
            page.wait_for_load_state('networkidle')
            data['cspViolations'] = page.evaluate('window.__qaCsp')
            assert not errors and not warnings and not failures, {'errors': errors, 'warnings': warnings, 'requestFailures': failures}
            assert not [r for r in responses if r['status'] >= 400]
            assert not data['cspViolations']
            assert len(checks) == 5
            passed = True
        except Exception:
            data['failure'] = traceback.format_exc()
            print(data['failure'], flush=True)
            try:
                snapshot('failure')
            except Exception:
                pass
        finally:
            try:
                data['cspViolations'] = page.evaluate('window.__qaCsp')
                data['finalAudioContexts'] = audio_state()
                (OUT / 'last-stored-rows.json').write_text(json.dumps(rows(), ensure_ascii=False, indent=2) + '\n')
            except Exception:
                pass
            context.close()
            context = None
except Exception:
    data['launchFailure'] = traceback.format_exc()
    print(data['launchFailure'], flush=True)
finally:
    end_hashes = source_hashes()
    (OUT / 'source-end.json').write_text(json.dumps(end_hashes, indent=2) + '\n')
    data['sourceStable'] = start_hashes == end_hashes
    if not data['sourceStable']:
        passed = False
        data['sourceChangedPaths'] = sorted(k for k in set(start_hashes) | set(end_hashes) if start_hashes.get(k) != end_hashes.get(k))
    data['responses'], data['requestFailures'] = responses, failures
    (OUT / 'results.json').write_text(json.dumps({'passed': passed, 'checks': checks, 'errors': errors, 'warnings': warnings,
        'data': data, 'url': a.url, 'method': __doc__}, ensure_ascii=False, indent=2) + '\n')
    if context:
        context.close()
    if not a.profile:
        shutil.rmtree(profile, ignore_errors=True)
    if server:
        server.shutdown()
        server.server_close()
if not passed:
    raise SystemExit(1)
