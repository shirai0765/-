import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { make109Cladding, make109Graphic } from './Building109Materials';

/** Photo-guided exterior study, facing +Z, metres at the game's compressed scale.
 * Primary reference: Dick Thomas Johnson, 2020-01-02 close aerial, CC BY 2.0;
 * SHIBUYA109 official frontage photo; RuinDig 2024 street views, CC BY 4.0.
 * Major entrance, lift, atrium and crown framing are now photograph-guided.
 * Dimensions, hidden rear elevations and exact member sizes remain estimates.
 * SHIBUYA 108 and the campaign graphics are deliberately fictional. */
export function create109(options: { fictional?: boolean } = { fictional: true }): THREE.Group {
  const fictional = options.fictional ?? true;
  const root = new THREE.Group(); root.name = fictional ? 'SHIBUYA_108_department_store' : 'SHIBUYA_109_architectural_study';
  root.userData = {
    landmark: 'Shibuya 109', fictionalName: fictional ? 'SHIBUYA 108' : null, heightMetres: 47.5,
    approximateDimensions: true, scanned: false, reconstruction: 'photo-guided architectural study',
    references: ['Shibuya-Tokyo---2024-08-28_038.JPG', 'Shibuya-Tokyo---2024-08-28_041.JPG', 'Shibuya-Tokyo---2024-08-28_045.JPG', 'Shibuya Scramble Square SHIBUYA109 (49994941977).jpg', 'official-img_109.jpg'],
    referenceAuthor: 'Dick Thomas Johnson (2020 aerial); RuinDig / Yuki Uchida (2024 street)', referenceLicense: 'CC BY 2.0 (aerial); CC BY 4.0 (street)',
    observedFeatures: ['slender silver tiled cylinder', 'pink crown numerals', 'recessed crown joint', 'single central campaign', 'full height recessed wing glazing', 'outer opaque panel walls', 'right glazed lift tower', 'horizontal cylinder slots', 'projecting gold steel entrance canopy', 'open crown with steel bracing', 'roof terraces and wing HVAC'],
    estimatedFeatures: ['compressed dimensions', 'hidden rear elevations', 'exact framing member sizes', 'concealed interiors'], referencePhotoDate: '2020-01-02',
  };
  const aluminium = make109Cladding();
  const crownCladding = aluminium.clone(); crownCladding.name = 'crown_scaled_aluminium_panels';
  if (aluminium.map) { crownCladding.map = aluminium.map.clone(); crownCladding.map.repeat.y = 6.4 / 40.6; }
  if (aluminium.bumpMap) { crownCladding.bumpMap = aluminium.bumpMap.clone(); crownCladding.bumpMap.repeat.y = 6.4 / 40.6; }
  const silver = new THREE.MeshStandardMaterial({ color: '#bcc3c6', metalness: .58, roughness: .38 }); silver.name = 'anodised_aluminium_edges';
  const pale = new THREE.MeshStandardMaterial({ color: '#d3d5d2', roughness: .67 }); pale.name = 'light_grey_enamelled_wing_panels';
  const recess = new THREE.MeshStandardMaterial({ color: '#333d42', roughness: .8 }); recess.name = 'deep_reveal_and_louvre_shadow';
  const glass = new THREE.MeshStandardMaterial({ color: '#263c46', metalness: .38, roughness: .22 }); glass.name = 'blue_grey_retail_glazing';
  const glassLight = new THREE.MeshStandardMaterial({ color: '#53676f', metalness: .4, roughness: .25 }); glassLight.name = 'glass_reflection_variation';
  const concrete = new THREE.MeshStandardMaterial({ color: '#aeb1ad', roughness: .92 }); concrete.name = 'street_level_stone_and_roof_concrete';
  const black = new THREE.MeshStandardMaterial({ color: '#20282c', roughness: .6 }); black.name = 'black_metal_shopfront';
  const warm = new THREE.MeshStandardMaterial({ color: '#f0e5ca', emissive: '#e4c896', emissiveIntensity: .27, roughness: .75 }); warm.name = 'recessed_retail_lighting';
  const gold = new THREE.MeshStandardMaterial({ color: '#aa8345', metalness: .65, roughness: .35 }); gold.name = 'entrance_golden_steel_truss';
  const pink = new THREE.MeshStandardMaterial({ color: '#ba1c76', roughness: .4, metalness: .12 }); pink.name = 'raised_magenta_crown_numerals';

  // Merge by material after authoring. Hundreds of small modeled elements remain
  // inspectable as part names in metadata, but do not become hundreds of draw calls.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); const names: string[] = [];
  let centralTower = false;
  function add(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, name: string, angle = 0) {
    geometry.rotateY(angle); geometry.translate(x, y, z);
    if (centralTower) geometry.scale(.5, 1, .5);
    const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
    if (normalized !== geometry) geometry.dispose();
    if (!normalized.getAttribute('uv')) normalized.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(normalized.getAttribute('position').count * 2), 2));
    if (!batches.has(material)) batches.set(material, []); batches.get(material)!.push(normalized); names.push(name);
  }
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, name: string, a = 0) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, name, a);
  const cylinder = (r: number, h: number, y: number, mat: THREE.Material, name: string) => add(new THREE.CylinderGeometry(r, r, h, 128), mat, 0, y, 0, name);
  const arc = (r: number, h: number, y: number, a: number, length: number, mat: THREE.Material, name: string) => add(new THREE.CylinderGeometry(r, r, h, Math.max(8, Math.ceil(length * 26)), 1, true, a, length), mat, 0, y, 0, name);
  const annulus = (r: number, thickness: number, h: number, y: number, mat: THREE.Material, name: string) => {
    const shape = new THREE.Shape(); shape.absarc(0, 0, r, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, r - thickness, 0, Math.PI * 2, true); shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 64 }); g.rotateX(-Math.PI / 2); add(g, mat, 0, y, 0, name);
  };
  const radialBox = (w: number, h: number, d: number, r: number, y: number, a: number, mat: THREE.Material, name: string) => box(w, h, d, Math.sin(a) * r, y, Math.cos(a) * r, mat, name, a);

  const beam = (a: THREE.Vector3, b: THREE.Vector3, width: number, mat: THREE.Material, name: string) => {
    const direction = b.clone().sub(a), g = new THREE.CylinderGeometry(width, width, direction.length(), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    const center = a.clone().add(b).multiplyScalar(.5); add(g, mat, center.x, center.y, center.z, name);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // The close aerial photo shows opaque side walls and tall recessed glazed
  // atria, not an office facade. The wing roof fascia projects over the void.
  box(32.4, .18, 25.5, -.6, .09, -2.5, concrete, 'retail_foundation');
  box(28.4, 33.4, 11.4, -1.4, 16.8, -8.5, pale, 'rear_retail_mass');
  for (const side of [-1, 1]) {
    const outer = side === -1 ? -16.5 : 13.4;
    const inner = side === -1 ? -9.5 : 9.5;
    const center = (outer + inner) / 2, width = Math.abs(outer - inner);
    box(width, 28.8, 16.6, center, 14.5, -5.6, pale, 'opaque_outer_wing_wall');
    const fasciaCenter = side === -1 ? -10.8 : 8.9, fasciaWidth = side === -1 ? 11.5 : 9.0;
    box(fasciaWidth, 4.8, 17.5, fasciaCenter, 31.3, -5.4, pale, 'cantilevered_wing_fascia');
    box(fasciaWidth + .12, .12, 17.6, fasciaCenter, 33.78, -5.4, silver, 'wing_roof_coping');
    box(fasciaWidth, .14, 17.3, fasciaCenter, 33.64, -5.4, concrete, 'wing_roof_terrace');
    const bayX = side === -1 ? -7.2 : 7.2;
    box(5.3, 24.5, .17, bayX, 16.6, -.25, glass, 'deep_recessed_atrium_glass');
    for (let i = 0; i < 5; i++) box(.065, 24.5, .10, bayX - 2.56 + i * 1.28, 16.6, -.10, silver, 'atrium_vertical_glazing_bar');
    for (let i = 0; i < 18; i++) box(5.25, .055, .11, bayX, 4.45 + i * 1.39, -.09, silver, 'atrium_horizontal_glazing_bar');
    box(5.45, .12, 3.1, bayX, 28.86, 1.24, recess, 'deep_dark_atrium_soffit');
    // Joints on opaque side panels, aligned in metres across both elevations.
    for (let i = 0; i < 27; i++) {
      const y = .8 + i * 1.22;
      box(width, .024, .025, center, y, 2.715, recess, 'wing_front_panel_joint');
      box(.025, .024, 16.6, outer + side * .012, y, -5.6, recess, 'wing_outer_panel_joint');
    }
    for (let i = 0; i <= Math.floor(width / 1.2); i++) box(.025, 28.7, .025, Math.min(outer, inner) + i * 1.2, 14.5, 2.715, recess, 'wing_front_vertical_panel_joint');
    for (let i = 0; i < 14; i++) box(.025, 28.7, .025, outer + side * .012, 14.5, -13.75 + i * 1.24, recess, 'wing_side_vertical_panel_joint');
    for (let i = 0; i < 4; i++) box(fasciaWidth, .026, .028, fasciaCenter, 29.5 + i * 1.18, 3.365, recess, 'fascia_horizontal_grid');
    for (let i = 0; i < Math.ceil(fasciaWidth / 1.2); i++) box(.026, 4.7, .027, fasciaCenter - fasciaWidth / 2 + i * 1.2, 31.3, 3.365, recess, 'fascia_vertical_grid');
    // Continuous perimeter rail on the real wing roof; its top is below the crown.
    for (let i = 0; i < 15; i++) box(.04, .8, .04, outer - side * .15, 34.2, -13.8 + i * 1.2, silver, 'wing_terrace_rail_post');
    box(.05, .05, 16.9, outer - side * .15, 34.61, -5.4, silver, 'wing_terrace_rail');
    box(fasciaWidth, .07, .05, fasciaCenter, 34.61, 3.20, silver, 'wing_front_terrace_rail');
    for (let i = 0; i < Math.ceil(fasciaWidth); i++) box(.045, .8, .045, fasciaCenter - fasciaWidth / 2 + i, 34.2, 3.2, silver, 'wing_front_terrace_rail_post');
  }
  // Exposed silver lattice in the left glazed recess supports a secondary sign.
  for (const x of [-9.65, -4.65]) for (const z of [.35, 1.00]) box(.07, 17.5, .07, x, 15.1, z, silver, 'left_atrium_exposed_frame');
  for (let i = 0; i < 12; i++) {
    const y = 6.5 + i * 1.46;
    for (const z of [.35, 1.0]) {
      box(5.1, .06, .06, -7.15, y, z, silver, 'left_atrium_lattice_horizontal');
      beam(v(-9.6, y, z), v(-4.7, y + 1.46, z), .025, silver, 'left_atrium_lattice_diagonal');
      beam(v(-9.6, y + 1.46, z), v(-4.7, y, z), .025, silver, 'left_atrium_lattice_cross_diagonal');
    }
    beam(v(-9.6, y, .35), v(-9.6, y + 1.46, 1), .027, silver, 'left_frame_side_brace');
  }
  box(3.3, 9.5, .13, -7.1, 15.0, 1.13, pale, 'left_atrium_hanging_poster_back');
  add(new THREE.PlaneGeometry(3.12, 9.28), make109Graphic('campaign', fictional), -7.1, 15.0, 1.21, 'left_atrium_original_campaign');
  // Asymmetric glass lift enclosure, clearly visible to the cylinder's right.
  box(2.7, 28.1, 2.8, 8.75, 14.8, 2.02, glass, 'right_glazed_lift_tower');
  for (const x of [7.34, 8.72, 10.16]) for (const z of [.55, 3.49]) box(.09, 28.4, .09, x, 14.8, z, silver, 'lift_tower_vertical_frame');
  for (let i = 0; i < 23; i++) {
    const y = .8 + i * 1.26;
    box(2.95, .10, .11, 8.75, y, 3.53, silver, 'lift_front_horizontal_frame');
    for (const x of [7.3, 10.2]) box(.11, .10, 3.0, x, y, 2.01, silver, 'lift_side_horizontal_frame');
  }
  box(3.1, .19, 3.1, 8.75, 29.15, 2.0, silver, 'lift_tower_cap');

  // Slender circulation tower. Actual width/height proportions are interpreted
  // from the frontal official photo and the 2020 close aerial, not surveyed.
  centralTower = true;
  const shell = (low: number, high: number, start = 0, length = Math.PI * 2) => {
    const g = new THREE.CylinderGeometry(10.53, 10.53, high - low, Math.max(8, Math.ceil(length * 28)), 1, true, start, length);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (start + uv.getX(i) * length) / (Math.PI * 2), (low + uv.getY(i) * (high - low)) / 40.6);
    add(g, aluminium, 0, (low + high) / 2, 0, 'cylindrical_panel_shell');
  };
  // Real openings: three exposed slots under the central advertisement and the
  // upper ones hidden behind its removable campaign skin, as in the aerial.
  let lower = 0;
  for (const y of [10.2, 14.1, 18.0, 21.9, 25.8, 29.7]) {
    shell(lower, y - .24); shell(y - .24, y + .24, .34, Math.PI * 2 - .68);
    arc(9.96, .48, y, -.34, .68, recess, 'recessed_horizontal_cylinder_window');
    arc(10.34, .035, y - .255, -.35, .7, silver, 'slot_lower_sill');
    arc(10.56, .05, y + .26, -.36, .72, silver, 'projecting_slot_upper_lip');
    for (const a of [-.18, .18]) radialBox(.06, .5, .6, 10.13, y, a, silver, 'slot_recessed_mullion');
    lower = y + .24;
  }
  shell(lower, 40.6);
  // Ground opening cuts only the forward portion of the cladding, rather than
  // replacing the whole cylinder with an invented glazed storefront.
  // Its outer black reveal intentionally stands in front of the backing shell.
  arc(10.58, 4.6, 2.35, -.49, .98, recess, 'deep_rectangular_entrance_reveal');
  cylinder(10.34, .24, 40.72, recess, 'recessed_dark_joint_below_crown');
  arc(10.62, 6.4, 44.05, 0, Math.PI * 2, crownCladding, 'open_top_logo_crown_skin');
  const innerCrown = new THREE.MeshStandardMaterial({ color: '#5b6266', metalness: .3, roughness: .72, side: THREE.BackSide }); innerCrown.name = 'inner_crown_steel_liner';
  arc(10.39, 6.35, 44.05, 0, Math.PI * 2, innerCrown, 'inside_open_crown');
  annulus(10.67, .29, .13, 47.25, silver, 'thin_crown_coping');
  cylinder(10.34, .12, 40.83, recess, 'deep_floor_of_open_crown');
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, b = a + Math.PI / 8;
    radialBox(.12, 6.1, .12, 10.15, 44.12, a, silver, 'open_crown_vertical_steel');
    beam(v(Math.sin(a) * 10.1, 41.2, Math.cos(a) * 10.1), v(Math.sin(b) * 10.1, 46.9, Math.cos(b) * 10.1), .055, silver, 'open_crown_diagonal_lacing');
    if (i < 8) beam(v(Math.sin(a) * 9.9, 46.7, Math.cos(a) * 9.9), v(-Math.sin(a) * 9.9, 46.7, -Math.cos(a) * 9.9), .06, silver, 'open_crown_cross_roof_truss');
  }
  for (const y of [42.0, 44.6, 46.8]) annulus(10.18, .13, .12, y, silver, 'open_crown_horizontal_ring');

  // Raised broad, rounded numerals follow the photographed modern magenta sign.
  // The game variant substitutes 108; the architectural study retains 109.
  const one = new THREE.Shape(); one.moveTo(-.85, 1.72); one.lineTo(-.27, 2.04); one.lineTo(.3, 2.04); one.lineTo(.3, -1.7); one.lineTo(-.27, -1.7); one.lineTo(-.27, 1.4); one.lineTo(-.85, 1.06); one.closePath();
  const zero = new THREE.Shape(); zero.absellipse(0, .1, 1.3, 1.8, 0, Math.PI * 2, false, 0); const zeroHole = new THREE.Path(); zeroHole.absellipse(0, .1, .73, 1.22, 0, Math.PI * 2, true, 0); zero.holes.push(zeroHole);
  const eight = new THREE.Shape(); eight.moveTo(0, 1.95); eight.bezierCurveTo(1.7, 1.95, 1.73, .1, .82, .05); eight.bezierCurveTo(1.94, -.24, 1.55, -1.78, 0, -1.78); eight.bezierCurveTo(-1.55, -1.78, -1.94, -.24, -.82, .05); eight.bezierCurveTo(-1.73, .1, -1.7, 1.95, 0, 1.95); eight.closePath();
  for (const [cy, ry] of [[.92, .49], [-.83, .51]]) { const hole = new THREE.Path(); hole.absellipse(0, cy, .64, ry, 0, Math.PI * 2, true, 0); eight.holes.push(hole); }
  const nine = new THREE.Shape(); nine.moveTo(1.28, .72); nine.bezierCurveTo(1.28, 2.39, -1.3, 2.39, -1.3, .72); nine.bezierCurveTo(-1.3, -.69, .16, -.88, .7, -.3); nine.bezierCurveTo(.6, -1.02, -.14, -1.49, -.88, -1.5); nine.lineTo(-.88, -2.02); nine.bezierCurveTo(.48, -2.05, 1.3, -1.14, 1.28, .72); nine.closePath();
  const nineHole = new THREE.Path(); nineHole.absellipse(0, .72, .74, .79, 0, Math.PI * 2, true, 0); nine.holes.push(nineHole);
  [one, zero, fictional ? eight : nine].forEach((shape, i) => {
    const a = (i - 1) * .47; const geo = new THREE.ExtrudeGeometry(shape, { depth: .19, bevelEnabled: true, bevelSegments: 2, bevelSize: .035, bevelThickness: .025, curveSegments: 28 });
    geo.scale(1.75, .76, 1);
    add(geo, pink, Math.sin(a) * 10.69, 44.13, Math.cos(a) * 10.69, `raised_crown_digit_${(fictional ? '108' : '109')[i]}`, a);
    for (const y of [42.9, 45.3]) radialBox(.14, .12, .22, 10.7, y, a, silver, 'crown_letter_mounting_pin');
  });
  // Secondary small typography deliberately remains a transparent graphic.
  const crownLabel = make109Graphic('crown', fictional);
  if (crownLabel.map) { crownLabel.map.repeat.set(1, .14); crownLabel.map.offset.set(0, .06); }
  arc(10.69, .55, 42.1, -.54, 1.08, crownLabel, 'small_SHIBUYA_secondary_brand');

  // One wide central ad, with an open silver field above, matching the observed
  // placement. It replaces two invented tall, narrow abstract side banners.
  arc(10.595, 15.1, 27.5, -.57, 1.14, recess, 'central_campaign_recess');
  arc(10.63, 14.85, 27.5, -.553, 1.106, make109Graphic('campaign', fictional), 'single_curved_original_campaign');
  for (const a of [-.571, .571]) radialBox(.07, 15.22, .09, 10.66, 27.5, a, silver, 'campaign_vertical_perimeter_rail');
  for (const y of [19.92, 35.08]) arc(10.665, .075, y, -.575, 1.15, silver, 'campaign_curved_edge_rail');
  for (let i = 0; i < 6; i++) {
    const a = -.49 + i * .196;
    radialBox(.06, .08, .55, 10.77, 19.7, a, silver, 'billboard_spotlight_bracket');
    radialBox(.35, .18, .25, 11.02, 19.78, a, black, 'billboard_spotlight_housing');
    radialBox(.26, .08, .16, 11.13, 19.82, a, warm, 'billboard_spotlight_lens');
  }

  // Front doors are recessed within the small real opening. Above them a
  // lightweight open steel canopy projects over the pavement, visible in both
  // official frontage and close aerial reference photographs.
  centralTower = false;
  box(4.95, 3.52, .16, 0, 1.99, 5.23, black, 'main_entrance_recess_back');
  for (const x of [-1.57, -.53, .53, 1.57]) {
    box(.97, 2.7, .065, x, 1.66, 5.34, glassLight, 'main_entry_glass_door');
    for (const dx of [-.49, .49]) box(.038, 2.8, .09, x + dx, 1.67, 5.40, silver, 'main_entry_door_stile');
    box(.034, .56, .10, x + .31, 1.5, 5.46, silver, 'main_entry_pull_handle');
  }
  box(4.95, .085, .10, 0, 3.09, 5.4, silver, 'main_entry_transom');
  box(4.95, .65, .08, 0, 3.51, 5.37, glass, 'entry_upper_transom_glass');
  box(4.9, .13, .8, 0, .21, 5.5, concrete, 'entry_stone_threshold');
  add(new THREE.PlaneGeometry(3.0, .86), make109Graphic('entry', fictional), 0, 4.00, 5.51, 'entry_109_brand_panel');
  const canopyBack = 5.7, canopyFront = 12.2;
  for (const x of [-2.72, 2.72]) {
    beam(v(x, .1, canopyFront), v(x, 4.5, canopyFront), .075, gold, 'gold_canopy_front_column');
    beam(v(x, .1, canopyBack), v(x, 5.35, canopyBack), .075, gold, 'gold_canopy_wall_column');
    beam(v(x, 4.5, canopyFront), v(x, 5.35, canopyBack), .065, gold, 'gold_canopy_longitudinal_top_chord');
    beam(v(x, 4.08, canopyFront), v(x, 4.93, canopyBack), .065, gold, 'gold_canopy_longitudinal_bottom_chord');
    for (let i = 0; i < 8; i++) {
      const z = canopyBack + i * (canopyFront - canopyBack) / 8, zz = canopyBack + (i + 1) * (canopyFront - canopyBack) / 8;
      const y = 5.35 - (z - canopyBack) * .85 / 6.5, yy = 5.35 - (zz - canopyBack) * .85 / 6.5;
      beam(v(x, y, z), v(x, yy - .42, zz), .03, gold, 'gold_canopy_side_zigzag');
      beam(v(x, y - .42, z), v(x, yy, zz), .03, gold, 'gold_canopy_side_crossbrace');
    }
  }
  for (let i = 0; i < 9; i++) {
    const z = canopyBack + i * 6.5 / 8, y = 5.35 - i * .85 / 8;
    beam(v(-2.72, y, z), v(2.72, y, z), .035, gold, 'gold_canopy_cross_member');
    if (i < 8) {
      beam(v(-2.72, y, z), v(2.72, y - .85 / 8, z + 6.5 / 8), .022, gold, 'gold_canopy_top_diagonal');
      beam(v(2.72, y, z), v(-2.72, y - .85 / 8, z + 6.5 / 8), .022, gold, 'gold_canopy_top_cross_diagonal');
    }
  }
  box(5.58, .42, .11, 0, 4.31, canopyFront, pale, 'entrance_canopy_front_sign_fascia');
  add(new THREE.PlaneGeometry(2.0, .42), make109Graphic('entry', fictional), 0, 4.31, canopyFront + .065, 'canopy_front_small_109_sign');
  // Side entrance terrace and open stair alongside the lift tower.
  box(5.7, .24, 3.2, -7.25, 3.45, 2.8, concrete, 'left_retail_entrance_terrace');
  box(5.7, 1.0, .16, -7.25, 3.95, 4.35, glassLight, 'left_terrace_glass_balustrade');
  box(5.78, .055, .075, -7.25, 4.48, 4.37, silver, 'left_terrace_handrail');
  box(5.7, 3.2, .12, -7.25, 1.63, 1.13, glass, 'left_ground_floor_retail_doors');
  for (let i = 0; i < 21; i++) box(2.55, .165, .30, 6.88, .15 + i * .162, 7.8 - i * .29, concrete, 'right_external_entrance_stair_tread');
  beam(v(5.52, .9, 8.1), v(5.52, 4.3, 1.9), .032, silver, 'right_entrance_stair_handrail');
  beam(v(8.25, .9, 8.1), v(8.25, 4.3, 1.9), .032, silver, 'right_entrance_stair_outer_handrail');
  for (let i = 0; i < 11; i++) for (const x of [5.52, 8.25]) box(.037, .88, .037, x, .51 + i * .32, 7.95 - i * .58, silver, 'right_stair_balustrade_post');

  // Rooftop equipment is on the low rear/wing roofs, not on a fictitious slab
  // capping the cylinder. Exact rear equipment placement remains approximate.
  for (let i = 0; i < 4; i++) {
    const x = -13.7 + i * 2.6;
    box(2.1, 1.0, 1.7, x, 34.3, -10.5, silver, 'wing_roof_air_handler');
    add(new THREE.CylinderGeometry(.47, .47, .07, 24), recess, x, 34.84, -10.5, 'wing_roof_air_handler_fan');
    for (let j = 0; j < 8; j++) box(1.84, .035, .05, x, 33.91 + j * .105, -9.62, recess, 'wing_roof_air_handler_louvre');
  }
  box(7.8, 1.1, 5.0, -7.2, 34.23, -4.6, pale, 'wing_roof_lightweight_terrace_pavilion');
  const roofPavilion = new THREE.CylinderGeometry(0, 1, 1, 4); roofPavilion.rotateY(Math.PI / 4); roofPavilion.scale(5.63, .9, 3.69); add(roofPavilion, pale, -7.2, 35.23, -4.6, 'wing_pavilion_hipped_roof');
  box(4.5, 2.4, .16, 7.2, 1.5, -14.3, recess, 'rear_service_entrance');
  for (let i = 0; i < 18; i++) box(4.2, .055, .1, 7.2, .47 + i * .12, -14.41, silver, 'rear_service_door_louvre');

  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) throw new Error(`Could not merge 109 detail for ${material.name}`);
    geometry.computeBoundingSphere(); const mesh = new THREE.Mesh(geometry, material); mesh.name = material.name;
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); geometries.forEach(g => g.dispose());
  }
  root.userData.parts = names; root.userData.materialBatches = batches.size;
  return root;
}
