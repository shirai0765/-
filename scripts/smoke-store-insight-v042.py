#!/usr/bin/env python3
"""Store insight DOM regression against captured 0.4.1 public-action states.
CityView is explicitly stubbed and GPU disabled. This is not a visual-city,
Windows-performance, user-comprehension or optimal-strategy test.
"""
import hashlib, json, math, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.getenv('STORE_INSIGHT_OUT', '/workspace/shared/shibuya-artifacts/store-insight-0.4.2'))
OUT.mkdir(parents=True, exist_ok=True)
BASELINE = Path(os.getenv('STORE_INSIGHT_BASELINE', str(OUT / 'baseline-v041.json')))
CONTROLS = Path(os.getenv('STORE_CONTROLS_BASELINE', str(OUT / 'controls-v041.json')))
URL = os.getenv('PLAYTEST_URL', 'http://127.0.0.1:5173')
baseline = json.loads(BASELINE.read_text())
controls = json.loads(CONTROLS.read_text())
assert baseline['sourceVersion'] == controls['sourceVersion'] == '0.4.1'
assert baseline['sourceHashes']['src/sim/engine.ts'] == controls['engineSHA256']
cases = {case['id']: case for case in baseline['cases']}
checks, errors, layouts, rounded_cases = [], [], [], []
def ok(message):
    checks.append(message); print('PASS', message, flush=True)
def btn(root, name): return root.get_by_role('button', name=name, exact=True)
def round_js(number): return math.floor(number + .5)
def yen(number): return '¥' + format(round_js(number), ',')
def read(page): return page.evaluate("async()=>(await import('/src/persistence.ts')).loadGame()")
def save(page):
    if page.locator('.toast button').count(): page.locator('.toast button').click()
    btn(page, '設定・保存').click()
    dialog = page.get_by_role('dialog', name='設定と会社データ')
    btn(dialog, '今すぐ保存する').click()
    expect(page.locator('.toast')).to_contain_text('保存しました')
    expect(btn(dialog, '今すぐ保存する')).to_be_enabled()
    btn(dialog, '閉じる').click()
    expect(dialog).to_have_count(0)
    if page.locator('.toast button').count(): page.locator('.toast button').click()
    return read(page)
def import_state(page, state, name, initial=False):
    envelope = page.evaluate("async(s)=>(await import('/src/persistence.ts')).createEnvelope(s)", state)
    path = OUT / (name + '.json'); path.write_text(json.dumps(envelope, ensure_ascii=False))
    if not initial: btn(page, '設定・保存').click()
    page.locator('input[type=file]').set_input_files(str(path))
    expect(page.locator('.company h1')).to_contain_text(state['companyName'])
    expect(page.get_by_role('dialog', name='設定と会社データ')).to_have_count(0)
    btn(page, '店舗経営').click()
def run_action(page, state, action):
    return page.evaluate("async(x)=>(await import('/src/sim/engine.ts')).applyAction(x.state,x.action)", {'state':state,'action':action})
def engine_view(page, state):
    return page.evaluate("""async(s)=>{const e=await import('/src/sim/engine.ts');const before=JSON.stringify(s);const insights=s.stores.map(st=>e.getStoreOperatingInsight(s,st.id));const forecast=e.previewWeek(s);if(JSON.stringify(s)!==before)throw Error('Read-only insight mutated input state');return {forecast,insights}}""", state)
