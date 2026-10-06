import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createPhotoGround } from './Ground';
import { assetURL } from './assets';
import { checkAbort, disposeRealObject, fitTextureBudget, texturePixels, yieldLoading } from './textureBudget';
import type { TextureQuality } from './textureBudget';
import { REAL_CITY_ANCHORS } from './gameSites';
import type { RealCitySiteState } from './gameSites';
import { RealCityMarkers } from './RealCityMarkers';
import { clonePhotoModelForExport, DEFAULT_PHOTO_GAIN, photoGain, setPhotoBrightness, usePhotoAppearance } from './photoAppearance';
export type { TextureQuality, RealCitySiteState };
export interface RealCityProgress { status:'loading'|'ready'|'failed'|'disposed'; quality:TextureQuality; buildingTiles:number; groundTiles:number; generation:number }
export interface RealCityFocus { lotId:string|null; status:'queued'|'focused'|'cleared'|'unknown' }
export interface RealCityOptions {
  textureQuality?:TextureQuality;
  onSelectLot?:(lotId:string)=>void;
  onProgress?:(progress:RealCityProgress)=>void;
  onError?:(error:Error)=>void;
  onFocusChange?:(focus:RealCityFocus)=>void;
}
export interface RealCitySnapshot {
  scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;model:THREE.Group;
  bounds:{min:number[];max:number[]};tiles:number;groundTiles:number;textureQuality:TextureQuality;
  textureStats:{buildings:ReturnType<typeof texturePixels>;ground:ReturnType<typeof texturePixels>};
  cloneModelForExport:()=>THREE.Group;
  dispose:()=>Promise<void>;
}
export interface RealCityController {
  updateSites:(sites:readonly RealCitySiteState[])=>void;
  focusLot:(lotId:string)=>'unknown'|'queued'|'focused';
  overview:()=>void;
  setPreset:(preset:'crossing'|'109'|'overhead')=>void;
  setQuality:(quality:TextureQuality)=>void;
  setExposure:(exposure:number)=>void;
  resize:(width?:number,height?:number)=>void;
  setVisible:(visible:boolean)=>void;
  dispose:()=>Promise<void>;
  getSnapshot:()=>RealCitySnapshot|null;
  getDiagnostics:()=>Readonly<{instanceId:number;status:RealCityProgress['status'];disposed:boolean;renderCount:number;visible:boolean;focusLotId:string|null;queuedFocusLotId:string|null;buildingTiles:number;groundTiles:number;pendingJobs:number;sitePositions:Record<string,number[]>}>;
}
interface Tile { transform?:number[];children?:Tile[];content?:{uri?:string;url?:string} }
interface TileItem { uri:string;transform:THREE.Matrix4 }
let nextInstance=1;
/** No GameState or mutation actions enter this class. Only display site state and clicks. */
export function createRealCityScene(host:HTMLElement,options:RealCityOptions={}):RealCityController {
  const instanceId=nextInstance++;
  // A synchronous WebGL construction failure is caught by the React/standalone owner.
  const renderer=new THREE.WebGLRenderer({antialias:true});
  const rollback:(()=>void)[]=[()=>{renderer.dispose();renderer.domElement.remove();}];
  let initializedDispose:(()=>Promise<void>)|undefined;
  try {
  let brightness=DEFAULT_PHOTO_GAIN;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=brightness;
  host.prepend(renderer.domElement);
  const scene=new THREE.Scene();rollback.push(()=>disposeRealObject(scene));scene.background=new THREE.Color('#dce3e7');
  const camera=new THREE.PerspectiveCamera(43,1,.4,4000);
  const controls=new OrbitControls(camera,renderer.domElement);rollback.push(()=>controls.dispose());controls.enableDamping=true;controls.minDistance=25;controls.maxDistance=2200;controls.maxPolarAngle=Math.PI*.49;
  scene.add(new THREE.HemisphereLight('#ffffff','#a0a6aa',2.4));const sun=new THREE.DirectionalLight('#fff8ed',1.25);sun.position.set(-400,900,300);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2500,2500),new THREE.MeshStandardMaterial({color:'#8c9291',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-14;scene.add(ground);
  const model=new THREE.Group();model.name='Official_PLATEAU_Shibuya_2025';scene.add(model);
  const markers=new RealCityMarkers();scene.add(markers.group);
  const positions=new Map<string,THREE.Vector3>();let sites:readonly RealCitySiteState[]=[];
  let focused:string|null=null,queued:string|null=null;
  let quality:TextureQuality=options.textureQuality??'1024',disposed=false,explicitVisible=true,sized=true;
  let frame=0,renderCount=0,requestedVersion=0,handledVersion=0;
  let activeAbort:AbortController|undefined,pumpTask:Promise<void>|undefined,disposePromise:Promise<void>|undefined;
  let photoGround:THREE.Group|undefined,snapshot:RealCitySnapshot|null=null;
  const progress:RealCityProgress={status:'loading',quality,buildingTiles:0,groundTiles:0,generation:0};
  const draco=new DRACOLoader(new THREE.LoadingManager().setURLModifier(assetURL));rollback.push(()=>draco.dispose());draco.setDecoderPath('./decoders/draco/');draco.setWorkerLimit(2);const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  // loadTile applies CESIUM_RTC in its ECEF→ENU transform exactly once.
  // Acknowledge only this externally handled extension; other warnings remain visible.
  loader.register(()=>({name:'CESIUM_RTC'}));
  const lon=139.7006*Math.PI/180,lat=35.6595*Math.PI/180,altitude=50,n=6378137/Math.sqrt(1-.00669437999014*Math.sin(lat)**2);
  const origin=new THREE.Vector3((n+altitude)*Math.cos(lat)*Math.cos(lon),(n+altitude)*Math.cos(lat)*Math.sin(lon),(n*(1-.00669437999014)+altitude)*Math.sin(lat));
  const east=new THREE.Vector3(-Math.sin(lon),Math.cos(lon),0),up=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)),south=new THREE.Vector3(Math.sin(lat)*Math.cos(lon),Math.sin(lat)*Math.sin(lon),-Math.cos(lat));
  const enu=new THREE.Matrix4().set(east.x,east.y,east.z,-east.dot(origin),up.x,up.y,up.z,-up.dot(origin),south.x,south.y,south.z,-south.dot(origin),0,0,0,1);
  const yToZ=new THREE.Matrix4().makeRotationX(Math.PI/2);
  const visible=()=>!disposed&&explicitVisible&&sized&&document.visibilityState!=='hidden';
  function emitProgress(){if(!disposed)options.onProgress?.({...progress});}
  function requestRender(){if(frame||!visible())return;frame=requestAnimationFrame(()=>{frame=0;if(!visible())return;const moving=controls.update();renderer.render(scene,camera);renderCount++;if(moving)requestRender();});}
  function visibilityChanged(){controls.enabled=visible();if(!visible()){cancelAnimationFrame(frame);frame=0;}else requestRender();}
  function resize(width=host.clientWidth,height=host.clientHeight){if(disposed)return;sized=width>0&&height>0;if(sized){renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}visibilityChanged();}
  function clearFocus(){focused=null;queued=null;if(!disposed)options.onFocusChange?.({lotId:null,status:'cleared'});}
  function setPreset(which:'crossing'|'109'|'overhead'){
    if(disposed)return;clearFocus();
    if(which==='109'){camera.position.set(-90,105,-80);controls.target.set(-170,28,-4);}
    else if(which==='overhead'){camera.position.set(-410,540,460);controls.target.set(0,20,0);}
    else{camera.position.set(0,230,180);controls.target.set(-35,25,-25);}
    controls.update();requestRender();
  }
  function focusLot(lotId:string):'unknown'|'queued'|'focused'{
    if(disposed)return 'unknown';
    if(!sites.some(site=>site.lotId===lotId)||!REAL_CITY_ANCHORS.some(anchor=>anchor.lotId===lotId)){queued=null;focused=null;options.onFocusChange?.({lotId,status:'unknown'});return 'unknown';}
    if(progress.status!=='ready'){queued=lotId;focused=null;options.onFocusChange?.({lotId,status:'queued'});return 'queued';}
    const site=sites.find(site=>site.lotId===lotId)!,position=positions.get(lotId);if(!position){queued=null;focused=null;options.onFocusChange?.({lotId,status:'unknown'});return 'unknown';}
    queued=null;focused=lotId;camera.position.fromArray(site.view.position);controls.target.copy(position);controls.update();requestRender();options.onFocusChange?.({lotId,status:'focused'});return 'focused';
  }
  function updateSites(next:readonly RealCitySiteState[]){
    if(disposed)return;
    // Copy tuple data: external state mutation cannot silently move a rendered marker.
    sites=next.filter(site=>REAL_CITY_ANCHORS.some(anchor=>anchor.lotId===site.lotId)).map(site=>({...site,position:[...site.position],view:{position:[...site.view.position],target:[...site.view.target]}}));
    if((queued&&!sites.some(site=>site.lotId===queued))||(focused&&!sites.some(site=>site.lotId===focused)))clearFocus();
    markers.update(sites,positions);requestRender();
  }
  function leaves(tile:Tile,tiles:TileItem[],parent=new THREE.Matrix4()){
    const transform=parent.clone();if(tile.transform)transform.multiply(new THREE.Matrix4().fromArray(tile.transform));
    if(tile.children?.length)for(const child of tile.children)leaves(child,tiles,transform);
    else if(tile.content){const uri=tile.content.uri??tile.content.url;if(uri)tiles.push({uri,transform});}
  }
  function locateSites(root:THREE.Object3D,tileUri:string,batch:{gml_id?:string[]}){
    for(const anchor of REAL_CITY_ANCHORS.filter(candidate=>candidate.tileUri===tileUri)){
      if(batch.gml_id?.[anchor.batchId]!==anchor.gmlId)continue;
      const bounds=new THREE.Box3(),vertex=new THREE.Vector3();
      root.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const p=object.geometry.getAttribute('position'),ids=object.geometry.getAttribute('_batchid')??object.geometry.getAttribute('_BATCHID');if(!p||!ids)return;
        for(let i=0;i<p.count;i++)if(ids.getX(i)===anchor.batchId)bounds.expandByPoint(vertex.fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld));
      });
      if(bounds.isEmpty())continue;
      const point=bounds.getCenter(new THREE.Vector3());point.y=bounds.max.y+6;
      // Guard dataset drift: static metadata and decoded source must still agree.
      if(point.distanceTo(new THREE.Vector3().fromArray(anchor.markerPosition))>.1)continue;
      positions.set(anchor.lotId,point);
    }
  }
  async function loadTile(item:TileItem,selectedQuality:TextureQuality,signal:AbortSignal){
    const response=await fetch(assetURL(`./models/real-shibuya/${item.uri}`),{signal});if(!response.ok)throw new Error(`${item.uri}: HTTP ${response.status}`);
    const bytes=await response.arrayBuffer(),header=new DataView(bytes);
    if(header.getUint32(0,true)!==0x6d643362)throw new Error('Unsupported tile: expected b3dm');
    const ftJSON=header.getUint32(12,true),ftBIN=header.getUint32(16,true),btJSON=header.getUint32(20,true),btBIN=header.getUint32(24,true),offset=28+ftJSON+ftBIN+btJSON+btBIN;
    const glb=bytes.slice(offset),glbView=new DataView(glb),jsonLength=glbView.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(glb,20,jsonLength)));
    const feature=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,28,ftJSON)).trim()||'{}');
    const batch=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,28+ftJSON+ftBIN,btJSON)).trim()||'{}');
    const center=json.extensions?.CESIUM_RTC?.center??feature.RTC_CENTER??[0,0,0];checkAbort(signal);
    const gltf=await loader.parseAsync(glb,'');
    try{
      checkAbort(signal);await fitTextureBudget(gltf.scene,selectedQuality,signal);
      if(texturePixels(gltf.scene).images!==json.images.length)throw new Error(`${item.uri}: 建物写真を完全に読み込めませんでした`);
      const transform=enu.clone().multiply(item.transform).multiply(new THREE.Matrix4().makeTranslation(...center as [number,number,number])).multiply(yToZ);
      usePhotoAppearance(gltf.scene,brightness);
      gltf.scene.applyMatrix4(transform);gltf.scene.updateMatrixWorld(true);checkAbort(signal);
      locateSites(gltf.scene,item.uri,batch);model.add(gltf.scene);requestRender();
    }catch(error){disposeRealObject(gltf.scene);throw error;}
  }
  function resetContent(){
    disposeRealObject(model);if(photoGround){scene.remove(photoGround);disposeRealObject(photoGround);photoGround=undefined;}
    positions.clear();markers.update([],positions);markers.group.visible=false;snapshot=null;ground.visible=true;ground.position.y=-14;
  }
  async function loadGeneration(version:number,selectedQuality:TextureQuality,signal:AbortSignal){
    resetContent();Object.assign(progress,{status:'loading',quality:selectedQuality,buildingTiles:0,groundTiles:0,generation:version});emitProgress();requestRender();
    const response=await fetch(assetURL('./models/real-shibuya/tileset.json'),{signal});if(!response.ok)throw new Error(`tileset HTTP ${response.status}`);
    const data=await response.json();checkAbort(signal);const tiles:TileItem[]=[];leaves(data.root,tiles);
    for(const tile of tiles){await loadTile(tile,selectedQuality,signal);checkAbort(signal);progress.buildingTiles++;emitProgress();await yieldLoading(signal);}
    const bounds=new THREE.Box3().setFromObject(model,true);ground.position.y=bounds.min.y-.2;
    const loadedGround=await createPhotoGround([139.7006,35.6595],()=>{if(disposed)return;progress.groundTiles++;emitProgress();},signal);
    if(signal.aborted||disposed){disposeRealObject(loadedGround);checkAbort(signal);return;}
    photoGround=loadedGround;photoGround.position.y=ground.position.y+.015;scene.add(photoGround);ground.visible=false;
    markers.update(sites,positions);markers.group.visible=true;
    progress.status='ready';snapshot={scene,camera,renderer,model,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},tiles:tiles.length,groundTiles:photoGround.userData.tileCount,textureQuality:selectedQuality,textureStats:{buildings:texturePixels(model),ground:texturePixels(photoGround)},cloneModelForExport:()=>clonePhotoModelForExport(model),dispose};
    if(queued){const requested=queued;queued=null;focusLot(requested);}emitProgress();requestRender();
  }
  async function pump(){
    while(!disposed&&handledVersion!==requestedVersion){
      const version=requestedVersion,selectedQuality=quality;handledVersion=version;
      const abort=new AbortController();activeAbort=abort;
      try{await loadGeneration(version,selectedQuality,abort.signal);}
      catch(error){if(disposed||abort.signal.aborted)continue;resetContent();progress.status='failed';emitProgress();options.onError?.(error instanceof Error?error:new Error(String(error)));requestRender();}
    }
  }
  function startLoad(){
    if(disposed)return;requestedVersion++;activeAbort?.abort();snapshot=null;progress.status='loading';emitProgress();
    if(!pumpTask){const task=pump();pumpTask=task;void task.finally(()=>{if(pumpTask===task)pumpTask=undefined;});}
  }
  function setQuality(next:TextureQuality){if(disposed)return;if(next===quality&&progress.status==='ready')return;quality=next;startLoad();}
  const raycaster=new THREE.Raycaster();let down:[number,number]|null=null;
  function pointerDown(event:PointerEvent){down=[event.clientX,event.clientY];}
  function pointerUp(event:PointerEvent){
    const start=down;down=null;if(!start||!visible()||progress.status!=='ready'||Math.hypot(event.clientX-start[0],event.clientY-start[1])>6)return;
    const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    const hit=raycaster.intersectObject(markers.group,true)[0];if(!hit)return;
    // Text is a game UI annotation; only the physical pin obeys building occlusion.
    if(!(hit.object instanceof THREE.Sprite)){const occluder=raycaster.intersectObject(model,true)[0];if(occluder&&occluder.distance<hit.distance-.1)return;}
    const id=hit.object.userData.lotId;if(typeof id==='string')options.onSelectLot?.(id);
  }
  function pointerCancel(){down=null;}
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerCancel);
  controls.addEventListener('change',requestRender);document.addEventListener('visibilitychange',visibilityChanged);
  function dispose():Promise<void>{
    if(disposePromise)return disposePromise;
    disposed=true;activeAbort?.abort();queued=null;focused=null;cancelAnimationFrame(frame);frame=0;progress.status='disposed';snapshot=null;
    document.removeEventListener('visibilitychange',visibilityChanged);controls.removeEventListener('change',requestRender);controls.dispose();
    renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',pointerCancel);
    resetContent();markers.dispose();disposeRealObject(scene);renderer.dispose();renderer.domElement.remove();
    disposePromise=(pumpTask??Promise.resolve()).catch(()=>undefined).then(()=>{draco.dispose();});return disposePromise;
  }
  initializedDispose=dispose;
  setPreset('crossing');resize();startLoad();
  return {updateSites,focusLot,overview:()=>setPreset('overhead'),setPreset,setQuality,
    // The fallback PBR ground still uses renderer exposure while loading. Once
    // ready, building photos use linear material gain; aerial ground and labels do not.
    setExposure:(value)=>{if(disposed||!Number.isFinite(value))return;brightness=photoGain(value);renderer.toneMappingExposure=brightness;setPhotoBrightness(model,brightness);requestRender();},resize,
    setVisible:(value)=>{explicitVisible=value;visibilityChanged();},dispose,getSnapshot:()=>snapshot,
    getDiagnostics:()=>({instanceId,status:progress.status,disposed,renderCount,visible:visible(),focusLotId:focused,queuedFocusLotId:queued,buildingTiles:progress.buildingTiles,groundTiles:progress.groundTiles,pendingJobs:pumpTask?1:0,sitePositions:Object.fromEntries([...positions].map(([id,point])=>[id,point.toArray()]))})};
  }catch(error){
    if(initializedDispose)void initializedDispose();else for(const release of rollback.reverse())release();
    throw error;
  }
}
