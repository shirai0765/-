#!/usr/bin/env python3
"""0.4.1 growth-flow DOM QA. CityView is explicitly stubbed; no 3D or human-duration claim."""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(os.getenv('GROWTH_V041_OUT', '/workspace/shared/shibuya-artifacts/growth-v041'))
URL = os.getenv('PLAYTEST_URL', 'http://127.0.0.1:5173')
OUT.mkdir(parents=True, exist_ok=True)
checks, errors = [], []
completed = False


def button(root, name):
    return root.get_by_role('button', name=name, exact=True)


def ok(message):
    checks.append(message)
    print('PASS', message, flush=True)


def read(page):
    return page.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")


def save(page):
    button(page, '設定・保存').click()
    dialog = page.get_by_role('dialog', name='設定と会社データ')
    button(dialog, '今すぐ保存する').click()
    expect(page.locator('.toast')).to_contain_text('保存しました')
    button(dialog, '閉じる').click()
    return read(page)


def expected_action(page, state, action):
    return page.evaluate("async(x)=>(await import('/src/sim/engine.ts')).applyAction(x.s,x.a)", {'s': state, 'a': action})


def shot(page, name, selector):
    if page.locator('.toast button').count():
        page.locator('.toast button').click()
    page.locator(selector).first.scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'document overflow'
    # A modal lives outside the stubbed city area; measure the active content, not its obscured backdrop.
    scope = page.get_by_role('dialog') if page.get_by_role('dialog').count() else page.locator('.main-area')
    assert scope.evaluate('(e)=>e.scrollWidth<=e.clientWidth'), 'active content overflow'
    page.screenshot(path=str(OUT / (name + '.png')))


