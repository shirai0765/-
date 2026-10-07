#!/usr/bin/env python3
"""One narrow native public v090 flow; no DEV globals or injected state."""
import argparse
import hashlib
import json
import re
import shutil
import tempfile
import traceback
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--expected-source', required=True)
ap.add_argument('--expected-index-sha256', required=True)
a = ap.parse_args()
OUT = Path(a.out)
assert not OUT.exists(), 'Keep previous evidence; choose a fresh output directory'
OUT.mkdir(parents=True)
shutil.copy2(__file__, OUT / Path(__file__).name)
PHONE = {'width': 390, 'height': 750}
NAME = '公開版・外周の初営業QA'
expect.set_options(timeout=30000)
profile = Path(tempfile.mkdtemp(prefix='shibuya-public-v090-', dir='/tmp'))
pw = context = page = None
passed = False
result = {'method': 'One normal native Linux WebKit software-WebGL session at390px; ordinary fresh company funds; real UI taps; read-only durable rows and release verification; no DEV globals, state injection, camera/RAF/TLS/sandbox changes',
          'errors': [], 'warnings': [], 'requestFailures': [], 'checks': [], 'snapshots': [], 'exports': {},
          'limitations': ['Linux WebKit/software GPU, not physical iPhone Safari or Windows hardware'], 'phase': 'startup'}


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
            dialogs.last.locator('.weekly-review-exit').tap()
        else:
            dialogs.last.locator(':scope > section > header > button[aria-label="閉じる"]').tap()
    assert not page.locator('dialog[open]').count()


def rows():
    return page.evaluate("""()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('shibuya-capital-v1');request.onerror=reject;
      request.onsuccess=()=>{const db=request.result,read=db.transaction('saves').objectStore('saves').getAll();
      read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=reject};})""")


def saved():
    return json.loads(next(row for row in rows() if row['key'] == 'primary')['envelope']['payload'])


def export_state(label):
    before = rows()
    close_all()
    button(page, '経営').tap()
    button(current(), '設定・保存').tap()
    with page.expect_download() as download:
        button(current(), '保存ファイルを書き出す').tap()
    path = OUT / f'{label}.json'
    download.value.save_as(str(path))
    envelope = json.loads(path.read_text())
    assert hashlib.sha256(envelope['payload'].encode()).hexdigest() == envelope['checksum']
    assert rows() == before, 'Export changed durable rows'
    result['exports'][label] = {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'payloadChecksum': envelope['checksum']}
    close_all()
    return json.loads(envelope['payload'])


def snapshot(label):
    result['phase'] = label
    page.evaluate('()=>document.fonts.ready')
    page.screenshot(path=str(OUT / f'{label}.png'))
    (OUT / f'{label}.txt').write_text(page.locator('body').inner_text()+'\n')
    result['snapshots'].append(label)
    print('SNAPSHOT', label, flush=True)


def ok(message):
    result['checks'].append(message)
    print('PASS', message, flush=True)


def select_new_site():
    close_all()
    page.get_by_role('button', name=re.compile('^(出店場所を探す|物件を探す)$')).tap()
    browser = current().locator('.site-browser')
    browser.get_by_label('物件名・店舗名で検索', exact=True).fill('坂西の生活')
    target = browser.locator('[data-lot-id="dogenzaka-13"]')
    expect(browser.locator('[data-lot-id]')).to_have_count(1)
    target.tap()
    expect(current().locator('.facility-content')).to_have_attribute('data-selected-lot-id', 'dogenzaka-13')
    expect(button(current(), '街でこの建物を見る')).to_be_visible()
    return current()


