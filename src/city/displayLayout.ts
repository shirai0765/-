import { LOTS } from '../data/district';
import type { Lot } from '../model';

/** Static layout of the fictional game map; economic parcels and PLATEAU are untouched. */
export const STORE_FRONT_CLEARANCE_METRES=8;

function blocksStoreApproach(background:Lot,store:Lot){
  const r=store.rotation??0,c=Math.cos(r),s=Math.sin(r),relative=(background.rotation??0)-r;
  const dx=(background.x-store.x)*c-(background.z-store.z)*s;
  const dz=(background.x-store.x)*s+(background.z-store.z)*c;
  const halfWidth=(Math.abs(Math.cos(relative))*background.width+Math.abs(Math.sin(relative))*background.depth)/2;
  const halfDepth=(Math.abs(Math.sin(relative))*background.width+Math.abs(Math.cos(relative))*background.depth)/2;
  return Math.abs(dx)<halfWidth+store.width/2+1&&dz+halfDepth>store.depth/2&&dz-halfDepth<store.depth/2+STORE_FRONT_CLEARANCE_METRES;
}

const stores=LOTS.filter(l=>l.available);
export const OMITTED_SCENERY_LOTS=LOTS.filter(l=>!l.available&&stores.some(store=>blocksStoreApproach(l,store)));
const omitted=new Set(OMITTED_SCENERY_LOTS.map(l=>l.id));
export const CITY_DISPLAY_LOTS=LOTS.filter(l=>!omitted.has(l.id));
