#!/usr/bin/env python3
"""Targeted sales UI integration; fixture setup uses genuine engine actions only."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
OUT=Path(os.getenv('PLAYTEST_OUT','/tmp/shibuya-playtest')); OUT.mkdir(parents=True,exist_ok=True)
checks=[]; errors=[]
def ok(s): checks.append(s); print('PASS',s,flush=True)
def btn(p,s): return p.get_by_role('button',name=s,exact=True)
def number(s): return int(re.sub(r'[^0-9-]','',s))
def cash(p): return number(p.locator('.deals-panel .summary-strip .metric').filter(has_text='手元資金').locator('strong').inner_text())
def read(p): return p.evaluate("async()=> (await import('/src/persistence.ts')).loadGame()")
def save(p):
 btn(p,'設定・保存').click(); d=p.get_by_role('dialog',name='設定と会社データ'); btn(d,'今すぐ保存する').click(); expect(p.get_by_role('alert')).to_contain_text('保存しました'); btn(d,'閉じる').click(); return read(p)
def confirm(p,prefix,charge):
 d=p.get_by_role('dialog',name='営業提案の操作確認'); expect(d.locator('.cost-list div').filter(has_text='今回の支払').locator('dd')).to_have_text(f'¥{charge:,}'); d.get_by_role('button',name=re.compile('^'+prefix)).click(); expect(d).to_have_count(0)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--enable-unsafe-swiftshader'])
 context=b.new_context(viewport={'width':1260,'height':900}); page=context.new_page(); page.set_default_timeout(30000)
 page.on('pageerror',lambda e:errors.append(str(e))); page.on('console',lambda m:errors.append(m.text+' '+str(m.location)) if m.type=='error' else None)
 page.goto(os.getenv('PLAYTEST_URL','http://127.0.0.1:5173'))
 fixture=page.evaluate('''async()=>{const e=await import('/src/sim/engine.ts'),d=await import('/src/data/district.ts'),p=await import('/src/persistence.ts'); let s=e.createGame('営業検証株式会社'); const lot=d.LOTS.find(l=>l.available&&e.evaluateSite(s,l.id,'standard').expectedProfit>0); s=e.applyAction(s,{type:'openStore',lotId:lot.id,style:'standard'}); s=e.applyAction(s,{type:'settings',changes:{quality:'low'}}); return p.createEnvelope(s);}''')
 fixturepath=OUT/'sales-fixture.json'; fixturepath.write_text(json.dumps(fixture,ensure_ascii=False))
 page.locator('input[type=file]').set_input_files(str(fixturepath)); expect(page.locator('.company h1')).to_have_text('営業検証株式会社'); btn(page,'営業・提案').click()
 expect(page.locator('.deal-card')).to_have_count(2); initial=cash(page)
 system=page.locator('.deal-card').filter(has_text='在庫・発注支援システム'); bad=page.locator('.deal-card').filter(has_text='集客保証プレミアム広告')
 system.get_by_role('button',name=re.compile('調査を依頼')).click(); confirm(page,'調査する',8000)
 expect(system.locator('.deal-report')).to_contain_text('調査レポート'); assert cash(page)==initial-8000
 ok('two offers; due diligence charges exactly 8000 yen and displays research')
 bad.get_by_role('button',name='見送る',exact=True).click(); confirm(page,'この提案を見送る',0); expect(page.locator('.deal-card')).to_have_count(1); assert cash(page)==initial-8000
 ok('declining high-cost pitch removes it without debit')
 before=save(page); baseline=page.evaluate("async()=>{const e=await import('/src/sim/engine.ts');const p=await import('/src/persistence.ts');return e.previewWeek(await p.loadGame());}")
 btn(system,'契約条件を確認').click(); confirm(page,'契約する',80000); assert cash(page)==initial-88000
 contract=page.locator('.deal-contract'); expect(contract).to_contain_text('導入中・未確定'); expect(page.locator('.deals-panel .summary-strip .metric').filter(has_text='契約中の週額費用').locator('strong')).to_have_text('¥4,000')
 after=save(page); forecast=page.evaluate("async()=>{const e=await import('/src/sim/engine.ts');const p=await import('/src/persistence.ts');return e.previewWeek(await p.loadGame());}")
 assert forecast['netProfit']==baseline['netProfit']-4000 and forecast['cashChange']==baseline['cashChange']-4000
 assert after['cash']==before['cash']-80000 and len(after['deals']['contracts'])==1
 ok('acceptance charges exactly 80000; recurring 4000 reduces weekly cash/profit forecast')
 for week in range(1,4):
  prior=read(page)
  page.get_by_role('button',name=re.compile('週を終了する')).click(); d=page.get_by_role('dialog',name=f'第{week}週の営業計画'); btn(d,'営業して週を進める').click(); report=page.get_by_role('dialog',name=f'第{week}週の経営レポート'); expect(report).to_be_visible(); btn(report,'街に戻る').click()
  current=read(page); c=current['deals']['contracts'][0]; assert current['cash']==prior['cash']+current['lastReport']['cashChange']; assert c['cumulativeFees']==week*4000
  if week<3: assert 'realizedWeeklyBenefit' not in c; expect(contract).to_contain_text('導入中・未確定')
  else:
   assert 15000<=c['realizedWeeklyBenefit']<=23000 and c['cumulativeBenefit']==c['realizedWeeklyBenefit']; expect(contract).not_to_contain_text('導入中・未確定')
 ok('three weekly reports settle cash/fees; observed benefit appears only after implementation lag')
 page.screenshot(path=str(OUT/'sales.png'),full_page=True)
 recorded=read(page); page.reload(); page.get_by_role('button',name=re.compile('営業検証株式会社 を続ける')).click(); btn(page,'営業・提案').click(); assert read(page)==recorded; expect(page.locator('.deal-contract')).to_contain_text(f"¥{c['realizedWeeklyBenefit']:,}")
 ok('reload preserves contract, investigation, observed outcome and cumulative fees')
 before_cash=cash(page); page.locator('.deal-contract').get_by_role('button',name=re.compile('解約条件を確認')).click(); confirm(page,'解約する',10000); assert cash(page)==before_cash-10000; expect(page.locator('.deal-contract')).to_contain_text('解約済み'); expect(page.locator('.deals-panel .summary-strip .metric').filter(has_text='契約中の週額費用').locator('strong')).to_have_text('¥0')
 cancelled=save(page); assert cancelled['deals']['contracts'][0]['status']=='cancelled'
 ok('cancellation charges exactly 10000 and stops recurring contract fees')
 # Fault injection affects only this fresh context's primary row; all backups remain intact.
 page.evaluate("""()=>new Promise((resolve,reject)=>{const request=indexedDB.open('shibuya-capital-v1',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),r=store.get('primary');r.onsuccess=()=>{const row=r.result;row.envelope.checksum='0'.repeat(64);store.put(row);};tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);})""")
 page.reload(); expect(page.get_by_role('alert')).to_contain_text('セーブの破損を検出しました')
 btn(page,'保存履歴から復元').click(); recovery=page.get_by_role('dialog',name='保存履歴から復元'); recovery.get_by_role('button',name=re.compile('営業検証株式会社 · 第4週')).click()
 expect(page.locator('.company h1')).to_have_text('営業検証株式会社'); btn(page,'営業・提案').click(); assert read(page)==cancelled; expect(page.locator('.deal-contract')).to_contain_text('解約済み')
 ok('corrupted primary detected; welcome recovery restores intact week4 backup and complete company/contract state')
 result={'passed':checks,'errors':errors}; (OUT/'sales-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)); assert not errors,errors; ok('zero console or page errors'); result['passed']=checks; (OUT/'sales-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)); b.close(); print(f'{len(checks)} sales scenarios passed; artifacts {OUT}')
