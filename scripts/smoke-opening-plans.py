#!/usr/bin/env python3
"""0.4.1 opening DOM/save checks. CityView is a prop-observing null stub; GPU is disabled."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT=Path(os.getenv('OPENING_SMOKE_OUT','/workspace/shared/shibuya-artifacts/opening-0.4.1'))
OUT.mkdir(parents=True,exist_ok=True)
URL=os.getenv('PLAYTEST_URL','http://127.0.0.1:5173')
checks,errors=[],[]
labels={'standard':'街角カフェ','premium':'プレミアム','takeaway':'テイクアウト'}
CITY_STUB='export default function CityView(p){globalThis.__openingCityProps={selectedLotId:p.selectedLotId,focusStoreLotId:p.focusStoreLotId};return null}'

def ok(message): checks.append(message); print('PASS',message,flush=True)
def btn(root,name): return root.get_by_role('button',name=name,exact=True)
def read(page): return page.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
def yen(value): return '¥'+format(round(value),',')
def save(page):
    page.locator('.rail-settings').click()
    dialog=page.get_by_role('dialog',name='設定と会社データ')
    btn(dialog,'今すぐ保存する').click()
    expect(page.locator('.toast')).to_contain_text('保存しました')
    btn(dialog,'閉じる').click()
    return read(page)
def week(page,number):
    page.get_by_role('button',name=re.compile('週を終了する')).click()
    plan=page.get_by_role('dialog',name=f'第{number}週の営業計画')
    btn(plan,'営業して週を進める').click()
    report=page.get_by_role('dialog',name=f'第{number}週の経営レポート')
    expect(report).to_be_visible()
    return report
def style(page,key): page.locator('.opening-option').filter(has_text=labels[key]).click()
def select(page): page.locator('.site-list button').filter(has_text='宇田川の角店').click()
def overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'document overflow'
    for selector in ['.opening-result','.store-opening']:
        for item in page.locator(selector).all():
            assert item.evaluate('(el)=>el.scrollWidth <= el.clientWidth'), selector+' overflow'
def shot(page,name,target=None):
    if page.locator('.toast button').count(): page.locator('.toast button').click()
    if target is not None: target.evaluate('(el)=>el.scrollIntoView({block:"start"})')
    overflow(page)
    page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
def details(card,opened):
    detail=card.locator('.opening-result-details')
    if detail.evaluate('(el)=>el.open')!=opened: detail.locator('summary').click()
    assert detail.evaluate('(el)=>el.open')==opened
    if opened: expect(card.locator('.opening-result-comparison')).to_be_visible()
    else: expect(card.locator('.opening-result-comparison')).not_to_be_visible()
def assert_result(card,record):
    result=record['result']
    expect(card.locator('header h4')).to_have_text(record['storeName'])
    expect(card.locator('.opening-result-actual-metrics > div').nth(0).locator('dd')).to_have_text(yen(result['storeProfit']))
    expect(card.locator('.opening-result-actual-metrics > div').nth(1).locator('dd')).to_have_text(f"{result['customers']:,} 人")
    outcome='黒字でした' if result['storeProfit']>0 else '赤字でした' if result['storeProfit']<0 else '収支が均衡しました'
    expect(card.locator('.opening-result-outcome')).to_contain_text(outcome)
    assert card.evaluate('(el)=>!!(el.querySelector(".opening-result-actual").compareDocumentPosition(el.querySelector("details")) & Node.DOCUMENT_POSITION_FOLLOWING)')
def assert_focus(page,lot_id):
    page.wait_for_function('(id)=>globalThis.__openingCityProps?.focusStoreLotId===id',arg=lot_id)
    if lot_id: expect(btn(page,'街全体に戻る')).to_be_visible()
    else: expect(btn(page,'街全体に戻る')).to_have_count(0)
def fresh(browser,name):
    context=browser.new_context(viewport={'width':1280,'height':1000})
    context.route('**/src/city/CityView.tsx*',lambda route:route.fulfill(status=200,content_type='application/javascript',body=CITY_STUB))
    page=context.new_page(); page.set_default_timeout(20000)
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto(URL); page.get_by_label('会社名').fill(name)
    btn(page,'新しい会社を設立').click()
    expect(page.locator('.company h1')).to_have_text(name)
    return context,page

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--disable-gpu'])
    context,page=fresh(browser,'出店計画検証')
    initial=save(page); select(page)
    plans=page.evaluate("async()=>{const p=await import('/src/persistence.ts'),m=await import('/src/sim/storePlanning.ts');return m.getStoreOpeningPlans(await p.loadGame(),'center-01')}")
    for plan in plans:
        assert plan['available']; style(page,plan['style'])
        panel=page.get_by_role('region',name='出店プランの比較')
        expect(panel.locator('.opening-comparison > div').filter(has_text='手元資金・開業費支払後').locator('dd strong')).to_have_text(yen(plan['cashAfter']))
        expect(panel.locator('.opening-comparison > div').filter(has_text='全社の利益 / 週・利息控除後').locator('dd strong')).to_have_text(yen(plan['after']['netProfit']))
        assert read(page)==initial
    ok('Three style choices match executable company-profit/cash forecasts and leave saved state unchanged')
    page.set_viewport_size({'width':390,'height':844})
    shot(page,'opening-mobile',page.locator('.opening-options'))
    page.set_viewport_size({'width':1280,'height':1000})
    ok('390px opening comparison has no horizontal document or panel overflow')

    style(page,'standard'); plan=next(x for x in plans if x['style']=='standard')
    btn(page,'この場所にカフェを開業').click()
    opened=save(page)
    assert opened['cash']==plan['cashAfter'] and len(opened['openingRecords'])==1
    report=week(page,1); saved=read(page); record=saved['openingRecords'][0]
    assert record['result']['companyNetProfit']==plan['after']['netProfit']==saved['lastReport']['netProfit']
    assert saved['cash']==opened['cash']+saved['lastReport']['cashChange']
    region=report.get_by_role('region',name='開店後の初決算')
    card=region.locator('.opening-result')
    expect(region).to_be_visible(); assert_result(card,record); details(card,False)
    expect(btn(region,'今の運営を続ける')).to_be_visible()
    details(card,True); expect(card.locator('details')).to_contain_text('出店時の全社予測と一致')
    assert read(page)==saved
    details(card,False)
    page.set_viewport_size({'width':390,'height':844})
    shot(page,'opening-first-result-mobile',card)
    btn(card,'店の様子を見る').click()
    expect(report).to_have_count(0); assert_focus(page,record['lotId'])
    expect(page.locator('.inspector')).to_contain_text(record['storeName'])
    assert read(page)==saved
    btn(page,'街全体に戻る').click(); assert_focus(page,None)
    ok('First actual store profit/customers precede collapsed comparisons; opening charge and weekly save are exact; report view-store routes correct lot without state mutation')

    btn(page,'経営記録').click(); card=page.locator('.opening-result')
    expect(card).to_have_count(1); assert_result(card,record); details(card,False)
    shot(page,'opening-history',card)
    details(card,True); expect(card.locator('details')).to_contain_text('出店時の全社予測と一致')
    btn(card,'この店の運営を見る').click(); assert_focus(page,None)
    expect(page.locator('.inspector')).to_contain_text(record['storeName'])
    assert read(page)==saved
    btn(page,'経営記録').click(); btn(page,'次の出店候補を見る').click()
    expect(page.locator('.site-list')).to_be_visible(); assert read(page)==saved
    page.reload(); page.get_by_role('button',name=re.compile('出店計画検証 を続ける')).click()
    assert read(page)==saved
    btn(page,'経営記録').click(); assert_result(page.locator('.opening-result'),record)
    ok('History details, operations and next-site navigation preserve complete saved JSON; reload retains first result')
    context.close()

    context,page=fresh(browser,'出店変更検証')
    select(page); style(page,'standard'); btn(page,'この場所にカフェを開業').click()
    save(page); btn(page,'閉店').click()
    style(page,'takeaway'); btn(page,'この場所にカフェを開業').click()
    reopened=save(page); records=reopened['openingRecords']
    assert len(records)==2 and records[0]['closedWeek']==1 and 'result' not in records[0] and records[1]['id']!=records[0]['id']
    for label,value in [('販売価格（円）','950'),('従業員数','30')]:
        field=page.get_by_label(label,exact=True); field.fill(value); field.press('Tab')
    modified=save(page)
    predicted=page.evaluate("async()=>{const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');return e.previewWeek(await p.loadGame())}")
    assert predicted['netProfit']!=records[1]['netProfitAfter'] and predicted['storeResults'][0]['profit']<0
    report=week(page,1); after=read(page)
    assert 'result' not in after['openingRecords'][0]
    assert after['openingRecords'][1]['result']['companyNetProfit']==predicted['netProfit']
    card=report.locator('.opening-result'); assert_result(card,after['openingRecords'][1])
    expect(card.locator('.opening-result-outcome')).to_contain_text('赤字でした')
    expect(card.locator('.opening-result-outcome')).not_to_contain_text('黒字')
    details(card,False)
    page.set_viewport_size({'width':390,'height':844})
    shot(page,'opening-loss-mobile',card)
    btn(report.get_by_role('region',name='開店後の初決算'),'今の運営を続ける').click()
    expect(report).to_have_count(0)
    btn(page,'経営記録').click()
    expect(page.locator('.opening-result')).to_have_count(2)
    closed_card=page.locator('.opening-result').filter(has_text='初営業前に閉店')
    settled_card=page.locator('.opening-result').filter(has_text='第1週に初決算')
    expect(closed_card).to_contain_text('営業実績はありません')
    expect(btn(closed_card,'店の様子を見る')).to_have_count(0)
    expect(btn(closed_card,'この区画を見る')).to_be_visible()
    details(settled_card,True); expect(settled_card.locator('details')).to_contain_text('出店時の全社予測との差')
    details(settled_card,False)
    assert read(page)==after
    shot(page,'history-mobile',settled_card)
    shot(page,'closed-before-first-week-mobile',closed_card)
    ok('Same-week closure/reopening keeps separate history; real loss is stated as loss, changed-settings comparison remains available, old closed record has no close-view link')
    btn(settled_card,'店の様子を見る').click(); assert_focus(page,'center-01')
    assert read(page)==after
    btn(page,'閉店').click(); closed=save(page)
    btn(page,'経営記録').click()
    expect(page.locator('.opening-result').get_by_role('button',name='店の様子を見る',exact=True)).to_have_count(0)
    expect(page.locator('.opening-result').filter(has_text='第1週に初決算')).to_contain_text('現在営業していません')
    assert read(page)==closed
    ok('After actual post-settlement closure, historical profit remains visible and all unavailable-store close-view buttons disappear')
    context.close()

    context,page=fresh(browser,'旧記録検証')
    legacy=page.evaluate("async()=>{const e=await import('/src/sim/engine.ts'),p=await import('/src/persistence.ts');let s=e.applyAction(e.createGame('既存会社'),{type:'openStore',lotId:'center-01',style:'standard'});s=e.advanceWeek(s);delete s.openingRecords;return {state:s,envelope:await p.createEnvelope(s)}}")
    path=OUT/'legacy-fixture.json'; path.write_text(json.dumps(legacy['envelope'],ensure_ascii=False))
    page.locator('.rail-settings').click()
    btn(page.get_by_role('dialog',name='設定と会社データ'),'ファイルから読み込む').click()
    page.locator('input[type=file]').set_input_files(str(path))
    expect(page.locator('.company h1')).to_have_text('既存会社')
    assert read(page)==legacy['state']
    btn(page,'経営記録').click()
    expect(page.locator('.opening-result-empty')).to_contain_text('後から作成しません')
    expect(page.locator('.opening-result')).to_have_count(0)
    assert save(page)==legacy['state']
    ok('Legacy JSON with an operating store and no journal imports and resaves identically without invented forecasts/results')
    context.close(); browser.close()
assert not errors,errors
ok('No browser console errors or unhandled exceptions')
(OUT/'result.json').write_text(json.dumps({'version':'0.4.1','checks':checks,'errors':errors,'cityViewStub':True,'stubObserves':['selectedLotId','focusStoreLotId'],'renderingTested':False,'browserFlags':['--disable-gpu'],'firstResult':record,'changedResult':after['openingRecords'][1],'legacySaveUnchanged':True},ensure_ascii=False,indent=2)+'\n')
