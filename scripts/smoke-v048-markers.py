#!/usr/bin/env python3
"""Focused DEV-only marker check in normal-sandbox Firefox with a real renderer.

Use a disposable profile and the shared private Xorg runner. No scene/state/RAF
replacement, TLS overrides, or browser security bypasses. DEV observations only
read the scene, camera, renderer, and native DOM.
"""
import argparse
import hashlib
import json
import re
import shutil
import tempfile
import traceback
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


def button(scope, label):
    return scope.get_by_role('button', name=label, exact=True)


def dialog(page):
    return page.locator('dialog[open]')


def close(page):
    dialog(page).locator(':scope > section > header > button[aria-label="閉じる"]').click()
    expect(dialog(page)).to_have_count(0)


def pose(page):
    return page.evaluate("""() => ({uuid:window.__cityScene.uuid,
      position:window.__cityCamera.position.toArray(),
      quaternion:window.__cityCamera.quaternion.toArray(),fov:window.__cityCamera.fov})""")


def same_pose(left, right):
    return left['uuid'] == right['uuid'] and abs(left['fov'] - right['fov']) < 1e-7 and all(
        abs(x-y) < 1e-6 for key in ['position', 'quaternion'] for x, y in zip(left[key], right[key]))


def markers(page):
    return page.evaluate("""() => {
      const group=window.__cityScene.getObjectByName('Game_economic_site_markers');
      return {scene:window.__cityScene.uuid,group:group.uuid,rows:group.children.map(marker=>({
        uuid:marker.uuid,id:marker.userData.lotId,status:marker.userData.siteStatus,
        visible:group.visible&&marker.visible}))};
    }""")


def wait_markers(page, count):
    page.wait_for_function("""count => {
      const group=window.__cityScene?.getObjectByName('Game_economic_site_markers');
      return group?.children.length===32&&group.children.filter(marker=>group.visible&&marker.visible).length===count;
    }""", arg=count)
    snapshot = markers(page)
    assert len({row['id'] for row in snapshot['rows']}) == 32
    return snapshot


def layer(page, name):
    button(page, '地図').click()
    button(dialog(page), name).click()
    expect(dialog(page)).to_have_count(0)


def sites(page):
    page.get_by_role('button', name=re.compile('^(出店場所を探す|物件を探す)$')).click()
    expect(dialog(page).locator('.site-list [data-lot-id]')).to_have_count(32)
    expect(dialog(page).get_by_role('status')).to_have_text('表示 32 / 全32区画')


