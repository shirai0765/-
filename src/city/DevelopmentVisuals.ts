import * as THREE from 'three';
import type { GameState } from '../model';
import { LOTS, ROADS } from '../data/district';
import { DEVELOPMENT_CHOICES } from '../sim/development';
import { CityArt } from './art';

/** Permanent built improvements; economic suspension never demolishes finished work. */
export class DevelopmentVisuals {
  readonly group=new THREE.Group();
  private completed=new Map<string,THREE.Group>();
  constructor(parent:THREE.Group){this.group.name='Completed_district_improvements';parent.add(this.group);}
  update(state:GameState){
    const ids=new Set<string>();
    for(const program of state.development?.programs??[]){
      program.completedChoiceIds.forEach(id=>ids.add(id));
      if(program.construction&&state.week>=program.construction.completeWeek)ids.add(program.construction.choiceId);
    }
    // Also supports loading an earlier save into the same running scene.
    for(const [id,group] of this.completed)group.visible=ids.has(id);
    for(const id of ids){
      if(this.completed.has(id))continue;
      const choice=DEVELOPMENT_CHOICES.find(c=>c.id===id);if(!choice)continue;
      const art=new CityArt();art.group.name=`Built_${id}`;art.group.userData={developmentChoiceId:id,permanent:true};
      const lots=LOTS.filter(l=>l.available&&l.district===choice.districtId);
      const commerce=id.endsWith('-commerce');
      for(const lot of lots.slice(choice.phase*2,choice.phase*2+2)){
        // Narrow side courts keep main entrances/cafe terraces and traffic lanes clear.
        const r=lot.rotation??0;
        const local=(lx:number,lz:number)=>({x:lot.x+lx*Math.cos(r)+lz*Math.sin(r),z:lot.z-lx*Math.sin(r)+lz*Math.cos(r)});
        const candidates=[local(-lot.width/2-1.25,-lot.depth*.1),local(lot.width/2+1.25,-lot.depth*.1)];
        const site=candidates.find(p=>!ROADS.some(road=>{const a=road.points[0],b=road.points[road.points.length-1];const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-a[0]-dx*t,p.z-a[1]-dz*t)<road.width/2+1.15;})&&!LOTS.some(other=>other.id!==lot.id&&Math.abs(other.x-p.x)<other.width/2+1.05&&Math.abs(other.z-p.z)<other.depth/2+2.3));
        if(!site)continue;
        const box=(lx:number,y:number,lz:number,w:number,h:number,d:number,color:string)=>{art.batch(site.x+lx*Math.cos(r)+lz*Math.sin(r),y,site.z-lx*Math.sin(r)+lz*Math.cos(r),w,h,d,color,r);};
        const stone=choice.districtId==='dogenzaka'?'#918579':'#959b95',timber=choice.districtId==='sakuragaoka'?'#8a7054':'#716858';
        box(0,.11,0,1.75,.14,4.5,stone);
        if(commerce){
          // Pedestrian route lighting -> seating court -> sheltered commercial meeting point.
          box(-.58,2.65,-1.6,.09,5.2,.09,'#52605e');box(-.3,5.2,-1.6,.65,.09,.32,'#8e9998');box(-.3,5.14,-1.6,.5,.025,.23,'#d9d5b8');
          box(-.58,3.2,-1.6,.72,.35,.1,'#485e57');
          for(let k=0;k<3;k++)box(-.77+k*.19,3.2,-1.535,.12,.025,.02,'#d1d0bc');
          if(choice.phase>=1){
            for(let k=0;k<4;k++)box(0,.57,-.6+k*.13,1.35,.07,.1,timber);
            for(const x of [-.5,.5])box(x,.33,-.4,.08,.45,.45,'#52605e');
            box(0,.39,1.4,1.2,.55,.9,stone);box(0,.77,1.4,1.05,.35,.75,'#586b43');
          }
          if(choice.phase===2){
            for(const x of [-.73,.73])for(const z of [-1,1.8])box(x,1.55,z,.07,2.9,.07,'#52605e');
            box(0,3.05,.4,1.7,.12,3.2,'#999e94');
            for(let z=-1;z<2;z+=.35)box(0,3.14,z,1.7,.035,.08,timber);
            box(.62,1.45,1.3,.12,1.8,.65,'#59635e');
          }
        }else{
          // Residential common areas -> sheltered cycle storage -> shared service cabinet.
          box(0,.4,-1.3,1.35,.58,1.1,stone);box(0,.8,-1.3,1.13,.43,.9,'#586b43');
          box(.58,.57,1.4,.1,1,.1,'#52605e');box(.58,1.06,1.4,.2,.07,.2,'#ddd6b8');
          for(let k=0;k<3;k++){const z=-.2+k*.52;for(const x of [-.48,.48])box(x,.44,z,.04,.6,.04,'#798585');box(0,.75,z,1,.045,.045,'#798585');}
          if(choice.phase>=1){for(const x of [-.72,.72])box(x,1.35,.55,.07,2.5,.07,'#52605e');box(0,2.63,.55,1.72,.09,2.55,'#a0aaa6');}
          if(choice.phase===2){box(0,1.24,-1.3,1.25,1.7,.72,'#6c7976');for(let k=0;k<3;k++){box(-.4+k*.4,1.25,-.925,.025,1.5,.015,'#404f4e');box(-.28+k*.4,1.25,-.91,.04,.18,.03,'#bcc1b5');}}
        }
      }
      art.finish();this.completed.set(id,art.group);this.group.add(art.group);
    }
  }
}
