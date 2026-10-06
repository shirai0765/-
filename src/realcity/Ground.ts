import * as THREE from 'three';
import { assetURL } from './assets';
import { checkAbort, disposeRealObject, yieldLoading } from './textureBudget';

interface GroundManifest { tiles:{file:string;boundsLonLat:[number,number,number,number]}[]; source:string; totalBytes:number }
/** Raw official orthophotos draped on an explicitly flat local ENU approximation. */
export async function createPhotoGround(centerLonLat:[number,number],onProgress?:()=>void,signal?:AbortSignal) {
  const response=await fetch(assetURL('./models/real-shibuya-ground/manifest.json'),{signal});if(!response.ok)throw new Error(`GSI ground manifest HTTP ${response.status}`);
  const manifest:GroundManifest=await response.json();
  const group=new THREE.Group();group.name='GSI_seamless_aerial_flat_ground';group.userData={source:manifest.source,flatApproximation:true,demUsed:false,imageryModified:false};
  const lon0=centerLonLat[0]*Math.PI/180,lat0=centerLonLat[1]*Math.PI/180;
  function ecef(lon:number,lat:number){lon*=Math.PI/180;lat*=Math.PI/180;const n=6378137/Math.sqrt(1-.00669437999014*Math.sin(lat)**2);return new THREE.Vector3((n+50)*Math.cos(lat)*Math.cos(lon),(n+50)*Math.cos(lat)*Math.sin(lon),(n*(1-.00669437999014)+50)*Math.sin(lat));}
  const origin=ecef(...centerLonLat),east=new THREE.Vector3(-Math.sin(lon0),Math.cos(lon0),0),south=new THREE.Vector3(Math.sin(lat0)*Math.cos(lon0),Math.sin(lat0)*Math.sin(lon0),-Math.cos(lat0));
  const loader=new THREE.TextureLoader();
  // Serial image uploads bound GPU work and preserve a modest offline memory footprint.
  try { for(const tile of manifest.tiles){
    checkAbort(signal);
    const [west,southLat,eastLon,north]=tile.boundsLonLat;
    const positions:number[]=[];
    for(const [lon,lat]of [[west,north],[eastLon,north],[west,southLat],[eastLon,southLat]]){const p=ecef(lon,lat).sub(origin);positions.push(p.dot(east),0,p.dot(south));}
    const texture=await loader.loadAsync(assetURL(`./models/real-shibuya-ground/${tile.file}`));
    if(signal?.aborted){texture.dispose();checkAbort(signal);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,0,0,1,0],2));geometry.setIndex([0,2,1,2,3,1]);geometry.computeVertexNormals();
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));mesh.name=tile.file;group.add(mesh);onProgress?.();await yieldLoading(signal);
  }
  checkAbort(signal);group.userData.tileCount=manifest.tiles.length;return group;
  } catch(error) {disposeRealObject(group);throw error;}
}
