#!/usr/bin/env python3
"""0.4.7 changed flows in the real App, with optional read-only DEV camera diagnostics.

Use normal-sandbox Firefox and the private Xorg runner. No scene stubs, state
injection, RAF overrides, TLS overrides, or browser security bypasses.
"""
import argparse
import json
import re
import shutil
import tempfile
import traceback
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://127.0.0.1:5173')
ap.add_argument('--out', default='/workspace/shared/shibuya-artifacts/targeted-0.4.7')
ap.add_argument('--profile')
ap.add_argument('--dev-diagnostics', action='store_true')
ap.add_argument('--ledger-only', action='store_true', help='Skip the already verified camera prefix; prepare a fresh actual report through UI actions')
ap.add_argument('--legacy-only', action='store_true', help='Only import and inspect unrecorded legacy accounts, then reload exactly')
ap.add_argument('--legacy-save', default=str(ROOT / 'tests/fixtures/legacy-0.3.2-envelope.json'))
a = ap.parse_args()
camera_prefix = a.dev_diagnostics and not a.ledger_only
if a.dev_diagnostics:
    assert urlsplit(a.url).hostname in ['127.0.0.1', 'localhost'], 'DEV reads must remain local'
OUT = Path(a.out)
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, warnings, responses, external = [], [], [], [], []
data, complete = {}, False
profile = Path(a.profile) if a.profile else Path(tempfile.mkdtemp(prefix='targeted-v047-firefox-', dir='/tmp'))


def button(scope, label):
    return scope.get_by_role('button', name=label, exact=True)


def dialog(page):
    return page.locator('dialog[open]')


def close(page):
    dialog(page).locator(':scope > section > header > button[aria-label="閉じる"]').click()
    expect(dialog(page)).to_have_count(0)


def primary(page):
    return page.evaluate("""() => new Promise((resolve,reject) => {
      const request=indexedDB.open('shibuya-capital-v1');
      request.onsuccess=()=>{const db=request.result;
        const read=db.transaction('saves').objectStore('saves').get('primary');
        read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=reject};
      request.onerror=reject;
    })""")


def state(page):
    return json.loads(primary(page)['envelope']['payload'])


def pose(page):
    return page.evaluate("""() => ({uuid:window.__cityScene.uuid,
      position:window.__cityCamera.position.toArray(),
      quaternion:window.__cityCamera.quaternion.toArray(),fov:window.__cityCamera.fov})""")


def same_pose(left, right):
    return left['uuid'] == right['uuid'] and abs(left['fov'] - right['fov']) < 1e-7 and all(
        abs(x-y) < 1e-6 for key in ['position', 'quaternion'] for x, y in zip(left[key], right[key]))


def stable(page):
    if a.dev_diagnostics:
        page.wait_for_timeout(650)


def select(page, lot_id):
    page.get_by_role('button', name=re.compile('^(出店場所を探す|物件を探す)$')).click()
    dialog(page).locator(f'.site-list [data-lot-id="{lot_id}"]').click()
    expect(dialog(page).locator('.facility-content')).to_have_attribute('data-selected-lot-id', lot_id)


def purpose(page, name):
    root = dialog(page).locator('.store-management')
    if root.get_attribute('data-store-purpose') != 'home':
        button(dialog(page), '店舗トップへ').click()
    root.locator('.store-management-purposes button').filter(has_text=name).click()


def view(page, lot_id):
    select(page, lot_id)
    button(dialog(page), '街でこの店を見る').click()
    expect(dialog(page)).to_have_count(0)
    stable(page)


def menu(page, name):
    button(page, '経営').click()
    button(dialog(page), name).click()
    return dialog(page)


def save(page):
    menu(page, '設定・保存')
    previous_revision = primary(page)['revision']
    button(dialog(page), '今すぐ保存する').click()
    page.wait_for_function("""revision => new Promise(resolve => {
      const request=indexedDB.open('shibuya-capital-v1');request.onsuccess=()=>{
        const db=request.result,read=db.transaction('saves').objectStore('saves').get('primary');
        read.onsuccess=()=>{db.close();resolve(read.result?.revision!==revision)}};
    })""", arg=previous_revision)
    expect(dialog(page).get_by_role('alert')).to_contain_text('保存しました')
    close(page)


def pan(page):
    box = page.locator('.city-world canvas').bounding_box()
    x, y = box['x'] + box['width']*.64, box['y'] + box['height']*.56
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x+min(80, box['width']*.15), y+20, steps=8)
    page.mouse.up()
    stable(page)


