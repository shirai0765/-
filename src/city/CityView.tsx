import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DistrictId, GameState, Lot, QualityLevel, StoreStyle } from '../model';
import { LOTS, ROADS, LANDMARKS } from '../data/district';
import { CityArt, disposeScene, compactRigidGroup, createDaylightEnvironment } from './art';
import { createMediaRetail } from './landmarks/MediaRetail';
import { create109 } from './landmarks/Building109';
import { createSkyTower } from './landmarks/SkyTower';
import { createStation } from './landmarks/Station';
import { createMiyashita } from './landmarks/Miyashita';
import './city.css';
import { CityGrowth } from './growth';
import { DevelopmentVisuals } from './DevelopmentVisuals';
import { RailProjectVisuals, RAIL_PROJECT_VIEWPOINTS } from './RailProjectVisuals';
import { getStoreViewpoint } from './storeViewpoints';
import { CITY_DISPLAY_LOTS } from './displayLayout';
import { LoadedAssetPool, AUTHORED_ASSETS } from './loadedAsset';
import { scheduleScene } from './sceneLifecycle';
import { PointerSelectionGesture } from './pointerSelection';
import { GameSiteMarkers } from './GameSiteMarkers';
import { StoreActivityVisuals } from './StoreActivityVisuals';
import { configureCameraInteraction, restoreOverviewDirection, type CameraMode } from './cameraInteraction';
import { observeModalPause } from './modalPause';
import { ActiveAnimationClock } from './animationClock';

interface Props { cameraMode?:CameraMode; overviewRequestId?:number; storeFocusRequestId?:number; state:GameState; selectedLotId:string|null; onSelectLot:(id:string)=>void; quality:QualityLevel; viewMode?:'normal'|'demand'|'ownership'; focusLotId?:string|null; focusRailDistrict?:DistrictId|null; focusStoreLotId?:string|null }
interface Runtime { storeActivity:StoreActivityVisuals; siteMarkers:GameSiteMarkers; storeFrame?:{lot:Lot;style:StoreStyle}; railProjectVisuals:RailProjectVisuals; staticTerraces:Map<string,THREE.Group>; developmentVisuals:DevelopmentVisuals; originalFronts:Map<string,THREE.Group>; growth:CityGrowth; selection:THREE.Mesh; hover:THREE.Mesh; accents:Map<string,THREE.Group>; overlays:Map<string,THREE.Mesh>; controls:OrbitControls; camera:THREE.PerspectiveCamera; focus?:THREE.Vector3 }
declare global { interface Window { __cityScene?:THREE.Scene; __cityCamera?:THREE.PerspectiveCamera; __cityRenderer?:THREE.WebGLRenderer } }
const GOLD='#e9c276';
const SHOPS=[['星珈琲','HOSHI COFFEE'],['渋谷書房','BOOKS & CULTURE'],['麺屋 八十八','NOODLES • SHIBUYA'],['茶の庭','TEA & BOTANICAL'],['喫茶 月','KISSA TSUKI'],['TOKYO RECORDS','MUSIC FOR THE CITY'],['花と暮らし','FLOWERS & LIVING']];

