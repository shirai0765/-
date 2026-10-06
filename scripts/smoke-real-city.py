#!/usr/bin/env python3
"""Verify actual textured PLATEAU subset, coordinate bounds and preset rendering."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(os.environ.get('REAL_CITY_OUT','/workspace/shared/shibuya-artifacts'));out.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':980},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
 page.goto(os.environ.get('PLAYTEST_URL','http://127.0.0.1:5173')+'/real-shibuya.html',wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('window.__realCity?.tiles > 0',timeout=240000)
 info=page.evaluate('''() => {const c=window.__realCity;c.renderer.render(c.scene,c.camera);return {bounds:c.bounds,tiles:c.tiles,groundTiles:c.groundTiles,triangles:c.renderer.info.render.triangles,calls:c.renderer.info.render.calls,textures:c.renderer.info.memory.textures}}''')
 assert info['tiles']==20 and info['groundTiles']==72,info
 assert info['textures']>=10,info
 assert max(abs(x)for x in info['bounds']['min']+info['bounds']['max'])<5000,info
 page.screenshot(path=str(out/'real-shibuya-crossing.png'))
 page.get_by_role('button',name='109周辺',exact=True).click();page.wait_for_timeout(1200);page.screenshot(path=str(out/'real-shibuya-109.png'))
 page.get_by_role('button',name='街区全体',exact=True).click();page.wait_for_timeout(1200);page.screenshot(path=str(out/'real-shibuya-overview.png'))
 assert not errors,errors
 (out/'real-shibuya-qa.json').write_text(json.dumps({'render':info,'errors':errors},ensure_ascii=False,indent=2))
 print(json.dumps(info));browser.close()
