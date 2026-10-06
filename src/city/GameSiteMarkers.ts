import * as THREE from 'three';
import type { GameState, Lot } from '../model';

type SiteStatus = 'candidate' | 'store' | 'property' | 'both';
const colors: Record<SiteStatus, string> = { candidate: '#2563eb', store: '#13815f', property: '#7652b1', both: '#13815f' };

/** Small, screen-sized annotations only for the game's economic parcels. */
export class GameSiteMarkers {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Sprite[] = [];
  private entries = new Map<string, THREE.Sprite>();
  private materials = new Map<string, THREE.SpriteMaterial>();
  private height = 0;
  private fov = 0;

  constructor(lots: readonly Lot[]) {
    this.group.name = 'Game_economic_site_markers';
    for (const lot of lots) {
      if (!lot.available) continue;
      const sprite = new THREE.Sprite(this.material('candidate', false));
      sprite.name = `Game_site_marker_${lot.id}`;
      sprite.userData.lotId = lot.id;
      sprite.position.set(lot.x, lot.height + 3, lot.z);
      sprite.center.set(.5, 0);
      sprite.renderOrder = 30;
      this.group.add(sprite);
      this.entries.set(lot.id, sprite);
      this.pickables.push(sprite);
    }
  }

  update(state: Pick<GameState, 'stores' | 'properties'>, selectedLotId: string | null) {
    const stores = new Set(state.stores.map(store => store.lotId));
    const properties = new Set(state.properties.map(property => property.lotId));
    for (const [id, sprite] of this.entries) {
      const status: SiteStatus = stores.has(id) ? properties.has(id) ? 'both' : 'store' : properties.has(id) ? 'property' : 'candidate';
      sprite.material = this.material(status, selectedLotId === id);
      sprite.userData.siteStatus = status;
    }
  }

  resize(camera: THREE.PerspectiveCamera, height: number) {
    if (height <= 0 || (height === this.height && camera.fov === this.fov)) return;
    this.height = height; this.fov = camera.fov;
    const width = 34 * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height;
    for (const sprite of this.entries.values()) sprite.scale.set(width, width * 112 / 96, 1);
  }

  private material(status: SiteStatus, selected: boolean) {
    const key = `${status}:${selected}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 112;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('施設の目印を描画できません');
    const color = colors[status];
    context.fillStyle = selected ? '#fff0b8' : '#ffffff';
    context.strokeStyle = selected ? '#946300' : status === 'both' ? '#7652b1' : color;
    context.lineWidth = selected ? 7 : 5;
    context.beginPath(); context.moveTo(34, 84); context.lineTo(48, 106); context.lineTo(62, 84); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.arc(48, 46, 40, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = color; context.lineWidth = 5; context.lineJoin = 'round'; context.lineCap = 'round';
    if (status === 'store' || status === 'both') {
      context.beginPath(); context.moveTo(27, 33); context.lineTo(27, 58); context.quadraticCurveTo(46, 71, 63, 58); context.lineTo(63, 33); context.closePath(); context.stroke();
      context.beginPath(); context.moveTo(64, 37); context.bezierCurveTo(83, 34, 83, 58, 64, 54); context.stroke();
      context.beginPath(); context.moveTo(24, 72); context.lineTo(68, 72); context.stroke();
    } else if (status === 'property') {
      context.strokeRect(28, 23, 40, 49);
      context.fillStyle = color;
      for (const x of [36, 51]) for (const y of [32, 46]) context.fillRect(x, y, 8, 7);
      context.fillRect(43, 61, 10, 11);
    } else {
      context.strokeRect(25, 40, 46, 31);
      context.beginPath(); context.moveTo(22, 40); context.lineTo(29, 24); context.lineTo(67, 24); context.lineTo(74, 40); context.closePath(); context.stroke();
      context.beginPath(); context.moveTo(48, 48); context.lineTo(48, 63); context.moveTo(40, 55.5); context.lineTo(56, 55.5); context.stroke();
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthTest: false, depthWrite: false, toneMapped: false });
    this.materials.set(key, material);
    return material;
  }

  dispose() {
    this.group.removeFromParent(); this.group.clear(); this.entries.clear(); this.pickables.length = 0;
    for (const material of this.materials.values()) { material.map?.dispose(); material.dispose(); }
    this.materials.clear();
  }
}
