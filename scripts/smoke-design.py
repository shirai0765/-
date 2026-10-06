#!/usr/bin/env python3
"""Real theme/typography/progression UI checks and screenshot comparison."""
import json, os, re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageDraw
OUT=Path(os.getenv('DESIGN_OUT','/workspace/shared/shibuya-artifacts/design')); OUT.mkdir(parents=True,exist_ok=True)
URL=os.getenv('PLAYTEST_URL','http://127.0.0.1:5173'); checks=[]; errors=[]; font_urls=[]
def ok(s): checks.append(s); print('PASS',s,flush=True)
def btn(p,s): return p.get_by_role('button',name=s,exact=True)
def overflow(p): assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),p.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--enable-unsafe-swiftshader']); context=b.new_context(viewport={'width':1260,'height':900}); page=context.new_page(); page.set_default_timeout(45000)
 page.on('pageerror',lambda e:errors.append(str(e))); page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None); page.on('response',lambda r:font_urls.append(r.url) if '.woff' in r.url else None)
 page.goto(URL); page.get_by_label('会社名').fill('渋谷デザイン株式会社'); btn(page,'新しい会社を設立').click(); expect(page.locator('.company h1')).to_have_text('渋谷デザイン株式会社'); page.wait_for_function('window.__cityRenderer?.info.render.triangles>0')
 fonts=page.evaluate('''async()=>{await document.fonts.ready; await document.fonts.load('500 16px "Manrope Variable"','Capital0123456789');await document.fonts.load('500 16px "Noto Sans JP Variable"','渋谷経営'); return [...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family);}''')
 assert any('Manrope Variable' in f for f in fonts) and any('Noto Sans JP Variable' in f for f in fonts),fonts
 assert font_urls and all(urlparse(u).netloc==urlparse(URL).netloc for u in font_urls),font_urls
 ok('Manrope Variable and Noto Sans JP Variable loaded from same-origin bundled WOFF fonts')
 btn(page,'設定・保存').click(); settings=page.get_by_role('dialog',name='設定と会社データ'); settings.get_by_label('3D描画').select_option('low'); btn(settings,'今すぐ保存する').click(); expect(page.get_by_role('alert')).to_contain_text('保存しました'); btn(settings,'閉じる').click()
 palettes=[]
 for theme,title in [('daylight','Tokyo Daylight'),('metro','Metro Editorial'),('night','After Hours')]:
  print('Checking theme',theme,flush=True); btn(page,'デザインを選ぶ').click(); d=page.get_by_role('dialog',name='デザインを選ぶ'); choice=d.get_by_role('button',name=re.compile(title)); choice.click(); expect(choice).to_have_attribute('aria-pressed','true'); expect(page.locator('html')).to_have_attribute('data-design',theme)
  if theme=='daylight': page.screenshot(animations='disabled',path=str(OUT/'chooser.png'))
  btn(d,'閉じる').click(); page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); overflow(page); expect(page.locator('canvas')).to_be_visible(); page.wait_for_function('window.__cityRenderer?.info.render.triangles>0'); palettes.append(page.locator('.topbar').evaluate('(el)=>getComputedStyle(el).backgroundColor')); page.screenshot(animations='disabled',path=str(OUT/f'{theme}.png'))
  assert page.evaluate("localStorage.getItem('shibuya-design')")==theme
  btn(page,'成長戦略').click(); expect(page.locator('.progression-roadmap')).to_be_visible(); page.set_viewport_size({'width':900,'height':900}); overflow(page); btn(page,'デザインを選ぶ').click(); expect(page.get_by_role('dialog',name='デザインを選ぶ').get_by_role('button',name=re.compile(title))).to_have_attribute('aria-pressed','true'); overflow(page); btn(page.get_by_role('dialog',name='デザインを選ぶ'),'閉じる').click(); page.set_viewport_size({'width':1260,'height':900}); overflow(page)
  page.reload(); expect(page.locator('html')).to_have_attribute('data-design',theme); page.get_by_role('button',name=re.compile('渋谷デザイン株式会社 を続ける')).click(); expect(page.locator('.company h1')).to_have_text('渋谷デザイン株式会社')
  ok(f'{title}: immediate theme choice, city screenshot, reload persistence and 900/1260 overflow checks')
 btn(page,'成長戦略').click(); expect(page.get_by_role('region',name='次の経営判断')).to_be_visible(); assert page.locator('.progression-roadmap > li').count()>3; page.screenshot(animations='disabled',path=str(OUT/'progression.png')); page.locator('.progression-advice').get_by_role('button',name='確認する').first.click(); expect(page.locator('.progression-panel')).to_have_count(0)
 ok('growth roadmap and next-decision controls visible and navigate to actual management screen')
 assert len(set(palettes))>=2,palettes
 assert not errors,errors; ok('no console/page errors or remote font requests')
 b.close()
 canvas=Image.new('RGB',(1260,360),'#e8edf3'); draw=ImageDraw.Draw(canvas)
 for index,(theme,title) in enumerate([('daylight','01 TOKYO DAYLIGHT'),('metro','02 METRO EDITORIAL'),('night','03 AFTER HOURS')]):
  im=Image.open(OUT/f'{theme}.png').convert('RGB'); im.thumbnail((420,900)); x=index*420; canvas.paste(im,(x,50)); draw.text((x+14,17),title,fill='#12213a')
 canvas.save(OUT/'comparison.png')
 (OUT/'results.json').write_text(json.dumps({'passed':checks,'errors':errors,'loadedFontFamilies':sorted(set(fonts)),'fontRequests':font_urls,'topbarColors':palettes},ensure_ascii=False,indent=2)); print(f'{len(checks)} design scenarios passed; artifacts {OUT}')
