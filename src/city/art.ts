import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class CityArt {
  readonly group = new THREE.Group();
  readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private batches = new Map<string, {material: THREE.MeshStandardMaterial; matrices: THREE.Matrix4[]}>();
  private treeMatrices:THREE.Matrix4[][]=[[],[],[]];
  private surfaceTextures=new Map<string,THREE.CanvasTexture>();
  private signMaterials=new Map<string,THREE.MeshStandardMaterial>();
  private signGeometry=new THREE.PlaneGeometry(1,1);
  private signTextures=new Map<string,THREE.CanvasTexture>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  material(color: string, metalness = 0, roughness = .78) {
    if(['#507b96','#21516e','#486675','#55829e','#375e79','#405e63','#637477','#374d55','#586965','#718183','#485e65'].includes(color)){metalness=.12;roughness=.28;}
    const key = `${color}:${metalness}:${roughness}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({color, metalness, roughness}));
    return this.materials.get(key)!;
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,rotation=0, parent:THREE.Group=this.group) {
    const mesh = new THREE.Mesh(this.boxGeometry, this.material(color));
    mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.rotation.y=rotation;
    mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  batch(x:number,y:number,z:number,w:number,h:number,d:number,color:string,rotation=0) {
    if(!this.batches.has(color)) this.batches.set(color,{material:this.material(color),matrices:[]});
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotation),new THREE.Vector3(w,h,d));
    this.batches.get(color)!.matrices.push(matrix);
  }
  finish() {
    for(const {material,matrices} of this.batches.values()) {
      const mesh=new THREE.InstancedMesh(this.boxGeometry,material,matrices.length);
      matrices.forEach((m,i)=>mesh.setMatrixAt(i,m)); mesh.castShadow=true; mesh.receiveShadow=true; this.group.add(mesh);
    }
    this.batches.clear();
    const signs=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of [...this.group.children])if(child instanceof THREE.Mesh&&child.userData.batchedSign){const material=child.material as THREE.Material;if(!signs.has(material))signs.set(material,[]);signs.get(material)!.push(child);}
    for(const [material,items] of signs){const batch=new THREE.InstancedMesh(this.signGeometry,material,items.length);items.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);this.group.remove(mesh);});this.group.add(batch);}
    for(let shade=0;shade<3;shade++) {const matrices=this.treeMatrices[shade];if(!matrices.length)continue;const trees=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),this.material(['#455b34','#536b3b','#65734a'][shade]),matrices.length);matrices.forEach((m,i)=>trees.setMatrixAt(i,m));trees.castShadow=true;trees.receiveShadow=true;this.group.add(trees);}this.treeMatrices=[[],[],[]];
  }
  cylinder(x:number,y:number,z:number,r:number,h:number,color:string,segments=16,parent=this.group) {
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),this.material(color));
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh);return mesh;
  }
  sign(text:string,sub:string,bg:string,fg:string,w:number,h:number) {
    const key=[text,sub,bg,fg].join('|');
    let texture=this.signTextures.get(key);
    if(!texture){
    const c=document.createElement('canvas');c.width=512;c.height=160;
    const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,160);
    ctx.strokeStyle=fg;ctx.globalAlpha=.28;ctx.strokeRect(12,12,488,136);ctx.globalAlpha=1;
    ctx.fillStyle=fg;ctx.textAlign='center';ctx.font='bold 53px sans-serif';ctx.fillText(text,256,82,465);
    ctx.font='17px sans-serif';ctx.fillText(sub,256,121,460);
    texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;this.signTextures.set(key,texture);}
    if(!this.signMaterials.has(key))this.signMaterials.set(key,new THREE.MeshStandardMaterial({map:texture,roughness:.85,side:THREE.DoubleSide}));
    const mesh=new THREE.Mesh(this.signGeometry,this.signMaterials.get(key)!);mesh.scale.set(w,h,1);mesh.userData.batchedSign=true;
    return mesh;
  }
  /** Deterministic tiled aggregate and paving joints, shared by all street surfaces. */
  surface(x:number,y:number,z:number,w:number,d:number,kind:'asphalt'|'paving',rotation=0) {
    const key=kind;let texture=this.surfaceTextures.get(key);
    if(!texture){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};ctx.fillStyle=kind==='asphalt'?'#45484a':'#99958d';ctx.fillRect(0,0,256,256);for(let i=0;i<26000;i++){const v=Math.floor((kind==='asphalt'?45:124)+random()*48);ctx.fillStyle=`rgba(${v},${v},${v},.28)`;ctx.fillRect(random()*256,random()*256,1+random(),1+random());}if(kind==='paving'){ctx.strokeStyle='#777670';ctx.lineWidth=1;for(let y=0;y<256;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(y/32%2)*32;x<256;x+=64){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+32);ctx.stroke();}}}texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;this.surfaceTextures.set(key,texture);}
    const materialKey='surface:'+kind;let material=this.materials.get(materialKey);if(!material){material=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:kind==='asphalt'?.045:.025,roughness:.94});this.materials.set(materialKey,material);}
    const geometry=new THREE.PlaneGeometry(w,d);const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/8,uv.getY(i)*d/8);const mesh=new THREE.Mesh(geometry,material);mesh.rotation.set(-Math.PI/2,0,-rotation);mesh.position.set(x,y,z);mesh.receiveShadow=true;this.group.add(mesh);return mesh;
  }
  tree(x:number,z:number,size=1) {
    this.batch(x,2.2*size,z,.25*size,4.4*size,.25*size,'#665849');
    // Smaller irregular overlapping crowns preserve branches and sky gaps.
    for(let i=0;i<9;i++){const a=i*2.399,rad=i===0?0:1.05+(i%3)*.16;const scale=(.83+(i%4)*.12)*size;this.treeMatrices[i%3].push(new THREE.Matrix4().compose(new THREE.Vector3(x+Math.cos(a)*rad*size,(4.3+(i%3)*.57)*size,z+Math.sin(a)*rad*size),new THREE.Quaternion().setFromEuler(new THREE.Euler(i*.4,i*.8,i*.2)),new THREE.Vector3(scale,scale*1.35,scale)));}
    this.batch(x,.4,z,1.7*size,.18,1.7*size,'#585c54');
  }
}

export function disposeScene(scene:THREE.Object3D) {
  const geometries=new Set<THREE.BufferGeometry>(); const materials=new Set<THREE.Material>(); const textures=new Set<THREE.Texture>();
  scene.traverse(o=>{if(o instanceof THREE.Mesh || o instanceof THREE.Sprite){if(o instanceof THREE.Mesh)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  // GLTFLoader can decode embedded images into ImageBitmaps; Texture.dispose alone
  // does not close their CPU-side storage. Deduplicate shared image sources too.
  if(typeof ImageBitmap!=='undefined'){const images=new Set<ImageBitmap>();for(const texture of textures){const image=texture.source.data;if(image instanceof ImageBitmap)images.add(image);}images.forEach(image=>image.close());}
}

/** Collapse rigid vehicle pieces by material; movement stays on the parent group. */
export function compactRigidGroup(group:THREE.Group) {
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  for(const child of [...group.children]) {
    if(!(child instanceof THREE.Mesh)||Array.isArray(child.material))continue;
    child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);
    if(!batches.has(child.material))batches.set(child.material,[]);
    batches.get(child.material)!.push(geometry);group.remove(child);
  }
  for(const [material,geometries] of batches){
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(geometry){const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  }
}

/** Small analytic sky: neutral ground, a pale horizon and blue zenith reflected in glass. */
export function createDaylightEnvironment(renderer:THREE.WebGLRenderer) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  const sky=ctx.createLinearGradient(0,0,0,256);
  sky.addColorStop(0,'#81b9e8');sky.addColorStop(.43,'#d5eafa');sky.addColorStop(.51,'#eef3f5');sky.addColorStop(.57,'#b3bdc2');sky.addColorStop(1,'#76818a');
  ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromEquirectangular(texture);texture.dispose();pmrem.dispose();
  return environment;
}
