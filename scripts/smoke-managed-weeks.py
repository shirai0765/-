#!/usr/bin/env python3
"""Actual UI batch progression; fixture uses earned profits and public actions only."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.getenv('PLAYTEST_OUT', '/tmp/shibuya-managed-playtest'))
OUT.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
def ok(message):
    checks.append(message)
    print('PASS', message, flush=True)
def button(scope, name):
    return scope.get_by_role('button', name=name, exact=True)
def read(page):
    return page.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
def integer(text):
    return int(re.sub(r'[^0-9-]', '', text))
def expected(page, state, count):
    return page.evaluate('''async({state,count})=>{const {runManagedWeeks}=await import('/src/sim/managedWeeks.ts');return runManagedWeeks(state,count,{commit:async()=>{}});}''', {'state':state, 'count':count})
def run_ui(page, weeks):
    page.get_by_role('button', name=re.compile('週を終了する')).click()
    dialog = page.get_by_role('dialog', name=re.compile('第.*週の営業計画'))
    dialog.get_by_label('営業を進める期間').select_option(str(weeks))
    button(dialog, f'最大{weeks}週間の営業を始める').click()
    report = page.get_by_role('dialog', name='連続営業の報告')
    expect(report).to_be_visible()
    return report

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width':1280, 'height':960}, accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(30000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.goto(os.getenv('PLAYTEST_URL', 'http://127.0.0.1:5173'))
    fixture = page.evaluate('''async()=>{
      const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');
      let s=e.createGame('委任進行検証株式会社',618);
      s=e.applyAction(s,{type:'openStore',lotId:'dogenzaka-02',style:'standard'});
      s=e.applyAction(s,{type:'updateStore',storeId:s.stores[0].id,changes:{manager:true,quality:85,price:750}});
      s=e.applyAction(s,{type:'settings',changes:{quality:'low'}});
      for(let i=0;i<12;i++) s=e.advanceWeek(s);
      if(s.profitableWeeks<12||s.gameOver)throw new Error('Fixture must earn twelve actual profitable weeks');
      return p.createEnvelope(s);
    }''')
    fixture_path = OUT / 'managed-fixture.json'
    fixture_path.write_text(json.dumps(fixture, ensure_ascii=False))
    page.locator('input[type=file]').set_input_files(str(fixture_path))
    expect(page.locator('.company h1')).to_have_text('委任進行検証株式会社')
    button(page, '店舗経営').click()
    initial = read(page)
    assert initial['week'] == 13 and initial['profitableWeeks'] == 12
    ok('imported legitimate week13 company earned from initial 12m; delegated progression unlocked')

    anticipated = expected(page, initial, 4)
    report = run_ui(page, 4)
    expect(report.locator('tbody tr')).to_have_count(4)
    current = read(page)
    assert current == anticipated['state'] and current['week'] == 17
    total = sum(item['cashChange'] for item in anticipated['reports'])
    visible_total = integer(report.locator('.metric').filter(has_text='期間の現金増減').locator('strong').inner_text())
    assert visible_total == total == current['cash'] - initial['cash']
    backups = page.evaluate("async()=> (await import('/src/persistence.ts')).listBackups()")
    assert {14,15,16,17}.issubset({b['week'] for b in backups})
    assert [integer(x) for x in report.locator('tbody tr td:first-child').all_text_contents()] == [13,14,15,16]
    ok('4-week UI run saves each week14–17; actual state, report rows and aggregate cash exactly match settlement')
    page.screenshot(path=str(OUT/'managed-four.png'), full_page=True)
    button(report, '経営に戻る').click()

    before = current
    anticipated = expected(page, before, 13)
    assert len(anticipated['reports']) == 8 and '営業提案' in anticipated['stopReason']
    report = run_ui(page, 13)
    expect(report.locator('tbody tr')).to_have_count(8)
    expect(report).to_contain_text('新しい営業提案が届きました')
    current = read(page)
    assert current == anticipated['state'] and current['week'] == 25
    total = sum(item['cashChange'] for item in anticipated['reports'])
    assert integer(report.locator('.metric').filter(has_text='期間の現金増減').locator('strong').inner_text()) == total == current['cash'] - before['cash']
    backups = page.evaluate("async()=> (await import('/src/persistence.ts')).listBackups()")
    assert sorted(b['week'] for b in backups) == list(range(14,26))
    ok('13-week UI request stops after8 at new offer week25; all12 retained weekly backups and aggregate cash are exact')
    page.screenshot(path=str(OUT/'managed-opportunity.png'), full_page=True)
    button(report, '経営に戻る').click()

    button(page, '設定・保存').click()
    settings = page.get_by_role('dialog', name='設定と会社データ')
    with page.expect_download() as download_info:
        button(settings, '保存ファイルを書き出す').click()
    export_path = OUT / 'managed-export.json'
    download_info.value.save_as(export_path)
    decoded = page.evaluate("async(envelope)=> (await import('/src/persistence.ts')).decodeEnvelope(envelope)", json.loads(export_path.read_text()))
    assert decoded == current
    button(settings, '閉じる').click()
    page.reload()
    page.get_by_role('button', name=re.compile('委任進行検証株式会社 を続ける')).click()
    button(page, '店舗経営').click()
    assert read(page) == current
    ok('downloaded save validates and equals complete batch state; browser reload retains week25 exactly')
    assert not errors, errors
    ok('zero console and page errors')
    result = {'passed':checks, 'errors':errors, 'finalWeek':current['week'], 'finalCash':current['cash'], 'backupWeeks':sorted(b['week'] for b in backups)}
    (OUT/'managed-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    browser.close()
    print(f'{len(checks)} managed UI checks passed; artifacts {OUT}')