def import_fixture(page, state):
    envelope = page.evaluate("async(s)=>(await import('/src/persistence.ts')).createEnvelope(s)", state)
    path = OUT / 'synthetic-preipo.json'
    path.write_text(json.dumps(envelope, ensure_ascii=False))
    button(page, '設定・保存').click()
    button(page.get_by_role('dialog', name='設定と会社データ'), 'ファイルから読み込む').click()
    page.locator('input[type=file]').set_input_files(str(path))
    expect(page.locator('.company h1')).to_contain_text(state['companyName'])


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--disable-gpu'])
    context = browser.new_context(viewport={'width': 1280, 'height': 960})
    context.route('**/src/city/CityView.tsx*', lambda r: r.fulfill(
        status=200, content_type='application/javascript', body='''
        export default function CityView(p){
          window.__growthCityProps={selectedLotId:p.selectedLotId,focusStoreLotId:p.focusStoreLotId,
            focusLotId:p.focusLotId,focusRailDistrict:p.focusRailDistrict}; return null;
        }'''))
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('dialog', lambda d: d.accept())
    try:
        page.goto(URL)
        page.get_by_label('会社名', exact=True).fill('成長導線の通常会社')
        button(page, '新しい会社を設立').click()
        expect(page.locator('.company h1')).to_have_text('成長導線の通常会社')
        initial = save(page)
        assert initial['cash'] == 12000000 and not initial['stores']

        # A real fresh company exposes the strict debt rule without a fabricated loss fixture.
        button(page, '財務・不動産').click()
        capital = page.get_by_role('region', name='資金調達の比較')
        capital.get_by_role('button', name=re.compile('銀行から借りる')).click()
        expect(capital.locator('.capital-warning').filter(has_text='倒産します')).to_be_visible()
        expect(capital.locator('.capital-table')).not_to_be_visible()
        assert save(page) == initial
        ok('Fresh-company debt danger remains visible with details closed; preview does not change money or time')

        button(page, '街を探索').click()
        page.locator('.site-list button').filter(has_text='宇田川の角店').click()
        page.locator('.opening-option').filter(has_text='街角カフェ').click()
        expected = expected_action(page, initial, {'type': 'openStore', 'lotId': 'center-01', 'style': 'standard'})
        button(page, 'この場所にカフェを開業').click()
        opened = save(page)
        assert opened == expected
        page.get_by_role('button', name=re.compile('週を終了する')).click()
        button(page.get_by_role('dialog', name='第1週の営業計画'), '営業して週を進める').click()
        report = page.get_by_role('dialog', name='第1週の経営レポート')
        expect(report).to_be_visible()
        settled = read(page)
        expected = page.evaluate("async(s)=>(await import('/src/sim/engine.ts')).advanceWeek(s)", opened)
        assert settled == expected and not settled['gameOver']
        record = settled['openingRecords'][0]
        result = report.locator('.opening-result')
        expect(result).to_contain_text(record['storeName'])
        expect(result.locator('.opening-result-outcome')).to_be_visible()
        actual = result.locator('.opening-result-actual-metrics')
        expect(actual.locator('dd').nth(0)).to_have_text('¥' + format(record['result']['storeProfit'], ','))
        expect(actual.locator('dd').nth(1)).to_have_text(format(record['result']['customers'], ',') + ' 人')
        assert not result.locator('details[open]').count()
        shot(page, 'first-settlement-desktop', '.opening-results')
        page.set_viewport_size({'width': 390, 'height': 844})
        shot(page, 'first-settlement-mobile', '.opening-results')
        button(result, '店の様子を見る').click()
        expect(report).to_have_count(0)
        expect(page.locator('.inspector')).to_contain_text(record['storeName'])
        assert page.evaluate('window.__growthCityProps.focusStoreLotId') == record['lotId']
        assert save(page) == settled
        ok('Normal opening and first weekly save match engine; optional store view targets the actual shop without advancing time')

        # The next candidate is selected through the real candidate list, without state mutation.
        button(page, '選択を解除').click()
        page.locator('.site-list button').first.click()
        candidate_id = page.evaluate('window.__growthCityProps.selectedLotId')
        candidate_name = page.locator('.inspector h2').inner_text()
        page.locator('.opening-option').filter(has_text='テイクアウト').click()
        plans = page.evaluate("async(x)=>(await import('/src/sim/storePlanning.ts')).getStoreOpeningPlans(x.s,x.id)", {'s': settled, 'id': candidate_id})
        plan = next(p for p in plans if p['style'] == 'takeaway')
        page.locator('.store-opening').get_by_role('button', name=re.compile('資金.*(計画|比較)|財務')).click()
        expect(capital.locator('.capital-context')).to_contain_text(candidate_name)
        expect(capital.get_by_label('計画する支出（円）')).to_have_value(str(plan['openingCost']))
        button(capital, '計画額を編集').click()
        capital.get_by_label('計画する支出（円）').fill('1234567')
        capital.get_by_label('支出後に残す現金（円）').fill('765432')
        capital.get_by_role('button', name=re.compile('銀行から借りる')).click()
        capital.get_by_label('借入希望額（円）').fill('100000')
        capital.get_by_label('元本の返済期間（週）').fill('104')
        capital.get_by_role('button', name=re.compile('株式公開する')).click()
        capital.get_by_role('button', name=re.compile('銀行から借りる')).click()
        expect(capital.get_by_label('借入希望額（円）')).to_have_value('100000')
        expect(capital.get_by_label('元本の返済期間（週）')).to_have_value('104')
        expect(capital.get_by_label('計画する支出（円）')).to_have_value('1234567')
        assert save(page) == settled
        preview = page.evaluate("async(s)=>(await import('/src/sim/capitalPlanning.ts')).getCapitalPlans(s,{borrowAmount:100000,borrowWeeks:104}).find(p=>p.id==='borrow')", settled)
        after = preview['after']
        shown = ['+¥100,000', '¥' + format(after['weekEndCash'], ','),
                 f"{after['ownership'] * 100:.1f}%", '¥' + format(after['report']['loanRepayment'], ','),
                 '¥' + format(after['report']['netProfit'], ',')]
        expect(capital.locator('.capital-key-values dd')).to_have_text(shown)
        expect(capital.locator('.capital-table')).not_to_be_visible()
        shot(page, 'capital-context-mobile', '.capital-context')
        shot(page, 'capital-main-values-mobile', '.capital-outcome')
        expected = expected_action(page, settled, {'type': 'borrow', 'amount': 100000, 'weeks': 104})
        capital.locator('.capital-submit').click()
        expect(capital.get_by_label('計画する支出（円）')).to_have_value('1234567')
        funded = save(page)
        assert funded == expected
        capital.locator('.capital-return').click()
        expect(page.locator('.inspector h2')).to_have_text(candidate_name)
        expect(page.locator('.opening-option').filter(has_text='テイクアウト')).to_have_attribute('aria-pressed', 'true')
        button(page, 'この出店の資金を比較').click()
        expect(capital.get_by_label('計画する支出（円）')).to_have_value('1234567')
        expect(capital.get_by_label('支出後に残す現金（円）')).to_have_value('765432')
        expect(capital.get_by_label('借入希望額（円）')).to_have_value('100000')
        expect(capital.get_by_label('元本の返済期間（週）')).to_have_value('104')
        capital.locator('.capital-return').click()
        expected = expected_action(page, funded, {'type': 'openStore', 'lotId': candidate_id, 'style': 'takeaway'})
        button(page, 'この場所にカフェを開業').click()
        invested = save(page)
        assert invested == expected and invested['week'] == settled['week']
        ok('Next investment carries site/style/cost into finance; input survives plan changes and loan; return executes only the intended separate investment')

        page.reload()
        page.get_by_role('button', name=re.compile('成長導線の通常会社 を続ける')).click()
        assert read(page) == invested
        ok('Normal two-shop flow and separate funding persist across reload')

        # IPO coverage is separately marked synthetic; it is not normal-play pacing evidence.
        preipo = page.evaluate('''async()=>{
          const e=await import('/src/sim/engine.ts');let s=e.createGame('IPO表示の合成会社',812);
          s.cash=900000000;s.reputation=100;s.profitableWeeks=12;s.week=13;
          for(const lotId of ['dogenzaka-02','center-01','sakuragaoka-01']){
            s=e.applyAction(s,{type:'openStore',lotId,style:'standard'});
            s=e.applyAction(s,{type:'updateStore',storeId:s.stores.at(-1).id,changes:{manager:true,price:750,quality:85}});
          }if(!e.getSummary(s).ipoEligible)throw Error('IPO fixture invalid');return s;
        }''')
        import_fixture(page, preipo)
        button(page, '財務・不動産').click()
        capital.get_by_role('button', name=re.compile('株式公開する')).click()
        expected = expected_action(page, preipo, {'type': 'ipo'})
        capital.locator('.capital-submit').click()
        milestone = page.get_by_role('dialog', name='上場しました')
        expect(milestone).to_be_visible()
        assert '保存済' not in milestone.inner_text()
        shot(page, 'ipo-milestone-mobile', '.growth-milestone')
        shot(page, 'ipo-next-choices-mobile', '.growth-milestone footer')
        button(milestone, '街区・沿線を検討').click()
        expect(milestone).to_have_count(0)
        expect(page.locator('.rail-projects-panel')).to_be_visible()
        assert save(page) == expected
        button(page, '財務・不動産').click()
        expect(milestone).to_have_count(0)
        page.reload()
        page.get_by_role('button', name=re.compile('IPO表示の合成会社 を続ける')).click()
        expect(milestone).to_have_count(0)
        assert read(page) == expected
        ok('Synthetic IPO commits once; milestone navigation does not buy an investment or reappear after tab change/reload')

        button(page, '株式市場').click()
        button(page, '友好的買収').click()
        for index in range(3):
            button(page.locator('.ma-card').nth(index), '比較に追加').click()
        expect(page.locator('.ma-comparison-card')).to_have_count(3)
        expect(button(page.locator('.ma-card').nth(3), '比較に追加')).to_be_disabled()
        first = page.locator('.ma-comparison-card').first
        target_name = first.locator('h4').inner_text()
        first.locator('select').select_option('integrated')
        expect(first.locator('.ma-comparison-priorities')).to_be_visible()
        expect(first.locator('.ma-comparison-forecast')).to_contain_text('今週の取得予測は未計算')
        expect(first.locator('.ma-comparison-commit-note')).to_be_visible()
        expect(first.locator('.ma-comparison-metrics')).not_to_be_visible()
        first.locator('summary').click()
        expect(first.locator('.ma-comparison-metrics')).to_be_visible()
        first.locator('summary').click()
        page.get_by_label('買収候補の現金予算').fill('0')
        expect(page.locator('.ma-card')).to_have_count(0)
        expect(page.locator('.ma-comparison-card')).to_have_count(3)
        expect(first.locator('select')).to_have_value('integrated')
        shot(page, 'acquisition-priorities-mobile', '.ma-comparison')
        shot(page, 'acquisition-unknown-mobile', '.ma-comparison-forecast')
        expected_budget = page.evaluate('''async(x)=>{
          const m=await import('/src/sim/marketAcquisitions.ts'), c=await import('/src/sim/acquisitionComparison.ts');
          const t=m.getMarketAcquisitionTargets(x.s).find(t=>t.name===x.name);
          return c.getAcquisitionComparison(x.s,t,'integrated').remainingCashBudget;
        }''', {'s': expected, 'name': target_name})
        button(first, 'この案の資金調達を比較').click()
        expect(capital.locator('.capital-context')).to_contain_text(target_name)
        expect(capital.get_by_label('計画する支出（円）')).to_have_value(str(expected_budget))
        assert save(page) == expected
        capital.locator('.capital-return').click()
        acquisition = page.get_by_role('dialog', name=target_name + 'の買収条件')
        expect(acquisition).to_be_visible()
        # A second finance visit exposes the retained mode via its exact preparation budget.
        button(acquisition, 'この案の資金調達を比較').click()
        expect(capital.get_by_label('計画する支出（円）')).to_have_value(str(expected_budget))
        capital.locator('.capital-return').click()
        button(acquisition, '買収条件を閉じる').click()
        button(page, '株式投資').click()
        button(page, '友好的買収').click()
        expect(acquisition).to_have_count(0)
        assert save(page) == expected
        ok('Three acquisition comparisons retain mode through filtering; collapsed details preserve warnings; finance returns to the unresearched plan without acquiring or reopening stale dialogs')
        assert not errors, errors
        ok('No browser page or console errors')
        completed = True
    except Exception as exc:
        errors.append(type(exc).__name__ + ': ' + str(exc))
        page.screenshot(path=str(OUT / 'failure.png'))
        raise
    finally:
        (OUT / 'result.json').write_text(json.dumps({'completed': completed, 'checks': checks, 'errors': errors,
            'cityViewStub': True, 'renderingTested': False, 'normalFlow': 'new company to two shops',
            'syntheticCoverage': ['IPO transition'], 'humanDurationValidated': False}, ensure_ascii=False, indent=2) + '\n')
        browser.close()
