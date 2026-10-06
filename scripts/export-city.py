"""Export the authored browser city as a reusable GLB; no surveyed geography implied."""
import base64,json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/workspace/shared/shibuya-artifacts');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 page.add_init_script("const raf=window.requestAnimationFrame.bind(window);window.__exportPause=false;window.requestAnimationFrame=cb=>raf(t=>{if(!window.__exportPause)cb(t)});")
 page.goto('http://127.0.0.1:5173',wait_until='networkidle')
 page.get_by_role('button',name='新しい会社を設立',exact=False).click()
 page.wait_for_function('window.__cityRenderer?.info.render.triangles > 0',timeout=60000)
 page.evaluate("async () => {const {waitFor109Textures}=await import('/src/city/landmarks/Building109Materials.ts');await waitFor109Textures();const {waitForLoadedAssets}=await import('/src/city/loadedAsset.ts');await waitForLoadedAssets(window.__cityScene);window.__cityRenderer.render(window.__cityScene,window.__cityCamera);}")
 page.evaluate('window.__exportPause=true')
 print('City rendered; animation paused for export',flush=True)
 page.screenshot(path=str(out/'shibuya-city.png'))
 render=page.evaluate("() => {window.__cityRenderer.render(window.__cityScene,window.__cityCamera);return window.__cityRenderer.domElement.toDataURL('image/png').split(',')[1];}")
 (out/'shibuya-model-render.png').write_bytes(base64.b64decode(render))
 print('Screenshots saved; serializing GLB',flush=True)
 data=page.evaluate('''async () => {
   const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
   const {waitFor109Textures}=await import('/src/city/landmarks/Building109Materials.ts');
   await waitFor109Textures();const {waitForLoadedAssets}=await import('/src/city/loadedAsset.ts');await waitForLoadedAssets(window.__cityScene);
   const scene=window.__cityScene;
   scene.name='SHIBUYA CAPITAL — architectural study (not surveyed)';
   const binary=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
   const bytes=new Uint8Array(binary);let s='';
   for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return btoa(s);
 }''')
 file=out/'shibuya-architectural-study.glb';file.write_bytes(base64.b64decode(data))
 metrics=page.evaluate('({triangles:window.__cityRenderer.info.render.triangles,drawCalls:window.__cityRenderer.info.render.calls,textures:window.__cityRenderer.info.memory.textures})')
 (out/'model-info.json').write_text(json.dumps({'title':'SHIBUYA CAPITAL architectural study','source':'Original procedural architecture inspired by Shibuya; not surveyed PLATEAU data','units':'metres at compressed playable scale','glbBytes':file.stat().st_size,'renderer':metrics},ensure_ascii=False,indent=2))
 print('GLB exported',file,file.stat().st_size,metrics,flush=True)
 browser.close()
