#!/usr/bin/env python3
"""Development App interaction QA. Both 3D components are explicit stubs.
Uses ordinary actions, native dialogs, and IndexedDB reads; not render/device evidence.
"""
import json, os, re, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.environ.get('IMMERSIVE_DOM_OUT', '/workspace/shared/shibuya-artifacts/immersive-v046/dom'))
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, snapshots = [], [], []
complete = False
STUB = '''import React from '/node_modules/.vite/deps/react.js';export default function CityView(p){
let token=React.useRef(null);if(token.current===null)token.current=++window.__cityCounter||(window.__cityCounter=1);
window.__citySnapshot={token:token.current,selectedLotId:p.selectedLotId,focusLotId:p.focusLotId??null,focusStoreLotId:p.focusStoreLotId??null,cameraMode:p.cameraMode};
return React.createElement('div',{className:'city-world','data-qa-stub':'true'},React.createElement('canvas',{style:{width:'100%',height:'100%'}}));}'''


def b(p, name): return p.get_by_role('button', name=name, exact=True)
def dialog(p): return p.locator('dialog[open]').last
def close(d): d.locator(':scope > section > header > button[aria-label="閉じる"]').click()
def primary(p):
    return p.evaluate("""()=>new Promise((resolve,reject)=>{
      const q=indexedDB.open('shibuya-capital-v1');q.onsuccess=()=>{
        const d=q.result,r=d.transaction('saves').objectStore('saves').get('primary');
        r.onsuccess=()=>{d.close();resolve(r.result)};r.onerror=reject};q.onerror=reject;
    })""")
def read(p): return json.loads(primary(p)['envelope']['payload'])
def menu(p, target):
    b(p, '経営').click(); b(dialog(p), target).click(); return dialog(p)
def city(p): return p.evaluate('window.__citySnapshot')
def shot(p, name): p.screenshot(path=str(OUT / (name + '.png')))
def ok(message): checks.append(message); print('PASS', message, flush=True)
def save(p):
    d = menu(p, '設定・保存'); b(d, '今すぐ保存する').click()
    expect(d.get_by_role('alert')).to_contain_text('保存しました')
    value = read(p); close(d); return value

def product(p):
    b(p, 'この店を経営').click(); d = dialog(p)
    expect(d.locator('.store-management')).to_have_attribute('data-store-purpose', 'home')
    expect(d.get_by_label('販売価格（円）', exact=True)).to_have_count(0)
    d.locator('.store-management-purposes button').filter(has_text='商品・価格').click()
    expect(d.locator('.store-management')).to_have_attribute('data-store-purpose', 'product')
    return d, d.get_by_role('spinbutton', name=re.compile('^販売価格（円）'))