function makeBuilding(art:CityArt,lot:Lot,index:number,pickables:THREE.Object3D[]) {
  const {x,z,width:w,depth:d,height:h}=lot; const r=lot.rotation??0;
  const local=(lx:number,lz:number)=>[x+lx*Math.cos(r)+lz*Math.sin(r),z-lx*Math.sin(r)+lz*Math.cos(r)];
  const hasCafeRecess=lot.available&&lot.id!=='center-03';
  const originalFront=new THREE.Group();originalFront.name=`original_storefront_${lot.id}`;originalFront.userData.storefrontLotId=lot.id;
  let writingFront=false;
  const detail=(lx:number,y:number,lz:number,bw:number,bh:number,bd:number,color:string)=>{const [xx,zz]=local(lx,lz);if(hasCafeRecess&&writingFront)art.box(xx,y,zz,bw,bh,bd,color,r,originalFront);else art.batch(xx,y,zz,bw,bh,bd,color,r);};
  art.batch(x,hasCafeRecess?.04:.35,z,w+2,hasCafeRecess?.08:.7,d+2,'#d1d2cc',r);
  const archetype=index%5;
  const facade=['#b5afa4','#414b50','#a79883','#90999c','#b3b0a7'][archetype];
  const body=art.box(x,h/2+.7,z,w,h,d,facade,r);body.userData.lotId=lot.id;if(lot.available)pickables.push(body);
  if(hasCafeRecess){
    // Full invisible envelope remains the pointer target; the visible shell leaves a real retail room.
    body.visible=false;body.castShadow=false;
    detail(0,(h+.7+4.1)/2,0,w,h+.7-4.1,d,facade);
    detail(0,2.05,-1.6,w,4.1,d-3.2,facade);
    for(const side of [-1,1])detail(side*(w/2-.16),2.05,d/2-1.6,.32,4.1,3.2,facade);
  }
  if(lot.id==='center-03'){
    body.visible=false;body.castShadow=false;
    const media=createMediaRetail(w,d,h);media.position.set(x,.7,z);media.rotation.y=r;art.group.add(media);
  } else {
  // Street references show mostly neutral silver/grey glazing, with strong opaque spandrels.
  const glass=['#637477','#374d55','#586965','#718183','#485e65'][archetype];
  const floors=Math.max(1,Math.floor((h-4)/3.8));
  for(let floor=0;floor<floors;floor++) {
    const y=6+floor*3.8;
    if(y>h-.8)continue;
    if(archetype===1 || archetype===3) {
      // Broad curtain walls and ribbon windows contrast with small masonry openings.
      detail(0,y,d/2+.07,w-.7,archetype===1?3.5:2.25,.16,glass);
      detail(0,y,-d/2-.07,w-.7,archetype===1?3.5:2.25,.16,glass);
      detail(w/2+.07,y,0,.16,archetype===1?3.5:2.25,d-.7,glass);
      detail(-w/2-.07,y,0,.16,archetype===1?3.5:2.25,d-.7,glass);
      for(let xx=-w/2+1;xx<w/2;xx+=2.7){detail(xx,y,d/2+.19,.1,3.65,.12,'#8d9b9f');detail(xx,y,-d/2-.19,.1,3.65,.12,'#8d9b9f');}
      detail(0,y+1.8,d/2+.16,w,.13,.15,'#8d9b9f');
      for(let zz=-d/2+1;zz<d/2;zz+=2.7){detail(-w/2-.19,y,zz,.12,3.65,.1,'#8d9b9f');detail(w/2+.19,y,zz,.12,3.65,.1,'#8d9b9f');}
    } else {
      const spacing=archetype===2?4.1:3.2;
      for(let col=0;col<Math.floor(w/spacing);col++) {
        const lx=-w/2+2+col*spacing; const color=(floor+col+index)%11===0?'#bbad8d':glass;
        detail(lx,y,d/2+.055,archetype===2?1.55:2.15,2.35,.13,color);detail(lx,y,-d/2-.055,2.05,2.35,.13,color);
      }
      for(let col=0;col<Math.floor(d/3.2);col++) {
        const lz=-d/2+2+col*3.2;
        detail(w/2+.055,y,lz,.13,2.25,2.05,glass);detail(-w/2-.055,y,lz,.13,2.25,2.05,glass);
      }
      if(archetype===4){detail(0,y-1.5,d/2+.3,w,.32,.7,'#f4f2eb');detail(0,y-1.5,-d/2-.3,w,.32,.7,'#f4f2eb');}
    }
  }
  // Exposed party walls have narrow service windows, panel joints and condenser racks.
  if(index%3===1)for(let y=6;y<h-1;y+=3.8){
    detail(-w/2-.14,y,-d*.3,.2,1.7,1.1,'#a7aeaa');
    detail(-w/2-.27,y,-d*.3,.13,1.35,.78,'#485e65');
    detail(w/2+.48,y-.6,-d*.25,.8,.65,1.3,'#a0a59c');
    detail(w/2+.91,y-.6,-d*.25,.04,.45,.95,'#64716f');
  }
  if(archetype===2||archetype===4)for(let y=4.5;y<h;y+=1.8)detail(0,y,d/2+.075,w,.035,.035,'#8e8b80');
  if(archetype===2){for(let xx=-w/2+.5;xx<w/2;xx+=4.1)detail(xx,hasCafeRecess?(h+4.15)/2:h/2+2,d/2+.15,.4,hasCafeRecess?h-4.15:h-3,.35,'#d2c6b3');}

  detail(0,h+1,0,w+.7,.6,d+.7,'#e9e9e3');
  detail(0,h+1.35,0,w-1,.25,d-1,'#aeb3b5');
  detail(-w*.22,h+2.4,-d*.15,Math.min(4+(index%3),w*.4),2+(index%2)*1.2,3,'#919b99');
  if(index%4===1){detail(w*.12,h+2.5,-d*.14,w*.45,3.1,d*.5,facade);detail(w*.12,h+4.1,-d*.14,w*.47,.22,d*.52,'#777f7d');}
  if(index%3===2)for(let k=0;k<3;k++){detail(-w*.3+k*2.1,h+1.9,d*.25,1.55,.9,2.2,'#969e9b');for(let slat=0;slat<4;slat++)detail(-w*.3+k*2.1,h+2.38,d*.25-.7+slat*.4,1.3,.04,.09,'#515e62');}
  detail(w*.24,h+1.85,d*.23,2,1.2,2,'#e4e1d4');
  detail(w*.24,h+2.5,d*.23,1.5,.15,1.5,'#7c8783');
  // Parapets, service pipes and balcony rails remain readable at street scale.
  detail(-w/2+.25,h+1.7,0,.25,1,d,'#b5b3a5');detail(w/2-.25,h+1.7,0,.25,1,d,'#b5b3a5');
  detail(w/2+.18,h/2,-d*.32,.16,h,.16,'#aaa997');
  if(lot.type==='residential')for(let y=6;y<h-1;y+=4.4){detail(0,y-1.1,d/2+.65,w-.8,.2,1.6,'#bdbbaa');detail(0,y-.55,d/2+1.4,w-.8,.13,.13,'#697974');for(let xx=-w/2+1;xx<w/2;xx+=1.4)detail(xx,y-.8,d/2+1.4,.08,.7,.08,'#697974');}
  // Movable frontage is hidden when an owned cafe occupies the actual ground-floor recess.
  writingFront=true;
  // A glazed ground floor with separate frames, a projecting canopy, and shop signage.
  detail(0,2.2,d/2+.12,w-1,3,.18,'#405e63');
  for(let i=0;i<Math.floor(w/3);i++)detail(-w/2+1+i*3,2.2,d/2+.25,.12,3.1,.2,'#d2c9b4');
  detail(0,4.15,d/2+.75,w+.3,.23,1.8,index%3===0?'#176246':index%3===1?'#b82426':'#f2e7cc');
  const shop=SHOPS[index%SHOPS.length];
  const sign=art.sign(shop[0],shop[1],index%3===0?'#14563c':'#fff9e9',index%3===0?'#ffffff':'#263940',Math.min(w-1,14),2.5);
  const [sx,sz]=local(0,d/2+.3);sign.position.set(sx,5,sz);sign.rotation.y=r;(hasCafeRecess?originalFront:art.group).add(sign);
  writingFront=false;
  if(index%7===0)for(let tenant=0;tenant<Math.min(4,Math.floor(h/4));tenant++){const plaque=art.sign(['歯科','美容室','音楽室','食堂'][tenant],`${tenant+2}F`,['#ece7dc','#ddd5b9','#445f75','#964b40'][tenant],tenant<2?'#39484a':'#ffffff',2.2,1.55);const [px,pz]=local(w/2-.8,d/2+.45);plaque.position.set(px,6+tenant*1.8,pz);plaque.rotation.y=r;art.group.add(plaque);}
  if(index%4===0) {const [tx,tz]=local(w/2+2,d/2-2);art.tree(tx,tz,.7);}
  writingFront=true;
  if(index%5===0){detail(-w/2+1,1.6,d/2+.8,1.3,2,.8,'#d9dacc');detail(-w/2+1,1.9,d/2+1.22,.95,.9,.03,'#7b9c9d');detail(-w/2+1,1.1,d/2+1.22,.9,.22,.03,'#4d5c55');}
  writingFront=false;
  // Commercial blocks carry the dense, saturated tenant signs of central Tokyo.
  // Shared canvas materials keep repeated lettering to a handful of draw calls.
  if(index%9===0 || (Math.abs(x)<55 && Math.abs(z)<65 && index%3===0)) {
    const campaigns=[['渋谷音楽','SHIBUYA MUSIC','#e42632'],['TOKYO','CITY CULTURE  /  2026','#0855b6'],['珈琲と、東京。','FRESHLY ROASTED EVERY DAY','#cf3424'],['本と暮らす','BOOKS · RECORDS · COFFEE','#e6b817']];
    const campaign=campaigns[index%4];
    const bw=Math.min(w*.82,15), bh=Math.min(9,h*.3), by=Math.max(9,h*.65);
    detail(0,by,d/2+.3,bw+.4,bh+.4,.45,'#eceded');
    const board=art.sign(campaign[0],campaign[1],campaign[2],'#ffffff',bw,bh);
    const [bx,bz]=local(0,d/2+.56);board.position.set(bx,by,bz);board.rotation.y=r;art.group.add(board);
    if(index%2===0){
      const blade=art.sign(index%4===0?'カラオケ':'珈琲',index%4===0?'24 HOURS':'COFFEE',index%4===0?'#0855b6':'#d32630','#ffffff',3.2,Math.min(12,h*.48));
      const [bx,bz]=local(-w/2-.25,d*.15);blade.position.set(bx,Math.max(9,h*.48),bz);blade.rotation.y=r-Math.PI/2;art.group.add(blade);
    }
  }
  writingFront=true;
  // Timber entrances, red vending machines and blackboard menus anchor the cafe scale.
  if(lot.available || index%4===0){
    detail(-w*.28,1.8,d/2+.26,2.3,3,.25,'#9f6d43');
    detail(-w*.28,2,d/2+.41,1.65,2.3,.08,'#234557');
    detail(w*.31,.75,d/2+1.6,1.05,1.5,.18,'#26383a');
    detail(w*.31,1.05,d/2+1.71,.72,.07,.03,'#f4f2eb');
    detail(w*.31,.79,d/2+1.71,.72,.05,.03,'#f4f2eb');
    detail(w*.31,.55,d/2+1.71,.55,.05,.03,'#f4f2eb');
    detail(-w*.39,.4,d/2+1.1,1.2,.8,1,'#a06b48');
    detail(-w*.39,1,d/2+1.1,1.25,.8,1.05,'#38823f');
  }
  }
  if(hasCafeRecess){compactRigidGroup(originalFront);art.group.add(originalFront);}
  const accent=new THREE.Group();accent.visible=false;
  const crown=art.box(x,h+1.7,z,w+.9,.5,d+.9,GOLD,r,accent);crown.castShadow=false;
  // Development adds visible rooftop pavilions and terraces, one per purchased level.
  for(let level=2;level<=5;level++){
    const pavilion=new THREE.Group();pavilion.userData.propertyLevel=level;
    const y=h+2+(level-2)*3.1;
    art.box(x,y+1.3,z,w*.7,2.6,d*.64,'#e9e9e3',r,pavilion);
    art.box(x,y+2.7,z,w*.74,.22,d*.68,'#176246',r,pavilion);
    const [gx,gz]=local(0,d*.325);const pane=art.box(gx,y+1.2,gz,w*.59,1.65,.1,'#21516e',r,pavilion);pane.castShadow=false;
    pavilion.visible=false;accent.add(pavilion);
  }
  art.group.add(accent);return accent;
}

