import * as THREE from 'three';
import type { DistrictId, GameState } from '../model';
import { getRailProjects } from '../sim/railProjects';
import { CityArt, disposeScene } from './art';

/** Four authored forecourts beside the existing station, not surveyed entrances. */
export const RAIL_PROJECT_SITES: Record<DistrictId, {x:number;z:number;rotation:number;label:string}> = {
  center: {x:58.3,z:22,rotation:-Math.PI/2,label:'西口・センター街方面'},
  dogenzaka: {x:58.3,z:43,rotation:-Math.PI/2,label:'西口・道玄坂方面'},
  miyashita: {x:92,z:25,rotation:Math.PI/2,label:'東口・宮下方面'},
  sakuragaoka: {x:58.3,z:65,rotation:-Math.PI/2,label:'南口・桜丘方面'},
};

/** Street-side endpoints above traffic, facing each canopy rather than its rear. */
export const RAIL_PROJECT_VIEWPOINTS: Record<DistrictId, {
  position:[number,number,number];target:[number,number,number];
}> = {
  center:{position:[31,9.3,8],target:[60,2.1,23]},
  dogenzaka:{position:[33,8.9,28],target:[59,2,44]},
  miyashita:{position:[103,10,2],target:[89,2,26]},
  sakuragaoka:{position:[33,9.3,50],target:[59,2.1,66]},
};

const C={stone:'#b9b7ad',joint:'#90968f',steel:'#566862',roof:'#e0e2d8',green:'#3b7261',wood:'#a38665',glass:'#637477',leaf:'#586b43',tactile:'#c1ad69',light:'#e9e4cf',orange:'#b67b47'};

/** Instanced static detail, rebuilt only when a project's visible state changes. */
export class RailProjectVisuals {
  readonly group=new THREE.Group();
  private signature='';
  private content?:THREE.Group;
  constructor(parent:THREE.Group){this.group.name='Station_joint_development';parent.add(this.group);}