def marker_point(page, lot_id):
    return page.evaluate("""id => {
      const marker=window.__cityScene.getObjectByName('Game_site_marker_'+id);
      const point=marker.getWorldPosition(marker.position.clone()).project(window.__cityCamera);
      const rect=window.__cityRenderer.domElement.getBoundingClientRect();
      return {x:rect.x+(point.x+1)*rect.width/2,y:rect.y+(1-point.y)*rect.height/2-22};
    }""", lot_id)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5173')
    parser.add_argument('--out', default='/workspace/shared/shibuya-artifacts/targeted-0.4.8/markers')
    parser.add_argument('--profile', help='Use a disposable Firefox profile; otherwise create and remove a temporary profile')
    args = parser.parse_args()
    assert urlsplit(args.url).hostname in ['127.0.0.1', 'localhost'], 'DEV-only scene reads require a local URL'
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    root = Path(__file__).resolve().parents[1]
    data = {'sourceSHA256': {name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in [
        'src/city/GameSiteMarkers.ts', 'src/city/CityView.tsx', 'src/App.tsx']}}
    checks, errors, warnings, responses, external = [], [], [], [], []
    complete = False
    profile = Path(args.profile) if args.profile else Path(tempfile.mkdtemp(prefix='markers-v048-firefox-', dir='/tmp'))

    def passed(message):
        checks.append(message)
        print('PASS', message, flush=True)

    def screenshot(page, name):
        page.screenshot(path=str(out/(name+'.png')))

    with sync_playwright() as playwright:
        context = None
        page = None
        try:
            context = playwright.firefox.launch_persistent_context(str(profile), headless=False, timeout=30000,
                viewport={'width':1000, 'height':760},
                firefox_user_prefs={'webgl.force-enabled':True, 'gfx.webrender.software':True})
            origin = urlsplit(args.url)

            def route(request):
                url = urlsplit(request.request.url)
                if (url.scheme, url.netloc) == (origin.scheme, origin.netloc) or url.scheme in ['data', 'blob']:
                    request.continue_()
                else:
                    external.append(request.request.url)
                    request.abort('blockedbyclient')

            context.route('**/*', route)
            page = context.new_page()
            page.set_default_timeout(30000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else warnings.append(message.text) if message.type == 'warning' else None)
            page.on('response', lambda response: responses.append({'url':response.url, 'status':response.status}))
            response = page.goto(args.url, wait_until='domcontentloaded')
            assert response and response.status == 200
            page.get_by_label('会社名', exact=True).fill('自社の目印と近景QA')
            button(page, '新しい会社を設立').click()
            if dialog(page).filter(has=page.get_by_role('heading', name='新しい会社を設立', exact=True)).count():
                button(dialog(page), '設立する').click()
            expect(page.locator('.immersive-game')).to_be_visible()
            expect(page.locator('.city-world canvas')).to_be_visible()
            expect(page.locator('.city-webgl-error')).to_have_count(0)
            # The header close is independent of the guide's changing primary-action label.
            if dialog(page).count():
                expect(dialog(page).get_by_role('heading', name='経営のはじめ方', exact=True)).to_be_visible()
                close(page)
            page.wait_for_function("window.__cityScene?.getObjectByName('Game_economic_site_markers')?.children.length===32")
            page.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
            page.wait_for_timeout(150)
            initial = wait_markers(page, 32)
            initial_pose = pose(page)
            identities = {row['id']:row['uuid'] for row in initial['rows']}
            data['default'] = initial
            assert all(row['status'] == 'candidate' for row in initial['rows'])
            sites(page)
            dialog(page).locator('.site-list [data-lot-id="center-01"]').click()
            expect(dialog(page).locator('.facility-content')).to_have_attribute('data-selected-lot-id', 'center-01')
            assert same_pose(initial_pose, pose(page)), 'Ordinary selection changed the camera'
            button(dialog(page), 'この場所にカフェを開業').click()
            expect(dialog(page)).to_have_count(0)
            page.wait_for_function("window.__cityScene.getObjectByName('Game_site_marker_center-01').userData.siteStatus==='store'")
            wait_markers(page, 32)
            assert same_pose(initial_pose, pose(page)), 'Opening automatically changed the camera'
            passed('Default shows 32 economic pins; opening center-01 through the actual 32-row list preserves the camera')

            layer(page, '自社の施設')
            owned = wait_markers(page, 1)
            visible = [row for row in owned['rows'] if row['visible']]
            assert [(row['id'], row['status']) for row in visible] == [('center-01', 'store')]
            assert same_pose(initial_pose, pose(page)), 'Ownership layer changed the camera'
            sites(page)
            close(page)
            wait_markers(page, 1)
            point = marker_point(page, 'center-01')
            assert 0 < point['x'] < 1000 and 0 < point['y'] < 760
            page.mouse.click(point['x'], point['y'])
            expect(dialog(page).locator('.facility-content')).to_have_attribute('data-selected-lot-id', 'center-01')
            assert same_pose(initial_pose, pose(page)), 'Native owned-pin click changed the camera'
            data['ownership'] = owned
            data['ownedPinClick'] = point
            passed('Ownership shows the single owned pin, keeps all 32 list rows, and a native pin click opens the correct facility')

            button(dialog(page), '街でこの店を見る').click()
            expect(dialog(page)).to_have_count(0)
            wait_markers(page, 0)
            closeup = pose(page)
            assert not same_pose(initial_pose, closeup), 'Explicit store-view request did not reframe'
            page.set_viewport_size({'width':390, 'height':844})
            page.wait_for_function('Math.abs(window.__cityCamera.aspect-390/844)<.000001')
            assert same_pose(closeup, pose(page)), 'Resize changed the current camera pose or FOV'
            button(page, 'この店を経営').click()
            button(dialog(page), '街でこの店を見る').click()
            expect(dialog(page)).to_have_count(0)
            wait_markers(page, 0)
            portrait = pose(page)
            button(page, 'この店を経営').click()
            dialog(page).locator('.store-management-purposes button').filter(has_text='広告・改装').click()
            style = dialog(page).get_by_label('内装・営業スタイル', exact=False)
            style.select_option('premium')
            expect(style).to_have_value('premium')
            wait_markers(page, 0)
            close(page)
            wait_markers(page, 0)
            assert same_pose(portrait, pose(page)), 'Style edit changed the camera'
            page.evaluate("async()=>await window.__cityScene[Symbol.for('shibuya.city.loadedAssetsReady')]?.()")
            data['closeup'] = markers(page)
            screenshot(page, '01-portrait-closeup-no-pins')
            passed('Explicit portrait close-up hides all pins; resizing and a normal style edit preserve the camera and keep pins suppressed')

            button(page, '街全体に戻る').click()
            restored = wait_markers(page, 1)
            assert [row['id'] for row in restored['rows'] if row['visible']] == ['center-01']
            assert restored['scene'] == initial['scene'] and restored['group'] == initial['group']
            data['overviewOwnership'] = restored
            screenshot(page, '02-portrait-owned-overview')
            layer(page, '街並み')
            normal = wait_markers(page, 32)
            assert {row['id']:row['uuid'] for row in normal['rows']} == identities, 'Layer switches recreated marker targets'
            sites(page)
            close(page)
            data['normalRestored'] = normal
            screenshot(page, '03-normal-overview-restored')
            passed('Overview restores the chosen ownership layer; normal restores the same 32 pins and the list still exposes 32 lots')
            assert not errors, errors
            assert not external, external
            assert not [response for response in responses if response['status'] >= 400]
            complete = True
        except Exception:
            data['failure'] = traceback.format_exc()
            print(data['failure'], flush=True)
            if page:
                try:
                    screenshot(page, 'failure')
                except Exception:
                    pass
        finally:
            data['responses'], data['externalRequests'] = responses, external
            (out/'results.json').write_text(json.dumps({'passed':complete, 'checks':checks, 'errors':errors,
                'warnings':warnings, 'data':data, 'url':args.url, 'devDiagnostics':True,
                'method':'normal-sandbox real Firefox/Mesa; UI actions only; read-only DEV scene/camera/renderer; no state/scene/RAF/TLS overrides; marker counts mean enabled annotations, not viewport intersections'}, ensure_ascii=False, indent=2))
            if context:
                context.close()
            if not args.profile:
                shutil.rmtree(profile, ignore_errors=True)
    return 0 if complete else 1


if __name__ == '__main__':
    raise SystemExit(main())
