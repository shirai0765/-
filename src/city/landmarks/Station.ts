import * as THREE from 'three';

/**
 * Shibuya-inspired elevated station: island and side platforms, green railway
 * fascia, steel butterfly canopies, tactile paving, retail and glass overpass.
 * This is an original procedural architectural interpretation, not surveyed
 * station geometry; dimensions are artistic approximations (25 × 68 metres).
 * Railway centre lines are x=-4/+4, railhead y=3, platforms y=3.45; z runs south.
 * No photographs, logos, downloaded textures or externally licensed assets.
 */
export function createStation(): THREE.Group {
  const group = new THREE.Group(); group.name = 'Shibuya_station_architectural_model';
  const materials: Record<string, THREE.MeshStandardMaterial> = {
    concrete: new THREE.MeshStandardMaterial({ color: '#bfc2c2', roughness: .87 }),
    pale: new THREE.MeshStandardMaterial({ color: '#efefea', roughness: .75 }),
    dark: new THREE.MeshStandardMaterial({ color: '#343f43', roughness: .6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#aeb8b7', metalness: .65, roughness: .36 }),
    rail: new THREE.MeshStandardMaterial({ color: '#7b888d', metalness: .9, roughness: .26 }),
    ballast: new THREE.MeshStandardMaterial({ color: '#535655', roughness: 1 }),
    sleeper: new THREE.MeshStandardMaterial({ color: '#877d6c', roughness: .95 }),
    green: new THREE.MeshStandardMaterial({ color: '#21983b', roughness: .6 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#efc525', roughness: .75 }),
    glass: new THREE.MeshStandardMaterial({ color: '#83a7aa', metalness: .22, roughness: .18, transparent: true, opacity: .55, depthWrite: false }),
    white: new THREE.MeshStandardMaterial({ color: '#e8e8df', roughness: .65 }),
    light: new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#f9ddb0', emissiveIntensity: .45, roughness: .3 }),
    wood: new THREE.MeshStandardMaterial({ color: '#9e7050', roughness: .76 }),
    vending: new THREE.MeshStandardMaterial({ color: '#db2e28', roughness: .45 }),
  };
  type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] };
  const batches = new Map<string, Batch>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const dummy = new THREE.Object3D();
  function instance(shape: 'box' | 'cylinder', mat: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0, rx = 0) {
    const key = `${shape}:${mat}`;
    if (!batches.has(key)) batches.set(key, { geometry: shape === 'box' ? cube : cylinder, material: materials[mat], matrices: [] });
    dummy.position.set(x, y, z); dummy.rotation.set(rx, 0, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone());
  }
  const box = (mat: string, x: number, y: number, z: number, w: number, h: number, d: number, rz = 0, rx = 0) => instance('box', mat, x, y, z, w, h, d, rz, rx);
  function beam(mat: string, a: THREE.Vector3, b: THREE.Vector3, thickness: number) {
    const center = a.clone().add(b).multiplyScalar(.5); const direction = b.clone().sub(a);
    const key = `box:${mat}`;
    if (!batches.has(key)) batches.set(key, { geometry: cube, material: materials[mat], matrices: [] });
    dummy.position.copy(center); dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()); dummy.scale.set(thickness, direction.length(), thickness); dummy.updateMatrix(); batches.get(key)!.matrices.push(dummy.matrix.clone());
  }
  function sign(text: string, x: number, y: number, z: number, w: number, h: number, rotation = 0, background = '#f0f1e7', foreground = '#25342d') {
    box('green', x, y, z, w + .12, h + .12, .1);
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#4f8e48'; ctx.fillRect(0, 202, 1024, 28);
    ctx.fillStyle = foreground; ctx.font = 'bold 95px "Noto Sans JP", "Yu Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 107, 985);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: .6, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z + .065); mesh.rotation.y = rotation; mesh.name = `Station_sign_${text}`; group.add(mesh);
  }

  // Raised railway viaduct with expansion joints, cross-girders and chamfer-like caps.
  box('concrete', 0, 2.55, 3.45, 24.7, .55, 61.1);
  box('concrete', 0, 2.55, -30.55, 14.0, .55, 6.9);
  box('dark', 0, 2.24, 3.45, 24.4, .12, 61.0);
  for (const z of [-29, -19, -9, 1, 11, 21, 31]) {
    box('concrete', 0, 2.03, z, 22.7, .36, .9);
    for (const x of [-10.2, 0, 10.2]) {
      box('concrete', x, 1.03, z, .8, 2.06, .9);
      box('pale', x, 2.0, z, 1.25, .35, 1.15);
      box('concrete', x, .11, z, 1.32, .22, 1.35);
    }
    box('dark', 0, 2.831, z + 4, 24.5, .015, .035);
  }
  for (const x of [-12.25, 12.25]) {
    box('pale', x, 3.36, 0, .28, 1.02, 67.6);
    box('green', x, 3.9, 0, .33, .09, 67.8);
  }

  // Ballast, individual sleepers and running rails form both through lines.
  for (const track of [-4, 4]) {
    box('ballast', track, 2.85, 0, 3.2, .13, 68);
    for (let z = -33.5; z <= 33.5; z += .67) box('sleeper', track, 2.94, z, 2.35, .10, .22);
    for (const rail of [-.72, .72]) {
      box('rail', track + rail, 3.025, 0, .09, .14, 68);
      box('rail', track + rail, 2.985, 0, .18, .035, 68);
    }
    // Cable channels alongside track bed.
    box('dark', track + 1.54, 2.95, 0, .16, .18, 68);
  }

  // Three platforms: centre island plus two side platforms.
  for (const x of [-9, 0, 9]) {
    const width = x === 0 ? 4.15 : 5.1;
    const platformDepth = x === 0 ? 65 : 59;
    const platformCenter = x === 0 ? 0 : 3;
    box('concrete', x, 3.12, platformCenter, width, .58, platformDepth);
    box('pale', x, 3.425, platformCenter, width, .07, platformDepth);
    const edges = x === 0 ? [-1, 1] : [x < 0 ? 1 : -1];
    for (const edge of edges) {
      const edgeX = x + edge * (width / 2 - .25);
      box('yellow', edgeX, 3.477, platformCenter, .28, .035, platformDepth - .7);
      box('white', x + edge * (width / 2 - .04), 3.47, platformCenter, .065, .018, platformDepth - .3);
      for (let z = x === 0 ? -31 : -25; z < 32; z += 1) {
        box('dark', edgeX, 3.499, z, .21, .008, .025);
        for (const offset of [-.075, .075]) box('yellow', edgeX + offset, 3.505, z + .24, .035, .018, .09);
      }
      for (const z of [-23, -13, -3, 7, 17, 27]) {
        box('white', edgeX - edge * .48, 3.472, z, .08, .015, 1.45);
        box('white', edgeX - edge * .76, 3.472, z - .69, .63, .015, .075);
      }
    }
    // Butterfly roof: centre gutter, two shallow upward wings, narrow green fascia.
    const roofWidth = x === 0 ? 3.8 : 4.65;
    for (const side of [-1, 1]) {
      box('pale', x + side * roofWidth / 4, 8.20, -2.5, roofWidth / 2 + .04, .13, 59, side * .12);
      box('green', x + side * roofWidth / 2, 8.35, -2.5, .08, .22, 59.1);
    }
    box('dark', x, 8.10, -2.5, .19, .12, 59.4);
    for (const z of [-29, -21, -13, -5, 3, 11, 19, 27]) {
      // Split steel uprights and slanted outriggers make roof structure readable.
      box('steel', x, 5.76, z, .18, 4.6, .20);
      box('dark', x, 3.56, z, .35, .2, .35);
      for (const side of [-1, 1]) beam('steel', new THREE.Vector3(x, 7.05, z), new THREE.Vector3(x + side * roofWidth * .42, 8.17, z), .095);
      box('steel', x, 8.06, z, roofWidth, .095, .1);
      box('light', x + .43, 7.98, z, .13, .065, 2.5);
      box('dark', x - .21, 4.95, z, .15, .5, .12);
    }
    for (let z = -30; z < 28; z += 1.5) box('steel', x, 8.15, z, roofWidth - .14, .027, .055);
    // Benches, timetable boards, bins and vending machines.
    for (const z of [-17, 1, 15]) {
      box('wood', x, 4.0, z, 1.6, .10, .5);
      box('wood', x, 4.33, z + .21, 1.6, .58, .07);
      for (const side of [-.58, .58]) box('steel', x + side, 3.74, z, .08, .48, .37);
      box('dark', x + .95, 3.93, z + 1, .38, .94, .38);
      box('pale', x + .95, 4.42, z + 1, .4, .05, .40);
    }
    box('vending', x + .3, 4.40, -25, .8, 1.85, .63);
    box('light', x + .3, 4.60, -24.676, .61, 1.02, .025);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) box(col % 2 ? 'green' : 'vending', x + .07 + col * .15, 4.25 + row * .27, -24.657, .08, .18, .018);
    box('dark', x + .3, 3.71, -24.665, .45, .16, .035);
    sign(x === 0 ? '渋谷  SHIBUYA' : x < 0 ? '1  渋谷  SHIBUYA' : '2  渋谷  SHIBUYA', x, 6.4, -9, Math.min(width - .3, 3.8), .83);
  }

  // Ground-level retail below the deck with transparent shopfronts, doors and awnings.
  for (const side of [-1, 1]) {
    for (const z of [-12, -3, 6, 15]) {
      const x = side * 8.8;
      box('pale', x, 1.08, z, 5.1, 2.13, 7.6);
      box('glass', x, 1.20, z - 3.83, 4.6, 1.8, .04);
      for (const dx of [-2.25, -.75, .75, 2.25]) box('dark', x + dx, 1.21, z - 3.87, .06, 1.9, .06);
      box('wood', x, .5, z - 3.5, 3.8, .85, .32);
      box('green', x, 2.18, z - 4.03, 5.0, .15, .7);
      box('light', x, 1.96, z - 3.83, 4.1, .08, .08);
    }
  }
  // Ground ticket gates under the island; visible from entrance ends.
  for (const x of [-1.3, -.45, .45, 1.3]) {
    box('steel', x, .52, -25, .3, 1.04, 1.6);
    box('green', x, 1.07, -24.5, .29, .11, .36);
    box('glass', x + .28, .7, -24.95, .3, .45, .05);
  }
  sign('渋谷駅  SHIBUYA STATION', 0, 2.03, -32.7, 10.8, 1.15);
  sign('HACHIKO EXIT  ハチ公口', 0, 1.20, -32.73, 6.9, .55);

  // Side staircases reach platform level without obstructing either railway.
  for (const side of [-1, 1]) {
    const x = side * 9;
    for (let i = 0; i < 20; i++) {
      const z = -33 + i * .34; const h = (i + 1) * 3.45 / 20;
      box('pale', x, h / 2, z, 2.65, h, .35);
      box('yellow', x, h + .008, z - .13, 2.62, .014, .03);
    }
    for (const dx of [-1.4, 1.4]) {
      beam('steel', new THREE.Vector3(x + dx, .9, -33.1), new THREE.Vector3(x + dx, 4.35, -26.25), .065);
      for (let i = 0; i <= 5; i++) box('steel', x + dx, .48 + i * .69, -33 + i * 1.36, .045, .95, .045);
    }
  }

  // High pedestrian concourse bridges both tracks; train clearance >7.9m.
  box('steel', 0, 8.08, 22, 24.0, .28, 4.0);
  box('pale', 0, 8.24, 22, 23.9, .08, 3.95);
  box('pale', 0, 11.05, 22, 24.4, .16, 4.4);
  box('green', 0, 10.96, 19.8, 24.45, .22, .12);
  for (const z of [20.04, 23.96]) {
    box('glass', 0, 9.64, z, 23.9, 2.58, .045);
    box('steel', 0, 8.60, z, 24, .08, .075);
    box('steel', 0, 10.97, z, 24, .08, .075);
    for (let x = -11.8; x <= 11.8; x += 1.7) box('steel', x, 9.63, z, .075, 2.75, .075);
  }
  for (const x of [-10.5, 0, 10.5]) {
    box('steel', x, 5.68, 23, .21, 5.05, .21);
    // Stairs from platform into the bridge within platform footprints.
    const stairX = x === 0 ? 0 : Math.sign(x) * 9.3;
    for (let i = 0; i < 26; i++) {
      const y = 3.45 + (i + 1) * 4.8 / 26;
      box('pale', stairX, y - .09, 10.5 + i * .35, 1.55, .18, .37);
    }
    for (const side of [-1, 1]) {
      beam('steel', new THREE.Vector3(stairX + side * .8, 3.40, 10.25), new THREE.Vector3(stairX + side * .8, 8.15, 19.5), .14);
      beam('steel', new THREE.Vector3(stairX + side * .85, 4.35, 10.25), new THREE.Vector3(stairX + side * .85, 9.1, 19.5), .055);
      for (let i = 0; i < 7; i++) box('steel', stairX + side * .85, 4.05 + i * .73, 10.5 + i * 1.4, .04, .90, .04);
    }
  }
  sign('渋谷駅  SHIBUYA', 0, 9.68, 19.97, 6.6, 1.04);

  // Traction gantries and catenary: understated thin geometry, no line-width quirks.
  for (const z of [-32, -16, 0, 16, 32]) {
    for (const x of [-11.8, 11.8]) box('dark', x, 6.65, z, .10, 7.2, .12);
    box('dark', 0, 10.25, z, 23.7, .11, .10);
    for (const x of [-4, 4]) {
      box('dark', x, 8.9, z, .025, 2.7, .025);
      box('pale', x, 9.90, z, .13, .27, .13);
    }
  }
  for (const x of [-4, 4]) box('dark', x, 7.55, 0, .025, .025, 68);

  for (const [key, batch] of batches) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = !key.includes('glass'); mesh.receiveShadow = true;
    mesh.name = `Station_${key}_${batch.matrices.length}`; mesh.computeBoundingSphere(); group.add(mesh);
  }
  return group;
}
