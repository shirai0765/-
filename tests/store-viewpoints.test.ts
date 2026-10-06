import { describe,expect,it } from 'vitest';
import { LOTS } from '../src/data/district';
import { getStoreViewpoint,isStoreViewpointClear } from '../src/city/storeViewpoints';
import { CITY_DISPLAY_LOTS,OMITTED_SCENERY_LOTS } from '../src/city/displayLayout';

describe('store close-up endpoints',()=>{
  it('reserves static storefront space without changing any purchasable parcel',()=>{
    expect(OMITTED_SCENERY_LOTS).toHaveLength(11);
    expect(OMITTED_SCENERY_LOTS.every(l=>!l.available)).toBe(true);
    for(const lot of LOTS.filter(l=>l.available))expect(CITY_DISPLAY_LOTS.find(l=>l.id===lot.id)).toBe(lot);
  });
  it('keeps all 32 purchasable storefronts clear of neighboring buildings in all styles',()=>{
    const lots=LOTS.filter(l=>l.available);expect(lots).toHaveLength(32);
    for(const lot of lots)for(const style of ['standard','premium','takeaway'] as const){
      const view=getStoreViewpoint(lot,style);expect(view,`${lot.id}/${style}`).not.toBeNull();
      expect(isStoreViewpointClear(lot,view!),`${lot.id}/${style} obstruction`).toBe(true);
      expect(view!.position[1]).toBeGreaterThanOrEqual(4);
      const distance=Math.hypot(...view!.position.map((v,i)=>v-view!.target[i]));
      expect(distance).toBeGreaterThan(5);expect(distance).toBeLessThan(40);
    }
  });
  it('faces local +Z after rotation and widens framing on narrow screens',()=>{
    const original=LOTS.find(l=>l.id==='center-01')!;
    const lot={...original,x:-500,z:-500,rotation:Math.PI/2};
    const wide=getStoreViewpoint(lot,'premium',1.5)!,narrow=getStoreViewpoint(lot,'premium',.7)!;
    expect(wide.position[0]).toBeGreaterThan(wide.target[0]);
    expect(Math.abs(wide.position[2]-wide.target[2])).toBeLessThan(.01);
    expect(narrow.fov).toBeGreaterThan(wide.fov);expect(narrow.fov).toBeLessThanOrEqual(74);
  });
});