def screenshot(page, name):
    page.screenshot(path=str(OUT / (name + '.png')))


def passed(message):
    checks.append(message)
    print('PASS', message, flush=True)


COST_LABELS = {'ingredients':'材料費', 'fulfilment':'包装・決済など', 'labor':'従業員の人件費',
               'rent':'家賃', 'equipment':'店舗・設備の維持費', 'marketing':'広告費', 'manager':'店長費'}


def assert_ledger(details, report, store_id):
    expect(details).to_have_attribute('data-store-id', store_id)
    result = next(row for row in report['storeResults'] if row['id'] == store_id)
    account = next(row for row in report['storeAccounts'] if row['storeId'] == store_id)
    expense = sum(account['costs'].values()) + account['roundingAdjustment']
    assert result['revenue'] - expense == result['profit']
    rows = {'売上':result['revenue'], **{COST_LABELS[k]:v for k,v in account['costs'].items()},
            '店舗費用合計':expense, '店舗利益':result['profit']}
    for label, value in rows.items():
        row = details.get_by_text(label, exact=True).locator('..')
        expect(row.locator('dd')).to_have_text(f'{value:,}円')
    adjustment = account['roundingAdjustment']
    if adjustment:
        row = details.get_by_text('円単位の調整', exact=True).locator('..')
        expect(row.locator('dd')).to_have_text(('+' if adjustment > 0 else '') + f'{adjustment:,}円')
    else:
        expect(details.get_by_text('円単位の調整', exact=True)).to_have_count(0)
    if result['profit'] < 0:
        expect(details.locator('.store-settlement-loss')).to_have_text(f'この週は店舗費用が売上を{-result["profit"]:,}円上回りました。')
    return details.inner_text()


