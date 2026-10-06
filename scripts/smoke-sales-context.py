#!/usr/bin/env python3
"""Sales DOM QA: real engine actions prepare v3; CityView route stub and GPU disabled.
The v2 compatibility fixture alone installs canonical historical offers; no economics are edited.
"""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT=Path(os.getenv('SALES_CONTEXT_OUT','/workspace/shared/shibuya-artifacts/sales-context-v4'))
OUT.mkdir(parents=True,exist_ok=True)
URL=os.getenv('PLAYTEST_URL','http://127.0.0.1:5173')
checks,errors=[],[]
def ok(message): checks.append(message); print('PASS',message,flush=True)
def btn(root,name): return root.get_by_role('button',name=name,exact=True)
def yen(n): return '¥'+format(round(n),',')
def read(page): return page.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
def cash(page): return int(re.sub(r'[^0-9-]','',page.locator('.deals-panel .metric').filter(has_text='手元資金').locator('strong').inner_text()))
def overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'document horizontal overflow'
    assert page.locator('.main-area').evaluate('(el)=>el.scrollWidth <= el.clientWidth'), 'main content horizontal overflow'
    for card in page.locator('.deal-card').all():
        assert card.evaluate('(el)=>el.scrollWidth <= el.clientWidth'), 'offer card horizontal overflow'
def screenshot(page,name):
    overflow(page)
    if page.locator('.toast button').count(): page.locator('.toast button').click()
    if not page.get_by_role('dialog').count():
        target=page.locator('.deal-contract').first if 'result' in name else page.locator('.deal-fit').first
        if target.count(): target.evaluate('(el)=>el.scrollIntoView({block:"start"})')
    page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
def save(page):
    page.locator('.rail-settings').click()
    dialog=page.get_by_role('dialog',name='設定と会社データ')
    btn(dialog,'今すぐ保存する').click()
    expect(page.locator('.toast')).to_contain_text('保存しました')
    btn(dialog,'閉じる').click()
    return read(page)
def import_state(page,state,name,initial=False):
    envelope=page.evaluate("async(s)=>(await import('/src/persistence.ts')).createEnvelope(s)",state)
    path=OUT/(name+'.json'); path.write_text(json.dumps(envelope,ensure_ascii=False))
    if not initial: page.locator('.rail-settings').click()
    page.locator('input[type=file]').set_input_files(str(path))
    expect(page.locator('.company h1')).to_have_text(state['companyName'])
    expect(page.get_by_role('dialog',name='設定と会社データ')).to_have_count(0)
    btn(page,'営業・提案').click()
def confirm(page,prefix,charge):
    dialog=page.get_by_role('dialog',name='営業提案の操作確認')
    expect(dialog.locator('.cost-list > div').filter(has_text='今回の支払').locator('dd')).to_have_text(yen(charge))
    dialog.get_by_role('button',name=re.compile('^'+prefix)).click()
    expect(dialog).to_have_count(0)
