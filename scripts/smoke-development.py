#!/usr/bin/env python3
"""Development UI regression using explicit synthetic campaign fixtures, not a balance/playtime proof."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
OUT = Path(os.getenv('DEVELOPMENT_OUT', '/workspace/shared/shibuya-artifacts/development'))
OUT.mkdir(parents=True, exist_ok=True)
URL = os.getenv('PLAYTEST_URL', 'http://127.0.0.1:5173')
checks, errors = [], []
def ok(name):
    checks.append(name); print('PASS', name, flush=True)
def btn(root, name): return root.get_by_role('button', name=name, exact=True)
def saved(page): return page.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
def overflow(page): assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
def fixture(page, completed=False):
    return page.evaluate('''async(completed)=>{
      const e=await import('/src/sim/engine.ts'), p=await import('/src/persistence.ts');
      const d=await import('/src/data/district.ts'), dev=await import('/src/sim/development.ts');
      let s=e.createGame('街区開発UI検証株式会社',912);
      s.cash=5000000000; s.reputation=100; s.listed=true; s.profitableWeeks=12;
      for(const id of ['dogenzaka-02','center-01','sakuragaoka-01']){
        const lot=d.LOTS.find(l=>l.id===id) ?? d.LOTS.find(l=>l.available&&!s.stores.some(st=>st.lotId===l.id));
        s=e.applyAction(s,{type:'openStore',lotId:lot.id,style:'standard'});
        s=e.applyAction(s,{type:'updateStore',storeId:s.stores.at(-1).id,changes:{manager:true,price:750,quality:85}});
      }
      for(const districtId of Object.keys(d.DISTRICTS)){
        const lot=d.LOTS.find(l=>l.available&&l.district===districtId);
        s=e.applyAction(s,{type:'buyProperty',lotId:lot.id});
      }
      s=e.applyAction(s,{type:'settings',changes:{quality:'low'}});
      if(completed){
        s.cash=100000000000;
        const universe=(await import('/src/data/stocks.ts')).STOCKS;
        for(const stock of universe){s=e.applyAction(s,{type:'researchMarketCompany',stockId:stock.id});s=e.applyAction(s,{type:'acquireMarketCompany',stockId:stock.id,mode:'autonomous'});}
        s.week=10;
        for(const target of d.ACQUISITION_TARGETS)s=e.applyAction(s,{type:'acquire',targetId:target.id});
        s.development={programs:Object.keys(d.DISTRICTS).map(districtId=>({districtId,completedChoiceIds:dev.DEVELOPMENT_CHOICES.filter(c=>c.districtId===districtId&&c.id.endsWith('commerce')).map(c=>c.id)}))};
      }
      return {envelope:await p.createEnvelope(s),state:s};
    }''', completed)
def import_fixture(page, data, name):
    path = OUT / name; path.write_text(json.dumps(data['envelope'], ensure_ascii=False))
    page.locator('input[type=file]').set_input_files(str(path))
    expect(page.locator('.company h1')).to_contain_text('街区開発UI検証株式会社')
    expect(page.get_by_role('dialog', name='設定と会社データ')).to_have_count(0)
def close_week(page):
    page.get_by_role('button', name=re.compile('週を終了する')).click()
    forecast = page.get_by_role('dialog', name=re.compile('第.*週の営業計画'))
    btn(forecast, '営業して週を進める').click()
    report = page.get_by_role('dialog', name=re.compile('第.*週の経営レポート'))
    btn(report, '街に戻る').click()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width':640,'height':600})
    page = context.new_page(); page.set_default_timeout(60000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL)
    initial = page.evaluate("async()=>{const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');const s=e.createGame('初期開発条件検証');s.settings.quality='low';return p.createEnvelope(s)}")
    initial_path = OUT/'initial-fixture.json'; initial_path.write_text(json.dumps(initial,ensure_ascii=False))
    page.locator('input[type=file]').set_input_files(str(initial_path)); btn(page, '街区開発').click()
    page.set_viewport_size({'width':1280,'height':960})
    expect(page.locator('.development-district')).to_have_count(4)
    expect(page.locator('.development-choice button')).to_have_count(8)
    for button in page.locator('.development-choice button').all(): expect(button).to_be_disabled()
    expect(page.locator('.development-district').first).to_contain_text('この地区に物件を1件以上保有')
    page.screenshot(path=str(OUT/'initial-locked.png'))
    ok('initial four districts each show two disabled choices and exact missing-property requirement')
    seeded = fixture(page)
    # Import through settings uses the actual validated save path.
    btn(page, '設定・保存').click()
    import_fixture(page, seeded, 'funded-fixture.json')
    btn(page, '街区開発').click()
    district = page.locator('.development-district').first
    expect(district.locator('.development-choice button').first).to_be_enabled()
    before = saved(page)
    district.locator('.development-choice button').first.click()
    dialog = page.get_by_role('dialog', name='センター街の開発計画')
    expect(dialog).to_contain_text('着工後・今週の予想利益')
    expect(dialog).to_contain_text('変更・中止・返金はできません')
    page.screenshot(path=str(OUT/'investment-confirm.png'))
    btn(dialog, '戻る').click()
    assert saved(page) == before
    ok('funded fixture unlocks choices; real forecast displayed; cancel leaves persisted state identical')
    district.locator('.development-choice button').first.click()
    dialog.get_by_role('button', name=re.compile('着工する')).click()
    expect(dialog).to_have_count(0)
    expect(district.locator('.development-construction')).to_contain_text('あと 3 週')
    btn(page, '設定・保存').click()
    settings = page.get_by_role('dialog', name='設定と会社データ')
    btn(settings, '今すぐ保存する').click()
    expect(page.get_by_role('alert')).to_contain_text('保存しました')
    btn(settings, '閉じる').click()
    current = saved(page)
    assert current['cash'] == before['cash'] - 2400000
    assert current['development']['programs'][0]['construction']['choiceId'] == 'center-0-commerce'
    page.set_viewport_size({'width':640,'height':600})
    page.reload(); page.get_by_role('button', name=re.compile('街区開発UI検証株式会社 を続ける')).click(); btn(page, '街区開発').click()
    page.set_viewport_size({'width':1280,'height':960})
    assert saved(page) == current
    expect(page.locator('.development-district').first.locator('.development-construction')).to_contain_text('あと 3 週')
    ok('successful start deducts exactly 2.4m once; explicit UI save preserves construction across reload')
    for _ in range(3): close_week(page)
    btn(page, '街区開発').click()
    expect(page.locator('.development-district').first.locator('.development-construction')).to_contain_text('今週の決算で完成')
    close_week(page)
    btn(page, '街区開発').click()
    current = saved(page)
    assert current['development']['programs'][0]['completedChoiceIds'] == ['center-0-commerce']
    district = page.locator('.development-district').first
    expect(district.locator('.development-phases .is-complete')).to_have_count(1)
    expect(district.locator('.development-choice button').first).to_be_enabled()
    expect(district.locator('.development-effects')).to_contain_text('+6%')
    page.screenshot(path=str(OUT/'phase-complete.png'))
    ok('three waiting weeks show completion-this-closing-week; next actual settlement commits phase one and unlocks phase two')
    completed = fixture(page, True)
    btn(page, '設定・保存').click(); import_fixture(page, completed, 'completed-fixture.json')
    btn(page, '成長戦略').click()
    expect(page.locator('.progression-roadmap > li:not(.is-achieved)')).to_have_count(0)
    expect(page.locator('.progression-roadmap > li').last).to_contain_text('現在達成中')
    page.screenshot(path=str(OUT/'campaign-complete.png'))
    ok('synthetic fully completed campaign shows every roadmap goal achieved (not measured playtime)')
    for theme, title in [('daylight','Tokyo Daylight'),('metro','Metro Editorial'),('night','After Hours')]:
        btn(page, 'デザインを選ぶ').click(); chooser=page.get_by_role('dialog',name='デザインを選ぶ')
        chooser.get_by_role('button',name=re.compile(title)).click(); btn(chooser,'閉じる').click()
        btn(page, '街区開発').click(); overflow(page)
        page.screenshot(path=str(OUT/f'development-{theme}.png'))
    page.set_viewport_size({'width':390,'height':844})
    expect(page.locator('.rail nav button')).to_have_count(9)
    for tab in page.locator('.rail nav button').all():
        tab.click(); expect(tab).to_have_class('active'); overflow(page)
    btn(page,'街区開発').click(); overflow(page)
    page.screenshot(path=str(OUT/'development-mobile.png'))
    ok('all three theme development views; 390px mobile all nine navigation buttons reachable with no document overflow')
    assert not errors, errors
    ok('no browser console errors or unhandled page exceptions')
    (OUT/'results.json').write_text(json.dumps({'passed':checks,'errors':errors,'fixtureNotice':'Synthetic UI fixtures, not an earned campaign or playtime benchmark.'},ensure_ascii=False,indent=2))
    browser.close()