def region_for(page, store_id): return page.locator(f'.store-operating-insight[data-store-id="{store_id}"]')
def row_value(region, group, label): return region.locator(group).locator('dt').filter(has_text=re.compile('^' + re.escape(label) + '$')).locator('..').locator('dd')
def count_text(locator): return int(re.sub(r'[^0-9-]', '', locator.inner_text()))
def check_insights(page, state, expected_forecast=None):
    view = engine_view(page, state)
    if expected_forecast is not None: assert view['forecast'] == expected_forecast, '0.4.1 forecast changed'
    expect(page.locator('.store-operating-insight')).to_have_count(len(state['stores']))
    for store, insight in zip(state['stores'], view['insights']):
        assert insight is not None
        region = region_for(page, store['id'])
        expect(region).to_be_visible()
        expect(region).to_contain_text(store['name'])
        expect(region.locator('.store-insight-heading')).to_contain_text(f"第{state['week']}週の予測")
        expect(region).to_have_attribute('aria-label',store['name']+'の今週の運営予測')
        diagnosis=region.locator('.store-insight-diagnosis')
        expect(diagnosis).to_be_visible()
        flow=insight['flow']
        near=round_js(flow['demand'])==round_js(flow['capacity']) or round_js(abs(flow['demand']-flow['capacity']))==0
        expect(diagnosis).to_contain_text('近い状態' if near else '上回る見込み' if flow['demand']>flow['capacity'] else '余力')
        expect(region.locator('.store-insight-staff-limit')).to_have_count(1 if insight['effectiveSettings']['staff']>insight['context']['staffCapacityLimit'] else 0)
        expect(region.locator('.store-insight-flow')).to_be_visible()
        for label, key in [('需要の見込み','demand'),('対応上限','capacity'),('迎える予想人数','customers')]:
            assert count_text(row_value(region,'.store-insight-flow',label)) == round_js(insight['flow'][key]), (label,insight['flow'])
        expect(region.locator('.store-insight-result strong')).to_have_text(yen(insight['result']['profit']))
        assert row_value(region,'.store-insight-satisfaction','予想満足度').inner_text() == str(insight['result']['satisfaction']) + '／100'
        card = region.locator('xpath=ancestor::article[1]')
        for label, key in [('販売価格（円）','price'),('従業員数','staff'),('週間広告費','marketing')]:
            expect(card.get_by_label(label,exact=True)).to_have_value(str(store[key]))
        expect(card.get_by_role('slider')).to_have_value(str(store['quality']))
        if store['manager']:
            for label,key in [('価格','price'),('従業員数','staff'),('品質','quality'),('広告費','marketing')]:
                assert count_text(row_value(region,'.store-insight-manager-settings',label)) == insight['effectiveSettings'][key]
            expect(region.locator('.store-insight-manager')).to_contain_text(format(round_js(insight['costs']['manager']), ',')+'円／週')
        expect(region.locator('.store-insight-founder')).to_have_count(1 if not store['manager'] and insight['context']['founderCapacity']<1 else 0)
        details=region.locator('.store-insight-costs')
        was_open=details.evaluate('(el)=>el.open')
        if not was_open: details.locator('summary').click()
        for key,label in [('ingredients','材料費'),('fulfilment','包装・決済など'),('labor','従業員の人件費'),('rent','家賃'),('equipment','店舗・設備の維持費'),('marketing','広告費'),('manager','店長費')]:
            assert count_text(row_value(region,'.store-insight-cost-list',label)) == round_js(insight['costs'][key])
        displayed_total=count_text(row_value(region,'.store-insight-cost-list','店舗費用合計'))
        assert displayed_total==sum(round_js(value) for value in insight['costs'].values())+insight['roundedCostAdjustment']
        assert displayed_total==insight['result']['revenue']-insight['result']['profit']
        if insight['roundedCostAdjustment']:
            assert count_text(row_value(region,'.store-insight-cost-list','表示の丸め調整'))==insight['roundedCostAdjustment']
            rounded_cases.append({'week':state['week'],'storeId':store['id'],'adjustment':insight['roundedCostAdjustment']})
        if not was_open: details.locator('summary').click()
        assert insight['result'] == next(result for result in view['forecast']['storeResults'] if result['id'] == store['id'])
    return view

