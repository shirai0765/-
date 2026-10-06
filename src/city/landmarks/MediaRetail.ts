import * as THREE from 'three';
import { compactRigidGroup } from '../art';

/** Compact QFRONT architectural interpretation. The observed curtain wall,
 * lower retail braces and open sign crown follow actual 2011 / 2018 close-ups,
 * cross-checked against 2024 / 2025 street photographs. Dimensions remain game
 * scale; HOSHI COFFEE and all screens are original fictional graphics. */
export function createMediaRetail(width: number, depth: number, height: number) {
  const group = new THREE.Group(); group.name = 'Photo_informed_media_retail';
  group.userData = {
    references: ['QFront-Shibuya-01.jpg', 'QFront-Shibuya-03.jpg', 'Tokyo Shibuya Starbucks 1.jpg', '2025 Shibuya Crossing.jpg', 'Shibuya-Tokyo---2024-08-28_038.JPG'],
    referenceAuthors: ['Rs1421 (2011-09, CC BY-SA 3.0)', 'Zairon (2018-04-05, CC BY-SA 4.0)', 'Kakidai (2025-08, CC BY-SA 4.0)', 'RuinDig / Yuki Uchida (2024-08-28, CC BY 4.0)'],
    approximateDimensions: true, fictionalBrand: 'HOSHI COFFEE / TOKYO FRAME',
    observedFeatures: ['convex curtain wall', 'closely spaced vertical mullions', 'screen behind retained glazing grid', 'transparent second-floor cafe', 'diagonal white retail braces', 'setback side shoulder', 'open metal crown', 'projecting rows of spotlights'],
    interpretedFeatures: ['compressed dimensions', 'cafe furniture layout', 'hidden rear rooms', 'original screen advertisements'],
  };
  const material = (name: string, color: string, roughness: number, metalness = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); m.name = name; return m; };
  const m = {
    stone: material('QFRONT_base_stone', '#929996', .82),
    frame: material('QFRONT_anodised_curtain_wall_frames', '#aeb8ba', .34, .62),
    dark: material('QFRONT_dark_recesses', '#222c31', .73),
    glass: material('QFRONT_upper_blue_grey_glass', '#42545c', .24, .43),
    sideGlass: material('QFRONT_pale_side_glass', '#7d8c91', .30, .38),
    white: material('QFRONT_white_structural_bracing', '#d5d9d6', .66, .14),
    timber: material('HOSHI_warm_oak_counter', '#94704a', .66),
    chairs: material('HOSHI_dark_timber_stools', '#3f3630', .7),
    green: material('HOSHI_original_forest_green', '#174b3d', .64),
    interior: material('HOSHI_warm_interior_walls', '#c7bfae', .91),
    warm: new THREE.MeshStandardMaterial({ name: 'HOSHI_recessed_warm_lighting', color: '#ebdbb8', emissive: '#e6bf75', emissiveIntensity: .28, roughness: .7 }),
    clear: new THREE.MeshStandardMaterial({ name: 'HOSHI_clear_retail_glazing', color: '#b6d1d5', roughness: .15, metalness: .08, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }),
  };
  const W = width - .24, H = height, front = depth / 2 - .40;
  const crownBase = H * .84, cafeFloor = H * .126, cafeCeiling = H * .272;
  const bow = Math.min(width * .075, depth * .11);
  const facadeZ = (x: number) => front - bow * Math.pow(x / (W / 2), 2);
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, name = '') => {
    const normalized = geometry.index ? geometry.toNonIndexed() : geometry; if (normalized !== geometry) geometry.dispose();
    const mesh = new THREE.Mesh(normalized, mat); mesh.position.set(x, y, z); mesh.name = name; mesh.castShadow = !('transparent' in mat && mat.transparent); mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, name = '') => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, name);
  const beam = (a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, mat: THREE.Material, name: string) => {
    const mesh = add(new THREE.BoxGeometry(w, a.distanceTo(b), d), mat, ...a.clone().add(b).multiplyScalar(.5).toArray() as [number, number, number], name);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return mesh;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  function facadePanel(x1: number, x2: number, low: number, high: number, mat: THREE.Material, offset = 0, name = '') {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x1, low, facadeZ(x1) + offset, x2, low, facadeZ(x2) + offset, x2, high, facadeZ(x2) + offset, x1, high, facadeZ(x1) + offset], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([(x1 + W / 2) / W, 0, (x2 + W / 2) / W, 0, (x2 + W / 2) / W, 1, (x1 + W / 2) / W, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return add(g, mat, 0, 0, 0, name);
  }
  function curvedGraphic(mat: THREE.Material, left: number, right: number, low: number, high: number, offset: number, name: string) {
    for (let i = 0; i < 14; i++) {
      const mesh = facadePanel(left + (right - left) * i / 14, left + (right - left) * (i + 1) / 14, low, high, mat, offset, name);
      const uv = mesh.geometry.getAttribute('uv'), position = mesh.geometry.getAttribute('position');
      for (let vertex = 0; vertex < uv.count; vertex++) uv.setXY(vertex, (position.getX(vertex) - left) / (right - left), (position.getY(vertex) - low) / (high - low));
    }
  }
  function graphic(text: string, sub: string, options: { transparent?: boolean; screen?: boolean; green?: boolean } = {}) {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .53, transparent: options.transparent ?? false, alphaTest: options.transparent ? .03 : 0 });
    mat.name = `original_${text.replaceAll(' ', '_')}`;
    if (typeof document === 'undefined') return mat;
    const c = document.createElement('canvas'); c.width = options.green ? 1024 : 1536; c.height = options.green ? 640 : options.screen ? 1024 : 256; const ctx = c.getContext('2d'); if (!ctx) return mat;
    if (!options.transparent) {
      const grad = ctx.createLinearGradient(0, 0, c.width, c.height); grad.addColorStop(0, options.green ? '#143b31' : '#21394b'); grad.addColorStop(1, options.green ? '#24644f' : '#62818b'); ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.textAlign = 'center';
    if (options.green) {
      ctx.fillStyle = '#d4e2d4'; ctx.beginPath(); ctx.arc(512, 148, 73, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#174b3d'; ctx.font = '500 102px serif'; ctx.fillText('✦', 512, 184);
      ctx.fillStyle = '#e7efe5'; ctx.font = '600 138px sans-serif'; ctx.fillText('HOSHI', 512, 402);
      ctx.font = '400 70px sans-serif'; ctx.fillText('C O F F E E', 512, 528);
    } else if (options.screen) {
      // Original editorial LED content; geometry/photo references are separate.
      ctx.fillStyle = '#bf8a71'; ctx.fillRect(75, 75, 1386, 100);
      ctx.fillStyle = '#e9deca'; ctx.font = '500 53px sans-serif'; ctx.fillText('C U L T U R E   /   T O K Y O', 768, 145);
      ctx.font = '600 208px sans-serif'; ctx.fillText('CITY', 768, 470); ctx.fillText('IN FRAME', 768, 700);
      ctx.font = '400 45px sans-serif'; ctx.fillText('MUSIC   /   BOOKS   /   EVERY DAY', 768, 913);
      for (let y = 0; y < c.height; y += 4) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, y, c.width, 1); }
    } else {
      ctx.fillStyle = options.green ? '#d4e2d4' : '#e9eeeb'; ctx.font = '600 103px sans-serif'; ctx.fillText(text, 768, 140, 1490);
      if (sub) { ctx.font = '400 38px sans-serif'; ctx.fillText(sub, 768, 214, 1480); }
    }
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; mat.map = texture;
    if (options.screen) { mat.emissiveMap = texture; mat.emissive.set('#ffffff'); mat.emissiveIntensity = .12; }
    return mat;
  }
  const coffeeWordmark = graphic('H O S H I   C O F F E E', '', { transparent: true });
  const frameWordmark = graphic('TOKYO FRAME', '', { transparent: true });
  const screen = graphic('CITY IN FRAME', '', { screen: true });
  const roofGraphic = graphic('FRAME', 'SHIBUYA / CULTURE');
  const greenSign = graphic('HOSHI', 'COFFEE', { green: true });
  const plane = (mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, name: string) => add(new THREE.PlaneGeometry(w, h), mat, x, y, z, name);

  // Upper opaque core stays behind the curtain wall. The two lower retail
  // levels are actual open interior volumes, so the coffee bar is visible.
  box(0, .10, -.1, width, .2, depth - .2, m.stone, 'pavement_plinth');
  box(0, (cafeCeiling + crownBase) / 2, -1.0, W - .3, crownBase - cafeCeiling, depth - 3.0, m.dark, 'setback_upper_structural_core');
  box(0, cafeCeiling / 2, -depth / 2 + 1.15, W - .5, cafeCeiling, 2.0, m.interior, 'retail_rear_service_rooms');
  for (const y of [.25, cafeFloor, cafeCeiling]) {
    const footprint = new THREE.Shape(), half = (W - .3) / 2;
    footprint.moveTo(-half, depth / 2 - .25); footprint.lineTo(half, depth / 2 - .25);
    for (let i = 0; i <= 24; i++) { const x = half - i * half * 2 / 24; footprint.lineTo(x, -facadeZ(x) + .15); }
    footprint.closePath(); const geometry = new THREE.ExtrudeGeometry(footprint, { depth: .17, bevelEnabled: false }); geometry.rotateX(-Math.PI / 2);
    add(geometry, y === cafeFloor ? m.timber : m.stone, 0, y - .085, 0, 'retail_floor_slab_following_convex_glass');
  }
  box(0, cafeFloor + 1.26, front - 4.7, W - 1.3, 2.45, .15, m.interior, 'cafe_rear_feature_wall');
  for (let i = 0; i < 32; i++) box(-W * .45 + i * W * .90 / 31, cafeFloor + 1.25, front - 4.6, .055, 2.45, .09, m.timber, 'cafe_vertical_timber_slat');

  const bays = 20, pitch = W / bays;
  for (let i = 0; i < bays; i++) {
    const x1 = -W / 2 + i * pitch, x2 = x1 + pitch, x = (x1 + x2) / 2;
    facadePanel(x1 + .027, x2 - .027, .28, cafeCeiling - .12, m.clear, -.04, 'two_storey_clear_cafe_pane');
    facadePanel(x1 + .026, x2 - .026, cafeCeiling, crownBase - .12, m.glass, -.09, 'convex_upper_glass_pane');
    // The screen is itself curved, behind the retained narrow exterior mullions.
    facadePanel(x1 + .025, x2 - .025, H * .36, H * .79, screen, -.055, 'curved_LED_panel');
    box(x1, crownBase / 2, facadeZ(x1) + .035, .045, crownBase, .11, m.frame, 'full_height_external_mullion');
    if (i === bays - 1) box(x2, crownBase / 2, facadeZ(x2) + .035, .045, crownBase, .11, m.frame, 'last_external_mullion');
    for (const y of [cafeFloor, cafeCeiling, H * .34, H * .44, H * .54, H * .64, H * .74, crownBase - .11]) {
      beam(v(x1, y, facadeZ(x1) + .045), v(x2, y, facadeZ(x2) + .045), .055, .11, m.frame, 'curved_horizontal_transom');
    }
    // Cafe counter and stools sit behind the transparent second-floor facade.
    if (i > 1 && i < 18) {
      const counter = box(x, cafeFloor + .95, facadeZ(x) - .53, pitch + .015, .075, .42, m.timber, 'window_view_coffee_counter'); counter.rotation.y = Math.atan(2 * bow * x / Math.pow(W / 2, 2));
      if (i % 2 === 0) {
        const z = facadeZ(x) - 1.14;
        add(new THREE.CylinderGeometry(.19, .19, .065, 12), m.chairs, x, cafeFloor + .61, z, 'cafe_bar_stool_seat');
        box(x, cafeFloor + .31, z, .065, .57, .065, m.frame, 'cafe_stool_pedestal');
        add(new THREE.CylinderGeometry(.20, .20, .028, 12), m.frame, x, cafeFloor + .025, z, 'cafe_stool_base');
      }
    }
  }
  // Clear side glazing on cafe levels; silver-grey side curtain wall above.
  const sideFront = facadeZ(W / 2), sideLength = sideFront + depth / 2;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const z = -depth / 2 + (i + .5) * sideLength / 12;
      box(side * W / 2, cafeCeiling / 2, z, .045, cafeCeiling - .3, sideLength / 12 - .05, m.clear, 'clear_side_retail_glass');
      box(side * W / 2, (cafeCeiling + crownBase) / 2, z, .05, crownBase - cafeCeiling, sideLength / 12 - .05, m.sideGlass, 'side_curtain_wall_pane');
      box(side * (W / 2 + .035), crownBase / 2, Math.max(-depth / 2 + .03, z - sideLength / 24), .075, crownBase, .045, m.frame, 'side_vertical_mullion');
    }
    for (const y of [cafeFloor, cafeCeiling, H * .34, H * .44, H * .54, H * .64, H * .74, crownBase]) box(side * (W / 2 + .035), y, (sideFront - depth / 2) / 2, .09, .055, sideLength, m.frame, 'side_horizontal_transom');
    // White diagonal braces are plainly visible through the cafe glass.
    beam(v(side * W * .34, .3, front - 1.05), v(side * W * .34, cafeFloor - .25, front - 1.05), .26, .30, m.white, 'ground_retail_support_column');
    beam(v(side * W * .34, cafeFloor - .25, front - 1.05), v(side * W * .46, cafeCeiling - .2, front - 1.05), .22, .26, m.white, 'upper_retail_diagonal_brace');
    beam(v(side * W * .34, cafeFloor - .25, front - 1.05), v(side * W * .20, cafeCeiling - .2, front - 1.05), .22, .26, m.white, 'paired_upper_retail_diagonal_brace');
    for (const z of [-2.5, 2.0]) beam(v(side * (W / 2 - .4), cafeFloor, z - 1.3), v(side * (W / 2 - .4), cafeCeiling - .15, z + 1.3), .19, .2, m.white, 'side_retail_diagonal_brace');
  }
  // Lettering sits in front of visible rooms, rather than on an opaque full-width board.
  curvedGraphic(coffeeWordmark, -W * .44, W * .24, cafeFloor + .28, cafeFloor + 1.38, .14, 'HOSHI_second_floor_wordmark');
  curvedGraphic(frameWordmark, W * .07, W * .41, cafeFloor - .55, cafeFloor + .33, .13, 'TOKYO_FRAME_entrance_wordmark');
  // Ground-floor portals, sliding door seams and handles at real human scale.
  for (const x of [-W * .27, W * .26]) {
    const z = facadeZ(x) - .04;
    box(x, 2.34, z + .18, 3.25, .18, .63, m.white, 'projecting_entry_lintel');
    for (const sign of [-1, 1]) box(x + sign * 1.5, 1.14, z, .085, 2.2, .16, m.frame, 'entry_portal_jamb');
    box(x, 1.12, z + .03, .045, 2.15, .075, m.frame, 'sliding_entry_meeting_stile');
    for (const dx of [-.11, .11]) box(x + dx, 1.08, z + .12, .027, .52, .065, m.frame, 'entry_door_pull');
  }
  box(W * .32, 1.5, front - .8, 2.85, 2.75, .14, m.green, 'HOSHI_ground_corner_portal');
  plane(greenSign, W * .32, 1.72, front - .71, 2.3, 1.4, 'HOSHI_ground_corner_original_sign');
  for (let i = 0; i < 9; i++) {
    const x = -W * .38 + i * W * .095;
    box(x, cafeCeiling - .24, front - 2.0, .52, .055, .12, m.warm, 'coffee_shop_ceiling_light');
    box(x, cafeFloor - .23, front - 2.1, .48, .045, .11, m.warm, 'ground_floor_ceiling_light');
  }
  // A real open crown with deep framing replaces a flat rooftop billboard.
  const crownTop = H - .06, crownDepth = Math.min(depth * .40, 5.2);
  for (let i = 0; i <= bays; i++) {
    const x = -W / 2 + i * pitch, z = facadeZ(x) - .13;
    box(x, (crownBase + crownTop) / 2, z, .055, crownTop - crownBase, .11, m.frame, 'open_crown_vertical_fin');
    if (i % 4 === 0) {
      box(x, (crownBase + crownTop) / 2, z - crownDepth, .075, crownTop - crownBase, .10, m.frame, 'crown_rear_frame');
      beam(v(x, crownBase + .15, z - crownDepth), v(x, crownTop - .2, z), .07, .07, m.frame, 'crown_depth_diagonal_brace');
    }
    if (i < bays) for (const y of [crownBase + .1, H * .92, crownTop]) beam(v(x, y, z), v(x + pitch, y, facadeZ(x + pitch) - .13), .055, .10, m.frame, 'curved_crown_ring_beam');
  }
  // Current facade carries changeable advertisements. This smaller authored
  // banner keeps some of the documented steel crown visible around it.
  curvedGraphic(roofGraphic, -W * .445, W * .225, H * .862, H * .974, -.22, 'original_crown_campaign');
  for (const side of [-1, 1]) {
    box(side * (W / 2 - .015), (crownBase + crownTop) / 2, facadeZ(W / 2) - crownDepth / 2, .08, crownTop - crownBase, crownDepth, m.sideGlass, 'crown_side_screen');
    for (let i = 0; i < 6; i++) box(side * (W / 2 + .035), (crownBase + crownTop) / 2, facadeZ(W / 2) - i * crownDepth / 5, .06, crownTop - crownBase, .055, m.frame, 'crown_side_vertical_joint');
    // Rows of short cantilevered lamp arms on both side edges are distinctive.
    for (let i = 0; i < 9; i++) {
      const y = crownBase - .55 - i * .38, x = side * (W / 2 - .06), z = facadeZ(x) + .07;
      beam(v(x, y, z), v(x, y + .05, z + .33), .025, .025, m.frame, 'projecting_screen_light_arm');
      add(new THREE.SphereGeometry(.07, 8, 6), m.frame, x, y + .05, z + .33, 'small_screen_spotlight');
    }
    for (let i = 0; i < 8; i++) {
      const z = facadeZ(W / 2) - .4 - i * .42;
      box(side * (W / 2 - .10), crownBase - .1, z, .15, .085, .14, m.frame, 'side_upper_screen_spotlight');
    }
  }
  // Rear side steps down one storey behind the crown, as seen from the crossing.
  box(0, crownBase - .2, -depth * .26, W - .3, .22, depth * .42, m.stone, 'stepped_rear_roof_slab');
  box(0, crownBase + .35, -depth * .32, W * .45, .9, depth * .24, m.dark, 'rear_roof_equipment_setback');
  compactRigidGroup(group);
  for (const child of group.children) if (child instanceof THREE.Mesh) {
    const mat = child.material as THREE.Material; child.name = mat.name || 'QFRONT_material_batch';
    if (mat.transparent) { child.castShadow = false; child.renderOrder = 2; }
  }
  group.userData.materialBatches = group.children.length;
  return group;
}