  update(state:GameState){
    const projects=getRailProjects(state).filter(p=>p.choice).map(project=>{
      const row=state.railProjects?.projects.find(p=>p.districtId===project.districtId);
      return {project,complete:!!row&&state.week>=row.completeWeek};
    });
    // Neither the week counter nor the remaining-weeks label allocates geometry.
    const signature=JSON.stringify(projects.map(({project:p,complete})=>[p.districtId,p.choice!.id,p.status,complete]));
    if(signature===this.signature)return;
    this.signature=signature;
    if(this.content){this.group.remove(this.content);disposeScene(this.content);this.content=undefined;}
    if(!projects.length){this.group.userData={projects:[],drawCalls:0,triangles:0,instances:0};return;}
    const art=new CityArt();art.group.name='Station_project_fabric';
    for(const {project:p,complete} of projects){
      const site=RAIL_PROJECT_SITES[p.districtId],r=site.rotation,co=Math.cos(r),si=Math.sin(r);
      const world=(x:number,z:number)=>({x:site.x+x*co+z*si,z:site.z-x*si+z*co});
      const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const v=world(x,z);art.batch(v.x,y,v.z,w,h,d,color,r);};
      const sign=(title:string,sub:string,x:number,y:number,z:number,w:number,h:number,bg=C.green)=>{
        if(typeof document==='undefined')return;
        const mesh=art.sign(title,sub,bg,'#f4f1e6',w,h),v=world(x,z);
        mesh.position.set(v.x,y,v.z);mesh.rotation.y=r;mesh.name=`Rail_project_sign_${p.districtId}_${title}`;
        art.group.add(mesh);
      };
      const suspended=p.status==='suspended',commerce=p.choice!.id==='commerce';
      const accent=suspended?C.steel:commerce?C.green:C.wood;
      // Clear width to the west carriageway remains >2m. Back edge meets the station.
      box(0,.16,0,13,.17,7.4,C.stone);
      for(let x=-6;x<=6;x+=1.5)box(x,.254,0,.024,.012,7.25,C.joint);
      for(const z of [-2.5,0,2.5])box(0,.254,z,12.8,.012,.024,C.joint);
      box(0,.27,2.48,12.5,.035,.32,C.tactile);
      box(-1.7,.27,.5,.32,.035,4.2,C.tactile);
      for(const z of [-1.3,2.48])for(const x of [-1.8,-1.7,-1.6])box(x,.297,z,.035,.025,.4,C.tactile);
      // Six slender posts, a gutter and a deep sheltered station connection.
      for(const x of [-6,0,6])for(const z of [-3.35,1.7]){
        box(x,.31,z,.35,.14,.35,C.steel);
        box(x,2.22,z,.12,3.82,.12,C.steel);
      }
      box(0,4.08,-3.35,12.4,.18,.18,C.steel);
      box(0,4.08,1.7,12.4,.18,.18,C.steel);
      if(!complete){
        // Hoarding encloses the work, leaving the tactile route outside it open.
        for(const x of [-4.8,-2.4,0,2.4,4.8]){
          box(x,1.14,1.25,2.32,1.75,.11,C.roof);
          box(x,1.95,1.33,2.32,.11,.035,C.orange);
          box(x,.34,1.33,2.32,.12,.035,C.steel);
        }
        for(const x of [-6,6])box(x,1.14,-1.1,.11,1.75,4.7,C.roof);
        for(const x of [-4.5,4.5]){box(x,.44,-.4,1.9,.4,2.7,C.wood);for(let i=0;i<4;i++)box(x,.69+i*.14,-.4,1.9,.09,2.7,C.stone);}
        for(const x of [-5.8,5.8]){box(x,.34,2,.45,.12,.45,C.steel);box(x,.69,2,.16,.65,.16,C.orange);box(x,.8,2,.19,.1,.19,C.light);}
        box(0,1.25,1.76,6.05,1.17,.08,C.steel);
        sign(suspended?'共同開発・連携休止':'駅まち共同開発・工事中',site.label,0,1.25,1.81,6,1.12,C.steel);
        continue;
      }
      // Two thin roof wings and exposed seams retain human scale at street level.
      for(const x of [-3.2,3.2])box(x,4.2,-.75,6.25,.16,6.1,C.roof);
      box(0,4.24,-.75,.2,.21,6.18,C.steel);
      for(let x=-5.9;x<6.3;x+=1.2)box(x,4.31,-.75,.05,.045,6.1,C.joint);
      box(0,4.16,2.36,13,.25,.16,accent);
      for(const x of [-3.8,3.8])box(x,4.07,.8,3.2,.06,.13,C.light);
      // Understated stationward ticket/service counters: no new rail tracks or gates.
      for(const x of [-.9,.0,.9]){
        box(x,.91,-3.05,.69,1.3,.62,C.steel);
        box(x,1.22,-2.72,.5,.45,.04,C.glass);
        box(x,.84,-2.71,.46,.08,.045,C.light);
        box(x,1.63,-3.05,.72,.13,.65,accent);
      }
      sign(site.label,suspended?'共同開発 · 連携休止中':'渋谷駅まち · 共同開発',0,3.63,2.46,6.8,.91,accent);
      if(commerce){
        // An open promenade with a small station kiosk and a slatted meeting canopy.
        box(-4.35,1.45,-2.63,2.9,2.4,1.3,C.roof);
        box(-4.35,1.7,-1.956,2.65,1.25,.045,C.glass);
        box(-4.35,.94,-1.84,2.8,.14,.46,C.wood);
        for(const x of [-5.62,-4.35,-3.08])box(x,1.62,-1.91,.07,1.6,.08,C.steel);
        box(-4.35,2.86,-2.15,3.15,.13,2.25,accent);
        sign('まちの売店',suspended?'休止中':'KIOSK · 駅まち',-4.35,2.58,-1.935,2.4,.43,accent);
        for(let x=2;x<=5.8;x+=.32)box(x,3.65,-.75,.11,.16,4.8,C.wood);
        for(const x of [3.3,5.3]){
          box(x,.5,-.9,1.45,.5,.66,C.stone);
          for(let k=0;k<4;k++)box(x,.79,-1.12+k*.145,1.5,.07,.1,C.wood);
        }
        box(4.25,.64,-2.55,3.55,.76,.8,C.stone);
        for(let x=2.7;x<=5.8;x+=.55)box(x,1.18,-2.55,.57,.5,.69,C.leaf);
        // Small event directory faces the promenade, away from the station doors.
        box(5.75,1.5,1.65,.16,2.5,.17,C.steel);
        box(5.75,2.32,1.7,1.2,.86,.12,accent);
        for(let k=0;k<3;k++)box(5.75,2.56-k*.2,1.78,.86,.035,.02,C.light);
      }else{
        // Rental partnership is a lobby/service frontage, never a duplicate tower.
        box(-3.25,1.69,-2.7,4.75,2.86,.8,C.roof);
        box(-3.25,1.79,-2.275,4.28,2.15,.05,C.glass);
        for(const x of [-5.34,-3.25,-1.15])box(x,1.78,-2.22,.09,2.2,.09,C.wood);
        box(-3.25,.34,-1.98,4.5,.13,1.1,C.stone);
        for(let x=-5.75;x<-5.36;x+=.13)box(x,1.85,-2.05,.055,3.1,.12,C.wood);
        sign('駅まちレジデンス',suspended?'共同管理 · 連携休止中':'共同管理 · 住まいの窓口',-3.25,3.02,-2.195,4.1,.47,accent);
        // Mailboxes, parcel locker doors and sheltered cycle hoops distinguish use.
        for(let col=0;col<3;col++)for(let row=0;row<3;row++){
          const x=2.3+col*.48,y=.87+row*.43;
          box(x,y,-3.07,.44,.39,.5,C.steel);box(x,y+.09,-2.81,.27,.025,.02,C.light);
        }
        box(4.48,1.18,-3.07,1.22,1.84,.54,C.steel);
        for(const y of [.76,1.45]){box(4.48,y,-2.79,1.1,.59,.035,C.joint);box(4.84,y,-2.76,.035,.2,.025,C.light);}
        for(const x of [2.3,3.3,4.3,5.3]){
          for(const z of [-.85,.25])box(x,.65,z,.055,.8,.055,C.steel);
          box(x,1.06,-.3,.055,.065,1.15,C.steel);
        }
        box(-5.5,.56,.5,1,.58,1.7,C.stone);box(-5.5,1.02,.5,.85,.4,1.55,C.leaf);
      }
    }
    art.finish();
    let drawCalls=0,triangles=0,instances=0;
    art.group.traverse(object=>{if(object instanceof THREE.Mesh){const count=object instanceof THREE.InstancedMesh?object.count:1;drawCalls++;instances+=count;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*count;}});
    this.group.userData={projects:projects.map(({project:p,complete})=>({districtId:p.districtId,choiceId:p.choice!.id,status:p.status,complete,...RAIL_PROJECT_SITES[p.districtId]})),drawCalls,triangles,instances};
    this.content=art.group;this.group.add(art.group);
  }
}