try:
    pw = sync_playwright().start()
    context = pw.webkit.launch_persistent_context(str(profile), headless=True, viewport=PHONE, has_touch=True, accept_downloads=True)
    context.add_init_script('window.__qaCsp=[];addEventListener("securitypolicyviolation",e=>window.__qaCsp.push({directive:e.effectiveDirective,blocked:e.blockedURI}));')
    page = context.pages[0]
    page.on('pageerror', lambda error: result['errors'].append(str(error)))
    page.on('console', lambda message: result['errors' if message.type == 'error' else 'warnings'].append(message.text) if message.type in ['error', 'warning'] else None)
    page.on('requestfailed', lambda request: result['requestFailures'].append({'url': request.url, 'error': request.failure}))
    response = page.goto(a.url, wait_until='domcontentloaded')
    assert response.status == 200
    result['publicIndexSHA256'] = hashlib.sha256(response.body()).hexdigest()
    assert result['publicIndexSHA256'] == a.expected_index_sha256
    result['release'] = page.evaluate('async()=>await(await fetch("release.json",{cache:"no-store"})).json()')
    assert result['release']['version'] == '0.9.0' and result['release']['sourceCommit'] == a.expected_source
    assert page.evaluate('()=>!["__cityScene","__cityCamera","__cityRenderer"].some(key=>key in window)')
    ok('Public version/source/index match the reviewed v090 build; DEV renderer globals absent')
    page.get_by_label('会社名', exact=True).fill(NAME)
    button(page, '新しい会社を設立').tap()
    expect(page.locator('.immersive-game')).to_be_visible()
    expect(page.locator('.city-webgl-error')).to_have_count(0)
    button(page, '説明を閉じる').tap()
    page.wait_for_load_state('networkidle')
    assert page.evaluate('()=>!["__cityScene","__cityCamera","__cityRenderer"].some(key=>key in window)')
    expect(page.locator('.city-webgl-error')).to_have_count(0)
    initial = export_state('01-initial')
    assert initial['week'] == 1 and initial['cash'] == 12_000_000 and not initial['stores']
    durable = rows()
    panel = select_new_site()
    snapshot('02-new-outer-candidate')
    button(panel, '街でこの建物を見る').tap()
    expect(page.locator('dialog[open]')).to_have_count(0)
    expect(button(page, '街全体に戻る')).to_be_visible()
    snapshot('03-explicit-outer-view')
    button(page, '街全体に戻る').tap()
    expect(page.locator('dialog[open]')).to_have_count(0)
    expect(button(page, '街全体に戻る')).to_have_count(0)
    assert export_state('04-after-view-only') == initial and rows() == durable
    ok('390px search reaches newdogenzaka13; explicit view and overview native taps leave company/save exact')
    panel = select_new_site()
    panel.locator('.opening-option').filter(has_text='テイクアウト').tap()
    button(panel, 'この場所にカフェを開業').tap()
    expect(page.locator('dialog[open]')).to_have_count(0)
    opened = export_state('05-opened')
    assert opened['week'] == 1 and opened['cash'] == 9_000_000 and len(opened['stores']) == 1
    assert opened['stores'][0]['lotId'] == 'dogenzaka-13' and opened['stores'][0]['style'] == 'takeaway'
    page.locator('.hud-next-week').tap()
    button(current(), re.compile('^(営業して週を進める|リスクを承知して営業する)$')).tap()
    expect(page.locator('.weekly-review-screen[open]')).to_be_visible()
    expect(page.locator('.weekly-results-profit > strong')).to_have_attribute('data-profit-complete', 'true')
    settled = saved()
    assert settled['week'] == 2 and settled['lastReport']['week'] == 1 and not settled['gameOver']
    assert settled['cash'] == round(opened['cash']+settled['lastReport']['cashChange'])
    assert settled['lastReport']['storeResults'][0]['id'] == opened['stores'][0]['id']
    result['settlement'] = {'lotId':'dogenzaka-13','style':'takeaway','reportWeek':1,'stateWeek':2,'netProfit':settled['lastReport']['netProfit'],'cash':settled['cash']}
    snapshot('06-first-real-week-autosaved')
    close_all()
    assert export_state('07-settled') == settled
    durable = rows()
    reload_response = page.reload(wait_until='domcontentloaded')
    result['reloadedPublicIndexSHA256'] = hashlib.sha256(reload_response.body()).hexdigest()
    assert reload_response.status == 200 and result['reloadedPublicIndexSHA256'] == a.expected_index_sha256
    page.get_by_role('button', name=re.compile(re.escape(NAME)+' を続ける')).tap()
    expect(page.locator('.immersive-game')).to_be_visible()
    assert saved() == settled and rows() == durable
    assert export_state('08-reloaded') == settled
    snapshot('09-resumed-new-store')
    ok('Ordinary funds pay one300万円opening; actual firstweek auto-saves and exact export/reload preserve durable progress')
    expect(page.locator('.city-webgl-error')).to_have_count(0)
    result['releaseAfter'] = page.evaluate('async()=>await(await fetch("release.json",{cache:"no-store"})).json()')
    result['sourceStable'] = result['releaseAfter'] == result['release']
    assert result['sourceStable']
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
    shutil.rmtree(profile, ignore_errors=True)
    result['profileRemoved'] = not profile.exists()
    result['functionalPassed'] = passed
    result['passed'] = passed and result['profileRemoved'] and result.get('contextClosed',False) and result.get('driverStopped',False) and not result.get('cleanupError') and not result.get('driverCleanupError')
    (OUT/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':result['passed'],'checks':len(result['checks']),'errors':result['errors'],'warnings':result['warnings'],'requestFailures':result['requestFailures'],'profileRemoved':result['profileRemoved']},ensure_ascii=False),flush=True)
raise SystemExit(0 if result['passed'] else 1)