def end_week(page,week):
    page.get_by_role('button',name=re.compile('週を終了する')).click()
    forecast=page.get_by_role('dialog',name=f'第{week}週の営業計画')
    btn(forecast,'営業して週を進める').click()
    report=page.get_by_role('dialog',name=f'第{week}週の経営レポート')
    expect(report).to_be_visible()
    expect(report).to_contain_text(f'第{week+1}週の会社データを保存しました')
    btn(report,'街に戻る').click()
    return read(page)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--disable-gpu'])
    context=browser.new_context(viewport={'width':1280,'height':960})
    context.route('**/src/city/CityView.tsx*',lambda route:route.fulfill(status=200,content_type='application/javascript',body='export default function CityView(){return null}'))
    page=context.new_page(); page.set_default_timeout(30000)
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
    page.goto(URL)
    fixture=page.evaluate('''async()=>{
      const e=await import('/src/sim/engine.ts'),lots=(await import('/src/data/district.ts')).LOTS,d=await import('/src/sim/deals.ts');
      let s=e.createGame('営業適性UI検証株式会社',42);
      const lot=lots.filter(l=>l.available).sort((a,b)=>e.evaluateSite(s,b.id,'standard').expectedProfit-e.evaluateSite(s,a.id,'standard').expectedProfit)[0];
      s=e.applyAction(s,{type:'openStore',lotId:lot.id,style:'standard'});
      s=e.applyAction(s,{type:'updateStore',storeId:s.stores[0].id,changes:{manager:true}});
      s=e.applyAction(s,{type:'settings',changes:{quality:'low'}});
      const initial=s;
      while(s.week<13){s=e.advanceWeek(s);if(s.gameOver)throw Error('Earned fixture went bankrupt');}
      return {initial,state:s,offers:d.getOffers(s),forecast:e.previewWeek(s)};
    }''')
    assert fixture['state']['week']==13 and len(fixture['state']['stores'])==1
    assert fixture['state']['cash']>0 and not fixture['state']['gameOver']
    assert fixture['state']['lastReport']['week']==12
    import_state(page,fixture['initial'],'legacy-v1',initial=True)
    expect(page.locator('.deal-card')).to_have_count(2)
    expect(page.locator('.deal-card').filter(has_text='在庫・発注支援システム')).to_contain_text('¥80,000')
    expect(page.locator('.deal-card').first.locator('.deal-fit')).to_contain_text('契約条件から見る収支幅')
    assert save(page)==fixture['initial']
    screenshot(page,'legacy-v1-desktop')
    ok('Unmodified v1 introductory offers display their original 80000-yen terms without inventing context')

    import_state(page,fixture['state'],'earned-v3')
    offer=next(o for o in fixture['offers'] if o['category']=='system')
    assert '-v3-' in offer['id']
    card=page.locator('.deal-card').filter(has=page.get_by_role('heading',name=offer['title'],exact=True))
    expect(card.locator('.deal-fit')).to_contain_text('作成時の店舗状況を反映した見込み')
    expect(card.locator('.deal-clues')).to_contain_text('第12週決算')
    expect(card.locator('.deal-clues')).to_contain_text('未計測')
    expect(card.locator('.deal-terms')).to_contain_text(yen(offer['upfrontCost']+offer['weeklyFee']*offer['termWeeks']))
    term=lambda o,amount: amount*(o['termWeeks']-o['leadWeeks'])-o['upfrontCost']-o['weeklyFee']*o['termWeeks']-(o['investigationCost'] if o['investigated'] else 0)+o['residualValue']
    for amount in [offer['conservativeWeeklyBenefit'],offer['optimisticWeeklyBenefit']]:
        expect(card.locator('.deal-fit')).to_contain_text(yen(term(offer,amount)))
    initial_cash=cash(page)
    assert save(page)==fixture['state']
    screenshot(page,'v3-before-research-desktop')
    page.set_viewport_size({'width':390,'height':844})
    screenshot(page,'v3-before-research-mobile')
    ok('At week13, observed week12 facts, proxy limitations and complete-term costs/ranges appear before paid research; 390px has no overflow')

    card.get_by_role('button',name=re.compile('調査を依頼')).click()
    confirm(page,'調査する',offer['investigationCost'])
    expect(card.locator('.deal-report')).to_contain_text('調査レポート')
    assert cash(page)==initial_cash-offer['investigationCost']
    researched=save(page)
    measured=next(o for o in researched['deals']['offers'] if o['id']==offer['id'])
    assert measured['investigated'] and measured['signals']==offer['signals']
    for amount in [measured['conservativeWeeklyBenefit'],measured['optimisticWeeklyBenefit']]:
        expect(card.locator('.deal-fit')).to_contain_text(yen(term(measured,amount)))
    expect(card.locator('.deal-fit')).to_contain_text('支払済み調査費')
    expect(card.get_by_role('button',name=re.compile('調査を依頼'))).to_have_count(0)
    screenshot(page,'v3-researched-mobile')
    ok('Mobile paid research deducts exactly 15000 once, narrows the offer and includes already-paid research in full-term net cash')

    btn(card,'契約条件を確認').click()
    dialog=page.get_by_role('dialog',name='営業提案の操作確認')
    expect(dialog).to_contain_text(yen(fixture['forecast']['netProfit']-offer['weeklyFee']))
    expect(dialog).not_to_contain_text('借入中の利益条件を満たせなくなる')
    screenshot(page,'v3-contract-confirm-mobile')
    confirm(page,'契約する',offer['upfrontCost'])
    accepted=save(page)
    assert accepted['cash']==initial_cash-offer['investigationCost']-offer['upfrontCost']
    assert accepted['deals']['contracts'][0]['offer']==measured
    contract=page.locator('.deal-contract').filter(has_text=offer['title'])
    expect(contract).to_contain_text('第13週の店舗状況を基にした提案')
    expect(contract).to_contain_text('導入中・未確定')
    for week in range(13,13+offer['leadWeeks']+1):
        prior=read(page); current=end_week(page,week)
        assert current['cash']==prior['cash']+current['lastReport']['cashChange']
        c=current['deals']['contracts'][0]
        assert c['cumulativeFees']==(week-12)*offer['weeklyFee']
        if week<13+offer['leadWeeks']: assert 'realizedWeeklyBenefit' not in c
    assert c['offer']==measured
    assert measured['conservativeWeeklyBenefit']<=c['realizedWeeklyBenefit']<=measured['optimisticWeeklyBenefit']
    assert c['cumulativeBenefit']==c['realizedWeeklyBenefit']
    recorded=read(page)
    page.reload(); page.get_by_role('button',name=re.compile('営業適性UI検証株式会社 を続ける')).click(); btn(page,'営業・提案').click()
    assert read(page)==recorded
    expect(page.locator('.deal-contract')).to_contain_text(yen(c['realizedWeeklyBenefit']))
    screenshot(page,'v3-result-reloaded-mobile')
    ok('Actual UI contract, four weekly settlements and reload preserve frozen offer, exact fees, delayed outcome and the complete saved state')

    legacy=page.evaluate('''async(s)=>{
      const d=await import('/src/sim/deals.ts');
      const old=d.getCanonicalDealOffer(s,{id:'cafe-1-system-fit-v2-pos',category:'system',createdWeek:13,investigated:false});
      return {...s,companyName:'旧カタログ表示検証',deals:{offers:[old],contracts:[],dismissed:[],generatedBatches:['cafe-0','cafe-1']}};
    }''',fixture['state'])
    import_state(page,legacy,'legacy-v2-compatibility')
    expect(page.locator('.deal-card')).to_have_count(1)
    old_card=page.locator('.deal-card')
    expect(old_card.locator('.deal-fit')).to_contain_text('契約条件から見る収支幅')
    expect(old_card.locator('.deal-fit')).to_contain_text('¥5,000 〜 ¥39,000')
    expect(old_card).not_to_contain_text('提案作成時')
    assert save(page)==legacy
    screenshot(page,'legacy-v2-mobile')
    ok('Canonical legacy-v2 compatibility fixture keeps original 5000–39000 range, no invented context, and identical imported/saved data')

    warning=page.evaluate('''async(base)=>{
      const e=await import('/src/sim/engine.ts'),d=await import('/src/sim/deals.ts');
      let s=e.applyAction(base,{type:'borrow',amount:100000,weeks:52});
      const offer=d.getOffers(s).find(o=>o.category==='system');
      for(let staff=1;staff<=6;staff++) for(let price=300;price<=1500;price+=10){
        const candidate=e.applyAction(s,{type:'updateStore',storeId:s.stores[0].id,changes:{manager:false,marketing:0,staff,price}});
        const forecast=e.previewWeek(candidate);
        if(forecast.netProfit>0 && forecast.netProfit<=offer.weeklyFee){
          const after=e.applyAction(candidate,{type:'acceptOffer',offerId:d.getOffers(candidate).find(o=>o.category==='system').id});
          return {state:candidate,offer:d.getOffers(candidate).find(o=>o.category==='system'),before:forecast,after:e.previewWeek(after)};
        }
      }
      throw Error('No ordinary-action borderline profit fixture found');
    }''',fixture['state'])
    assert warning['before']['netProfit']>0 and warning['after']['netProfit']<=0
    assert warning['state']['cash']+warning['after']['cashChange']>0
    import_state(page,warning['state'],'earned-debt-warning')
    warning_card=page.locator('.deal-card').filter(has=page.get_by_role('heading',name=warning['offer']['title'],exact=True))
    btn(warning_card,'契約条件を確認').click()
    dialog=page.get_by_role('dialog',name='営業提案の操作確認')
    expect(dialog).to_contain_text('借入中の利益条件を満たせなくなるおそれがあります')
    expect(dialog).to_contain_text(yen(warning['after']['netProfit']))
    screenshot(page,'debt-contract-warning-mobile')
    confirm(page,'契約する',warning['offer']['upfrontCost'])
    save(page)
    page.get_by_role('button',name=re.compile('週を終了する')).click()
    plan=page.get_by_role('dialog',name='第13週の営業計画')
    expect(plan).to_contain_text('倒産の見込みがあります')
    expect(plan).to_contain_text('借入残高があり、この週の純利益が0以下')
    expect(plan).to_contain_text(yen(warning['after']['netProfit']))
    screenshot(page,'debt-week-warning-mobile')
    btn(plan,'営業して週を進める').click()
    report=page.get_by_role('dialog',name='第13週の経営レポート')
    expect(report).to_contain_text('借入がある状態で')
    ruined=read(page)
    assert ruined['gameOver'] and ruined['cash']>0 and ruined['lastReport']['netProfit']==warning['after']['netProfit']
    ok('Ordinary borrowing/settings create positive pre-contract profit but nonpositive profit after fees; modal and weekly warning agree with actual cash-positive bankruptcy')
    assert not errors,errors
    ok('No browser console errors or unhandled exceptions')
    result={'checks':checks,'errors':errors,'cityView':'Explicit route stub; 3D rendering not tested','browserFlags':['--disable-gpu'],'v3Fixture':{'week':fixture['state']['week'],'stores':len(fixture['state']['stores']),'cash':fixture['state']['cash'],'reportWeek':fixture['state']['lastReport']['week'],'offerId':offer['id']},'settledContract':c,'debtWarning':{'beforeProfit':warning['before']['netProfit'],'afterProfit':warning['after']['netProfit'],'finalCash':ruined['cash']},'legacyNotice':'v1 comes from normal initial actions; v2 uses a historical canonical-offer compatibility fixture'}
    (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    browser.close()
    print(f'{len(checks)} sales-context browser checks passed; artifacts {OUT}')
