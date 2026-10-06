import * as THREE from 'three';

/** Miyashita Park inspired architectural study, artist-built and dimensionally approximate.
 * Not a measured survey or an exact replica. Fictional shop names are intentional.
 * Local coordinates: east +X, south +Z; 35 × 57 m, ground Y=0, canopy Y≈18 m.
 */
export function createMiyashita(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Miyashita Park — architectural interpretation';
  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: '#c4c2b8', roughness: .87 }),
    dark: new THREE.MeshStandardMaterial({ color: '#343f41', roughness: .55 }),
    metal: new THREE.MeshStandardMaterial({ color: '#929e92', metalness: .55, roughness: .42 }),
    glass: new THREE.MeshStandardMaterial({ color: '#71918f', metalness: .4, roughness: .23 }),
    warm: new THREE.MeshStandardMaterial({ color: '#e3c38b', emissive: '#9a673a', emissiveIntensity: .12, roughness: .7 }),
    paving: new THREE.MeshStandardMaterial({ color: '#ddd7c8', roughness: .96 }),
    wood: new THREE.MeshStandardMaterial({ color: '#987455', roughness: .9 }),
    grass: new THREE.MeshStandardMaterial({ color: '#718c4b', roughness: 1 }),
    hedge: new THREE.MeshStandardMaterial({ color: '#4f7143', roughness: 1 }),
    coral: new THREE.MeshStandardMaterial({ color: '#b65742', roughness: .8 }),
    cream: new THREE.MeshStandardMaterial({ color: '#ece6d7', roughness: .86 }),
  };
  type Mat = keyof typeof materials;
  const batches = new Map<Mat, THREE.Matrix4[]>();
  const transform = new THREE.Object3D();
  function box(m: Mat, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) {
    transform.position.set(x, y, z); transform.rotation.set(0, ry, 0); transform.scale.set(w, h, d); transform.updateMatrix();
    if (!batches.has(m)) batches.set(m, []);
    batches.get(m)!.push(transform.matrix.clone());
  }
  function beam(a: THREE.Vector3, b: THREE.Vector3, thickness: number, material: Mat = 'metal') {
    transform.position.copy(a).add(b).multiplyScalar(.5);
    transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    transform.scale.set(thickness, a.distanceTo(b), thickness); transform.updateMatrix();
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material)!.push(transform.matrix.clone());
  }
  box('stone', 0, .25, 0, 32, .5, 52);
  // Three readable retail levels; recessed warm shop interiors behind cool shopfronts.
  for (let f = 0; f < 3; f++) {
    const floor = f * 4;
    box('stone', 0, floor + .65, 0, 32.4, .55, 51.8);
    box('dark', 0, floor + 3.85, 0, 32.5, .28, 51.9);
    box('warm', 0, floor + 2.1, 0, 30.5, 2.55, 50);
    for (const side of [-1, 1]) {
      box('glass', side * 15.75, floor + 2.2, 0, .16, 2.75, 50.6);
      box('glass', 0, floor + 2.2, side * 25.3, 31.4, 2.75, .16);
      box('metal', side * 16, floor + 1.1, 0, .18, .12, 51.2);
      box('metal', side * 16, floor + 3.35, 0, .18, .12, 51.2);
      for (let z = -24; z <= 24; z += 2.4) {
        box('metal', side * 15.98, floor + 2.18, z, .18, 2.98, .12);
        // Slight variety in occupied storefront panels creates a human-scale retail rhythm.
        if (Math.round((z + 24) / 2.4) % 4 === 1)
          box('wood', side * 16.08, floor + 2.25, z, .15, 2.3, 1.05);
      }
      for (let x = -14.4; x <= 14.5; x += 2.4)
        box('metal', x, floor + 2.18, side * 25.45, .12, 2.98, .18);
      // Narrow walking balconies and fine balustrades.
      if (f > 0) {
        box('paving', side * 16.5, floor + .84, 0, 1.1, .18, 50.8);
        box('metal', side * 17, floor + 1.85, 0, .1, .08, 50.7);
        for (let z = -25; z <= 25; z += 1.5)
          box('metal', side * 17, floor + 1.35, z, .065, 1, .065);
      }
    }
  }
  // Exposed tapered-looking diagonal steelwork along the mall's long facades.
  for (const side of [-1, 1]) {
    for (let z = -24; z < 24; z += 8) {
      beam(new THREE.Vector3(side * 16.25, .5, z), new THREE.Vector3(side * 16.25, 12.25, z + 7.8), .22);
      box('dark', side * 16.25, 6.1, z, .27, 11.5, .27);
    }
  }
  box('stone', 0, 12.3, 0, 33, .65, 52.5);
  box('paving', 0, 12.66, 0, 32.4, .13, 52);
  // Rooftop lawns separated by the central public promenade.
  for (const side of [-1, 1]) {
    for (let z = -18; z <= 18; z += 12) {
      box('stone', side * 8.8, 12.92, z, 8.4, .48, 9.3);
      box('grass', side * 8.8, 13.17, z, 8.05, .1, 8.95);
      box('wood', side * 4.75, 13.23, z, .65, .3, 8.8);
      box('hedge', side * 12.45, 13.52, z, .5, .7, 8.7);
    }
    box('metal', side * 16.3, 13.7, 0, .1, .09, 52);
    for (let z = -26; z <= 26; z += 1.3)
      box('metal', side * 16.3, 13.2, z, .055, 1.04, .055);
  }
  // Characteristic curved cage/pergola. Thin ribs keep the open park visible from above.
  for (let z = -25; z <= 25; z += 3.125) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = Math.PI * i / 40;
      points.push(new THREE.Vector3(15.6 * Math.cos(t), 13 + 4.8 * Math.sin(t), z));
    }
    const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, .075, 5, false), materials.metal);
    arch.name = 'Curved rooftop pergola rib'; root.add(arch);
  }
  for (let i = 0; i <= 20; i++) {
    const t = Math.PI * i / 20;
    box('metal', 15.6 * Math.cos(t), 13 + 4.8 * Math.sin(t), 0, .065, .065, 50);
  }
  // Entrance stairs fit within the district footprint; paired flights rise to each terrace.
  for (const side of [-1, 1]) {
    for (let step = 0; step < 21; step++) {
      const h = (step + 1) * .19;
      box('stone', -10 + step * .42, h / 2, side * 27, .43, h, 2.45);
    }
    for (let f = 1; f < 3; f++) {
      const y0 = f * 4;
      for (let step = 0; step < 21; step++) {
        const h = (step + 1) * .19;
        box('stone', -1 + step * .42, y0 + h / 2, side * 27, .43, h, 2.45);
      }
      for (const edge of [-1, 1])
        beam(new THREE.Vector3(-1, y0 + 1, side * 27 + edge * 1.2), new THREE.Vector3(7.4, y0 + 5, side * 27 + edge * 1.2), .07);
    }
    box('cream', 4.5, 2.95, side * 25.62, 7, .9, .12);
    box('coral', -8, 7, side * 25.62, 4.6, .85, .12);
  }
  // Trees use two instanced low-poly crown lobes per trunk, not per-leaf geometry.
  const treePositions: THREE.Vector3[] = [];
  for (const side of [-1, 1]) for (const z of [-20, -8, 4, 16]) {
    const x = side * 10;
    box('wood', x, 14, z, .15, 1.8, .15);
    treePositions.push(new THREE.Vector3(x, 15.3, z));
  }
  const foliage = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), materials.hedge, treePositions.length * 2);
  treePositions.forEach((p, i) => {
    transform.position.copy(p); transform.rotation.set(.15 * i, .8 * i, 0); transform.scale.set(1.2, 1.55, 1.3); transform.updateMatrix(); foliage.setMatrixAt(i * 2, transform.matrix);
    transform.position.copy(p).add(new THREE.Vector3(.65, -.35, .3)); transform.scale.set(1, 1.1, 1); transform.updateMatrix(); foliage.setMatrixAt(i * 2 + 1, transform.matrix);
  });
  foliage.name = 'Rooftop trees'; root.add(foliage);
  // Rooftop cafe pavilion and furniture; restrained detail remains readable at city scale.
  box('glass', 0, 14.05, -21, 6, 2.6, 6);
  box('dark', 0, 15.45, -21, 6.4, .2, 6.4);
  for (let x = -2.7; x <= 2.7; x += .9) box('wood', x, 14.05, -24.06, .075, 2.6, .075);
  for (const z of [-12, 0, 12, 21]) {
    box('wood', 0, 13.4, z, 1.6, .1, 1);
    box('dark', 0, 13.03, z, .12, .74, .12);
    for (const x of [-1.3, 1.3]) { box('wood', x, 13.16, z, .6, .1, .6); box('dark', x, 12.92, z, .13, .44, .13); }
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  for (const [m, matrices] of batches) {
    const mesh = new THREE.InstancedMesh(unitBox, materials[m], matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.name = `Mall ${m} details`; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  }
  // Browser-only local canvas lettering. Geometry is still complete in headless exports.
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#e9e5da'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = '#344541';
      ctx.font = 'bold 61px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('MIYANO PARK  •  星コーヒー', 512, 67);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.625), new THREE.MeshStandardMaterial({ map: texture, roughness: .85 }));
      sign.position.set(0, 11.15, 25.63); sign.name = 'Fictional shopping mall sign'; root.add(sign);
    }
  }
  root.userData = { source: 'Artist-built Miyashita Park inspired model; approximate, not surveyed', dimensionsMeters: [35, 18, 57] };
  return root;
}
