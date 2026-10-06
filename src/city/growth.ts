import * as THREE from 'three';
import type { GameState, Lot, StoreStyle } from '../model';
import { CityArt, compactRigidGroup } from './art';
import { createCafeExterior } from './assets/CafeExterior';
import { AUTHORED_ASSETS } from './loadedAsset';
import type { LoadedAssetPool, LoadedAssetHandle } from './loadedAsset';

/** A canvas is retained and repainted only when the displayed business changes. */
class BusinessSign {
  readonly mesh:THREE.Mesh;
  private canvas=document.createElement('canvas');
  private texture:THREE.CanvasTexture;
  private previous='';
  private content?:[string,string,string,string];
  private disposed=false;
  constructor(width:number,height:number) {
    this.canvas.width=1024;this.canvas.height=256;
    this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map:this.texture,roughness:.75,side:THREE.DoubleSide});
    material.addEventListener('dispose',()=>{this.disposed=true;});
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
    void document.fonts?.ready.then(()=>{if(!this.disposed&&this.content){this.previous='';this.update(...this.content);}});
  }
  update(title:string,subtitle:string,background:string,foreground='#ffffff') {
    if(this.disposed)return;this.content=[title,subtitle,background,foreground];
    const key=JSON.stringify(this.content);if(key===this.previous)return;this.previous=key;
    const ctx=this.canvas.getContext('2d')!;
    ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);ctx.fillStyle=foreground;ctx.textAlign='center';ctx.textBaseline='middle';
    // Company and store names are drawn as text, never interpreted as HTML.
    ctx.font='600 79px "Noto Sans JP Variable", "Yu Gothic", sans-serif';ctx.fillText(title,512,105,956);
    ctx.font='25px sans-serif';ctx.fillText(subtitle,512,194,942);
    ctx.globalAlpha=.5;ctx.fillRect(36,155,952,2);ctx.globalAlpha=1;
    this.texture.needsUpdate=true;this.mesh.userData.displayedText=title;this.mesh.userData.subtitle=subtitle;
  }
}
interface BusinessFront { cafeAsset?:LoadedAssetHandle; group:THREE.Group; sign:BusinessSign; styles:Map<StoreStyle,THREE.Group>; upgrades:THREE.Group[]; premiumLevel2:THREE.Group; headquarters:THREE.Group; headquartersSign:BusinessSign }
const palette={standard:{color:'#70252c',label:'喫茶 · COFFEE & CAKE'},premium:{color:'#294d41',label:'SPECIALTY COFFEE · ROASTERY'},takeaway:{color:'#135aa8',label:'COFFEE TO GO · TAKEAWAY'}};

