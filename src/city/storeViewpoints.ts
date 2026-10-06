import type { Lot, StoreStyle } from '../model';
import { LANDMARKS } from '../data/district';
import { CITY_DISPLAY_LOTS } from './displayLayout';

export interface StoreViewpoint { position:[number,number,number];target:[number,number,number];fov:number }
type Obstacle={id:string;x:number;z:number;width:number;depth:number;height:number;rotation?:number};
// Include neighboring shop terraces and the reserved landmark envelopes, not just walls.
const obstacles:Obstacle[]=[
  ...CITY_DISPLAY_LOTS.map(l=>({...l,z:l.z+(l.available?1.2*Math.cos(l.rotation??0):0),x:l.x+(l.available?1.2*Math.sin(l.rotation??0):0),width:l.width+1.6,depth:l.depth+(l.available?4:1.6),height:l.height+14})),
  ...LANDMARKS.filter(l=>l.kind!=='crossing').map(l=>({id:l.id,x:l.x,z:l.z,width:l.kind==='park'?62:l.kind==='tower'?46:l.kind==='station'?38:40,depth:l.kind==='park'?78:l.kind==='tower'?52:l.kind==='station'?70:42,height:l.kind==='station'?15:l.height??50})),
  {id:'rail-corridor',x:75,z:0,width:19,depth:430,height:15},
];

function intersects(a:StoreViewpoint['position'],b:StoreViewpoint['position'],o:Obstacle){
  const c=Math.cos(o.rotation??0),s=Math.sin(o.rotation??0);
  const local=(p:StoreViewpoint['position'])=>[(p[0]-o.x)*c-(p[2]-o.z)*s,p[1],(p[0]-o.x)*s+(p[2]-o.z)*c];
  const from=local(a),to=local(b),low=[-o.width/2-.5,-1,-o.depth/2-.5],high=[o.width/2+.5,o.height,o.depth/2+.5];
  let near=0,far=1;
  for(let axis=0;axis<3;axis++){
    const delta=to[axis]-from[axis];
    if(Math.abs(delta)<1e-8){if(from[axis]<low[axis]||from[axis]>high[axis])return false;continue;}
    const first=(low[axis]-from[axis])/delta,last=(high[axis]-from[axis])/delta;
    near=Math.max(near,Math.min(first,last));far=Math.min(far,Math.max(first,last));
    if(near>far)return false;
  }
  return true;
}

/** Conservative building/rail clearance for both endpoint and the sightline. */
export function isStoreViewpointClear(lot:Lot,view:StoreViewpoint){
  return view.position[1]>=4&&!obstacles.some(o=>o.id!==lot.id&&intersects(view.position,view.target,o));
}

/** A storefront faces local +Z. The premium GLB is 8.14m wide, unlike its host parcel. */
export function getStoreViewpoint(lot:Lot,style:StoreStyle,aspect=1.3):StoreViewpoint|null {
  const detailed=style==='premium'&&lot.id!=='center-03';
  const c=Math.cos(lot.rotation??0),s=Math.sin(lot.rotation??0);
  const world=(x:number,y:number,z:number):[number,number,number]=>[lot.x+x*c+z*s,y,lot.z-x*s+z*c];
  const front=lot.depth/2+.9,aimX=0,aimY=detailed?2.25:3.25;
  const width=detailed?10.8:lot.width+1.8,preferred=detailed?12.5:19;
  for(const aimShift of [0,.22,-.22,.34,-.34,.4,-.4]){
    const target=world(aimX+lot.width*aimShift,aimY,front);
    for(const distance of [preferred,preferred*.85,preferred*1.15,preferred*.7,preferred*1.35,7]){
    for(const side of [0,.24,-.24,.48,-.48,.75,-.75,1,-1]){
      const position=world(aimX+lot.width*(side+aimShift),Math.max(4.5,aimY+distance*.19),front+distance);
      const fov=Math.max(40,Math.min(74,2*Math.atan(width/(2*Math.max(.65,aspect)*distance))*180/Math.PI));
      const view={position,target,fov};
      if(isStoreViewpointClear(lot,view))return view;
    }
    }
  }
  // An unrecognized or newly crowded parcel never places the camera inside a building.
  return null;
}