function makeLandmarks(art:CityArt,assets:LoadedAssetPool) {
  for(const lm of LANDMARKS) {
    if(lm.kind==='crossing')continue;
    const x=lm.x,z=lm.z;
    if(lm.kind==='mall') {
      const group=assets.mount(AUTHORED_ASSETS.departmentStore,create109()).group;group.position.set(x,0,z);art.group.add(group);
    } else if(lm.kind==='tower') {
      const group=createSkyTower();group.position.set(x,0,z);art.group.add(group);
    } else if(lm.kind==='station') {
      const group=createStation();group.position.set(x,0,z);art.group.add(group);
    } else if(lm.kind==='park') {
      const group=createMiyashita();group.position.set(x,0,z);art.group.add(group);
    }
  }
}

export default function CityView({state,selectedLotId,onSelectLot,quality,viewMode='normal',focusLotId,focusRailDistrict,focusStoreLotId,cameraMode='manage',overviewRequestId=0,storeFocusRequestId=0}:Props) {
  const cameraModeRef=useRef(cameraMode);cameraModeRef.current=cameraMode;
  const host=useRef<HTMLDivElement>(null);const runtime=useRef<Runtime|null>(null);
  const previousCloseFocus=useRef<string|null>(null);
  const previousLotFocus=useRef<string|null|undefined>(undefined);
  const previousOverviewRequest=useRef(overviewRequestId);
  const previousStoreRequest=useRef<{lotId:string|null|undefined;requestId:number;sceneRevision:number}>({lotId:undefined,requestId:storeFocusRequestId,sceneRevision:-1});
  const focusedStore=state.stores.find(store=>store.lotId===focusStoreLotId);
  const focusedStoreStyle=focusedStore?.style;
  const onSelect=useRef(onSelectLot);onSelect.current=onSelectLot;
  const [hovered,setHovered]=useState<Lot|null>(null);const [error,setError]=useState(false);
  const [sceneRevision,setSceneRevision]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    const retire=scheduleScene(()=>{
    const rollback:Array<()=>void|Promise<void>>=[];
    try {
    const container=host.current;if(!container)return()=>{};
    setError(false);previousCloseFocus.current=null;previousLotFocus.current=undefined;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:quality!=='low',alpha:false,powerPreference:'high-performance'});}catch{setError(true);return()=>{};}
    rollback.push(()=>{renderer.dispose();renderer.domElement.remove();});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,quality==='high'?2:quality==='low'?1:1.5));
    renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.08;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label','渋谷の3D街区。ドラッグで移動、ホイールで拡大。物件をクリックして選択。');
    const scene=new THREE.Scene();rollback.push(()=>disposeScene(scene));scene.background=new THREE.Color('#a9d9f5');scene.fog=new THREE.Fog('#a9d9f5',590,1250);
    const daylightEnvironment=createDaylightEnvironment(renderer);rollback.push(()=>daylightEnvironment.dispose());scene.environment=daylightEnvironment.texture;scene.environmentIntensity=.28;
    const camera=new THREE.PerspectiveCamera(36,1,.5,1800);camera.position.set(-290,255,325);
    const controls=new OrbitControls(camera,renderer.domElement);rollback.push(()=>controls.dispose());controls.target.set(0,8,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.maxPolarAngle=Math.PI*.46;controls.minDistance=55;controls.maxDistance=730;controls.maxTargetRadius=230;controls.panSpeed=.65;controls.rotateSpeed=.55;configureCameraInteraction(controls,cameraModeRef.current);
    const hemi=new THREE.HemisphereLight('#d8eeff','#899094',1.5);scene.add(hemi);
    const sun=new THREE.DirectionalLight('#fffaf0',3.0);sun.position.set(-180,330,-140);sun.castShadow=quality!=='low';sun.shadow.mapSize.setScalar(quality==='high'?4096:2048);sun.shadow.camera.left=-270;sun.shadow.camera.right=270;sun.shadow.camera.top=270;sun.shadow.camera.bottom=-270;sun.shadow.camera.far=750;sun.shadow.normalBias=.7;sun.shadow.bias=-.0002;scene.add(sun);
    const art=new CityArt();scene.add(art.group);
    art.box(0,-5,0,1900,9,1900,'#797e7c');art.surface(0,-.04,0,1100,1100,'paving');
    art.batch(0,.1,0,45,.12,40,'#36414b');
    const pickables:THREE.Object3D[]=[];const accents=new Map<string,THREE.Group>();const overlays=new Map<string,THREE.Mesh>();
    for(const road of ROADS)for(let i=1;i<road.points.length;i++) {
      const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),r=Math.atan2(dx,dz),cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2;
      art.surface(cx,.08,cz,road.width+5,length,'paving',r);art.surface(cx,.17,cz,road.width,length,'asphalt',r);
      const nx=Math.cos(r),nz=-Math.sin(r);
      for(const side of [-1,1]){
        art.batch(cx+nx*side*(road.width/2+.12),.24,cz+nz*side*(road.width/2+.12),.22,.25,length,'#aaa89e',r);
        art.batch(cx+nx*side*(road.width/2-.45),.205,cz+nz*side*(road.width/2-.45),.14,.018,length,'#d5d2c5',r);
        for(let t=11;t<length;t+=24){const f=t/length,xx=a[0]+dx*f+nx*side*(road.width/2-.23),zz=a[1]+dz*f+nz*side*(road.width/2-.23);art.batch(xx,.22,zz,.4,.02,.8,'#333b3c',r);for(let k=-2;k<=2;k++)art.batch(xx+Math.sin(r)*k*.12,.235,zz+Math.cos(r)*k*.12,.37,.015,.035,'#777b78',r);}
      }
      if(road.width>=18)for(let t=8;t<length;t+=12){const f=t/length;for(const side of [-1,1])art.batch(a[0]+dx*f+nx*side*road.width*.24,.21,a[1]+dz*f+nz*side*road.width*.24,.12,.018,4,'#d5d2c5',r);}

      for(let t=8;t<length;t+=15) {const f=t/length,x=a[0]+dx*f,z=a[1]+dz*f;if(Math.abs(x)<19&&Math.abs(z)<19)continue;art.batch(x,.23,z,.16,.035,5,'#f1efde',r);
        if(t%30<15&&Math.abs(x)+Math.abs(z)>36){const xx=x+nx*(road.width/2+1.8),zz=z+nz*(road.width/2+1.8);art.batch(xx,3.4,zz,.17,6.8,.17,'#697570');art.batch(xx,6.8,zz,1.5,.14,.65,'#c5c8b8');}
      }
    }
    // Five simultaneous pedestrian streams give the scramble its unmistakable geometry.
    const crossing=(x:number,z:number,length:number,angle:number,width=5)=>{for(let t=-length/2;t<length/2;t+=2.1){const xx=x+Math.sin(angle)*t,zz=z+Math.cos(angle)*t;art.batch(xx,.26,zz,width,.035,1.1,'#fafaf5',angle);}};
    crossing(-17,0,24,0);crossing(17,0,24,0);crossing(0,-16,30,Math.PI/2);crossing(0,16,30,Math.PI/2);crossing(0,0,39,Math.PI/4,4.5);crossing(0,0,39,-Math.PI/4,4.5);
    for(const [x,z] of [[-22,-18],[22,-18],[-22,18],[22,18]]){
      art.batch(x,3.2,z,.18,6.4,.18,'#626f66');art.batch(x+1.5,6.3,z,3.3,.15,.15,'#626f66');art.batch(x+2.5,6.1,z,.8,.4,.3,'#405b51');art.batch(x+2.7,6.1,z+.17,.14,.14,.06,'#8bc996');
      art.batch(x,2.8,z+.25,.4,.8,.3,'#465a50');art.batch(x,2.95,z+.42,.18,.24,.02,'#98cda1');
      art.batch(x,.24,z+1.5,3,.05,.55,'#bda967');
    }
    // Hachiko plaza: a small bronze landmark at the human scale.
    art.box(24,.5,23,3.4,1,3.2,'#9b9f91');art.box(24,1.25,23,1.7,.5,1.6,'#8d9588');
    const bronze=art.material('#536a5b',.48,.55);
    const dogBody=new THREE.Mesh(new THREE.SphereGeometry(.55,12,8),bronze);dogBody.scale.set(.7,1.35,1);dogBody.position.set(24,2.1,23);art.group.add(dogBody);
    const dogHead=new THREE.Mesh(new THREE.SphereGeometry(.35,12,8),bronze);dogHead.position.set(24,2.85,23.2);art.group.add(dogHead);
    art.box(24,2.78,23.5,.27,.22,.4,'#536a5b');for(const dx of [-.2,.2]){art.box(24+dx,1.9,23.3,.15,.85,.18,'#536a5b');art.box(24+dx,3.13,23.14,.13,.28,.13,'#536a5b');}
    const displayed=new Set(CITY_DISPLAY_LOTS.map(l=>l.id));
    for(let i=0;i<LOTS.length;i++)if(displayed.has(LOTS[i].id))accents.set(LOTS[i].id,makeBuilding(art,LOTS[i],i,pickables));
    const loadedAssets=new LoadedAssetPool(scene);rollback.push(()=>loadedAssets.dispose());
    makeLandmarks(art,loadedAssets);
    // Elevated tracks, sleepers and catenary infrastructure along the station corridor.
    art.batch(75,1.4,0,15,2.8,430,'#939e95');
    for(const x of [70,72,78,80])art.batch(x,3,0,.2,.25,430,'#c0c1b0');
    for(let z=-210;z<215;z+=3)for(const x of [71,79])art.batch(x,2.9,z,4.5,.2,.45,'#69776e');
    for(let z=-200;z<210;z+=28){art.batch(66,8,z,.3,12,.3,'#738178');art.batch(84,8,z,.3,12,.3,'#738178');art.batch(75,13.8,z,18,.25,.3,'#738178');}
    const trains:THREE.Group[]=[];
    for(let n=0;n<2;n++) {const train=new THREE.Group();for(let car=0;car<4;car++) {art.box(0,0,car*11,3.4,3.2,10,'#e7e4d5',0,train);art.box(0,-.15,car*11,3.5,.65,10.1,n?'#189849':'#81c32c',0,train);for(let k=0;k<4;k++)for(const side of [-1,1])art.box(side*1.72,.65,car*11-3.5+k*2.3,.06,.95,1.6,'#586d6b',0,train);art.box(0,1.8,car*11,2,.35,4,'#acb4a8',0,train);}train.position.set(n?79:71,5,-150+n*210);compactRigidGroup(train);scene.add(train);trains.push(train);}
    // Furniture, pocket greenery and cafe terraces at the quieter edges.
    for(let i=0;i<18;i++){art.tree(-119,-185+i*21,.75+(i%3)*.13);if(i%2===0)art.tree(29,-185+i*21,.8);}
    const staticTerraces=new Map<string,THREE.Group>();
    for(const lot of LOTS.filter(l=>l.available).slice(0,12)){
      const terrace=new THREE.Group();terrace.name=`static_terrace_${lot.id}`;terrace.userData.lotId=lot.id;
      terrace.position.set(lot.x,0,lot.z);terrace.rotation.y=lot.rotation??0;
      for(let i=0;i<2;i++){const x=-lot.width*.25+i*4,z=lot.depth/2+2;art.cylinder(x,1.1,z,.65,.13,'#b3a98b',10,terrace);art.box(x,.55,z,.12,1.1,.12,'#6d7667',0,terrace);}
      compactRigidGroup(terrace);art.group.add(terrace);staticTerraces.set(lot.id,terrace);
    }
    // A varied, lower-detail city fabric: mixed parcels and stepped roofs rather than a cube grid.
    for(let row=-8;row<=8;row++)for(let col=-8;col<=8;col++){
      if(Math.abs(row)<5&&Math.abs(col)<5)continue;
      const seed=Math.abs(row*73+col*131),x=col*52+(row%2)*11+(seed%9)-4,z=row*52+(seed%13)-6;
      const w=18+seed%19,d=19+(seed*7)%18,h=9+(seed*13)%43,facade=['#a6aaa5','#918e84','#b1aea3','#7f8c91','#a19889'][seed%5];
      art.batch(x,h/2-.5,z,w,h,d,facade);
      art.batch(x,h+.1,z,w-.6,.3,d-.6,'#737b7a');
      if(seed%3===0){const upper=6+seed%12;art.batch(x-w*.12,h+upper/2,z,w*.7,upper,d*.64,facade);art.batch(x-w*.12,h+upper+.2,z,w*.72,.4,d*.66,'#737b7a');}
      if(seed%4===0)art.batch(x+w*.16,h+1.4,z-d*.15,w*.24,2.6,d*.22,'#888d88');
      for(let y=4;y<h-1;y+=3.5){
        if(seed%2===0){art.batch(x,y,z+d/2+.06,w-2,1.45,.12,'#566a73');art.batch(x-w/2-.06,y,z,.12,1.45,d-2,'#566a73');}
        else for(let t=-w/2+1.7;t<w/2-1;t+=3.1)art.batch(x+t,y,z+d/2+.06,1.5,1.65,.12,'#69797c');
      }
      if(seed%3===1){const sw=w*.45,sh=h*.52;art.batch(x+w*.22,sh/2,z+d*.5+5,sw,sh,9,facade);art.batch(x+w*.22,sh+.1,z+d*.5+5,sw,.3,9,'#737b7a');}
    }
    art.finish();
    const traffic:THREE.Group[]=[];
    for(let i=0;i<9;i++) {
      const vehicle=new THREE.Group();const c=['#e8e9e7','#f7f7f5','#156d58','#e5a71c'][i%4];
      art.box(0,.9,0,4.3,1.3,1.9,c,0,vehicle);art.box(-.2,1.8,0,2.3,.65,1.65,'#4e6665',0,vehicle);art.box(-.2,2.15,0,2.5,.13,1.8,c,0,vehicle);
      for(const xx of [-1.25,1.25])for(const zz of [-.92,.92])art.box(xx,.55,zz,.6,.65,.15,'#4c5650',0,vehicle);
      vehicle.position.set(-190+i*43,.2,i%2?5:-5);compactRigidGroup(vehicle);scene.add(vehicle);traffic.push(vehicle);
    }
    const peopleCount=quality==='low'?55:110;
    const bodies=new THREE.InstancedMesh(new THREE.BoxGeometry(.48,.95,.36),art.material('#65736b'),peopleCount);
    const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.19,6,5),art.material('#ba9e80'),peopleCount);scene.add(bodies,heads);
    const walkers=Array.from({length:peopleCount},(_,i)=>({x:i<40?-20+(i*7.91%40):-195+(i*37.13%390),z:i<40?-18+(i*5.87%36):(i%2?13:-13),cross:i<40,speed:.3+(i%5)*.11}));
    const personMatrix=new THREE.Matrix4();
    for(let i=0;i<peopleCount;i++)bodies.setColorAt(i,new THREE.Color(['#48615b','#b99d76','#d2c7ae','#565963','#947e79'][i%5]));
    const indicator=(color:string)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,depthWrite:false}));mesh.visible=false;scene.add(mesh);return mesh;};
    const selection=indicator(GOLD),hover=indicator('#faf4d9');
    for(const lot of LOTS) {const overlay=new THREE.Mesh(new THREE.BoxGeometry(lot.width+.5,1,lot.depth+.5),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.45,depthWrite:false}));overlay.position.set(lot.x,lot.height+1.4,lot.z);overlay.rotation.y=lot.rotation??0;overlay.visible=false;scene.add(overlay);overlays.set(lot.id,overlay);}
    const growth=new CityGrowth(art,trains,LOTS,loadedAssets);
    const originalFronts=new Map<string,THREE.Group>();for(const child of art.group.children)if(child instanceof THREE.Group&&child.userData.storefrontLotId)originalFronts.set(child.userData.storefrontLotId,child);
    const developmentVisuals=new DevelopmentVisuals(art.group);
    const railProjectVisuals=new RailProjectVisuals(art.group);
    const siteMarkers=new GameSiteMarkers(LOTS);scene.add(siteMarkers.group);rollback.push(()=>siteMarkers.dispose());
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const storeActivity=new StoreActivityVisuals(LOTS,reduceMotion);scene.add(storeActivity.group);rollback.push(()=>storeActivity.dispose());
    runtime.current={storeActivity,siteMarkers,railProjectVisuals,staticTerraces,developmentVisuals,originalFronts,growth,selection,hover,accents,overlays,controls,camera};
    const dev=(import.meta as ImportMeta & {env?:{DEV?:boolean}}).env?.DEV;
    if(dev){window.__cityScene=scene;window.__cityCamera=camera;window.__cityRenderer=renderer;}
    rollback.push(()=>{runtime.current=null;if(dev&&window.__cityScene===scene){delete window.__cityScene;delete window.__cityCamera;delete window.__cityRenderer;}});
    const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();const selectionGesture=new PointerSelectionGesture();let lastHover='';
    const hit=(e:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const target=siteMarkers.pick(raycaster)??raycaster.intersectObjects(pickables,false)[0];return target?.object.userData.lotId as string|undefined;};
    const move=(e:PointerEvent)=>{selectionGesture.move(e);if(selectionGesture.active)return;const id=hit(e)??'';if(id===lastHover)return;lastHover=id;const lot=LOTS.find(l=>l.id===id);setHovered(lot??null);renderer.domElement.style.cursor=lot?'pointer':'grab';hover.visible=!!lot&&!runtime.current?.storeFrame;if(lot){hover.position.set(lot.x,lot.height/2+.8,lot.z);hover.scale.set(lot.width+.8,lot.height+1,lot.depth+.8);}};
    const pointerDown=(e:PointerEvent)=>selectionGesture.start(e);
    const pointerUp=(e:PointerEvent)=>{if(selectionGesture.end(e)){const id=hit(e);if(id)onSelect.current(id);}};
    const leave=(e:PointerEvent)=>{selectionGesture.cancel(e.pointerId);hover.visible=false;lastHover='';setHovered(null);renderer.domElement.style.cursor='grab';};
    renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointerleave',leave);renderer.domElement.addEventListener('pointercancel',leave);
    const removeSelectionEvents=()=>{selectionGesture.reset();renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointerleave',leave);renderer.domElement.removeEventListener('pointercancel',leave);};rollback.push(removeSelectionEvents);
    let raf=0,lastTime:number|undefined,modalPaused=false,animationDisposed=false;
    let pendingSize:{width:number;height:number}|undefined;
    const animationClock=new ActiveAnimationClock();
    const animationVisible=()=>!animationDisposed&&!document.hidden&&!modalPaused;
    const applyPendingSize=()=>{
      if(!pendingSize)return;
      const {width,height}=pendingSize;pendingSize=undefined;
      renderer.setSize(width,height);camera.aspect=width/height;
      // Retain the player's pose and zoom on resize; an explicit store view fits the new viewport.
      camera.updateProjectionMatrix();
    };
    const resize=new ResizeObserver(()=>{
      const width=container.clientWidth,height=container.clientHeight;
      if(!width||!height||animationDisposed)return;
      pendingSize={width,height};if(animationVisible())applyPendingSize();
    });rollback.push(()=>resize.disconnect());resize.observe(container);
    const requestAnimation=()=>{if(!raf&&animationVisible())raf=requestAnimationFrame(animate);};
    const visibilityChanged=()=>{
      controls.enabled=animationVisible();
      if(!controls.enabled){cancelAnimationFrame(raf);raf=0;animationClock.pause();lastTime=undefined;}
      else {applyPendingSize();requestAnimation();}
    };
    const stopAnimation=()=>{animationDisposed=true;cancelAnimationFrame(raf);raf=0;document.removeEventListener('visibilitychange',visibilityChanged);};
    document.addEventListener('visibilitychange',visibilityChanged);rollback.push(stopAnimation);
    const animate=(timestamp:number)=>{
      raf=0;if(!animationVisible()){animationClock.pause();return;}requestAnimation();
      const time=animationClock.sample(timestamp);
      if(lastTime!==undefined&&time-lastTime<(quality==='low'?32:16))return;
      lastTime=time;
      if(!reduceMotion){trains.forEach((train,n)=>{train.position.z=((time*.009*(n?-1:1)+n*180+10000)%460)-230;});traffic.forEach((car,i)=>{car.position.x=((time*.005*(i%2?1:-1)+i*43+10000)%390)-195;});}
      walkers.forEach((p,i)=>{const offset=reduceMotion?0:time*.00045*p.speed;const x=p.cross?((p.x+20+offset)%40)-20:((p.x+195+offset)%390)-195,z=p.cross?p.z+Math.sin(offset*.05+i)*.7:p.z;personMatrix.makeTranslation(x,1.03,z);bodies.setMatrixAt(i,personMatrix);personMatrix.makeTranslation(x,1.72,z);heads.setMatrixAt(i,personMatrix);});
      bodies.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;
      if(runtime.current?.focus){const delta=runtime.current.focus.clone().sub(controls.target).multiplyScalar(.065);controls.target.add(delta);camera.position.add(delta);if(delta.length()<.04)runtime.current.focus=undefined;}
      controls.update();storeActivity.animate(time);siteMarkers.resize(camera,container.clientHeight);renderer.render(scene,camera);
    };
    const stopModalObserver=observeModalPause(paused=>{modalPaused=paused;visibilityChanged();});rollback.push(stopModalObserver);
    setSceneRevision(value=>value+1);
    return()=>{stopAnimation();stopModalObserver();resize.disconnect();removeSelectionEvents();controls.dispose();const done=loadedAssets.dispose();siteMarkers.dispose();storeActivity.dispose();disposeScene(scene);daylightEnvironment.dispose();renderer.dispose();renderer.domElement.remove();runtime.current=null;if(dev){delete window.__cityScene;delete window.__cityCamera;delete window.__cityRenderer;}return done;};
    } catch {
      if(!cancelled)setError(true);
      const settled=Promise.allSettled(rollback.reverse().map(dispose=>{try{return dispose();}catch(error){return Promise.reject(error);}})).then(()=>undefined);
      return()=>settled;
    }
    },()=>{if(!cancelled)setError(true);});
    return()=>{cancelled=true;void retire();};
  },[quality]);
  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    configureCameraInteraction(rt.controls,cameraMode);
    if(cameraMode==='manage')restoreOverviewDirection(rt.controls,new THREE.Vector3(-290,247,325));
    host.current?.querySelector('canvas')?.setAttribute('aria-label',cameraMode==='manage'?'渋谷の3D街区。ドラッグで移動、ホイールで拡大。物件をクリックして選択。':'渋谷の3D街区。ドラッグで回転、ホイールで拡大。物件をクリックして選択。');
  },[cameraMode,sceneRevision]);
  useEffect(()=>{const rt=runtime.current;if(!rt)return;rt.siteMarkers.update(state,selectedLotId);rt.storeActivity.update(state,rt.storeFrame?.lot.id);rt.growth.update(state);rt.developmentVisuals.update(state);rt.railProjectVisuals.update(state);for(const [id,terrace] of rt.staticTerraces){const store=state.stores.find(s=>s.lotId===id);terrace.visible=!store||!(store.level>=2||(store.style==='premium'&&id!=='center-03'));}const lot=LOTS.find(l=>l.id===selectedLotId);rt.selection.visible=!!lot&&!rt.storeFrame;if(lot){rt.selection.position.set(lot.x,lot.height/2+.8,lot.z);rt.selection.scale.set(lot.width+1.3,lot.height+1.5,lot.depth+1.3);rt.selection.rotation.y=lot.rotation??0;}const owned=new Set([...state.stores.map(s=>s.lotId),...state.properties.map(p=>p.lotId)]);for(const [id,group] of rt.accents){const originalFront=rt.originalFronts.get(id);if(originalFront)originalFront.visible=!state.stores.some(store=>store.lotId===id);group.visible=owned.has(id);const level=state.properties.find(p=>p.lotId===id)?.level??1;for(const child of group.children)if(child.userData.propertyLevel)child.visible=child.userData.propertyLevel<=level;}for(const lot of LOTS){const mesh=rt.overlays.get(lot.id)!;mesh.visible=(viewMode==='demand'&&lot.available)||(viewMode==='ownership'&&owned.has(lot.id));(mesh.material as THREE.MeshBasicMaterial).color.set(viewMode==='demand'?new THREE.Color().setHSL(.42-Math.min(1,lot.footfall/80000)*.32,.55,.56):GOLD);}},[selectedLotId,focusedStoreStyle,state.railProjects,state.development,state.week,state.stores,state.properties,state.subsidiaries,state.companyName,state.listed,viewMode,quality,sceneRevision]);
  useEffect(()=>{
    const rt=runtime.current;if(!rt)return;
    const ordinaryChanged=previousLotFocus.current!==focusLotId;previousLotFocus.current=focusLotId;
    const previousRequest=previousStoreRequest.current;
    const storeRequestChanged=previousRequest.lotId!==focusStoreLotId||previousRequest.requestId!==storeFocusRequestId||previousRequest.sceneRevision!==sceneRevision;
    previousStoreRequest.current={lotId:focusStoreLotId,requestId:storeFocusRequestId,sceneRevision};
    const lot=focusedStoreStyle?LOTS.find(l=>l.id===focusStoreLotId):undefined;
    const storeView=lot&&focusedStoreStyle?getStoreViewpoint(lot,focusedStoreStyle,(host.current?.clientWidth??1)/(host.current?.clientHeight||1)):null;
    rt.selection.visible=!!LOTS.find(l=>l.id===selectedLotId)&&!storeView;
    const view=storeView??(focusRailDistrict?{...RAIL_PROJECT_VIEWPOINTS[focusRailDistrict],fov:36}:null);
    if(view){
      rt.storeFrame=storeView&&lot&&focusedStoreStyle?{lot,style:focusedStoreStyle}:undefined;
      rt.storeActivity.update(state,rt.storeFrame?.lot.id);
      rt.focus=undefined;rt.hover.visible=false;rt.controls.minDistance=storeView?5:18;
      previousCloseFocus.current=storeView?`store:${focusStoreLotId}`:`rail:${focusRailDistrict}`;
      // Changing a business style updates its appearance; only a viewing request reframes it.
      if(storeView&&!storeRequestChanged)return;
      rt.camera.fov=view.fov;rt.camera.updateProjectionMatrix();
      rt.camera.position.fromArray(view.position);rt.controls.target.fromArray(view.target);rt.controls.update();
      return;
    }
    rt.storeFrame=undefined;
    rt.storeActivity.update(state,null);
    if(previousCloseFocus.current){
      rt.focus=undefined;rt.controls.minDistance=55;
      rt.camera.fov=36;rt.camera.updateProjectionMatrix();
      rt.camera.position.set(-290,255,325);rt.controls.target.set(0,8,0);rt.controls.update();
      previousCloseFocus.current=null;
      // Returning to overview must not immediately pan back to the retained selection.
      if(!ordinaryChanged)return;
    }
    previousCloseFocus.current=null;
    const selected=LOTS.find(l=>l.id===focusLotId);
    if(selected){rt.controls.minDistance=55;rt.focus=new THREE.Vector3(selected.x,Math.min(selected.height*.35,20),selected.z);}
  },[focusStoreLotId,storeFocusRequestId,focusedStoreStyle,focusRailDistrict,focusLotId,quality,sceneRevision]);
  useEffect(()=>{
    if(previousOverviewRequest.current===overviewRequestId)return;
    previousOverviewRequest.current=overviewRequestId;
    const rt=runtime.current;if(!rt)return;
    rt.focus=undefined;rt.storeFrame=undefined;rt.storeActivity.update(state,null);
    rt.hover.visible=false;rt.selection.visible=!!LOTS.find(lot=>lot.id===selectedLotId);
    previousCloseFocus.current=null;rt.controls.minDistance=55;
    rt.camera.fov=36;rt.camera.updateProjectionMatrix();
    rt.camera.position.set(-290,255,325);rt.controls.target.set(0,8,0);rt.controls.update();
  },[overviewRequestId,sceneRevision,state,selectedLotId]);
  return <div className="city-world" ref={host}>{error&&<div className="city-webgl-error">3D表示を開始できませんでした。ブラウザのハードウェアアクセラレーションをご確認ください。物件一覧から経営操作を続けられます。</div>}<div className="city-location"><span className="city-location-dot"/>TOKYO / SHIBUYA <span>35°39′ N · 139°42′ E</span></div><div className="city-compass"><span>N</span><i>↑</i></div>{hovered&&<div className="city-hover"><span>{state.stores.some(s=>s.lotId===hovered.id)?'営業中':state.properties.some(p=>p.lotId===hovered.id)?'物件保有':'出店・購入'}</span><strong>{hovered.name}</strong><small>タップで詳細・経営</small></div>}<div className="city-attribution">SHIBUYA DISTRICT · 実在地形を参考にした創作街区</div></div>;
}
