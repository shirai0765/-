import * as THREE from 'three';

const pendingTextures: Promise<void>[] = [];
/** Exports wait for the local original campaign artwork before serializing. */
export const waitFor109Textures = () => Promise.all(pendingTextures);

/** Original, deterministic metal cladding. Joints are texture detail at distance;
 * the architecturally important reveals are also modeled by Building109. */
export function make109Cladding(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: '#c9cccd', metalness: .38, roughness: .52 });
  material.name = '109_brushed_aluminium_panel_grid';
  if (typeof document === 'undefined') return material;
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 2048;
  const ctx = canvas.getContext('2d'); if (!ctx) return material;
  const cols = 32, rows = 40, pw = canvas.width / cols, ph = canvas.height / rows;
  ctx.fillStyle = '#91999d'; ctx.fillRect(0, 0, 2048, 2048);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = 190 + ((x * 17 + y * 11 + x * y * 3) % 13);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 5})`;
    ctx.fillRect(x * pw + .65, y * ph + 1.0, pw - 1.3, ph - 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x * pw + 1.3, y * ph + 1.7, .7, ph - 3.4);
    ctx.fillStyle = 'rgba(43,51,56,.16)'; ctx.fillRect((x + 1) * pw - 1.4, y * ph + 2, .65, ph - 4);
    // Subtle downward streaking, not large randomized color blocks.
    const shade = ctx.createLinearGradient(0, y * ph, 0, (y + 1) * ph);
    shade.addColorStop(0, 'rgba(35,42,46,.035)'); shade.addColorStop(.2, 'rgba(35,42,46,0)'); shade.addColorStop(1, 'rgba(255,255,255,.025)');
    ctx.fillStyle = shade; ctx.fillRect(x * pw + 2, y * ph + 2, pw - 4, ph - 4);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  texture.name = 'original_109_cladding_panel_albedo';
  material.color.set('#ffffff'); material.map = texture;
  const relief = texture.clone(); relief.colorSpace = THREE.NoColorSpace; relief.name = '109_panel_reveal_bump';
  material.bumpMap = relief; material.bumpScale = .025;
  return material;
}

export function make109Graphic(kind: 'crown' | 'campaign' | 'entry', fictional = true): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: '#f0f0e9', roughness: .7 });
  material.name = `109_original_${kind}_graphic`;
  if (typeof document === 'undefined') return material;
  const canvas = document.createElement('canvas'); canvas.width = kind === 'campaign' ? 1024 : 2048; canvas.height = kind === 'campaign' ? 2592 : 768;
  const ctx = canvas.getContext('2d'); if (!ctx) return material;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = kind === 'campaign' ? '#d8e1e4' : '#f1f1ec'; if (kind !== 'crown') ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  if (kind === 'crown') {
    ctx.fillStyle = '#d7399c'; ctx.font = '500 605px Arial, sans-serif'; ctx.fillText(fictional ? '108' : '109', w / 2 - 24, 583);
    ctx.fillStyle = '#5d5064'; ctx.font = '600 74px Arial, sans-serif'; ctx.fillText('S H I B U Y A', w / 2, 708);
  } else if (kind === 'entry') {
    ctx.fillStyle = '#d7399c'; ctx.font = '500 425px Arial, sans-serif'; ctx.fillText(fictional ? '108' : '109', w / 2, 478);
    ctx.fillStyle = '#41464d'; ctx.font = '500 100px Arial, sans-serif'; ctx.fillText('S H I B U Y A', w / 2, 640);
  } else {
    // A deliberately original fashion campaign; not a claim to match the
    // changeable advertisement photographed on the reference building.
    const gradient = ctx.createLinearGradient(0, 0, w, h); gradient.addColorStop(0, '#d5dae4'); gradient.addColorStop(.5, '#f0e9e3'); gradient.addColorStop(1, '#bfd5dc'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#28394a'; ctx.font = '500 94px Arial, sans-serif'; ctx.fillText(fictional ? 'SHIBUYA 108' : 'SHIBUYA', w / 2, 135);
    ctx.font = '900 290px Arial, sans-serif'; ctx.fillText('THE', w / 2, 590); ctx.fillText('NEW', w / 2, 890); ctx.fillText('MOOD', w / 2, 1190);
    ctx.strokeStyle = '#566b7a'; ctx.lineWidth = 3; ctx.strokeRect(75, 260, w - 150, 1110);
    ctx.font = '400 59px Arial, sans-serif'; ctx.fillText('FASHION / CULTURE / TOKYO', w / 2, 1515);
    ctx.font = '900 92px Arial, sans-serif'; ctx.fillText('AUTUMN — WINTER', w / 2, 1710);
    ctx.font = '400 49px Arial, sans-serif'; ctx.fillText('DISCOVER YOUR NEXT', w / 2, 1850);
    ctx.fillStyle = '#c32648'; ctx.fillRect(w / 2 - 165, 1930, 330, 10);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.name = material.name;
  material.map = texture; material.color.set('#ffffff');
  if (kind === 'campaign') {
    // Original generated advertising art, distinct from the real building photographs.
    // Keep the canvas fallback if a local resource fails; exports explicitly await it.
    pendingTextures.push(new Promise<void>(resolve => {
      const picture = new Image();
      picture.onload = () => {
        // The photographed architectural banner is narrow. Crop the original
        // campaign composition to its portrait slot instead of stretching faces.
        const cropH = picture.height * .86, cropW = cropH * w / (h * .80);
        const cropX = Math.max(0, (picture.width - cropW) * .61);
        ctx.fillStyle = '#b8edf0'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(picture, cropX, 0, cropW, cropH, 0, 0, w, h * .80);
        ctx.fillStyle = '#152533'; ctx.textAlign = 'center';
        ctx.font = '500 93px Georgia, serif'; ctx.fillText('SHIBUYA', w / 2, h * .86);
        ctx.font = '500 80px Georgia, serif'; ctx.fillText('NEW SEASON', w / 2, h * .91);
        ctx.font = '400 28px Arial, sans-serif'; ctx.fillText('F A S H I O N  ·  A R T  ·  C U L T U R E', w / 2, h * .96);
        texture.needsUpdate = true; resolve();
      };
      picture.onerror = () => resolve();
      picture.src = new URL('../../assets/fashion-campaign.png', import.meta.url).href;
    }));
  }
  if (kind === 'crown') { material.transparent = true; material.alphaTest = .03; material.depthWrite = false; }
  return material;
}
