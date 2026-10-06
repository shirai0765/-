import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import './realcity.css';
import { createPhotoGround } from './Ground';
import { assetURL } from './assets';
import { checkAbort, disposeRealObject, fitTextureBudget, parseTextureQuality, texturePixels, yieldLoading } from './textureBudget';
import type { TextureQuality } from './textureBudget';

const host=document.querySelector<HTMLElement>('#real-city')!;
host.innerHTML=`<div class="heading"><span>PROJECT PLATEAU / TOKYO</span><h1>実際の渋谷を、3Dで。</h1><p>航空写真等に基づく建物テクスチャ・LOD2 / 2025年度公開データ</p></div><nav aria-label="視点"><a class="back" href="./index.html">ゲームへ戻る</a><button data-view="crossing">交差点周辺</button><button data-view="109">109周辺</button><button data-view="overhead">街区全体</button><label class="brightness">建物の明るさ <input id="brightness" aria-label="建物の明るさ" type="range" min="1" max="1.8" step="0.05" value="1.15"/></label><label class="texture-quality">建物写真の精細さ <select id="texture-quality" aria-label="建物写真の精細さ" aria-describedby="texture-help"><option value="1024">軽量・1024</option><option value="2048">高精細・2048</option><option value="original">原寸</option></select></label><small id="texture-help"></small></nav><div class="loading-panel"><div id="loading" role="status">実際の建物データを読み込み中…</div><button id="retry" hidden>再読み込み</button></div><footer>出典：東京都・国土交通省 Project PLATEAU「建築物モデル（渋谷区）」2025 / 実測データを部分抽出・座標変換<br>地表：地理院タイル（シームレス空中写真）。平面近似のため高低差は未再現。写真の撮影時期は場所により異なります。ドラッグで回転・ホイールで拡大。<br><a href="https://www.mlit.go.jp/plateau/opendata/" target="_blank" rel="noreferrer">公式データ案内</a> · <a href="https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto" target="_blank" rel="noreferrer">地理院タイル</a> · <a href="./models/real-shibuya/manifest.json" target="_blank">取得記録</a></footer>`;
const manifestLink=host.querySelector<HTMLAnchorElement>('a[href="./models/real-shibuya/manifest.json"]');if(manifestLink)manifestLink.href=assetURL('./models/real-shibuya/manifest.json');
const status=document.querySelector<HTMLElement>('#loading')!;
const qualitySelect=document.querySelector<HTMLSelectElement>('#texture-quality')!;
const retry=document.querySelector<HTMLButtonElement>('#retry')!;
let quality:TextureQuality=parseTextureQuality(new URL(location.href).searchParams.get('texture'));
qualitySelect.value=quality;
function describeQuality(){document.querySelector<HTMLElement>('#texture-help')!.textContent=quality==='original'?'原寸は建物画像だけで約1GiBを使用（ミップマップ等は別）。読み込みには時間がかかります。':`建物の形・範囲は同じです。写真を縮小してメモリを抑えます（建物画像 約${quality==='1024'?'76':'304'}MiB、ミップマップ等は別）。`;}
describeQuality();
let disposed=false,frame=0,requestedVersion=0,handledVersion=0,running=false;
let activeAbort:AbortController|undefined;
let photoGround:THREE.Group|undefined;
const debug=window as unknown as Record<string,unknown>;
const progress={status:'loading',quality,buildingTiles:0,groundTiles:0,generation:0};
debug.__realCityProgress=progress;