with sync_playwright() as pw:
    context = pw.firefox.launch_persistent_context(str(profile), headless=False, timeout=30000,
        viewport={'width':1000, 'height':760}, firefox_user_prefs={'webgl.force-enabled':True, 'gfx.webrender.software':True})
    origin = urlsplit(a.url)
    def route(request):
        url = urlsplit(request.request.url)
        if (url.scheme, url.netloc) == (origin.scheme, origin.netloc) or url.scheme in ['data', 'blob']:
            request.continue_()
        else:
            external.append(request.request.url)
            request.abort('blockedbyclient')
    context.route('**/*', route)
    context.add_init_script("window.__qaCspViolations=[];addEventListener('securitypolicyviolation',e=>window.__qaCspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}))")
    page = context.new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else warnings.append(message.text) if message.type == 'warning' else None)
    page.on('response', lambda response: responses.append({'url':response.url, 'status':response.status}))
    try:
        response = page.goto(a.url, wait_until='domcontentloaded')
        assert response and response.status == 200
        if not a.legacy_only:
            page.get_by_label('会社名', exact=True).fill('確定費用と店舗カメラQA')
            button(page, '新しい会社を設立').click()
            expect(dialog(page).get_by_role('heading', name='経営のはじめ方', exact=True)).to_be_visible()
            button(dialog(page), '街で始める').click()
            expect(page.locator('.city-world canvas')).to_be_visible()
            if a.dev_diagnostics:
                page.wait_for_function("window.__cityScene?.getObjectByName('Game_economic_site_markers')?.children.length===32")
                page.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
                stable(page)
            initial_pose = pose(page) if camera_prefix else None
            select(page, 'center-01')
            opening = dialog(page).locator('.store-opening')
            expect(opening.locator('.opening-detail')).not_to_have_attribute('open', '')
            expect(opening.locator('.opening-options button')).to_have_count(3)
            expect(opening.locator('.opening-primary-values')).to_contain_text('今週の全社利益見込み')
            if camera_prefix:
                assert same_pose(initial_pose, pose(page)), 'Selection automatically moved the camera'
            button(dialog(page), 'この場所にカフェを開業').click()
            expect(dialog(page)).to_have_count(0)
            stable(page)
            if camera_prefix:
                assert same_pose(initial_pose, pose(page)), 'Opening automatically moved the camera'
            save(page)
            first = state(page)['stores'][0]
            store_a = first['id']
            if not a.ledger_only:
                view(page, 'center-01')
            if camera_prefix:
                focused = pose(page)
                pan(page)
                panned = pose(page)
                assert not same_pose(focused, panned), 'Native manage drag did not pan'
            select(page, 'center-01')
            purpose(page, '広告・改装')
            dialog(page).get_by_label('内装・営業スタイル', exact=False).select_option('premium')
            expect(dialog(page).get_by_label('内装・営業スタイル', exact=False)).to_have_value('premium')
            close(page)
            stable(page)
            if camera_prefix:
                assert same_pose(panned, pose(page)), 'Style edit recentered the explicitly viewed store'
            if not a.ledger_only:
                view(page, 'center-01')
            if camera_prefix:
                recentered = pose(page)
                assert not same_pose(panned, recentered), 'Repeated store-view request did not recenter'
                pan(page)
                assert not same_pose(recentered, pose(page))
                view(page, 'center-01')
                assert same_pose(recentered, pose(page)), 'Same-store explicit request did not restore its viewpoint'
                page.set_viewport_size({'width':390, 'height':844})
                page.wait_for_function('Math.abs(window.__cityCamera.aspect-390/844)<1e-8')
                assert same_pose(recentered, pose(page)), 'Resize automatically reframed a manually viewed store'
                view(page, 'center-01')
                points = page.evaluate("""() => {
                  const sign=window.__cityScene.getObjectByName('Business frontage center-01').children.find(o=>o.geometry?.type==='PlaneGeometry'&&typeof o.userData.displayedText==='string');
                  const corners=sign.geometry.getAttribute('position');
                  return Array.from({length:corners.count},(_,i)=>window.__cityCamera.position.clone().fromBufferAttribute(corners,i).applyMatrix4(sign.matrixWorld).project(window.__cityCamera).toArray());
                }""")
                assert all(abs(point[0]) <= .920001 and abs(point[1]) <= .920001 and -1 <= point[2] <= 1 for point in points), points
                data['camera'] = {'initial':initial_pose, 'focused':focused, 'panned':panned, 'recentered':recentered,
                                  'portrait':pose(page), 'portraitSignNdc':points}
                screenshot(page, '01-portrait-explicit-store-sign')
                page.set_viewport_size({'width':1000, 'height':760})
                view(page, 'center-01')
            if not a.ledger_only:
                passed('Opening comparison detail stays closed; explicit store view, style edit, repeat request, and optional DEV portrait sign/camera checks')

            held_pose = pose(page) if a.dev_diagnostics else None
            select(page, 'center-04')
            dialog(page).locator('.opening-option').filter(has_text='テイクアウト').click()
            button(dialog(page), 'この場所にカフェを開業').click()
            expect(dialog(page)).to_have_count(0)
            stable(page)
            if a.dev_diagnostics:
                assert same_pose(held_pose, pose(page)), 'Opening B reset focused A'
            save(page)
            store_b = next(row['id'] for row in state(page)['stores'] if row['lotId'] == 'center-04')
            select(page, 'center-01')
            purpose(page, '商品・価格')
            dialog(page).get_by_role('spinbutton', name=re.compile('^販売価格（円）')).fill('950')
            button(dialog(page), '店舗トップへ').click()
            purpose(page, '人員・店長')
            dialog(page).get_by_role('spinbutton', name=re.compile('^従業員数')).fill('30')
            page.keyboard.press('Escape')
            expect(dialog(page)).to_have_count(0)
            page.set_viewport_size({'width':390, 'height':844})
            page.locator('.hud-next-week').click()
            dialog(page).get_by_role('button', name=re.compile('^(営業して週を進める|リスクを承知して営業する)$')).click()
            report_dialog = dialog(page)
            expect(report_dialog.get_by_role('heading', name='第1週の営業結果', exact=True)).to_be_visible()
            expect(report_dialog.locator('.weekly-results-profit > strong')).to_have_attribute('data-profit-complete', 'true')
            expect(report_dialog.locator('.weekly-stores')).not_to_have_attribute('open', '')
            expect(report_dialog.locator('.weekly-results-detail')).not_to_have_attribute('open', '')
            box = report_dialog.bounding_box()
            assert box['height'] <= 844 and box['width'] <= 390
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            settled = state(page)
            historical = settled['lastReport']
            (OUT / 'settled-primary.json').write_text(json.dumps(primary(page), ensure_ascii=False, indent=2))
            data['settledReport'] = historical
            actual_a = next(row for row in historical['storeResults'] if row['id'] == store_a)
            assert actual_a['profit'] < 0 and settled['week'] == 2 and not settled['gameOver']
            expect(report_dialog.locator('.store-settlement-breakdown')).to_have_count(2)
            for details in report_dialog.locator('.store-settlement-breakdown').all():
                expect(details).not_to_have_attribute('open', '')
            screenshot(page, '02-short-mobile-loss-report')
            report_dialog.locator('.weekly-stores > summary').click()
            breakdown = report_dialog.locator(f'.store-settlement-breakdown[data-store-id="{store_a}"]')
            breakdown.locator(':scope > summary').click()
            ledger_text = assert_ledger(breakdown, historical, store_a)
            breakdown.scroll_into_view_if_needed()
            screenshot(page, '03-settled-mobile-costs')
            passed('Ordinary 30-person plan produces a compact mobile loss report; closed expense detail reconciles exactly with actual saved figures')
            close(page)

            select(page, 'center-01')
            purpose(page, '営業実績')
            breakdown = dialog(page).locator('.store-settlement-breakdown')
            expect(breakdown).not_to_have_attribute('open', '')
            breakdown.locator(':scope > summary').click()
            assert assert_ledger(breakdown, historical, store_a) == ledger_text
            purpose(page, '商品・価格')
            dialog(page).get_by_role('spinbutton', name=re.compile('^販売価格（円）')).fill('1500')
            button(dialog(page), '店舗トップへ').click()
            purpose(page, '人員・店長')
            dialog(page).get_by_role('spinbutton', name=re.compile('^従業員数')).fill('1')
            button(dialog(page), '店舗トップへ').click()
            purpose(page, '営業実績')
            breakdown = dialog(page).locator('.store-settlement-breakdown')
            breakdown.locator(':scope > summary').click()
            assert assert_ledger(breakdown, historical, store_a) == ledger_text
            screenshot(page, '04-management-historical-costs-after-edit')
            close(page)
            save(page)
            edited = state(page)
            assert edited['lastReport'] == historical
            current_a = next(row for row in edited['stores'] if row['id'] == store_a)
            assert current_a['price'] == 1500 and current_a['staff'] == 1
            saved = primary(page)
            page.reload()
            page.get_by_role('button', name=re.compile(re.escape(edited['companyName']) + ' を続ける')).click()
            expect(page.locator('.immersive-game')).to_be_visible()
            assert primary(page)['envelope']['payload'] == saved['envelope']['payload']
            menu(page, '直近の営業結果').locator('.weekly-stores > summary').click()
            breakdown = dialog(page).locator(f'.store-settlement-breakdown[data-store-id="{store_a}"]')
            breakdown.locator(':scope > summary').click()
            assert assert_ledger(breakdown, historical, store_a) == ledger_text
            close(page)
            passed('Management and report show the same historical expense values after current price/staff changes and an exact native IndexedDB reload')

            page.set_viewport_size({'width':1000, 'height':760})
            if a.dev_diagnostics:
                page.wait_for_function('!!window.__cityCamera')
                page.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
            view(page, 'center-01')
            focus_a = pose(page) if a.dev_diagnostics else None
            select(page, 'center-04')
            dialog(page).locator('.store-management-admin > summary').click()
            page.once('dialog', lambda native: native.accept())
            button(dialog(page), 'この店を閉店する').click()
            expect(dialog(page).locator('.store-opening')).to_be_visible()
            close(page)
            stable(page)
            if a.dev_diagnostics:
                assert same_pose(focus_a, pose(page)), 'Closing managed B reset explicitly viewed A'
            save(page)
            assert not any(row['id'] == store_b for row in state(page)['stores'])
            assert state(page)['lastReport'] == historical
            select(page, 'center-01')
            dialog(page).locator('.store-management-admin > summary').click()
            page.once('dialog', lambda native: native.accept())
            button(dialog(page), 'この店を閉店する').click()
            expect(dialog(page).locator('.store-opening')).to_be_visible()
            close(page)
            stable(page)
            if a.dev_diagnostics:
                overview = pose(page)
                assert not same_pose(focus_a, overview) and overview['fov'] == 36, 'Closing focused A did not release its view'
                assert page.evaluate("window.__cityScene.getObjectByName('Settled_store_activity').userData.count") == 0
                data.setdefault('camera', {})['focusedBeforeClose'] = focus_a
                data['camera']['releasedAfterClose'] = overview
            save(page)
            assert state(page)['lastReport'] == historical
            select(page, 'center-01')
            dialog(page).locator('.opening-option').filter(has_text='テイクアウト').click()
            button(dialog(page), 'この場所にカフェを開業').click()
            expect(dialog(page)).to_have_count(0)
            select(page, 'center-01')
            purpose(page, '営業実績')
            expect(dialog(page).locator('.store-management-empty')).to_contain_text('初営業')
            expect(dialog(page).locator('.store-settlement-breakdown')).to_have_count(0)
            assert state(page)['lastReport'] == historical
            close(page)
            menu(page, '直近の営業結果').locator('.weekly-stores > summary').click()
            article = dialog(page).locator(f'.weekly-store[data-store-id="{store_a}"]')
            expect(article.locator('.weekly-store-badge')).to_have_text('閉店済み')
            breakdown = article.locator('.store-settlement-breakdown')
            breakdown.locator(':scope > summary').click()
            assert assert_ledger(breakdown, historical, store_a) == ledger_text
            screenshot(page, '05-closed-store-historical-account')
            close(page)
            passed('Closing B preserves focused A; closing focused A releases overview; reopened same parcel starts without inheriting the closed store account')

        legacy_path = Path(a.legacy_save)
        legacy = json.loads(json.loads(legacy_path.read_text())['payload'])
        if not a.legacy_only:
            menu(page, '設定・保存')
        page.locator('input[type="file"]').set_input_files(str(legacy_path))
        if a.legacy_only:
            expect(dialog(page).get_by_role('heading', name='経営のはじめ方', exact=True)).to_be_visible()
            button(dialog(page), '街で始める').click()
        expect(page.locator('.toast')).to_contain_text('会社データを読み込みました')
        assert state(page) == legacy
        select(page, legacy['stores'][0]['lotId'])
        purpose(page, '営業実績')
        missing = dialog(page).locator('.store-settlement-breakdown')
        expect(missing).not_to_have_attribute('open', '')
        missing.locator(':scope > summary').click()
        expect(missing).to_contain_text('この週の費用内訳は記録されていません。')
        expect(missing.locator('.store-settlement-costs')).to_have_count(0)
        close(page)
        menu(page, '直近の営業結果').locator('.weekly-stores > summary').click()
        missing = dialog(page).locator('.store-settlement-breakdown')
        missing.locator(':scope > summary').click()
        expect(missing).to_contain_text('この週の費用内訳は記録されていません。')
        expect(missing.locator('.store-settlement-costs')).to_have_count(0)
        screenshot(page, '06-legacy-unrecorded-expenses')
        assert state(page) == legacy
        close(page)
        page.reload()
        page.get_by_role('button', name=re.compile(re.escape(legacy['companyName']) + ' を続ける')).click()
        expect(page.locator('.immersive-game')).to_be_visible()
        assert state(page) == legacy
        data['legacy'] = {'exactImportAndReload':True, 'missingCostsNotFabricated':True}
        passed('Actual 0.3.2 import/reload remains exact; report and management explicitly mark missing expenses without current-plan reconstruction')
        assert not errors, errors
        assert not external, external
        assert not [response for response in responses if response['status'] >= 400]
        assert not page.evaluate('window.__qaCspViolations')
        complete = True
    except Exception:
        data['failure'] = traceback.format_exc()
        print(data['failure'], flush=True)
        try:
            screenshot(page, 'failure')
        except Exception:
            pass
    finally:
        data['responses'], data['externalRequests'] = responses, external
        try:
            data['cspViolations'] = page.evaluate('window.__qaCspViolations')
            (OUT / 'last-primary.json').write_text(json.dumps(primary(page), ensure_ascii=False, indent=2))
        except Exception:
            pass
        (OUT / 'results.json').write_text(json.dumps({'passed':complete, 'checks':checks, 'errors':errors, 'warnings':warnings,
            'data':data, 'url':a.url, 'devDiagnostics':a.dev_diagnostics, 'ledgerOnly':a.ledger_only, 'legacyOnly':a.legacy_only,
            'method':'normal-sandbox real Firefox/Mesa; real App and IndexedDB; UI actions only; optional read-only DEV scene/camera/sign diagnostics; no RAF/state/scene/TLS overrides'}, ensure_ascii=False, indent=2))
        context.close()
        if not a.profile:
            shutil.rmtree(profile, ignore_errors=True)
if not complete:
    raise SystemExit(1)
