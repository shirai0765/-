import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createDaylightEnvironment } from '../city/art';

interface Comparison { before:THREE.Group; after:THREE.Group; current:'before'|'after' }
declare global { interface Window { __modelViewer?: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; ready: boolean; comparison?:Comparison } } }
const host = document.querySelector<HTMLElement>('#scene')!;
const status = document.querySelector<HTMLElement>('#status')!;
const config: {title?:string;description?:string;asset?:boolean;clearCafeGlass?:boolean;reference?:{image:string;credit:string;sourceURL:string}} = JSON.parse(document.querySelector('#viewer-config')?.textContent || '{}');
if(config.title){document.title=config.title;document.querySelector('h1')!.textContent=config.title;}
if(config.description)document.querySelector('header p')!.textContent=config.description;
if(config.reference){
 const panel=document.createElement('details'); panel.className='reference';
 panel.style.cssText='position:absolute;right:18px;top:18px;z-index:3;background:#fff;border-radius:10px;max-width:min(380px,85vw);box-shadow:0 8px 30px #18304720;font-size:12px';
 const summary=document.createElement('summary');summary.textContent='実際の参考写真を見る';summary.style.cssText='padding:12px;cursor:pointer';panel.append(summary);
 const photo=document.createElement('img');photo.src=config.reference.image;photo.alt='建築形状を確認した実際の渋谷の参考写真';photo.style.cssText='width:100%;max-height:55vh;object-fit:contain;display:block';panel.append(photo);
 const credit=document.createElement('p');credit.style.cssText='margin:10px;line-height:1.6';credit.textContent=config.reference.credit;panel.append(credit);
 const link=document.createElement('a');link.textContent='写真の出典（オンライン）';link.href=config.reference.sourceURL;link.target='_blank';link.rel='noopener noreferrer';link.style.cssText='display:block;margin:10px;color:#1352a8';panel.append(link);host.append(panel);
}
try {
 const scene = new THREE.Scene(); scene.background = new THREE.Color('#b5ddef'); scene.fog = new THREE.Fog('#b5ddef',650,1250);
 const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.NeutralToneMapping; renderer.toneMappingExposure=1.08; renderer.shadowMap.enabled=false; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const environment=createDaylightEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.28;
 renderer.domElement.setAttribute('aria-label','渋谷の建築スタディを回転・拡大できる3D画面'); renderer.domElement.tabIndex=0; host.append(renderer.domElement);
 const camera = new THREE.PerspectiveCamera(36,1,.5,1800);
 const controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=false; controls.maxPolarAngle=Math.PI*.47; controls.minDistance=25; controls.maxDistance=850; controls.panSpeed=.65; controls.rotateSpeed=.55;
 scene.add(new THREE.HemisphereLight('#eaf7ff','#b1b2a2',2.3));
 const sun=new THREE.DirectionalLight('#fffaf0',3); sun.position.set(-180,330,-140); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-300,right:300,top:300,bottom:-300,far:900}); sun.shadow.normalBias=.7; sun.shadow.bias=-.0002; scene.add(sun);
 if(config.asset){scene.background=new THREE.Color('#eaf0f4');scene.fog=null;controls.minDistance=1;controls.maxPolarAngle=Math.PI*.49;renderer.shadowMap.enabled=true;document.querySelector<HTMLInputElement>('#quality')!.checked=true;
  document.querySelectorAll('[data-view]').forEach((b,i)=>b.textContent=['全景','正面','入口','背面'][i]);
  const roof=document.createElement('button');roof.dataset.view='roof';roof.textContent='屋上';roof.setAttribute('aria-pressed','false');document.querySelector('.viewpoints')!.append(roof);
 }
 const render=()=>renderer.render(scene,camera);
 const presets:Record<string,{position:number[];target:number[]}>= {
  overview:{position:[-290,255,325],target:[0,8,0]},
  crossing:{position:[-95,100,130],target:[0,3,0]},
  station:{position:[-30,125,165],target:[75,10,42]},
  park:{position:[-5,115,-30],target:[116,13,-143]},
  roof:{position:[-290,390,200],target:[0,8,0]},
 };
 function preset(name:string){const p=presets[name];camera.position.set(...p.position as [number,number,number]);controls.target.set(...p.target as [number,number,number]);controls.update();render();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.view===name)));}
 controls.addEventListener('change',render);
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();};new ResizeObserver(resize).observe(host);
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.view!)));
 document.querySelector('#reset')!.addEventListener('click',()=>preset('overview'));
 document.querySelector<HTMLInputElement>('#quality')!.addEventListener('change',event=>{renderer.shadowMap.enabled=(event.target as HTMLInputElement).checked;scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){for(const material of Array.isArray(m.material)?m.material:[m.material])material.needsUpdate=true;}});render();});
 document.querySelector('#capture')!.addEventListener('click',()=>{render();renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='shibuya-architectural-study.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');});
 const api:NonNullable<Window['__modelViewer']>={renderer,scene,camera,controls,ready:false};window.__modelViewer=api;
 preset('overview'); resize();
 function modelBytes(id:string):ArrayBuffer {const binary=atob(document.querySelector(id)!.textContent!.trim());const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes.buffer;}
 function prepareModel(model:THREE.Group){
  const lights:THREE.Object3D[]=[];
  model.traverse(o=>{
   if((o as THREE.Light).isLight)lights.push(o);
   if(o instanceof THREE.Mesh){
    const materials=Array.isArray(o.material)?o.material:[o.material];
    // Use the game's clear-window approximation only when requested. The source
    // exhibition GLB and Blender master retain their physical transmission glass.
    if(config.clearCafeGlass)for(const material of materials){
     if(material.name==='Cafe_glazing'&&material instanceof THREE.MeshStandardMaterial){
      if(material instanceof THREE.MeshPhysicalMaterial)material.transmission=0;
      material.opacity=.08;material.transparent=true;material.metalness=0;
      material.roughness=.07;material.depthWrite=false;material.needsUpdate=true;
     }
    }
    o.castShadow=!materials.some(m=>m.transparent||(m instanceof THREE.MeshPhysicalMaterial&&m.transmission>0));
    o.receiveShadow=true;
   }
  });
  lights.forEach(o=>o.removeFromParent());
 }
 async function loadModels(){
  const loader=new GLTFLoader(),gltf=await loader.parseAsync(modelBytes('#model-data'),'');
  prepareModel(gltf.scene);scene.add(gltf.scene);
  if(config.asset){
   const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
   const target:[number,number,number]=[center.x,box.min.y+size.y*.43,center.z];
   presets.overview={position:[center.x+extent*1.25,box.min.y+size.y*.78,center.z+extent*1.85],target};
   presets.crossing={position:[center.x,box.min.y+size.y*.48,box.max.z+extent*1.6],target};
   const entryTarget:[number,number,number]=[center.x,box.min.y+Math.min(3,size.y*.4),box.max.z-1];
   presets.station={position:[center.x+size.x*.22,box.min.y+Math.min(5,size.y*.9),box.max.z+Math.min(18,extent*1.4)],target:entryTarget};
   presets.park={position:[center.x-extent*1.3,box.min.y+size.y*.85,box.min.z-extent*1.8],target};
   presets.roof={position:[center.x+extent*.85,box.max.y+extent*.9,center.z+extent*1.15],target:[center.x,box.max.y-size.y*.16,center.z]};
   controls.maxDistance=extent*7;camera.near=.05;camera.far=extent*30;camera.updateProjectionMatrix();
   sun.position.set(center.x-extent*1.6,extent*2.8,center.z+extent);sun.target.position.copy(center);scene.add(sun.target);Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.1,far:extent*8});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(extent*80,extent*80),new THREE.MeshStandardMaterial({color:'#e2e6e8',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.set(center.x,box.min.y-.025,center.z);floor.receiveShadow=true;scene.add(floor);
  }
  if(document.querySelector('#before-model-data')){
   const original=await loader.parseAsync(modelBytes('#before-model-data'),'');prepareModel(original.scene);original.scene.visible=false;scene.add(original.scene);
   const comparison:Comparison={before:original.scene,after:gltf.scene,current:'after'};api.comparison=comparison;
   const panel=document.createElement('div');panel.setAttribute('role','group');panel.setAttribute('aria-label','モデルの比較');
   panel.style.cssText='position:absolute;left:22px;bottom:20px;z-index:2;background:#fffffff2;padding:10px;border-radius:12px;box-shadow:0 5px 25px #24466320';
   const label=document.createElement('div');label.textContent='同じ視点・照明で比較';label.style.cssText='font-size:11px;color:#526b82;margin-bottom:7px';panel.append(label);
   const buttons=new Map<'before'|'after',HTMLButtonElement>();
   for(const [key,title] of [['before','修正前'],['after','Blender修正後']] as const){
    const button=document.createElement('button');button.textContent=title;button.style.marginRight='6px';button.setAttribute('aria-pressed',String(key==='after'));
    button.onclick=()=>{comparison.current=key;comparison.before.visible=key==='before';comparison.after.visible=key==='after';for(const [id,b] of buttons)b.setAttribute('aria-pressed',String(id===key));status.textContent=`${title} · カメラと照明は共通`;render();};buttons.set(key,button);panel.append(button);
   }
   host.append(panel);status.textContent='Blender修正後 · カメラと照明は共通';
  }else status.textContent='モデル読込完了 · オフライン表示';
  api.ready=true;preset('overview');
 }
 void loadModels().catch(error=>{status.textContent='モデルを開けませんでした。';console.error(error);});
} catch(error){ status.textContent='3D表示を開始できませんでした。WebGL対応のChromeまたはEdgeで開いてください。'; console.error(error); }
