#!/usr/bin/env python3
"""Export verified official Shibuya buildings + georeferenced GSI ground to editable GLB."""
import importlib.util,json,os,struct
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(os.environ.get('REAL_CITY_OUT','/workspace/shared/shibuya-artifacts'));OUT.mkdir(parents=True,exist_ok=True)
DEST=OUT/'real-shibuya.glb'
if DEST.exists(): raise FileExistsError('Existing GLB is preserved. Set REAL_CITY_OUT to a new output directory.')
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1000,'height':750},accept_downloads=True);page.set_default_timeout(240000)
 page.goto(os.environ.get('PLAYTEST_URL','http://127.0.0.1:5173')+'/real-shibuya.html?texture=original',wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('window.__realCity?.tiles === 20 && window.__realCity?.groundTiles === 72',timeout=240000)
 assert page.evaluate("window.__realCity.textureQuality==='original' && window.__realCity.textureStats.buildings.rgbaBaseBytes===1073741824"), 'Export requires complete original-resolution atlases'
 before=page.evaluate('window.__realCity.bounds');ground_count=page.evaluate('window.__realCity.groundTiles');print(f'20 building + {ground_count} ground tiles ready',flush=True)
 with page.expect_download(timeout=240000)as download:
  page.evaluate('''async () => {
    const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const {disposePhotoExportMaterials}=await import('/src/realcity/photoAppearance.ts');
    const runtime=window.__realCity;const scene=new runtime.scene.constructor();scene.name='Official_Shibuya_PLATEAU_2025_with_GSI_ground';
    scene.userData={title:'Actual Shibuya buildings and aerial street imagery',attribution:['東京都・国土交通省 Project PLATEAU 建築物モデル（渋谷区）2025年度公開','地理院タイル（シームレス空中写真）を使用'],modifications:'Bounded leaf-tile subset, ECEF to local ENU, glTF Y-up; baked photographic appearance via KHR_materials_unlit with original linear color factors; raw GSI imagery on flat approximation',photographicAppearance:{material:'KHR_materials_unlit',exportPhotoGain:1,displayPhotoGain:runtime.renderer.toneMappingExposure,sourceFilesModified:false,displayGainBakedIntoPixels:false},originLonLat:[139.7006,35.6595],originEllipsoidHeight:50,units:'metres',axes:'X east, Y up, Z south',terrain:'Flat approximation; no DEM. Buildings retain source elevations.',sourceUrls:['https://www.mlit.go.jp/plateau/opendata/','https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto'],licenseReferences:['https://www.mlit.go.jp/plateau/site-policy/','https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html'],notGameMap:true};
    const ground=runtime.scene.getObjectByName('GSI_seamless_aerial_flat_ground');if(!ground||ground.children.length<20)throw Error('Ground not ready');const exportModel=runtime.cloneModelForExport();scene.add(exportModel);scene.add(ground.clone(true));
    let data;try{data=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});}finally{disposePhotoExportMaterials(exportModel);}
    const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='real-shibuya.glb';a.click();
  }''')
 download.value.save_as(DEST);print('GLB saved',DEST.stat().st_size,flush=True)
 spec=importlib.util.spec_from_file_location('compress_real_glb',Path(__file__).with_name('compress-real-glb.py'));compressor=importlib.util.module_from_spec(spec);spec.loader.exec_module(compressor);compression=compressor.compress(DEST)
 # Browser file upload avoids publishing the exported file or base64-encoding hundreds of MB.
 page.evaluate("() => {const input=document.createElement('input');input.type='file';input.id='verify-glb';document.body.appendChild(input);}")
 page.locator('#verify-glb').set_input_files(str(DEST))
 verification=page.evaluate('''async()=>{
   const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
   const {Box3}=await import('/node_modules/three/build/three.module.js');
   const glb=await document.querySelector('#verify-glb').files[0].arrayBuffer();const result=await new GLTFLoader().parseAsync(glb,'');
   const buildings=result.scene.getObjectByName('Official_PLATEAU_Shibuya_2025');const ground=result.scene.getObjectByName('GSI_seamless_aerial_flat_ground');if(!buildings||!ground)throw Error('Missing model groups');
   const bounds=new Box3().setFromObject(buildings,true);let meshes=0,maps=0,triangles=0;
   result.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)maps++;}});
   return {bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},groundMeshes:ground.children.length,meshes,maps,triangles,metadata:result.scene.userData};
 }''')
 for key in ('min','max'):
  assert max(abs(a-b)for a,b in zip(before[key],verification['bounds'][key]))<.05,(before,verification)
 assert verification['groundMeshes']==ground_count and verification['maps']>=40,verification
 browser.close()
with DEST.open('rb')as f:
 header=f.read(20);length=struct.unpack_from('<I',header,12)[0];doc=json.loads(f.read(length))
external=[x['uri']for kind in ('buffers','images')for x in doc.get(kind,[])if x.get('uri')and not x['uri'].startswith('data:')]
assert not external,external
assert 'KHR_materials_unlit' in doc.get('extensionsUsed',[]), 'Export must preserve baked photographic appearance'
assert all(0<=factor<=1 for material in doc.get('materials',[]) for factor in material.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])), 'Display gain must not leak into exported baseColorFactor'
verification.update(compression=compression,glbBytes=DEST.stat().st_size,externalUris=external,sourceBounds=before,images=len(doc.get('images',[])),asset=doc.get('asset'),status='passed')
(OUT/'real-shibuya-glb-qa.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(verification,ensure_ascii=False),flush=True)