def start_context(browser, width, height, name):
    c = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width == 390)
    c.route('**/src/city/CityView.tsx*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=STUB))
    c.route('**/src/ui/RealCityView.tsx*', lambda r: r.fulfill(status=200, content_type='application/javascript', body='export function RealCityView(){return null};export default RealCityView'))
    p = c.new_page(); p.set_default_timeout(10000); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(os.environ.get('IMMERSIVE_DOM_URL', 'http://127.0.0.1:5173'))
    p.get_by_label('会社名', exact=True).fill(name); b(p, '新しい会社を設立').click()
    expect(p.locator('.immersive-game')).to_be_visible(); guide = dialog(p)
    expect(guide.get_by_role('heading', name='経営のはじめ方', exact=True)).to_be_visible()
    expect(guide.locator('.first-play-steps > li')).to_have_count(3)
    assert guide.evaluate('(e)=>e.matches(":modal")')
    return c, p, guide

def assert_report(p, width, negative=False):
    d = dialog(p); expect(d.get_by_role('heading', name='第1週の営業結果', exact=True)).to_be_visible()
    current = read(p); report = current['lastReport']; profit = d.locator('.weekly-results-profit > strong')
    expect(profit).to_have_attribute('data-profit-complete', 'true')
    expect(profit).to_have_attribute('aria-label', '全社純利益 ¥' + f"{report['netProfit']:,}")
    expect(profit.locator('span')).to_have_text('¥' + f"{report['netProfit']:,}")
    expect(d.locator('.weekly-stores')).not_to_have_attribute('open', '')
    expect(d.locator('.weekly-results-detail')).not_to_have_attribute('open', '')
    settled_cash = next(h['cash'] for h in current['history'] if h['week'] == 1)
    expect(d.locator('.weekly-results-cash > div').nth(1).locator('dd')).to_have_text('¥' + f'{settled_cash:,}')
    assert current['week'] == 2 and not current['gameOver']
    assert report['netProfit'] < 0 if negative else report['netProfit'] > 0
    if negative:
        expect(profit).to_have_class('negative'); expect(d).to_contain_text('赤字の決算です')
    assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if width == 390:
        assert d.locator(':scope > section').evaluate('(e)=>e.scrollHeight<=e.clientHeight+2'), 'Collapsed first report requires scrolling'
        for node in [d.get_by_role('heading', name='第1週の営業結果', exact=True), profit, b(d, '街に戻る')]:
            box = node.bounding_box()
            assert box and 0 <= box['x'] and box['x'] + box['width'] <= width + 1
            assert 0 <= box['y'] and box['y'] + box['height'] <= 844
    return d, current

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--disable-gpu'])
    try:
        for width, height in [(1280, 960), (390, 844)]:
            company = '全面街QA' + str(width)
            c, p, guide = start_context(browser, width, height, company)
            initial = primary(p); shot(p, f'{width}-first-guide')
            if width == 390: p.keyboard.press('Escape')
            else: b(guide, '街で始める').click()
            expect(p.locator('dialog[open]')).to_have_count(0)
            assert p.evaluate("localStorage.getItem('shibuya-first-play-guide-v1')") == 'seen'
            assert primary(p) == initial
            guide = menu(p, '遊び方'); expect(guide.locator('.first-play-steps > li')).to_have_count(3); close(guide)
            assert primary(p) == initial
            ok(f'{width}: first-launch three-step native guide dismisses/persists; Help reopens without changing company')
            rect = p.locator('.immersive-city').bounding_box()
            assert rect == {'x': 0, 'y': 0, 'width': width, 'height': height}, rect
            assert p.locator('.city-world canvas').bounding_box() == rect
            assert p.locator('.rail,.bottom-bar,.inspector,.topbar').count() == 0
            token = city(p)['token']; shot(p, f'{width}-full-city-stub')
            b(p, '出店場所を探す').click(); sites = dialog(p)
            expect(sites.locator('.site-list button')).to_have_count(32)
            sites.locator('[data-lot-id="center-01"]').click(); d = dialog(p)
            expect(d.locator('.facility-content')).to_have_attribute('data-selected-lot-id', 'center-01')
            assert d.evaluate('(e)=>e.matches(":modal")')
            expect(d.locator('.opening-detail')).not_to_have_attribute('open', '')
            assert city(p)['focusStoreLotId'] is None and city(p)['focusLotId'] is None
            d.locator('.opening-option').filter(has_text='プレミアム').click()
            b(d, 'この出店の資金を比較').click(); finance = dialog(p)
            expect(finance).to_contain_text('財務・不動産'); finance.locator('.capital-return').click(); d = dialog(p)
            expect(d.locator('.opening-option').filter(has_text='プレミアム')).to_have_attribute('aria-pressed', 'true')
            assert primary(p) == initial
            d.locator('.opening-option').filter(has_text='街角カフェ').click(); b(d, 'この場所にカフェを開業').click()
            expect(p.locator('dialog[open]')).to_have_count(0); expect(p.locator('.toast')).to_contain_text('カフェを開業')
            assert city(p)['token'] == token and city(p)['selectedLotId'] == 'center-01'
            assert city(p)['focusStoreLotId'] is None and city(p)['focusLotId'] is None
            ok(f'{width}: 32-site/native opening/funding return keeps draft; selection/opening requests no camera focus')
            d, price = product(p); price.fill('950')
            expect(d.locator('.store-management-draft')).to_contain_text('編集中'); p.keyboard.press('Escape')
            expect(p.locator('dialog[open]')).to_have_count(0); d, price = product(p); expect(price).to_have_value('950')
            price.fill('9999'); p.keyboard.press('Tab'); expect(price).to_have_attribute('aria-invalid', 'true')
            expect(d.locator('.store-management-draft')).to_contain_text('反映できませんでした。現在の設定：950')
            shot(p, f'{width}-invalid-draft')
            if width == 390:
                panel = d.locator(':scope > section'); panel_node = panel.element_handle()
                panel.evaluate('(e)=>{e.scrollTop=e.scrollHeight}')
                scroll_before = panel.evaluate('(e)=>({top:e.scrollTop,height:e.scrollHeight})')
                notice = d.locator('.game-dialog-notice').inner_text(); p.wait_for_timeout(8500)
                assert panel_node.evaluate("e=>e.isConnected && e===document.querySelector('dialog[open] > section')")
                assert panel.evaluate('(e)=>({top:e.scrollTop,height:e.scrollHeight})') == scroll_before
                expect(d.locator('.game-dialog-notice')).to_have_text(notice)
                ok('390: invalid-input notice stays in open modal after toast timeout; same panel/scroll height/position')
            close(d); d, price = product(p)
            expect(price).to_have_value('950'); expect(price).not_to_have_attribute('aria-invalid', 'true')
            b(d, '店舗トップへ').click(); expect(d.locator('.store-management-purposes button')).to_have_count(4)
            expect(d.locator('.store-management-admin')).not_to_have_attribute('open', '')
            for purpose, field in [('人員・店長', '従業員数'), ('広告・改装', '週間広告費（円）'), ('営業実績', None)]:
                d.locator('.store-management-purposes button').filter(has_text=purpose).click()
                expect(d.get_by_role('heading', name=purpose, exact=True)).to_be_focused()
                if field: expect(d.get_by_label(field, exact=True)).to_be_visible()
                else: expect(d).to_contain_text('初営業の結果を待っています')
                b(d, '店舗トップへ').click()
            b(d, '街でこの店を見る').click(); expect(p.locator('dialog[open]')).to_have_count(0)
            assert city(p)['focusStoreLotId'] == 'center-01'; b(p, '街全体に戻る').click()
            assert city(p)['focusStoreLotId'] is None
            ok(f'{width}: purpose home has four actions; valid focused draft commits on Escape; invalid draft is explicit; store view requires click')
            selection = city(p)
            for target in ['財務・不動産', '店舗経営', '株式市場']:
                d = menu(p, target); assert d.evaluate('(e)=>e.matches(":modal")'); assert city(p) == selection
                if target == '店舗経営':
                    expect(d.get_by_label('販売価格（円）', exact=True)).to_have_count(0)
                    b(d, 'この店を経営').click(); d = dialog(p)
                    expect(d.locator('.store-management')).to_have_attribute('data-store-purpose', 'home')
                if target == '株式市場':
                    b(d, '買う').first.click(); child = d.locator('.investment-order'); expect(child).to_be_visible()
                    child.get_by_label('購入株数', exact=True).fill('2'); p.keyboard.press('Escape')
                    expect(child).to_have_count(0); expect(d).to_be_visible(); assert d.evaluate('(e)=>e.matches(":modal")')
                close(d); expect(p.locator('dialog[open]')).to_have_count(0); assert city(p) == selection
            assert primary(p) == initial
            ok(f'{width}: management dialogs preserve stub instance/selection; child stock order Escape keeps parent; no accidental saved transaction')
            if width == 390:
                b(p, 'この店を経営').click(); d = dialog(p)
                d.locator('.store-management-purposes button').filter(has_text='人員・店長').click()
                d.get_by_label('従業員数', exact=True).fill('30'); p.keyboard.press('Escape')
            before = save(p); p.reload()
            p.get_by_role('button', name=re.compile(re.escape(company) + ' を続ける')).click()
            expect(p.locator('.immersive-game')).to_be_visible(); expect(p.locator('dialog[open]')).to_have_count(0)
            assert read(p) == before
            assert before['stores'][0]['price'] == 950 and before['week'] == 1
            p.locator('.hud-next-week').click(); d = dialog(p)
            expect(d.locator('.week-outlook')).not_to_have_attribute('open', '')
            expect(d.locator('.summary-strip')).to_have_count(0); shot(p, f'{width}-week-outlook-closed')
            b(d, '営業して週を進める').click(); report_dialog, after = assert_report(p, width, negative=width == 390)
            assert after['cash'] == round(before['cash'] + after['lastReport']['cashChange'])
            shot(p, f'{width}-short-settled-report')
            report_dialog.locator('.weekly-stores > summary').click()
            expect(report_dialog.locator('.weekly-opening-comparison')).not_to_have_attribute('open', '')
            b(report_dialog, 'この店を調整').click(); d = dialog(p)
            expect(d.locator('.store-management')).to_have_attribute('data-store-purpose', 'home')
            d.locator('.store-management-purposes button').filter(has_text='営業実績').click()
            expect(d).to_contain_text('第1週に確定した')
            expect(d.locator('.store-management-results')).to_contain_text(f"{after['lastReport']['storeResults'][0]['profit']:,}円")
            close(d)
            d = menu(p, '財務・不動産'); capital = d.get_by_role('region', name='資金調達の比較')
            capital.get_by_role('button', name=re.compile('銀行から借りる')).click(); capital.locator('.capital-submit').click(); close(d)
            after_funding = save(p); assert after_funding['cash'] > after['cash']
            d = menu(p, '直近の営業結果')
            expect(d.locator('.weekly-results-profit > strong')).to_have_attribute('data-profit-complete', 'true')
            expect(d.locator('.weekly-results-cash > div').nth(1).locator('dd')).to_have_text('¥' + f"{after['cash']:,}")
            assert after_funding['lastReport'] == after['lastReport']
            shot(p, f'{width}-settled-cash-after-funding'); close(d)
            ok(f'{width}: normal financing changes current cash; reopened report preserves settled cash and profit without replay')
            saved = primary(p); p.reload()
            p.get_by_role('button', name=re.compile(re.escape(company) + ' を続ける')).click()
            expect(p.locator('.immersive-game')).to_be_visible(); expect(p.locator('dialog[open]')).to_have_count(0)
            assert primary(p) == saved
            snapshots.append({'viewport': [width, height], 'rect': rect, 'beforeWeek': before, 'afterWeek': after})
            ok(f'{width}: guide stays dismissed on reload; actual settlement/cash/store results autosave exactly; {"negative short mobile" if width == 390 else "positive"} report has closed detail')
            c.close()
        c, p, guide = start_context(browser, 1280, 960, '見込みリスクQA'); b(guide, '街で始める').click()
        d = menu(p, '財務・不動産'); capital = d.get_by_role('region', name='資金調達の比較')
        capital.get_by_role('button', name=re.compile('銀行から借りる')).click(); capital.locator('.capital-submit').click(); close(d)
        p.locator('.hud-next-week').click(); d = dialog(p)
        expect(d.locator('.week-outlook')).to_have_attribute('open', ''); expect(d.get_by_role('alert')).to_contain_text('経営')
        expect(b(d, 'リスクを承知して営業する')).to_be_visible(); shot(p, 'risk-outlook-open')
        ok('Ordinary no-store bank loan exposes risk outlook and explicit risk confirmation'); c.close()
        assert not errors, errors; complete = True
    except Exception:
        try: shot(p, 'failure'); (OUT / 'failure.txt').write_text(traceback.format_exc())
        except Exception: pass
        raise
    finally:
        (OUT / 'results.json').write_text(json.dumps({'passed': complete, 'checks': checks, 'errors': errors, 'snapshots': snapshots, 'method': 'Both 3D views explicit stubs; actual App/economy/native dialogs and ordinary actions; no state injection. Stub identity/focus props do not prove camera/render behavior.'}, ensure_ascii=False, indent=2))
        browser.close()
