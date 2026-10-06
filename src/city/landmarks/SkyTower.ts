import * as THREE from 'three';

/** An authored Scramble Square-inspired tower, not surveyed/photogrammetric geometry.
 * Dimensions are compressed to the playable district scale. Origin: centre at grade. */
export function createSkyTower(): THREE.Group {
  const group = new THREE.Group(); group.name = 'SHIBUYA SKYLINE — observation tower';
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const material = (color: string, metalness = 0, roughness = .65) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const steel = material('#a8b5b6', .7, .3), dark = material('#263d48', .4, .38);
  const glass = material('#366f96', .5, .2), lightGlass = material('#79acd0', .4, .26);
  const stone = material('#eeeae2'), deck = material('#9c927d'), greenery = material('#398a37');
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material) => {
    const m = new THREE.Mesh(cube, mat); m.position.set(x,y,z); m.scale.set(w,h,d); m.castShadow=true; m.receiveShadow=true; group.add(m); return m;
  };
  const batches = new Map<THREE.Material, THREE.Matrix4[]>();
  const instance = (x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material) => {
    const transforms=batches.get(mat)||[];
    transforms.push(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d)));batches.set(mat,transforms);
  };
  // Broad commercial podium and the stepped eastern shoulder distinguish the silhouette.
  box(0,6,0,42,12,34,stone); box(0,14,0,39,4,31,dark);
  box(-3,64,-1,32,96,27,glass); box(16,39,0,6,46,29,lightGlass);
  box(-3,113,-1,33,2,28,steel); box(-3,116,-1,32,4,27,dark);
  // Individual panes subtly vary while their thin mullions preserve the curtain wall rhythm.
  for(let floor=0;floor<31;floor++) {
    const y=18+floor*3;
    for(let col=0;col<10;col++) {
      const x=-17.7+col*3.25;
      instance(x,y,12.6,3,.15,.24,steel);
      instance(x,y,-14.6,3,.15,.24,steel);
      if((floor*7+col*3)%9===0) {instance(x,y+1.15,12.57,2.9,2.05,.08,lightGlass);instance(x,y+1.15,-14.57,2.9,2.05,.08,lightGlass);}
    }
    instance(-3,y,12.75,32,.2,.3,dark);instance(-3,y,-14.75,32,.2,.3,dark);
    instance(-19.15,y,-1,.3,.2,27,dark);instance(13.15,y,-1,.3,.2,27,dark);
  }
  for(let col=0;col<=10;col++) {const x=-19+col*3.2;instance(x,65,12.85,.15,94,.25,steel);instance(x,65,-14.85,.15,94,.25,steel);}
  for(let col=0;col<=8;col++) {const z=-14.5+col*3.4;instance(-19.25,65,z,.2,94,.15,steel);instance(13.25,65,z,.2,94,.15,steel);}
  // Four visually weighty mega-columns and the slim upper crown.
  for(const x of [-18.5,12.5])for(const z of [-14,12])box(x,65,z,.65,100,.65,steel);
  for(let i=0;i<14;i++) {instance(16,18+i*3,14.6,6,.16,.25,steel);instance(16,18+i*3,-14.6,6,.16,.25,steel);}
  // Podium: retail windows, recessed entrances, pedestrian terraces and vertical blade fins.
  for(const z of [-17.05,17.05])for(let x=-18;x<=18;x+=3) {
    instance(x,6,z,2.65,8,.12,dark);instance(x,6,z+(z>0?.12:-.12),.18,9,.24,steel);
    instance(x,7.7,z,2.7,.22,.25,steel);
  }
  for(const x of [-21.08,21.08])for(let z=-14;z<=14;z+=3.5){instance(x,6,z,.15,8,3.1,dark);instance(x,6,z,.3,9,.16,steel);}
  box(0,4,17.45,8,7,.35,dark);box(0,8.2,18.4,14,.5,3,steel);
  for(let i=0;i<6;i++)box(0,.12+i*.17,18.1-i*.32,12,.24+i*.34,.6,stone);
  // Sky deck, planted edge, transparent windscreens and a circular helipad marker.
  box(-3,118.1,-1,31,.28,26,deck);
  const screenMat = new THREE.MeshPhysicalMaterial({color:'#bad9dd',metalness:.1,roughness:.15,transparent:true,opacity:.36,depthWrite:false,side:THREE.DoubleSide});
  for(const z of [-14,12])box(-3,119.4,z,32,2.6,.12,screenMat);
  for(const x of [-19,13])box(x,119.4,-1,.12,2.6,26,screenMat);
  for(let x=-19;x<=13;x+=4) {instance(x,119.4,-14,.12,2.7,.16,steel);instance(x,119.4,12,.12,2.7,.16,steel);}
  for(let z=-14;z<=12;z+=3.7){instance(-19,119.4,z,.16,2.7,.12,steel);instance(13,119.4,z,.16,2.7,.12,steel);}
  box(-3,118.35,-11.7,20,.35,2,greenery);box(-16.9,118.35,-1,2,.35,15,greenery);
  const helipad=new THREE.Mesh(new THREE.RingGeometry(5.2,5.42,64),material('#e7e4d7'));helipad.rotation.x=-Math.PI/2;helipad.position.set(-2,118.3,0);group.add(helipad);
  box(-3.3,118.31,0,.23,.02,3.6,stone);box(-.7,118.31,0,.23,.02,3.6,stone);box(-2,118.31,0,2.6,.02,.24,stone);
  box(7,120,-7,5,3.5,6,dark);box(7,122,-7,5.5,.25,6.5,steel);
  // Roof access staircase and a tiny lookout crowd give scale at near zoom.
  for(let i=0;i<12;i++)instance(6.3,118.45+i*.24,-2+i*.36,2.8,.2,.46,steel);
  const personGeometry=new THREE.CapsuleGeometry(.16,.65,2,5);
  for(const [i,x,z] of [[0,-14,7],[1,-10,10],[2,8,9],[3,10,-3],[4,-8,-8],[5,-6,4]]) {
    const person=new THREE.Mesh(personGeometry,material(i%2?'#b9a082':'#344856'));person.position.set(x,118.8,z);group.add(person);
  }
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#233b47';ctx.fillRect(0,0,1024,256);ctx.textAlign='center';ctx.fillStyle='#efe8d8';ctx.font='500 77px sans-serif';ctx.fillText('SHIBUYA SKYLINE',512,117);ctx.font='30px sans-serif';ctx.fillStyle='#cbb57c';ctx.fillText('渋谷から、世界へ。',512,183);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(24,6),new THREE.MeshStandardMaterial({map:tex,roughness:.75}));sign.position.set(0,13,17.25);group.add(sign);
  }
  for(const [mat,transforms] of batches) {
    const mesh=new THREE.InstancedMesh(cube,mat,transforms.length);transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