const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.15;host.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce3e7');
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.4,4000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=25;controls.maxDistance=2200;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight('#ffffff','#a0a6aa',2.4));const sun=new THREE.DirectionalLight('#fff8ed',1.25);sun.position.set(-400,900,300);scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(2500,2500),new THREE.MeshStandardMaterial({color:'#8c9291',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-14;scene.add(ground);
const lon=139.7006*Math.PI/180,lat=35.6595*Math.PI/180,altitude=50;
const n=6378137/Math.sqrt(1-.00669437999014*Math.sin(lat)**2);
const origin=new THREE.Vector3((n+altitude)*Math.cos(lat)*Math.cos(lon),(n+altitude)*Math.cos(lat)*Math.sin(lon),(n*(1-.00669437999014)+altitude)*Math.sin(lat));
const east=new THREE.Vector3(-Math.sin(lon),Math.cos(lon),0),up=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)),south=new THREE.Vector3(Math.sin(lat)*Math.cos(lon),Math.sin(lat)*Math.sin(lon),-Math.cos(lat));
const enu=new THREE.Matrix4().set(east.x,east.y,east.z,-east.dot(origin),up.x,up.y,up.z,-up.dot(origin),south.x,south.y,south.z,-south.dot(origin),0,0,0,1);
const yToZ=new THREE.Matrix4().makeRotationX(Math.PI/2);
const draco=new DRACOLoader(new THREE.LoadingManager().setURLModifier(assetURL));draco.setDecoderPath('./decoders/draco/');draco.setWorkerLimit(2);const loader=new GLTFLoader();loader.setDRACOLoader(draco);
interface Tile { transform?:number[];children?:Tile[];content?:{uri?:string;url?:string};refine?:string }
type TileItem={uri:string;transform:THREE.Matrix4};
function leaves(tile:Tile,tiles:TileItem[],parent=new THREE.Matrix4()) {const transform=parent.clone();if(tile.transform)transform.multiply(new THREE.Matrix4().fromArray(tile.transform));if(tile.children?.length){for(const child of tile.children)leaves(child,tiles,transform);}else if(tile.content){const uri=tile.content.uri??tile.content.url;if(uri)tiles.push({uri,transform});}}
const model=new THREE.Group();model.name='Official_PLATEAU_Shibuya_2025';scene.add(model);
function view(which:string){if(which==='109'){camera.position.set(-90,105,-80);controls.target.set(-170,28,-4);}else if(which==='overhead'){camera.position.set(-410,540,460);controls.target.set(0,20,0);}else{camera.position.set(0,230,180);controls.target.set(-35,25,-25);}controls.update();}
document.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach(button=>button.onclick=()=>view(button.dataset.view!));view('crossing');
async function loadTile(item:TileItem,selectedQuality:TextureQuality,signal:AbortSignal) {
  const response=await fetch(assetURL(`./models/real-shibuya/${item.uri}`),{signal});if(!response.ok)throw new Error(`${item.uri}: HTTP ${response.status}`);
  const bytes=await response.arrayBuffer(),header=new DataView(bytes);
  if(header.getUint32(0,true)!==0x6d643362)throw new Error('Unsupported tile: expected b3dm');
  const ftJSON=header.getUint32(12,true),ftBIN=header.getUint32(16,true),btJSON=header.getUint32(20,true),btBIN=header.getUint32(24,true),offset=28+ftJSON+ftBIN+btJSON+btBIN;
  const glb=bytes.slice(offset),glbView=new DataView(glb),jsonLength=glbView.getUint32(12,true);
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(glb,20,jsonLength)));
  const rtc=json.extensions?.CESIUM_RTC?.center as number[]|undefined;
  const featureTable=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,28,ftJSON)).trim()||'{}');
  const center=rtc??featureTable.RTC_CENTER??[0,0,0];
  checkAbort(signal);
  const gltf=await loader.parseAsync(glb,'');
  try {
  checkAbort(signal);
  await fitTextureBudget(gltf.scene,selectedQuality,signal);
  if(texturePixels(gltf.scene).images!==json.images.length)throw new Error(`${item.uri}: 建物写真を完全に読み込めませんでした`);
  // GLTF Y-up -> 3D Tiles Z-up, then ECEF RTC/ancestor transforms, then local ENU.
  const transform=enu.clone().multiply(item.transform).multiply(new THREE.Matrix4().makeTranslation(...center as [number,number,number])).multiply(yToZ);
  // Photo atlases already contain surface shading; source metallic=.5 would make them unnaturally dark without a matching captured environment.
  gltf.scene.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshStandardMaterial){material.metalness=0;material.roughness=1;}});
  gltf.scene.applyMatrix4(transform);gltf.scene.updateMatrixWorld(true);checkAbort(signal);model.add(gltf.scene);requestRender();
  } catch(error) {disposeRealObject(gltf.scene);throw error;}
}
function resetContent(){
  disposeRealObject(model);
  if(photoGround){scene.remove(photoGround);disposeRealObject(photoGround);photoGround=undefined;}
  ground.visible=true;ground.position.y=-14;
  delete debug.__realCity;
}
async function loadGeneration(version:number,selectedQuality:TextureQuality,signal:AbortSignal){
  resetContent();
  Object.assign(progress,{status:'loading',quality:selectedQuality,buildingTiles:0,groundTiles:0,generation:version});
  status.classList.remove('loaded');retry.hidden=true;status.textContent='実際の建物データを読み込み中…';requestRender();
  const response=await fetch(assetURL('./models/real-shibuya/tileset.json'),{signal});
  if(!response.ok)throw new Error(`tileset HTTP ${response.status}`);
  const tileset=await response.json();checkAbort(signal);
  const tiles:TileItem[]=[];leaves(tileset.root,tiles);
  // One detached tile is decoded and resized before any texture can reach the GPU.
  for(const item of tiles){
    await loadTile(item,selectedQuality,signal);checkAbort(signal);
    progress.buildingTiles++;status.textContent=`実際の建物データ ${progress.buildingTiles} / ${tiles.length}`;
    await yieldLoading(signal);
  }
  const bounds=new THREE.Box3().setFromObject(model,true);ground.position.y=bounds.min.y-.2;requestRender();
  status.textContent='実際の街路写真を読み込み中…';
  const loadedGround=await createPhotoGround([139.7006,35.6595],()=>{progress.groundTiles++;status.textContent=`実際の街路写真 ${progress.groundTiles} / 72`;},signal);
  if(signal.aborted||disposed){disposeRealObject(loadedGround);checkAbort(signal);return;}
  photoGround=loadedGround;photoGround.position.y=ground.position.y+.015;scene.add(photoGround);ground.visible=false;
  progress.status='ready';status.textContent=`実測の建物データを表示中 · ${tiles.length} タイル`;status.classList.add('loaded');
  debug.__realCity={scene,camera,renderer,model,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},tiles:tiles.length,groundTiles:photoGround.userData.tileCount,textureQuality:selectedQuality,textureStats:{buildings:texturePixels(model),ground:texturePixels(photoGround)},dispose};
  requestRender();
}
/** A newer selection cancels fetches, but waits for in-flight Draco/image decode to settle.
 * There is never a second generation decoding concurrently or retaining a second full scene. */
