#!/usr/bin/env python3
"""Development App DOM QA; both 3D components explicitly stubbed. Never production/render evidence."""
import json,re,traceback,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path(os.environ.get('IMMERSIVE_DOM_OUT','/workspace/shared/shibuya-artifacts/immersive-v045/dom'));OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[];snapshots=[];issues=[]
STUB='''import React from '/node_modules/.vite/deps/react.js';export default function CityView(p){let token=React.useRef(null);if(token.current===null)token.current=++window.__cityCounter|| (window.__cityCounter=1);window.__citySnapshot={token:token.current,selectedLotId:p.selectedLotId,focusStoreLotId:p.focusStoreLotId};return React.createElement('div',{className:'city-world','data-qa-stub':'true'},React.createElement('canvas',{style:{width:'100%',height:'100%'}}));}'''
def b(p,n):return p.get_by_role('button',name=n,exact=True)
def close(d):d.locator(':scope > section > header > button[aria-label="閉じる"]').click()
def read(p):return p.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
def primary(p):return p.evaluate("()=>new Promise((resolve,reject)=>{let q=indexedDB.open('shibuya-capital-v1');q.onsuccess=()=>{let d=q.result,r=d.transaction('saves').objectStore('saves').get('primary');r.onsuccess=()=>{d.close();resolve(r.result)}};q.onerror=reject})")
def menu(p,target):b(p,'経営').click();d=p.locator('dialog').filter(has=p.get_by_role('heading',name='経営',exact=True));b(d,target).click();return p.locator('dialog').filter(has=p.get_by_role('heading',name=('設定と会社データ' if target=='設定・保存' else target),exact=True))
def city(p):return p.evaluate('window.__citySnapshot')
def shot(p,n):p.screenshot(path=str(OUT/(n+'.png')))
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--disable-gpu'])
 try:
  for width,height in [(1280,960),(390,844)]:
   c=browser.new_context(viewport={'width':width,'height':height},has_touch=(width==390));c.route('**/src/city/CityView.tsx*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=STUB));c.route('**/src/ui/RealCityView.tsx*',lambda r:r.fulfill(status=200,content_type='application/javascript',body='export function RealCityView(){return null};export default RealCityView'));p=c.new_page();p.set_default_timeout(10000);p.on('pageerror',lambda e:errors.append(str(e)));p.goto(os.environ.get('IMMERSIVE_DOM_URL','http://127.0.0.1:5173'));p.get_by_label('会社名',exact=True).fill('全面街QA'+str(width));b(p,'新しい会社を設立').click();expect(p.locator('.immersive-game')).to_be_visible();expect(p.locator('dialog[open]')).to_have_count(0)
   assert p.locator('.rail,.bottom-bar,.inspector,.topbar').count()==0
   rect=p.locator('.immersive-city').bounding_box();assert rect=={'x':0,'y':0,'width':width,'height':height},rect
   assert p.locator('.city-world canvas').bounding_box()==rect;assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
   initial=primary(p);token=city(p)['token'];shot(p,f'{width}-full-city-stub');checks.append(f'{width}: viewport全域のcity host/stub canvas・常設sidebar/footerなし')
   b(p,'出店場所を探す').click();sites=p.locator('dialog[open]');expect(sites.locator('.site-list button')).to_have_count(32);sites.locator('[data-lot-id="center-01"]').click();d=p.locator('dialog[open]');expect(d.locator('.facility-content')).to_have_attribute('data-selected-lot-id','center-01');assert d.evaluate('(e)=>e.matches(":modal")');expect(d.locator('.opening-detail')).not_to_have_attribute('open','')
   d.locator('.opening-option').filter(has_text='プレミアム').click();b(d,'この出店の資金を比較').click();finance=p.locator('dialog[open]');expect(finance).to_contain_text('財務・不動産');finance.locator('.capital-return').click();d=p.locator('dialog[open]');expect(d.locator('.facility-content')).to_have_attribute('data-selected-lot-id','center-01');expect(d.locator('.opening-option').filter(has_text='プレミアム')).to_have_attribute('aria-pressed','true');assert primary(p)==initial
   d.locator('.opening-option').filter(has_text='街角カフェ').click();b(d,'この場所にカフェを開業').click();expect(p.locator('dialog[open]')).to_have_count(0);expect(p.locator('.toast')).to_contain_text('カフェを開業');assert city(p)=={'token':token,'selectedLotId':'center-01','focusStoreLotId':'center-01'};shot(p,f'{width}-opened-city-stub');checks.append(f'{width}: 32区画一覧→native施設dialog→財務比較→同区画/形態復帰→開業後dialog閉じ外観focus props')
   b(p,'この店を経営').click();d=p.locator('dialog[open]');price=d.get_by_label('販売価格（円）',exact=True);price.fill('950');price.blur();expect(price).to_have_value('950');close(d);saved_selection=city(p)
   for target in ['財務・不動産','店舗経営','株式市場']:
    d=menu(p,target);assert d.evaluate('(e)=>e.matches(":modal")');assert city(p)['token']==saved_selection['token'] and city(p)['selectedLotId']==saved_selection['selectedLotId']
    if target=='店舗経営':
     expect(d.get_by_label('販売価格（円）',exact=True)).to_have_count(0);b(d,'この店を経営').click();facility=p.locator('dialog[open]');expect(facility.locator('.facility-content')).to_have_attribute('data-selected-lot-id','center-01');expect(facility.get_by_label('販売価格（円）',exact=True)).to_have_value('950');close(facility)
    if target=='株式市場':
     b(d,'買う').first.click();child=d.locator('.investment-order');expect(child).to_be_visible();child.get_by_label('購入株数',exact=True).fill('2');p.keyboard.press('Escape');p.wait_for_timeout(100)
     if child.count():issues.append(str(width)+': child order Escape did not close');b(child,'取引を閉じる').click()
     expect(child).to_have_count(0);expect(d).to_be_visible();assert d.evaluate('(e)=>e.matches(":modal")')
    if d.count():close(d)
    expect(p.locator('dialog[open]')).to_have_count(0);assert city(p)['token']==saved_selection['token'] and city(p)['selectedLotId']==saved_selection['selectedLotId']
   assert primary(p)==initial;checks.append(f'{width}: finance/stores/stocksを必要時overlay、child注文を閉じ、親→同city stub instance/selection復帰・保存不変')
   p.locator('.hud-next-week').click();d=p.locator('dialog[open]');expect(d).to_contain_text('第1週を営業する');expect(d.locator('.week-outlook')).not_to_have_attribute('open','');expect(d.locator('.summary-strip')).to_have_count(0);assert '418,200' not in d.inner_text();shot(p,f'{width}-week-outlook-closed');close(d)
   # Normal settings API through UI. The later engine shock acceptance is separately owned by rail.
   d=menu(p,'設定・保存');b(d,'今すぐ保存する').click();expect(d.get_by_role('alert')).to_contain_text('保存しました');close(d);saved=read(p);assert len(saved['stores'])==1 and saved['stores'][0]['price']==950 and saved['week']==1
   p.reload();p.get_by_role('button',name=re.compile('全面街QA'+str(width)+' を続ける')).click();expect(p.locator('.immersive-game')).to_be_visible();assert read(p)==saved;expect(p.locator('dialog[open]')).to_have_count(0);checks.append(f'{width}: 通常週確認は見込みdetails閉じ・確定利益なし、手動保存/reloadは経済state完全一致')
   snapshots.append({'viewport':[width,height],'rect':rect,'saved':saved});c.close()
  c=browser.new_context(viewport={'width':1280,'height':960});c.route('**/src/city/CityView.tsx*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=STUB));c.route('**/src/ui/RealCityView.tsx*',lambda r:r.fulfill(status=200,content_type='application/javascript',body='export function RealCityView(){return null};export default RealCityView'));p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(os.environ.get('IMMERSIVE_DOM_URL','http://127.0.0.1:5173'));p.get_by_label('会社名',exact=True).fill('見込みリスクQA');b(p,'新しい会社を設立').click();expect(p.locator('.immersive-game')).to_be_visible();d=menu(p,'財務・不動産');capital=d.get_by_role('region',name='資金調達の比較');capital.get_by_role('button',name=re.compile('銀行から借りる')).click();capital.locator('.capital-submit').click();close(d);p.locator('.hud-next-week').click();d=p.locator('dialog[open]');expect(d.locator('.week-outlook')).to_have_attribute('open','');expect(d.get_by_role('alert')).to_contain_text('経営');expect(b(d,'リスクを承知して営業する')).to_be_visible();shot(p,'risk-outlook-open');checks.append('通常新会社の借入リスク時は見込みdetails自動open・危険を理解して営業するlabel');c.close()
  assert not errors,errors
  (OUT/'results.json').write_text(json.dumps({'checks':checks,'errors':errors,'issues':issues,'snapshots':snapshots,'method':'Both 3D views explicit stubs; actual App/economy/native dialogs; no state injection. Stub instance stability is not real camera/render evidence.'},ensure_ascii=False,indent=2));print(json.dumps({'checks':checks,'errors':errors,'issues':issues},ensure_ascii=False))
  assert not issues,issues
 except Exception:
  print('PAGE_ERRORS',errors,flush=True)
  try:shot(p,'failure');(OUT/'failure.txt').write_text(traceback.format_exc())
  except:pass
  raise
 finally:browser.close()