/** Owns only state-dependent groups; static city geometry is never rebuilt on a week tick. */
export class CityGrowth {
  private fronts=new Map<string,BusinessFront>();
  private railGroups:THREE.Group[]=[];
  private railwaySign:BusinessSign;
  constructor(private art:CityArt,trains:THREE.Group[],private lots:Lot[],private assets?:LoadedAssetPool) {
    this.railwaySign=new BusinessSign(7,.75);
    for(const train of trains){
      const livery=new THREE.Group();livery.name='Owned railway livery';livery.visible=false;
      for(let car=0;car<4;car++)for(const side of [-1,1]){
        art.box(side*1.77,-.3,car*11,.045,.6,9.85,'#135aa8',0,livery);
        art.box(side*1.78,-.69,car*11,.045,.1,9.85,'#e9c276',0,livery);
      }
      compactRigidGroup(livery);
      for(const side of [-1,1]){
        const sign=new THREE.Mesh(this.railwaySign.mesh.geometry,this.railwaySign.mesh.material);
        sign.position.set(side*1.81,-.35,16.5);sign.rotation.y=side*Math.PI/2;livery.add(sign);
      }
      train.add(livery);this.railGroups.push(livery);
    }
  }
  private createFront(lot:Lot):BusinessFront {
    const art=this.art,w=lot.width,d=lot.depth;
    const group=new THREE.Group();group.name=`Business frontage ${lot.id}`;group.position.set(lot.x,0,lot.z);group.rotation.y=lot.rotation??0;art.group.add(group);
    const sign=new BusinessSign(Math.min(w-1,16),2.8);sign.mesh.position.set(0,5.1,d/2+.82);group.add(sign.mesh);
    const styles=new Map<StoreStyle,THREE.Group>();let cafeAsset:LoadedAssetHandle|undefined;
    for(const style of ['standard','premium','takeaway'] as const){
      const frontage=new THREE.Group();frontage.name=`Cafe style ${style}`;
      if(style==='premium' && lot.id!=='center-03'){
        const cafe=createCafeExterior({width:Math.min(w-.8,12),terrace:true,wordmark:false});
        cafe.position.z=d/2+.35;
        cafeAsset=this.assets?.mount(AUTHORED_ASSETS.cafe,cafe,false);frontage.add(cafeAsset?.group??cafe);
        // Already merged by material; retain transparent glazing and exclusive textures.
        group.add(frontage);styles.set(style,frontage);continue;
      }
      const box=(x:number,y:number,z:number,bw:number,bh:number,bd:number,c:string)=>art.box(x,y,z,bw,bh,bd,c,0,frontage);
      // Full-height shopfront frames and a deep canopy make each operating format distinct.
      box(0,2.05,d/2+.43,w-.8,3.1,.22,style==='premium'?'#21362f':'#203b49');
      const trim=style==='premium'?'#a87943':style==='standard'?'#834c33':'#ecefee';
      for(const x of [-w*.42,-w*.16,w*.16,w*.42])box(x,2.05,d/2+.61,.18,3.3,.24,trim);
      box(0,3.8,d/2+1.05,w-.2,.28,2.1,palette[style].color);
      if(style==='standard'){
        for(let x=-w/2+.7;x<w/2-.3;x+=1.15)box(x,3.96,d/2+1.03,.5,.06,2,'#f7e9cd');
        box(0,3.58,d/2+2.08,w-.2,.45,.08,palette[style].color);
        box(-w*.27,1.12,d/2+.7,w*.22,.65,.5,'#a87943');
      }else if(style==='premium'){
        for(let x=-w/2+.8;x<-w*.22;x+=.35)box(x,1.98,d/2+.73,.12,3.2,.12,trim);
        box(w*.29,1.1,d/2+.75,w*.24,.65,.65,'#d4b893');
        box(w*.29,1.5,d/2+.76,w*.26,.12,.74,'#eeeae0');
        box(0,3.7,d/2+2.08,w-.3,.12,.12,'#d9b26e');
      }else{
        box(w*.19,1.08,d/2+.89,w*.48,1.35,.86,'#f2f2ed');
        box(w*.19,1.8,d/2+1.13,w*.52,.14,1.25,'#abbac2');
        box(w*.19,2.66,d/2+.7,w*.49,1.1,.09,'#79abc0');
        for(const x of [w*.1,w*.24,w*.36]){box(x,1.99,d/2+1.2,.2,.24,.2,'#fff9ed');box(x,2.12,d/2+1.2,.22,.04,.22,'#263940');}
      }
      compactRigidGroup(frontage);group.add(frontage);styles.set(style,frontage);
    }
    const upgrades:THREE.Group[]=[];
    for(let level=2;level<=5;level++){
      const upgrade=new THREE.Group();upgrade.name=`Cafe expansion level ${level}`;upgrade.userData.storeLevel=level;
      const box=(x:number,y:number,z:number,bw:number,bh:number,bd:number,c:string)=>art.box(x,y,z,bw,bh,bd,c,0,upgrade);
      if(level===2){
        // Window bench and two pavement tables, with chairs rather than floating props.
        box(0,.55,d/2+1.05,w*.52,.14,.62,'#a87943');
        for(const x of [-w*.29,w*.29]){
          box(x,1.04,d/2+2.15,1.15,.12,.85,'#a87943');box(x,.56,d/2+2.15,.11,.9,.11,'#263940');
          for(const dx of [-.87,.87]){box(x+dx,.61,d/2+2.15,.55,.12,.55,'#a87943');box(x+dx,.29,d/2+2.15,.11,.58,.11,'#263940');}
        }
      }else if(level===3){
        // Lightweight timber pergola and planted street edge.
        for(const x of [-w*.43,w*.43]){box(x,1.92,d/2+2.15,.13,3.84,.13,'#a87943');box(x,.42,d/2+2.2,1.1,.8,.9,'#e9e9e3');box(x,1.03,d/2+2.2,1.15,.55,.95,'#38823f');}
        for(let x=-w*.44;x<=w*.44;x+=.9)box(x,4,d/2+1.15,.12,.16,2.6,'#a87943');
      }else if(level===4){
        // A second-storey lounge uses the existing building shell.
        box(0,7.6,d/2+.5,w*.78,1.6,.27,'#21516e');
        box(0,6.7,d/2+.75,w*.87,.25,.9,'#e9e9e3');
        for(let x=-w*.39;x<w*.42;x+=2)box(x,7.65,d/2+.7,.12,1.75,.1,'#a87943');
        box(0,8.6,d/2+.68,w*.85,.2,.7,'#a87943');
      }else{
        // A modest planted lounge balcony, below roof-level property extensions.
        box(0,9.4,d/2+1.0,w*.8,.22,2.05,'#e9e9e3');
        box(0,10.23,d/2+1.99,w*.8,.12,.12,'#a87943');
        for(let x=-w*.38;x<w*.4;x+=1.4)box(x,9.86,d/2+1.99,.075,.7,.075,'#a87943');
        for(const x of [-w*.3,w*.3]){box(x,9.77,d/2+1.42,1.6,.65,.7,'#eeeae2');box(x,10.25,d/2+1.42,1.7,.5,.8,'#38823f');}
      }
      compactRigidGroup(upgrade);group.add(upgrade);upgrades.push(upgrade);
    }
    // Detailed cafés already have a terrace at level 1. Their first upgrade gets
    // a separate service stand beside the façade rather than duplicate tables.
    const premiumLevel2=new THREE.Group();premiumLevel2.name='Premium level 2 service stand';
    premiumLevel2.userData.storeLevel=2;
    const standX=Math.min(w-.8,12)/2+.48,standZ=d/2+1.2;
    art.box(standX,.65,standZ,.78,1.3,.72,'#46645a',0,premiumLevel2);
    art.box(standX,1.34,standZ,.9,.12,.8,'#ddd4bd',0,premiumLevel2);
    art.box(standX,1.53,standZ-.22,.74,.24,.09,'#a87943',0,premiumLevel2);
    for(const dx of [-.22,.08])art.box(standX+dx,1.52,standZ+.08,.16,.24,.16,'#f2eee1',0,premiumLevel2);
    compactRigidGroup(premiumLevel2);premiumLevel2.visible=false;group.add(premiumLevel2);
    const headquarters=new THREE.Group();headquarters.name='Listed company headquarters';
    art.box(0,lot.height+3.2,0,w*.65,.25,d*.45,'#e9e9e3',0,headquarters);
    for(const x of [-w*.25,w*.25])art.box(x,lot.height+5,0,.18,3.4,.18,'#a87943',0,headquarters);
    compactRigidGroup(headquarters);
    const headquartersSign=new BusinessSign(Math.min(w*.7,15),3.2);headquartersSign.mesh.position.set(0,lot.height+5.3,.15);headquarters.add(headquartersSign.mesh);group.add(headquarters);
    return {group,sign,styles,upgrades,premiumLevel2,headquarters,headquartersSign,cafeAsset};
  }
  update(state:GameState) {
    const owned=new Set([...state.stores.map(s=>s.lotId),...state.properties.map(p=>p.lotId)]);
    for(const [id,front] of this.fronts){front.group.visible=owned.has(id);
      // Deactivation prevents a late response attaching to a closed or restyled shop.
      front.cafeAsset?.setActive(state.stores.some(store=>store.lotId===id&&store.style==='premium'));
    }
    const headquartersId=state.properties[0]?.lotId??state.stores[0]?.lotId;
    for(const id of owned){
      let front=this.fronts.get(id);if(!front){const lot=this.lots.find(l=>l.id===id);if(!lot)continue;front=this.createFront(lot);this.fronts.set(id,front);}
      front.group.visible=true;
      const store=state.stores.find(s=>s.lotId===id),property=state.properties.find(p=>p.lotId===id);
      const style=store?.style??'premium',design=palette[style];
      const lot=this.lots.find(l=>l.id===id)!;
      const detailedCafe=!!store&&style==='premium'&&id!=='center-03';
      front.cafeAsset?.setActive(detailedCafe);
      const cafeWidth=Math.min(lot.width-.8,12);
      // Reuse the dynamic texture and mesh; the owner's name sits on the café fascia.
      front.sign.mesh.scale.set(detailedCafe?cafeWidth*.6/Math.min(lot.width-1,16):1,detailedCafe?.5/2.8:1,1);
      front.sign.mesh.position.set(detailedCafe?cafeWidth*.12:0,detailedCafe?3.47:5.1,lot.depth/2+(detailedCafe?.54:.82));
      front.sign.update(store?.name??state.companyName,store?`${design.label}  /  LEVEL ${store.level}`:`OWNED PROPERTY  /  LEVEL ${property?.level??1}`,detailedCafe?'#a7a59e':design.color,detailedCafe?'#293b34':style==='standard'?'#fff0d9':'#ffffff');
      for(const [key,group] of front.styles)group.visible=!!store&&key===style;
      for(const group of front.upgrades)group.visible=!!store&&store.level>=group.userData.storeLevel&&!(detailedCafe&&group.userData.storeLevel===2);
      front.premiumLevel2.visible=detailedCafe&&store.level>=2;
      front.headquarters.visible=state.listed&&id===headquartersId;
      if(front.headquarters.visible)front.headquartersSign.update(state.companyName,'LISTED COMPANY · SHIBUYA HQ','#135aa8');
      front.group.userData={lotId:id,storeName:store?.name,style:store?.style,storeLevel:store?.level,propertyLevel:property?.level};
    }
    const railway=state.subsidiaries.find(s=>s.sector==='rail');
    for(const group of this.railGroups)group.visible=!!railway;
    if(railway)this.railwaySign.update(railway.name,state.companyName+' GROUP','#135aa8');
  }
}
