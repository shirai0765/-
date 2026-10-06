#!/usr/bin/env python3
"""Real UI smoke test against an already-running Vite development server."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('PLAYTEST_URL', 'http://127.0.0.1:5173')
OUT = Path(os.environ.get('PLAYTEST_OUT', '/tmp/shibuya-playtest'))
OUT.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
def passed(name):
    checks.append(name)
    print('PASS', name, flush=True)
def attach(page):
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text + ' ' + str(m.location)) if m.type == 'error' else None)
    page.set_default_timeout(30000)
def button(page, name):
    return page.get_by_role('button', name=name, exact=True)
def metric(root, label):
    return root.locator('.metric').filter(has_text=label).locator('strong').inner_text()
def yen(value):
    return int(re.sub(r'[^0-9-]', '', value))
def saved(page):
    return page.evaluate("async () => (await import('/src/persistence.ts')).loadGame()")
def settings(page):
    button(page, '設定・保存').click()
    return page.get_by_role('dialog', name='設定と会社データ')
def save_ui(page):
    d = settings(page)
    button(d, '今すぐ保存する').click()
    expect(page.get_by_role('alert')).to_contain_text('保存しました')
    button(d, '閉じる').click()
def overflow(page):
    sizes = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
    assert sizes['scroll'] <= sizes['width'], sizes

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width':1260,'height':900}, accept_downloads=True)
    page = context.new_page(); attach(page)
    page.goto(URL)
    page.get_by_label('会社名').fill('ブラウザ検証珈琲株式会社')
    button(page, '新しい会社を設立').click()
    expect(page.locator('.company h1')).to_have_text('ブラウザ検証珈琲株式会社')
    page.wait_for_function('window.__cityRenderer?.info.render.triangles > 0')
    render = page.evaluate('({triangles:window.__cityRenderer.info.render.triangles,calls:window.__cityRenderer.info.render.calls,objects:window.__cityScene.children.length})')
    expect(page.locator('canvas')).to_be_visible()
    # Sample an explicitly rendered frame: a single uniform/blank canvas cannot pass.
    colors = page.evaluate('''() => {const r=window.__cityRenderer; r.render(window.__cityScene,window.__cityCamera); const gl=r.getContext(), w=gl.drawingBufferWidth,h=gl.drawingBufferHeight; const px=new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px); const colors=new Set(); for(let i=0;i<px.length;i+=400) colors.add(px.slice(i,i+3).join(',')); return colors.size;}''')
    assert colors > 30, colors
    page.screenshot(path=str(OUT/'city.png'))
    passed(f'new company; rendered city ({render}, {colors} sampled colors)')
    d = settings(page)
    d.get_by_label('3D描画').select_option('low')
    button(d, '閉じる').click()
    names = page.locator('.site-list button strong').all_text_contents()
    chosen = None
    for name in names:
        page.locator('.site-list button').filter(has_text=name).click()
        preview = page.locator('.inspector .cost-list div').filter(has_text='全社の増分利益 / 週').locator('dd')
        if yen(preview.inner_text()) > 0:
            chosen = name; break
        button(page, '選択を解除').click()
    assert chosen, 'No profitable visible site'
    button(page, 'この場所にカフェを開業').click()
    button(page, '店舗経営').click()
    expect(page.locator('.store-grid article')).to_have_count(1)
    page.get_by_label('販売価格（円）').fill('650'); page.get_by_label('販売価格（円）').press('Tab')
    page.get_by_label('従業員数').fill('3'); page.get_by_label('従業員数').press('Tab')
    page.get_by_label('店長に運営を委任', exact=False).check()
    expect(page.get_by_label('店長に運営を委任', exact=False)).to_be_checked()
    overflow(page)
    passed('profitable-site café opened; price, staffing and manager controls')
    page.get_by_role('button', name=re.compile('週を終了する')).click()
    forecast = page.get_by_role('dialog', name='第1週の営業計画')
    profit = metric(forecast, '純利益予測'); revenue = metric(forecast, '売上予測')
    end_cash = yen(forecast.locator('.cost-list div').filter(has_text='週末の資金予測').locator('dd').inner_text())
    button(forecast, '営業して週を進める').click()
    report = page.get_by_role('dialog', name='第1週の経営レポート')
    expect(report.locator('.report-intro h3')).to_have_text(profit)
    assert metric(report, '週間売上') == revenue
    button(report, '街に戻る').click()
    snapshot = saved(page)
    assert snapshot['week'] == 2 and len(snapshot['stores']) == 1 and snapshot['cash'] == end_cash
    passed('week 1 forecast equals report and saved cash; week 2 autosaved')
    page.reload()
    page.get_by_role('button', name=re.compile('ブラウザ検証珈琲株式会社 を続ける')).click()
    button(page, '店舗経営').click()
    expect(page.locator('.store-grid article')).to_have_count(1)
    assert saved(page) == snapshot
    passed('reload and continue preserves full saved state')
    button(page, '株式市場').click()
    expect(page.locator('tbody tr')).to_have_count(100)
    page.get_by_role('group', name='上場市場で絞り込み').get_by_role('button', name=re.compile('グロース')).click()
    count = page.locator('tbody tr').count(); assert 0 < count < 100
    assert all('グロース' in t for t in page.locator('tbody tr td:first-child').all_text_contents())
    page.get_by_role('group', name='上場市場で絞り込み').get_by_role('button', name=re.compile('すべて')).click()
    page.get_by_label('1株の購入予算').select_option('500')
    assert page.locator('tbody tr').count() > 0
    row = page.locator('tbody tr').first
    assert yen(row.locator('td').nth(1).locator('strong').inner_text()) <= 500
    stock_name = row.locator('td').first.locator('strong').inner_text()
    button(row, '買う').click()
    order = page.get_by_role('dialog')
    expect(order.get_by_label('購入株数')).to_have_value('1')
    order.get_by_role('button', name=re.compile('1株を購入する')).click()
    page.get_by_label('保有銘柄のみ').check()
    expect(page.locator('tbody tr')).to_have_count(1)
    expect(page.locator('tbody tr')).to_contain_text(stock_name)
    button(page.locator('tbody tr'), '売る').click()
    page.get_by_role('dialog').get_by_role('button', name=re.compile('1株を売却する')).click()
    expect(page.locator('tbody tr')).to_have_count(0)
    page.get_by_label('保有銘柄のみ').uncheck()
    overflow(page)
    page.screenshot(path=str(OUT/'market.png'))
    passed(f'100 stocks, Growth filter ({count}), budget filter, 1-share purchase and sale')
    button(page, '財務・不動産').click()
    page.get_by_label('借入希望額（円）').fill('100000')
    button(page, '52週間の融資を受ける').click()
    expect(button(page, '一括返済')).to_be_visible()
    button(page, '一括返済').click()
    expect(page.get_by_text('借入はありません。', exact=True)).to_be_visible()
    save_ui(page)
    final_state = saved(page)
    assert final_state['cash'] == snapshot['cash'] and final_state['positions'] == [] and final_state['loans'] == []
    passed('loan borrow/repay and stock roundtrip preserve cash')
    d = settings(page)
    with page.expect_download() as download:
        button(d, '保存ファイルを書き出す').click()
    path = OUT/'save.json'; download.value.save_as(str(path))
    assert json.loads(json.loads(path.read_text())['payload']) == final_state
    imported_context = browser.new_context(viewport={'width':900,'height':900})
    imported = imported_context.new_page(); attach(imported); imported.goto(URL)
    expect(button(imported, '保存ファイルを読み込む')).to_be_visible()
    imported.locator('input[type=file]').set_input_files(str(path))
    expect(imported.locator('.company h1')).to_have_text('ブラウザ検証珈琲株式会社')
    button(imported, '店舗経営').click()
    expect(imported.locator('.store-grid article')).to_have_count(1)
    assert saved(imported) == final_state
    overflow(imported)
    button(imported, '株式市場').click(); overflow(imported)
    imported.screenshot(path=str(OUT/'market-900.png'))
    passed('export/import in fresh browser context; 1260px and 900px no document overflow')
    (OUT/'results.json').write_text(json.dumps({'passed':checks,'errors':errors}, ensure_ascii=False, indent=2))
    assert not errors, errors
    passed('no browser pageerror or console errors')
    browser.close()
    (OUT/'results.json').write_text(json.dumps({'passed':checks,'errors':errors}, ensure_ascii=False, indent=2))
    print(f'{len(checks)} scenarios passed; artifacts {OUT}')