def edit_store(page, card, field, value):
    if field == 'quality':
        slider = card.get_by_role('slider'); slider.focus(); slider.press('Home')
        for _ in range((value - 20) // 5): slider.press('ArrowRight')
        expect(slider).to_have_value(str(value))
    elif field == 'manager':
        card.get_by_label('店長に運営を委任', exact=False).set_checked(value)
    else:
        labels = {'price':'販売価格（円）','staff':'従業員数','marketing':'週間広告費','name':'店舗名'}
        control = card.get_by_label(labels[field], exact=True)
        control.fill(str(value)); control.press('Tab')
def shot(page, name, region):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('.main-area').evaluate('(el)=>el.scrollWidth <= el.clientWidth')
    if page.locator('.toast button').count(): page.locator('.toast button').click()
    region.evaluate('(el)=>el.scrollIntoView({block:"start"})')
    page.screenshot(path=str(OUT / (name + '.png')))

def finish_week(page, week):
    page.get_by_role('button', name=re.compile('週を終了する')).click()
    dialog = page.get_by_role('dialog', name=f'第{week}週の営業計画')
    btn(dialog, '営業して週を進める').click()
    btn(page.get_by_role('dialog', name=f'第{week}週の経営レポート'), '街に戻る').click()

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--disable-gpu'])
    context = browser.new_context(viewport={'width':1280,'height':960})
    context.route('**/src/city/CityView.tsx*', lambda route:route.fulfill(status=200, content_type='application/javascript', body='export default function CityView(){return null}'))
    page = context.new_page(); page.set_default_timeout(30000)
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('console', lambda m:errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL)
    current = controls['snapshots'][0]['state']
    import_state(page, current, 'initial-control-fixture', initial=True)
    check_insights(page, current, controls['snapshots'][0]['forecast'])
    region = region_for(page, current['stores'][0]['id'])
    details = region.locator('.store-insight-costs')
    assert not details.evaluate('(el)=>el.open')
    details.locator('summary').click(); details.locator('summary').click()
    assert save(page) == current
    ok('Initial prediction matches captured 0.4.1 forecast; viewing and expanding costs leave saved state unchanged')
    for snapshot in controls['snapshots'][1:]:
        field, value = next(iter(snapshot['action']['changes'].items()))
        card = region_for(page,current['stores'][0]['id']).locator('xpath=ancestor::article[1]')
        edit_store(page,card,field,value)
        current = snapshot['state']
        check_insights(page,current,snapshot['forecast'])
        assert save(page) == current
    manager_view = engine_view(page,current)['insights'][0]
    expect(region_for(page,current['stores'][0]['id']).locator('.store-insight-manager')).to_be_visible()
    assert current['stores'][0]['manager']
    shot(page,'manager-desktop',region_for(page,current['stores'][0]['id']))
    ok('Price, staffing, quality, advertising and manager controls reproduce the exact 0.4.1 states and forecasts')
    finish_week(page,current['week'])
    assert read(page) == controls['advancedState']
    current = read(page)
    assert current['lastReport'] == controls['snapshots'][-1]['forecast']
    card=region_for(page,current['stores'][0]['id']).locator('xpath=ancestor::article[1]')
    expect(card.locator('.mini-metrics .metric').filter(has=page.get_by_text('前週利益',exact=True))).to_contain_text('48.8万円')
    expect(region_for(page,current['stores'][0]['id']).locator('.store-insight-heading')).to_contain_text('第2週の予測')
    page.reload(); page.get_by_role('button',name=re.compile(re.escape(current['companyName'])+' を続ける')).click();btn(page,'店舗経営').click()
    assert read(page) == current
    check_insights(page,current)
    assert save(page) == current
    ok('Actual week settlement and reload match the pre-change baseline, preserving first-week records and manager settlement')

    case = cases['saturated-quality85']; current=case['inputState'];import_state(page,current,'saturated-fixture')
    before=check_insights(page,current,case['forecast'])['insights'][0]
    card=region_for(page,current['stores'][0]['id']).locator('xpath=ancestor::article[1]')
    edit_store(page,card,'quality',100)
    current=cases['saturated-quality100']['inputState']
    after=check_insights(page,current,cases['saturated-quality100']['forecast'])['insights'][0]
    assert before['result']['customers']==after['result']['customers']==1120
    assert after['result']['profit']-before['result']['profit']==-19320
    assert after['result']['satisfaction']-before['result']['satisfaction']==5
    assert save(page)==current
    ok('Quality85 to100 preserves 1120 customers, lowers this-week profit by19320 and raises satisfaction by5 without immediate cash charge')

    for case_id in ['demand-limited','high-profit-low-satisfaction','manager-normal','manager-keeps-low-satisfaction-fallback','chain-4','chain4-one-manager','week87-owned','borrowed-loss']:
        case=cases[case_id];current=case['inputState'];import_state(page,current,case_id+'-fixture')
        view=check_insights(page,current,case['forecast'])
        assert save(page)==current
        if case_id=='demand-limited':
            assert view['insights'][0]['flow']['unusedCapacity']>0
            shot(page,'demand-limited-desktop',region_for(page,current['stores'][0]['id']))
        elif case_id=='high-profit-low-satisfaction':
            region=region_for(page,current['stores'][0]['id'])
            assert not region.locator('.store-insight-costs').evaluate('(el)=>el.open')
            expect(row_value(region,'.store-insight-satisfaction','予想満足度')).to_be_visible()
            assert view['insights'][0]['result']['profit']>0 and view['insights'][0]['result']['satisfaction']==47
        elif case_id.startswith('manager-'):
            expect(region_for(page,current['stores'][0]['id']).locator('.store-insight-manager')).to_be_visible()
        elif case_id=='chain-4':
            first,second=current['stores'][:2]
            region_for(page,first['id']).locator('.store-insight-costs summary').click()
            assert not region_for(page,second['id']).locator('.store-insight-costs').evaluate('(el)=>el.open')
            btn(page,first['name']+'の様子を見る').click()
            region=region_for(page,first['id'])
            expect(page.locator('.store-operating-insight')).to_have_count(1)
            region.locator('.store-insight-costs summary').click()
            btn(page,'店舗経営').click()
            btn(page,second['name']+'の様子を見る').click()
            region=region_for(page,second['id'])
            expect(page.locator('.store-operating-insight')).to_have_count(1)
            expect(region.locator('.store-insight-heading')).to_contain_text(second['name'])
            assert not region.locator('.store-insight-costs').evaluate('(el)=>el.open')
            assert save(page)==current
            btn(page,'店舗経営').click()
            ok('Switching managed stores keeps correct identities and starts the newly viewed store details closed without changing state')
        elif case_id=='week87-owned':
            assert view['insights'][0]['costs']['rent']==0
            assert view['forecast']['netProfit'] != view['insights'][0]['result']['profit']
            region=region_for(page,current['stores'][0]['id']);region.locator('.store-insight-costs summary').click()
            expect(row_value(region,'.store-insight-cost-list','家賃')).to_have_text('0円')
            expect(region.locator('.store-insight-owned-property')).to_contain_text('維持費は全社の収支で別')
            assert save(page)==current
        elif case_id=='borrowed-loss':
            assert view['forecast']['netProfit']<0 and current['loans']
            page.get_by_role('button',name=re.compile('週を終了する')).click()
            dialog=page.get_by_role('dialog',name=f"第{current['week']}週の営業計画")
            expect(dialog).to_contain_text('倒産の見込み')
            btn(dialog,'計画に戻る').click()
            assert save(page)==current
            finish_week(page,current['week'])
            assert read(page)==case['advancedState']
            assert read(page)['gameOver']
            expect(page.locator('.store-operating-insight')).to_have_count(0)
            expect(page.locator('.game-over-banner')).to_be_visible()
            assert save(page)==case['advancedState']
            ok('Borrowed loss settles to exact old terminal state and shows no forecast for the ended company')
    ok('Demand headroom, profitable low satisfaction, manager fallback, founder limits, owned zero rent and debt loss cases match pre-change forecasts')

    current=cases['initial-center-01-standard']['inputState'];import_state(page,current,'long-name-fixture')
    page.set_viewport_size({'width':390,'height':844})
    region=region_for(page,current['stores'][0]['id'])
    layouts.append({'theme':'daylight','viewport':390,'nameLength':len(current['stores'][0]['name']),'panelHeight':round(region.bounding_box()['height'])})
    shot(page,'normal-mobile',region)
    long_name='渋谷駅前・来店需要と処理能力を確認する珈琲株式会社第一号店'
    action={'type':'updateStore','storeId':current['stores'][0]['id'],'changes':{'name':long_name}}
    current=run_action(page,current,action)
    card=region_for(page,current['stores'][0]['id']).locator('xpath=ancestor::article[1]')
    edit_store(page,card,'name',long_name)
    check_insights(page,current)
    page.set_viewport_size({'width':390,'height':844})
    for theme,title in [('daylight','Tokyo Daylight'),('metro','Metro Editorial'),('night','After Hours')]:
        btn(page,'デザインを選ぶ').click()
        dialog=page.get_by_role('dialog',name='デザインを選ぶ')
        dialog.get_by_role('button',name=re.compile(title)).click()
        btn(dialog,'閉じる').click()
        expect(page.locator('html')).to_have_attribute('data-design',theme)
        region=region_for(page,current['stores'][0]['id'])
        layouts.append({'theme':theme,'viewport':390,'nameLength':len(long_name),'panelHeight':round(region.bounding_box()['height'])})
        shot(page,'long-name-mobile-'+theme,region)
        assert save(page)==current
    ok('Three themes preserve store state and retain diagnosis, profit, satisfaction and controls at390px')
    region_for(page,current['stores'][0]['id']).locator('.store-insight-costs summary').click()
    shot(page,'costs-mobile',region_for(page,current['stores'][0]['id']).locator('.store-insight-costs'))
    assert save(page)==current
    expected=run_action(page,current,{'type':'closeStore','storeId':current['stores'][0]['id']})
    page.once('dialog',lambda d:d.accept());btn(card,'閉店').click()
    expect(page.locator('.store-operating-insight')).to_have_count(0)
    assert save(page)==expected
    ok('390px long-name and expanded costs fit; closing the store removes stale diagnostics and saves the exact close action')
    assert rounded_cases, 'Expected at least one visible nonzero rounding adjustment'
    ok('Displayed cost rows plus explicit rounding adjustment reconcile exactly with store profit')
    assert not errors,errors
    ok('No JavaScript or console errors in store-insight DOM flow')
    browser.close()
    (OUT/'results.json').write_text(json.dumps({'passed':checks,'errors':errors,'layouts':layouts,'nonzeroRoundingExamples':rounded_cases,'baselineEngineSHA256':controls['engineSHA256'],'baselineFiles':{'casesSHA256':hashlib.sha256(BASELINE.read_bytes()).hexdigest(),'controlsSHA256':hashlib.sha256(CONTROLS.read_bytes()).hexdigest()},'fixtureNotice':'Captured0.4.1 public-action states, CityView stubbed, GPU disabled; UI/accounting regression only.'},ensure_ascii=False,indent=2))