async function pump(){
  if(running||disposed)return;running=true;
  try{
    while(!disposed&&handledVersion!==requestedVersion){
      const version=requestedVersion,selectedQuality=quality;handledVersion=version;
      const abort=new AbortController();activeAbort=abort;
      try{await loadGeneration(version,selectedQuality,abort.signal);}
      catch(error){
        if(disposed||abort.signal.aborted)continue;
        resetContent();progress.status='failed';
        status.textContent=`読み込みに失敗しました：${error instanceof Error?error.message:String(error)}`;
        retry.hidden=false;requestRender();
      }
    }
  }finally{running=false;if(disposed)draco.dispose();}
}
function requestLoad(next:TextureQuality){
  if(disposed)return;
  quality=next;qualitySelect.value=next;describeQuality();requestedVersion++;
  activeAbort?.abort();delete debug.__realCity;progress.status='switching';retry.hidden=true;
  status.textContent='表示の切り替えを準備中…';void pump();
}
qualitySelect.onchange=()=>{
  const next=parseTextureQuality(qualitySelect.value),url=new URL(location.href);url.searchParams.set('texture',next);
  history.replaceState(null,'',url);requestLoad(next);
};
retry.onclick=()=>requestLoad(quality);
function resize(){if(disposed)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);requestRender();}
addEventListener('resize',resize);
function requestRender(){if(frame||disposed)return;frame=requestAnimationFrame(()=>{frame=0;if(disposed)return;const moving=controls.update();renderer.render(scene,camera);if(moving)requestRender();});}
controls.addEventListener('change',requestRender);
document.querySelector<HTMLInputElement>('#brightness')!.oninput=event=>{if(disposed)return;renderer.toneMappingExposure=Number((event.target as HTMLInputElement).value);requestRender();};
function dispose(){
  if(disposed)return;disposed=true;activeAbort?.abort();cancelAnimationFrame(frame);frame=0;
  removeEventListener('resize',resize);controls.removeEventListener('change',requestRender);controls.dispose();
  resetContent();disposeRealObject(scene);renderer.dispose();renderer.domElement.remove();
  progress.status='disposed';if(!running)draco.dispose();
}
addEventListener('pagehide',dispose);
// A bfcache restoration must recreate the disposed WebGL resources, preserving the URL quality.
addEventListener('pageshow',event=>{if(event.persisted&&disposed)location.reload();});
requestLoad(quality);
