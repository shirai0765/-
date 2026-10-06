import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface CafeExteriorOptions { width?: number; terrace?: boolean; wordmark?: boolean; }

/** Metres, pavement origin; shopfront faces +Z. Owns all of its GPU resources. */
export function createCafeExterior({ width = 8, terrace = true, wordmark = true }: CafeExteriorOptions = {}): THREE.Group {
  const root = new THREE.Group(); root.name = 'HOSHI_COFFEE_reusable_shopfront';
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const material = (color: string, roughness = .65, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const stone = material('#454843', .87), charcoal = material('#353a37', .5, .4), plaster = material('#a7a59e', .92);
  const bronze = material('#514b40', .45, .62), fabric = material('#252b29', .96);
  const timber = material('#b6956f', .7), green = material('#153f32', .56), leaf = material('#466346', .9), soil = material('#38322a', 1);
  const brass = material('#baa47a', .32, .72), porcelain = material('#f2ece0', .28);
  const warm = new THREE.MeshStandardMaterial({ color: '#ffe6ac', emissive: '#ffbc60', emissiveIntensity: .65, roughness: .45 });
  const glass = new THREE.MeshStandardMaterial({ color: '#9aadaa', transparent: true, opacity: .14, roughness: .1, metalness: .12, depthWrite: false, side: THREE.DoubleSide });
  const texture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (typeof document === 'undefined') return undefined;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); if (!ctx) return undefined; draw(ctx);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const wood = texture(256, 512, ctx => {
    ctx.fillStyle = '#bc9974'; ctx.fillRect(0, 0, 256, 512);
    // Broad cathedral grain and subtle fine fibres; authored material, no photo baking.
    for (let band = 0; band < 7; band++) {
      ctx.strokeStyle = `rgba(100,57,26,${.12 + band % 3 * .035})`; ctx.lineWidth = 2.5;
      const x = 20 + band * 36; ctx.beginPath(); ctx.moveTo(x - 17, 512);
      ctx.bezierCurveTo(x - 24, 210, x - 4, 40 + band * 19, x, 35 + band * 18);
      ctx.bezierCurveTo(x + 16, 94 + band * 21, x + 24, 330, x + 19, 512); ctx.stroke();
    }
    for (let i = 0; i < 210; i++) {
      ctx.strokeStyle = `rgba(65,37,17,${.025 + (i % 7) * .009})`; ctx.lineWidth = .4 + i % 3;
      ctx.beginPath(); ctx.moveTo((i * 37) % 256, 0); ctx.bezierCurveTo((i * 37) % 256 + 9, 160, (i * 37) % 256 - 6, 380, (i * 37) % 256 + 2, 512); ctx.stroke();
    }
  });
  if (wood) { wood.wrapS = wood.wrapT = THREE.RepeatWrapping; timber.map = wood; timber.color.set('#ffffff'); }
  const horizontalTimber = timber.clone();
  if (wood) { horizontalTimber.map = wood.clone(); horizontalTimber.map.center.set(.5, .5); horizontalTimber.map.rotation = Math.PI / 2; horizontalTimber.map.needsUpdate = true; }
  const signTexture = texture(512, 512, ctx => {
    ctx.fillStyle = '#153f32'; ctx.fillRect(0, 0, 512, 512); ctx.strokeStyle = '#e9e4ca'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(256, 256, 227, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ece7cd'; ctx.textAlign = 'center'; ctx.font = 'bold 150px "Noto Sans JP Variable", sans-serif'; ctx.fillText('星', 256, 263);
    ctx.font = '600 43px sans-serif'; ctx.fillText('COFFEE', 256, 339); ctx.font = '22px sans-serif'; ctx.fillText('H O S H I', 256, 391);
  });
  const sign = new THREE.MeshStandardMaterial({ color: '#ffffff', map: signTexture, roughness: .5 });
  const wordmarkTexture = wordmark ? texture(1024, 128, ctx => {
    ctx.clearRect(0, 0, 1024, 128); ctx.fillStyle = '#293b34'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 65px sans-serif'; ctx.fillText('H O S H I   C O F F E E', 512, 65, 980);
  }) : undefined;
  const wordmarkMaterial = wordmark ? new THREE.MeshStandardMaterial({ map: wordmarkTexture, color: '#ffffff', transparent: true, alphaTest: .3, roughness: .55, metalness: .15 }) : undefined;
  const menuTexture = texture(512, 384, ctx => {
    ctx.fillStyle = '#252d29'; ctx.fillRect(0, 0, 512, 384); ctx.fillStyle = '#eee2bf'; ctx.font = '30px sans-serif'; ctx.fillText('HOSHI  /  COFFEE', 30, 60);
    ctx.font = '22px sans-serif'; ['ESPRESSO       420', 'LATTE              560', 'FILTER             480', 'BAKERY            380'].forEach((s, i) => ctx.fillText(s, 30, 130 + i * 57));
  });
  const menu = new THREE.MeshStandardMaterial({ map: menuTexture, color: '#ffffff', roughness: .8 });
  function add(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    // Rounded boxes are non-indexed; normalize before material batching.
    if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    const list = batches.get(m) ?? []; list.push(g); batches.set(m, list);
  }
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => add(m === glass && d < .03 ? new THREE.PlaneGeometry(w, h) : new THREE.BoxGeometry(w, h, d), m, x, y, z);
  const rounded = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, radius = .035) => add(new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, Math.min(w, h, d) * .4)), m, x, y, z);
  const cyl = (r: number, h: number, x: number, y: number, z: number, m: THREE.Material) => add(new THREE.CylinderGeometry(r, r, h, 16), m, x, y, z);
  // The room is genuinely recessed, with a visible floor and counter behind glazing.
  box(8, .14, 3, 0, .07, -1.5, stone); box(8, 3.8, .15, 0, 2, -2.94, plaster);
  for (const x of [-3.92, 3.92]) box(.16, 3.8, 3, x, 2, -1.5, stone);
  box(8, .22, 3.45, 0, 3.83, -1.32, timber); box(8.14, .12, 3.52, 0, 3.98, -1.32, charcoal);
  // Neutral rendered fascia; the original green brand is a small medallion, not a full-width box.
  box(8, .59, .18, 0, 3.47, .08, plaster);
  box(7.76, .045, .08, 0, 3.17, .18, bronze);
  // Thin folded fabric awning, kept below the dynamic name at y=3.47.
  add(new THREE.BoxGeometry(7.68, .055, .6), fabric, 0, 3.04, .4, .12);
  box(7.68, .13, .035, 0, 2.96, .7, fabric);
  for (const x of [-3.78, 3.78]) box(.045, .14, .52, x, 3.0, .38, charcoal);
  for (let i = 0; i < 38; i++) box(.035, .07, 3.1, -3.86 + i * .208, 3.7, -1.32, charcoal);
  for (const x of [-3.76, -2.12, -.47, 1.18, 2.48, 3.76]) box(.055, 3.05, .11, x, 1.67, -.035, bronze);
  for (const x of [-3.84, 1.12, 2.54, 3.84]) box(.095, 3.1, .18, x, 1.7, .025, bronze);
  box(7.78, .12, .17, 0, 3.19, .025, bronze);
  box(7.78, .19, .18, 0, .2, .045, stone);
  for (const y of [.27, 2.67]) box(7.58, .045, .1, 0, y, -.035, bronze);
  // Windows and recessed double entry, including metal pulls and kick plates.
  for (const [x, w] of [[-2.95, 1.55], [-1.3, 1.55], [.35, 1.55], [3.12, 1.19]]) box(w, 2.9, .015, x, 1.67, -.04, glass);
  // Recessed timber-lined vestibule, with long dark pulls and visible lower rails.
  for (const x of [1.24, 2.42]) box(.095, 2.44, .35, x, 1.45, -.2, timber);
  box(1.25, .11, .35, 1.83, 2.66, -.2, timber);
  box(1.08, 2.36, .015, 1.83, 1.44, -.37, glass); box(.045, 2.36, .07, 1.83, 1.44, -.34, charcoal);
  for (const y of [.31, 1.02, 2.61]) box(1.08, .045, .07, 1.83, y, -.33, charcoal);
  for (const x of [1.73, 1.93]) { cyl(.014, 1.05, x, 1.37, -.22, charcoal); for (const y of [.91, 1.83]) box(.029, .035, .12, x, y, -.28, charcoal); }
  box(1.25, .06, .46, 1.83, .145, -.17, stone);
  for (let i = 0; i < 7; i++) box(.065, 2.98, .17, 3.42 + i * .067, 1.69, .13, timber);
  box(4.5, 1.02, .65, -.7, .68, -1.91, timber); rounded(4.6, .095, .78, -.7, 1.23, -1.91, horizontalTimber, .045);
  // Low service case gives the counter a useful height hierarchy behind the glazing.
  box(1.08, .04, .43, .55, 1.33, -1.93, bronze);
  box(1.02, .31, .008, .55, 1.5, -1.72, glass);
  box(1.04, .02, .44, .55, 1.67, -1.93, glass);
  box(1.0, .42, .36, -.8, 1.48, -1.97, charcoal); box(.96, .07, .4, -.8, 1.69, -1.97, brass);
  for (let i = 0; i < 5; i++) cyl(.046, .085, -.95 + i * .13, 1.77, -1.97, porcelain);
  box(2, .12, .26, -2, 2.36, -2.72, timber);
  for (let i = 0; i < 7; i++) box(.14, .26 + (i % 2) * .04, .1, -2.8 + i * .27, 2.55, -2.71, porcelain);
  add(new THREE.PlaneGeometry(1.7, 1.15), menu, 1.15, 2.32, -2.84);
  // Globe fixtures observed at Ginza; small emissive sources rather than extra point lights.
  for (const x of [-2.75, -.2, 2.98]) {
    cyl(.014, .2, x, 2.81, .22, bronze);
    add(new THREE.SphereGeometry(.105, 12, 8), warm, x, 2.66, .22);
  }
  box(6.6, .03, .06, 0, 3.15, -.15, warm);
  // Recessed canopy lamps: observed in the inspected Katoriya street photograph.
  for (const x of [-2.2, 0, 2.2]) { cyl(.09, .024, x, 3.68, -.45, brass); cyl(.066, .028, x, 3.663, -.45, warm); }
  add(new THREE.CylinderGeometry(.46, .46, .09, 48), green, -2.98, 3.47, .24, Math.PI / 2);
  add(new THREE.CircleGeometry(.425, 48), sign, -2.98, 3.47, .291);
  if (wordmarkMaterial) add(new THREE.PlaneGeometry(4.9, .48), wordmarkMaterial, .78, 3.47, .19);
  add(new THREE.TorusGeometry(.441, .012, 6, 48), bronze, -2.98, 3.47, .292);
  if (terrace) {
    for (const x of [-2.8, -.8]) {
      cyl(.38, .055, x, .77, .85, horizontalTimber); cyl(.035, .68, x, .4, .85, charcoal); cyl(.23, .035, x, .075, .85, charcoal);
      for (const dx of [-.56, .56]) {
        const cx = x + dx; rounded(.36, .065, .38, cx, .46, .91, horizontalTimber);
        rounded(.36, .28, .055, cx, .67, 1.08, timber, .025);
        for (const lx of [-.14, .14]) for (const lz of [-.14, .14]) cyl(.014, .42, cx + lx, .24, .91 + lz, charcoal);
      }
    }
    for (const x of [-3.72, 3.5]) {
      box(.48, .56, .5, x, .35, .66, charcoal); box(.41, .02, .43, x, .63, .66, soil);
      for (let i = 0; i < 17; i++) {
        const a = i * 2.399, r = .08 + (i % 4) * .035;
        const foliage = new THREE.SphereGeometry(.18, 7, 5); foliage.scale(.6, 1.4, .22);
        add(foliage, leaf, x + Math.cos(a) * r, .81 + (i % 5) * .09, .66 + Math.sin(a) * r, .8, a, .6);
      }
    }
  }
  // Material batches keep the detailed asset below 20 draw calls, regardless of tiny component count.
  for (const [m, geometries] of batches) {
    const merged = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
    if (!merged) throw new Error('Cafe geometry merge failed');
    const mesh = new THREE.Mesh(merged, m); mesh.name = `cafe_${m === glass ? 'glazing' : m === sign ? 'original_brand' : m.uuid.slice(0, 8)}`;
    mesh.castShadow = m !== glass; mesh.receiveShadow = true; root.add(mesh);
  }
  root.scale.x = Math.max(4, width) / 8;
  root.userData = { asset: 'HOSHI COFFEE', fictionalBrand: true, photoReconstruction: false, referenceStudy: 'docs/cafe-photo-study.md', dimensionsMetres: [Math.max(4, width), 4.04, terrace ? 4.4 : 3.15], front: '+Z', resourceOwnership: 'exclusive; disposeCafeExterior once after detaching' };
  return root;
}

/** Detach first; all resources are exclusive to this asset, with no global cache. */
export function disposeCafeExterior(root: THREE.Group): void {
  const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
  root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); } });
  for (const m of materials) { const map = (m as THREE.MeshStandardMaterial).map; if (map) textures.add(map); m.dispose(); }
  textures.forEach(t => t.dispose());
}
