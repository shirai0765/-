import * as THREE from 'three';
import type { RealCitySiteState } from './gameSites';
import { disposeRealObject } from './textureBudget';
const STYLES = { empty: ['#ba852d','候補'], store: ['#28795b','営業'], property: ['#4e67a9','保有'], both: ['#865baa','営業・保有'] } as const;
export class RealCityMarkers {
  readonly group = new THREE.Group();
  private entries = new Map<string,{key:string;group:THREE.Group;ring:THREE.Mesh}>();
  constructor(){this.group.name='Fictional_game_sites_on_real_city';this.group.visible=false;}
  update(sites:readonly RealCitySiteState[],positions:ReadonlyMap<string,THREE.Vector3>){
    const live=new Set(sites.map(site=>site.lotId));
    for(const[id,entry]of this.entries)if(!live.has(id)||!positions.has(id)){this.group.remove(entry.group);disposeRealObject(entry.group);this.entries.delete(id);}
    for(const site of sites){
      const position=positions.get(site.lotId);if(!position)continue;
      const key=`${site.status}:${site.label}`;let entry=this.entries.get(site.lotId);
      if(entry?.key!==key){
        if(entry){this.group.remove(entry.group);disposeRealObject(entry.group);}
        const group=new THREE.Group();group.name=`Game_site_${site.lotId}`;group.userData.lotId=site.lotId;
        const[color,status]=STYLES[site.status];
        const pin=new THREE.Mesh(new THREE.SphereGeometry(3.5,12,8),new THREE.MeshBasicMaterial({color}));group.add(pin);
        const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.65,6,24),new THREE.MeshBasicMaterial({color:'#fff4a0'}));ring.rotation.x=Math.PI/2;group.add(ring);
        const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
        const context=canvas.getContext('2d');if(!context)throw new Error('地点名の描画を開始できません');
        context.fillStyle='#fffdf1';context.fillRect(0,0,512,128);context.fillStyle=color;context.fillRect(0,0,12,128);
        context.fillStyle='#273e3a';context.font='600 28px system-ui';context.fillText([...site.label].slice(0,16).join(''),26,48);
        context.fillStyle=site.status==='empty'?'#7d5717':color;context.font='22px system-ui';context.fillText(`ゲーム内 ${status}`,26,93);
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
        const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,depthTest:false,toneMapped:false}));label.renderOrder=20;label.position.y=11;label.scale.set(40,10,1);group.add(label);
        group.traverse(object=>object.userData.lotId=site.lotId);this.group.add(group);entry={key,group,ring};this.entries.set(site.lotId,entry);
      }
      entry.group.position.copy(position);entry.ring.visible=site.selected;
    }
  }
  dispose(){disposeRealObject(this.group);this.entries.clear();}
}
