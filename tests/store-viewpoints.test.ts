import { describe,expect,it } from 'vitest';
import * as THREE from 'three';
import { LOTS } from '../src/data/district';
import { getStoreViewpoint,isStoreViewpointClear } from '../src/city/storeViewpoints';
import { CITY_DISPLAY_LOTS,OMITTED_SCENERY_LOTS } from '../src/city/displayLayout';

describe('store close-up endpoints',()=>{
  it('reserves static storefront space without changing any purchasable parcel',()=>{
    expect(OMITTED_SCENERY_LOTS).toHaveLength(12);
    expect(OMITTED_SCENERY_LOTS.every(l=>!l.available)).toBe(true);
    for(const lot of LOTS.filter(l=>l.available))expect(CITY_DISPLAY_LOTS.find(l=>l.id===lot.id)).toBe(lot);
  });
  it('keeps all 48 purchasable storefronts clear of neighboring buildings in all styles',()=>{
    const lots=LOTS.filter(l=>l.available);expect(lots).toHaveLength(48);
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
  it.each([[390,844],[1000,760]])('frames the actual name-sign bounds for all 32 lots and styles at %i×%i', (width,height)=>{
    for(const lot of LOTS.filter(lot=>lot.available))for(const style of ['standard','premium','takeaway'] as const){
      const view=getStoreViewpoint(lot,style,width/height);
      const label=`${lot.id}/${style} at ${width}×${height}`;
      expect(view,label).not.toBeNull();
      expect(isStoreViewpointClear(lot,view!),`${label} obstruction`).toBe(true);
      const camera=new THREE.PerspectiveCamera(view!.fov,width/height,.5,1800);
      camera.position.fromArray(view!.position);camera.lookAt(...view!.target);camera.updateMatrixWorld();
      const detailed=style==='premium'&&lot.id!=='center-03',cafeWidth=Math.min(lot.width-.8,12);
      // The PlaneGeometry and transform used by CityGrowth's business sign.
      // Neighbor clearance and sign framing do not establish full-building or GLB visibility.
      const geometry=new THREE.PlaneGeometry(detailed?cafeWidth*.6:Math.min(lot.width-1,16),detailed?.5:2.8);
      const sign=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
      sign.position.set(detailed?cafeWidth*.12:0,detailed?3.47:5.1,lot.depth/2+(detailed?.54:.82));
      const frontage=new THREE.Group();frontage.position.set(lot.x,0,lot.z);frontage.rotation.y=lot.rotation??0;
      frontage.add(sign);frontage.updateMatrixWorld(true);
      const corners=geometry.getAttribute('position');
      for(let index=0;index<corners.count;index++){
        const projected=new THREE.Vector3().fromBufferAttribute(corners,index).applyMatrix4(sign.matrixWorld).project(camera);
        expect(Math.abs(projected.x),`${label} sign horizontal edge`).toBeLessThanOrEqual(.920001);
        expect(Math.abs(projected.y),`${label} sign vertical edge`).toBeLessThanOrEqual(.920001);
        expect(projected.z,`${label} sign depth`).toBeGreaterThan(-1);
        expect(projected.z,`${label} sign depth`).toBeLessThan(1);
      }
      geometry.dispose();sign.material.dispose();
    }
  });
});
