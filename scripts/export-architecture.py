"""Export standalone authored assets from the live Vite source, preserving textures.

Run after starting Vite: python3 scripts/export-architecture.py [--asset 109|cafe|qfront|all]
No city scene, game state or survey-data claims are included in these exports.
"""
import argparse
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--asset', choices=['109', 'cafe', 'qfront', 'all'], default='all')
parser.add_argument('--url', default='http://127.0.0.1:5173')
parser.add_argument('--output', type=Path, default=Path('/workspace/shared/shibuya-artifacts/architecture'))
parser.add_argument('--fictional', action='store_true', help='Export the 108 game variant of asset 109 as 108.glb; use a separate --output directory')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                args=['--enable-unsafe-swiftshader'])
    page = browser.new_page()
    # Same-origin document without starting the game or its animation loop.
    page.goto(args.url + '/@vite/client', wait_until='domcontentloaded')
    for asset in (['109', 'cafe', 'qfront'] if args.asset == 'all' else [args.asset]):
        result = page.evaluate('''async ({asset,fictional}) => {
          const THREE = await import('/node_modules/three/build/three.module.js');
          const {GLTFExporter} = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
          let root;
          if(asset === '109') {
            const {create109} = await import('/src/city/landmarks/Building109.ts'); root = create109({fictional});
          } else if(asset === 'qfront') {
            const {createMediaRetail} = await import('/src/city/landmarks/MediaRetail.ts'); root = createMediaRetail(18,14,26);
          } else {
            const {createCafeExterior} = await import('/src/city/assets/CafeExterior.ts'); root = createCafeExterior();
          }
          const images = new Set();
          root.traverse(o => {if(o.isMesh) for(const m of (Array.isArray(o.material)?o.material:[o.material]))
            for(const value of Object.values(m)) if(value?.isTexture && value.image instanceof HTMLImageElement) images.add(value.image);});
          await Promise.all([...images].map(img => img.complete ? Promise.resolve() : new Promise((resolve,reject)=>{
            img.addEventListener('load',resolve,{once:true}); img.addEventListener('error',reject,{once:true});
          })));
          const {waitFor109Textures} = await import('/src/city/landmarks/Building109Materials.ts');
          await waitFor109Textures();
          root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          let meshes = 0, triangles = 0, instances = 0;
          root.traverse(o => {if(o.isMesh){meshes++; const n=o.isInstancedMesh?o.count:1;
            instances+=n; triangles+=(o.geometry.index?.count ?? o.geometry.attributes.position.count)/3*n;}});
          const binary=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
          const bytes=new Uint8Array(binary);let s='';
          for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));
          return {data:btoa(s),info:{name:root.name,metadata:root.userData,meshes,instances,triangles,
            boundingBox:{min:box.min.toArray(),max:box.max.toArray(),size:size.toArray()},bytes:bytes.length}};
        }''', {'asset':asset, 'fictional':args.fictional})
        output_name = '108' if asset == '109' and args.fictional else asset
        (args.output / f'{output_name}.glb').write_bytes(base64.b64decode(result['data']))
        (args.output / f'{output_name}-info.json').write_text(json.dumps(result['info'], ensure_ascii=False, indent=2))
        print(output_name, json.dumps({k:v for k,v in result['info'].items() if k != 'metadata'}, ensure_ascii=False), flush=True)
    browser.close()
