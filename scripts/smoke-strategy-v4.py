#!/usr/bin/env python3
"""DOM strategy QA with explicit synthetic fixtures and CityView stub; not a 3D or campaign-duration test."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.getenv('STRATEGY_V4_OUT', '/workspace/shared/shibuya-artifacts/strategy-0.4.1'))
OUT.mkdir(parents=True, exist_ok=True)
URL = os.getenv('PLAYTEST_URL', 'http://127.0.0.1:5173')
checks, errors = [], []
def ok(message):
    checks.append(message)
    print('PASS', message, flush=True)
def btn(root, name): return root.get_by_role('button', name=name, exact=True)
def yen(value): return '¥' + format(round(value), ',')
def read(page): return page.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
def overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal document overflow'
    assert page.locator('.main-area').evaluate('(el)=>el.scrollWidth <= el.clientWidth'), 'horizontal content overflow'
def save(page):
    page.locator('.rail-settings').click()
    d = page.get_by_role('dialog', name='設定と会社データ')
    btn(d, '今すぐ保存する').click()
    expect(page.locator('.toast')).to_contain_text('保存しました')
    btn(d, '閉じる').click()
    return read(page)
def import_state(page, state, name, initial=False):
    envelope = page.evaluate("async(s)=> (await import('/src/persistence.ts')).createEnvelope(s)", state)
    path = OUT / (name + '.json')
    path.write_text(json.dumps(envelope, ensure_ascii=False))
    if not initial: page.locator('.rail-settings').click()
    page.locator('input[type=file]').set_input_files(str(path))
    expect(page.locator('.company h1')).to_contain_text(state['companyName'])
    expect(page.get_by_role('dialog', name='設定と会社データ')).to_have_count(0)
def action_result(page, state, action):
    return page.evaluate("async(x)=> (await import('/src/sim/engine.ts')).applyAction(x.state,x.action)", {'state':state, 'action':action})
def capital_plan(page, state, plan_id, amount=3000000, weeks=52):
    return page.evaluate("async(x)=> (await import('/src/sim/capitalPlanning.ts')).getCapitalPlans(x.state,{borrowAmount:x.amount,borrowWeeks:x.weeks}).find(p=>p.id===x.id)", {'state':state, 'amount':amount, 'weeks':weeks, 'id':plan_id})
def check_capital_table(panel, plan):
    details = panel.locator('.capital-details')
    if not details.evaluate('(el)=>el.open'): details.locator('summary').click()
    b, a = plan['before'], plan['after']
    values = {
        '調達直後の手元資金': (yen(b['cash']), yen(a['cash'])),
        '借入残高': (yen(b['debt']), yen(a['debt'])),
        '創業者持分': (f"{b['ownership']*100:.1f}%", f"{a['ownership']*100:.1f}%"),
        '営業利益 / 今週': (yen(b['report']['operatingProfit']), yen(a['report']['operatingProfit'])),
        '支払利息 / 今週': (yen(b['report']['interest']), yen(a['report']['interest'])),
        '利息控除後の利益 / 今週': (yen(b['report']['netProfit']), yen(a['report']['netProfit'])),
        '元本返済 / 今週': (yen(b['report']['loanRepayment']), yen(a['report']['loanRepayment'])),
        '支払配当 / 今週': (yen(b['report']['dividendsPaid']), yen(a['report']['dividendsPaid'])),
        '週末の手元資金': (yen(b['weekEndCash']), yen(a['weekEndCash'])),
    }
    for label, expected in values.items():
        row = panel.get_by_role('rowheader', name=label, exact=True).locator('..')
        expect(row.locator('td').nth(0)).to_have_text(expected[0])
        expect(row.locator('td').nth(1)).to_have_text(expected[1])
def shot(page, name, selector=None):
    overflow(page)
    if page.locator('.toast button').count(): page.locator('.toast button').click()
    if selector is None:
        selector = '.ma-comparison' if name.startswith('acquisition') else '.capital-options' if name.startswith('capital') else '.rail-projects-panel' if 'building' in name else '.rail-projects-modal'
    page.locator(selector).first.evaluate('(el)=>el.scrollIntoView({block:"start"})')
    page.screenshot(path=str(OUT / (name + '.png')))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--disable-gpu'])
    context = browser.new_context(viewport={'width':1280, 'height':960})
    context.route('**/src/city/CityView.tsx*', lambda route: route.fulfill(status=200, content_type='application/javascript', body='export default function CityView(){return null}'))
    page = context.new_page(); page.set_default_timeout(30000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL)
    initial = page.evaluate("async()=> (await import('/src/sim/engine.ts')).createGame('戦略UI検証株式会社',812)")
    import_state(page, initial, 'initial-fixture', initial=True)
    btn(page, '財務・不動産').click()
    panel = page.get_by_role('region', name='資金調達の比較')
    options = panel.get_by_role('group', name='調達方法を比較')
    options.get_by_role('button', name=re.compile('株式公開する')).click()
    expect(panel).to_contain_text('未達の上場条件')
    expect(panel.locator('.capital-submit')).to_be_disabled()
    options.get_by_role('button', name=re.compile('銀行から借りる')).click()
    expect(panel).to_contain_text('このまま週を終了すると倒産します')
    check_capital_table(panel, capital_plan(page, initial, 'borrow'))
    panel.get_by_label('借入希望額（円）').fill('999999999999')
    expect(panel.locator('.capital-submit')).to_be_disabled()
    panel.get_by_label('借入希望額（円）').fill('3000000')
    assert save(page) == initial
    ok('Initial IPO requirements and unavailable borrowing are shown; valid debt warning/table match engine; previews leave save unchanged')

    fixture = page.evaluate('''async()=>{
      const e=await import('/src/sim/engine.ts'),d=await import('/src/data/district.ts'),m=await import('/src/sim/marketAcquisitions.ts');
      let s=e.createGame('戦略UI検証株式会社',812);s.cash=900000000;s.reputation=100;s.profitableWeeks=12;s.week=13;
      for(const lotId of ['dogenzaka-02','center-01','sakuragaoka-01']){
        s=e.applyAction(s,{type:'openStore',lotId,style:'standard'});
        s=e.applyAction(s,{type:'updateStore',storeId:s.stores.at(-1).id,changes:{manager:true,price:750,quality:85}});
      }
      for(const districtId of Object.keys(d.DISTRICTS)){
        const lot=d.LOTS.find(l=>l.available&&l.district===districtId&&!s.stores.some(st=>st.lotId===l.id));
        s=e.applyAction(s,{type:'buyProperty',lotId:lot.id});
      }
      const targets=m.getMarketAcquisitionTargets(s).sort((a,b)=>a.quotePrice-b.quotePrice).slice(0,3);
      s=e.applyAction(s,{type:'researchMarketCompany',stockId:targets[0].stockId});
      s=e.applyAction(s,{type:'buyStock',stockId:targets[0].stockId,shares:10});
      if(!e.getSummary(s).ipoEligible)throw Error('Synthetic IPO fixture does not meet actual engine requirements');
      return {state:s,targets};
    }''')
    current = fixture['state']; import_state(page, current, 'funded-preipo-fixture')
    btn(page, '財務・不動産').click()
    options.get_by_role('button', name=re.compile('株式公開する')).click()
    check_capital_table(panel, capital_plan(page, current, 'equity'))
    shot(page, 'capital-ipo-desktop')
    assert save(page) == current
    expected = action_result(page, current, {'type':'ipo'})
    panel.locator('.capital-submit').click()
    milestone = page.get_by_role('dialog', name='上場しました', exact=True)
    expect(milestone).to_be_visible()
    expect(milestone).to_contain_text(yen(expected['cash'] - current['cash']))
    expect(milestone).to_contain_text('100% → 80%')
    btn(milestone, '企業取得を検討').click()
    expect(btn(page, '友好的買収')).to_have_attribute('aria-pressed','true')
    expect(page.locator('.market-acquisitions')).to_be_visible()
    btn(page, '財務・不動産').click()
    expect(panel).to_contain_text('10%増資する')
    current = save(page); assert current == expected
    ok('IPO preview includes correct proceeds/80% founder stake; actual UI IPO equals engine and saved state')
    options.get_by_role('button', name=re.compile('10%増資する')).click()
    check_capital_table(panel, capital_plan(page, current, 'equity'))
    panel.locator('.capital-budget > summary').click()
    panel.get_by_label('予定する支出から、調達不足を計算する').check()
    panel.get_by_label('計画する支出（円）').fill(str(current['cash'] + 2000000))
    panel.get_by_label('支出後に残す現金（円）').fill('1000000')
    btn(panel, '不足額を借入希望額へ').click()
    expect(panel.get_by_label('借入希望額（円）')).to_have_value('3000000')
    check_capital_table(panel, capital_plan(page, current, 'borrow'))
    expect(panel).to_contain_text('入力では投資を実行しません')
    page.set_viewport_size({'width':390,'height':844}); shot(page, 'capital-borrow-mobile'); shot(page, 'capital-table-mobile', '.capital-table')
    assert save(page) == current
    expected = action_result(page, current, {'type':'borrow','amount':3000000,'weeks':52})
    panel.locator('.capital-submit').click()
    current = save(page); assert current == expected
    ok('Listed equity and loan previews match engine; budget gap fills borrowing; mobile layout fits; actual borrowing is exact')

    page.set_viewport_size({'width':1280,'height':960})
    btn(page, '株式市場').click(); btn(page, '友好的買収').click()
    for i in range(3): page.locator('.ma-card').nth(i).get_by_role('button', name='比較に追加', exact=True).click()
    expect(page.locator('.ma-comparison-card')).to_have_count(3)
    expect(page.locator('.ma-card').nth(3).get_by_role('button', name='比較に追加', exact=True)).to_be_disabled()
    for i in [1,2]:
        card = page.locator('.ma-comparison-card').nth(i)
        expect(card).to_contain_text('品質は未確認')
        expect(card).to_contain_text('今週の取得予測は未計算')
        assert '会社全体の利益差' not in card.inner_text()
    first = page.locator('.ma-comparison-card').first
    expect(first.locator('.ma-comparison-priorities > div')).to_have_count(3)
    expect(first.locator('.ma-comparison-metrics')).not_to_be_visible()
    expect(first.locator('.ma-comparison-forecast')).to_be_visible()
    expect(first.locator('.ma-comparison-commit-note')).to_be_visible()
    first.locator('details summary').click()
    expect(first.locator('.ma-comparison-metrics')).to_be_visible()
    first.locator('select').select_option('integrated')
    assert first.locator('details').evaluate('(el)=>el.open')
    first.locator('details summary').click()
    expect(first.locator('.ma-comparison-metrics')).not_to_be_visible()
    expect(first.locator('select')).to_have_value('integrated')
    expect(page.locator('.ma-comparison-card')).to_have_count(3)
    first_target = fixture['targets'][0]
    preview = page.evaluate("async(x)=> {const a=await import('/src/sim/acquisitionComparison.ts'),m=await import('/src/sim/marketAcquisitions.ts');return a.previewAcquisitionComparison(x.state,m.getMarketAcquisitionTargets(x.state).find(t=>t.stockId===x.id),'integrated')}", {'state':current,'id':first_target['stockId']})
    expect(first).to_contain_text('会社全体の利益差：' + yen(preview['weeklyProfitChange']))
    expect(first).to_contain_text('週末の現金：' + yen(preview['weekEndCash']))
    shot(page, 'acquisition-comparison-desktop')
    page.get_by_label('買収候補の現金予算').fill('0')
    expect(page.locator('.ma-card')).to_have_count(0)
    expect(page.locator('.ma-comparison-card')).to_have_count(3)
    btn(page, '絞り込みを解除').click()
    page.get_by_label('買収候補の状態').select_option('ready')
    expect(page.locator('.ma-card')).to_have_count(1)
    page.get_by_label('買収候補の状態').select_option('unowned')
    page.get_by_label('買収候補の並べ替え').select_option('profit')
    page.get_by_label('買収候補の変動幅').select_option('0.14')
    assert page.locator('.ma-card').count() > 0
    page.set_viewport_size({'width':390,'height':844}); shot(page, 'acquisition-comparison-mobile'); shot(page, 'acquisition-forecast-mobile', '.ma-comparison-forecast')
    assert save(page) == current
    ok('Three-target limit enforced; unknown quality stays undisclosed; selected-mode preview matches engine; budget/ready/risk filters preserve comparison without mutation')
    first.get_by_role('button', name='この案の調査・取得を確認').click()
    dialog = page.get_by_role('dialog')
    expect(dialog.get_by_role('button', name=re.compile('グループへ統合'))).to_have_attribute('aria-pressed','true')
    btn(dialog, '買収と引継ぎを確認').click()
    expected = action_result(page, current, {'type':'acquireMarketCompany','stockId':first_target['stockId'],'mode':'integrated'})
    btn(dialog, '友好的買収を実行する').click()
    expect(dialog).to_contain_text('経営の引継ぎ中')
    btn(dialog, '買収条件を閉じる').click()
    expect(page.locator('.ma-comparison-card')).to_have_count(2)
    current = save(page); assert current == expected
    ok('Comparison selected mode reaches existing confirmation; acquisition removes shares and matches exact engine/save state')

    # The second company is still unresearched. Funding navigation must not reveal its quality or acquire it.
    target2 = fixture['targets'][1]
    unresearched_card = page.locator('.ma-comparison-card').filter(has_text=target2['name'])
    unresearched_card.locator('select').select_option('integrated')
    btn(unresearched_card, 'この案の資金調達を比較').click()
    expected_budget = page.evaluate("async(x)=>{const c=await import('/src/sim/acquisitionComparison.ts'),m=await import('/src/sim/marketAcquisitions.ts');return c.getAcquisitionComparison(x.state,m.getMarketAcquisitionTargets(x.state).find(t=>t.stockId===x.id),'integrated').remainingCashBudget}", {'state':current,'id':target2['stockId']})
    expect(panel.locator('.capital-context')).to_contain_text(target2['name'])
    expect(panel.locator('.capital-context')).to_contain_text('グループへ統合')
    expect(panel.get_by_label('計画する支出（円）')).to_have_value(str(expected_budget))
    assert save(page) == current
    btn(panel, 'この買収プランに戻る').click()
    dialog = page.get_by_role('dialog',name=target2['name']+'の買収条件',exact=True)
    expect(dialog).to_contain_text('取得前に事業を調べる')
    assert '調査結果' not in dialog.inner_text()
    # Returning an unresearched target does not show mode options; a second funding visit proves the retained mode.
    btn(dialog, 'この案の資金調達を比較').click()
    expect(panel.locator('.capital-context')).to_contain_text('グループへ統合')
    expect(panel.get_by_label('計画する支出（円）')).to_have_value(str(expected_budget))
    btn(panel, 'この買収プランに戻る').click()
    btn(dialog, '買収条件を閉じる').click()
    btn(page, '株式投資').click(); btn(page, '友好的買収').click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    assert save(page) == current
    ok('Unresearched integrated acquisition budget transfers to finance and returns to the same target/mode without research, acquisition or stale tab reopening')

    page.set_viewport_size({'width':1280,'height':960})
    btn(page, '街区開発').click()
    rail = page.locator('.rail-projects-panel')
    expect(rail.locator('.rail-projects-district')).to_have_count(4)
    district = rail.locator('.rail-projects-district').first
    district.get_by_role('button', name='この計画の資金を確認').nth(1).click()
    expect(panel.locator('.capital-context')).to_contain_text('センター街・駅近賃貸・生活パートナー')
    expect(panel.get_by_label('計画する支出（円）')).to_have_value('8000000')
    assert save(page) == current
    btn(panel, 'この共同開発プランに戻る').click()
    dialog = page.get_by_role('dialog', name='センター街・共同開発の確認')
    expect(dialog).to_contain_text('駅近賃貸・生活パートナー')
    ok('Rail rental plan transfers its eight-million-yen budget to finance and returns to the same district/choice without construction')
    rail_action = {'type':'startRailProject','districtId':'center','choiceId':'rental'}
    expected = action_result(page, current, rail_action)
    reports = page.evaluate("async(x)=>{const e=await import('/src/sim/engine.ts');return {before:e.previewWeek(x.before),after:e.previewWeek(x.after)}}", {'before':current,'after':expected})
    expect(dialog).to_contain_text(yen(reports['before']['netProfit']) + ' → ' + yen(reports['after']['netProfit']))
    expect(dialog).to_contain_text(yen(expected['cash'] + reports['after']['cashChange']))
    expect(dialog).to_contain_text('完成後の効果は先取りしていません')
    assert reports['after']['netProfit'] == reports['before']['netProfit'] - 4000
    shot(page, 'rail-confirm-desktop')
    btn(dialog, '戻る').click()
    assert save(page) == current
    district.get_by_role('button', name='支払と今週の予測を確認').nth(1).click()
    dialog.get_by_role('button', name=re.compile('着工する')).click()
    expect(dialog).to_have_count(0)
    expect(district).to_contain_text('完成まであと6週')
    expect(district.get_by_role('button',name='支払と今週の予測を確認')).to_have_count(0)
    expect(district.locator('.rail-projects-options')).to_have_count(0)
    current = save(page); assert current == expected
    page.set_viewport_size({'width':390,'height':844}); shot(page, 'rail-building-mobile')
    ok('Rail preview charges only current upkeep, cancellation preserves save, confirmed project matches engine and excludes alternative')

    for _ in range(6):
        expected = page.evaluate("async(s)=>(await import('/src/sim/engine.ts')).advanceWeek(s)",current)
        page.get_by_role('button',name=re.compile('週を終了する')).click()
        d = page.get_by_role('dialog', name=re.compile('第.*週の営業計画'))
        btn(d, '営業して週を進める').click()
        btn(page.get_by_role('dialog',name=re.compile('第.*週の経営レポート')), '街に戻る').click()
        current = read(page); assert current == expected
    expect(district).to_contain_text('共同開発が稼働中')
    expect(district).to_contain_text('+16%')
    page.reload(); page.get_by_role('button', name=re.compile('戦略UI検証株式会社 を続ける')).click()
    btn(page, '街区開発').click(); expect(rail).to_contain_text('共同開発が稼働中')
    assert read(page) == current
    ok('Six actual UI week advances equal engine results; rail construction finishes, rental effect activates, and ownership reloads')

    poor = {**action_result(page, current, {'type':'researchMarketCompany','stockId':fixture['targets'][1]['stockId']}), 'cash':0}; import_state(page, poor, 'insufficient-cash-fixture')
    btn(page, '街区開発').click()
    for control in rail.get_by_role('button',name='支払と今週の予測を確認').all(): expect(control).to_be_disabled()
    expect(rail).to_contain_text('現預金が不足')
    unavailable_district = rail.locator('.rail-projects-district').nth(1)
    unavailable_district.get_by_role('button', name='この計画の資金を確認').nth(1).click()
    expect(panel.get_by_label('計画する支出（円）')).to_have_value('8000000')
    btn(panel, 'この共同開発プランに戻る').click()
    unavailable_dialog = page.get_by_role('dialog', name='道玄坂・共同開発の確認')
    expect(unavailable_dialog).to_contain_text('現預金が不足')
    expect(unavailable_dialog.get_by_role('button', name=re.compile('着工する'))).to_be_disabled()
    btn(unavailable_dialog, '戻る').click()
    btn(page, '株式市場').click(); btn(page, '友好的買収').click()
    page.get_by_label('買収候補の状態').select_option('ready')
    expect(page.locator('.ma-card')).to_have_count(0)
    page.get_by_label('買収候補の状態').select_option('unowned')
    page.get_by_label('買収候補を検索').fill(fixture['targets'][1]['name'])
    if page.get_by_role('button', name='比較をクリア', exact=True).count(): btn(page, '比較をクリア').click()
    page.locator('.ma-card').first.get_by_role('button',name='比較に追加',exact=True).click()
    expect(page.locator('.ma-comparison')).to_contain_text('今週の取得予測は未計算')
    expect(page.locator('.ma-comparison')).to_contain_text('取得資金が不足しています')
    poor_card = page.locator('.ma-comparison-card').first
    poor_card.locator('select').select_option('integrated')
    expect(poor_card.locator('.ma-comparison-cash-warning')).to_be_visible()
    expect(poor_card.locator('.ma-comparison-metrics')).not_to_be_visible()
    btn(poor_card, 'この案の資金調達を比較').click()
    expect(panel.locator('.capital-context')).to_contain_text('グループへ統合')
    btn(panel, 'この買収プランに戻る').click()
    poor_dialog = page.get_by_role('dialog',name=fixture['targets'][1]['name']+'の買収条件',exact=True)
    expect(poor_dialog.get_by_role('button', name=re.compile('グループへ統合'))).to_have_attribute('aria-pressed','true')
    expect(btn(poor_dialog, '買収と引継ぎを確認')).to_be_disabled()
    btn(poor_dialog, '買収条件を閉じる').click()
    assert save(page) == poor
    ok('Insufficient-cash rail actions and ready-acquisition list are blocked without save mutation')
    assert not errors, errors
    ok('No page or console errors in DOM strategy flow')
    browser.close()
    (OUT/'results.json').write_text(json.dumps({'passed':checks,'errors':errors,'fixtureNotice':'Synthetic funded/IPO fixtures; CityView explicitly stubbed and GPU disabled. Validates DOM/action accounting, not 3D graphics, organic campaign reachability or play duration.'},ensure_ascii=False,indent=2))
