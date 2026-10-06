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
      sprite.userData.siteStatus = 'candidate';
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
      sprite.renderOrder = selectedLotId === id ? 32 : status === 'candidate' ? 30 : 31;
      // Opening/buying/closing can change ownership without a viewport resize.
      this.scale(sprite, status);
    }
  }

  resize(camera: THREE.PerspectiveCamera, height: number) {
    if (height <= 0 || (height === this.height && camera.fov === this.fov)) return;
    this.height = height; this.fov = camera.fov;
    for (const sprite of this.entries.values()) this.scale(sprite, sprite.userData.siteStatus as SiteStatus);
  }

  /** Match the drawing order when screen-sized annotations overlap. */
  pick(raycaster: THREE.Raycaster): THREE.Intersection<THREE.Sprite> | undefined {
    const hits = raycaster.intersectObjects<THREE.Sprite>(this.pickables, false);
    hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder || a.distance - b.distance);
    return hits[0];
  }

  private scale(sprite: THREE.Sprite, status: SiteStatus) {
    if (this.height <= 0) return;
    const pixels = status === 'candidate' ? 34 : 44;
    const width = pixels * 2 * Math.tan(THREE.MathUtils.degToRad(this.fov / 2)) / this.height;
    sprite.scale.set(width, width * 112 / 96, 1);
  }

  private material(status: SiteStatus, selected: boolean) {
    const key = `${status}:${selected}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 112;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('施設の目印を描画できません');
    const color = colors[status];
    const owned = status !== 'candidate';
    context.fillStyle = owned ? color : selected ? '#fff0b8' : '#ffffff';
    context.strokeStyle = selected ? '#946300' : status === 'both' ? '#7652b1' : color;
    context.lineWidth = selected ? 7 : 5;
    context.beginPath(); context.moveTo(34, 84); context.lineTo(48, 106); context.lineTo(62, 84); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.arc(48, 46, 40, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = owned ? '#ffffff' : color; context.lineWidth = 5; context.lineJoin = 'round'; context.lineCap = 'round';
    if (status === 'store' || status === 'both') {
      context.beginPath(); context.moveTo(30, 21); context.lineTo(30, 39); context.quadraticCurveTo(46, 49, 61, 39); context.lineTo(61, 21); context.closePath(); context.stroke();
      context.beginPath(); context.moveTo(62, 24); context.bezierCurveTo(78, 21, 78, 41, 62, 38); context.stroke();
      context.beginPath(); context.moveTo(28, 49); context.lineTo(65, 49); context.stroke();
    } else if (status === 'property') {
      context.strokeRect(32, 17, 32, 33);
      context.fillStyle = '#ffffff';
      for (const x of [38, 51]) for (const y of [24, 35]) context.fillRect(x, y, 6, 6);
      context.fillRect(44, 43, 8, 7);
    } else {
      context.strokeRect(25, 40, 46, 31);
      context.beginPath(); context.moveTo(22, 40); context.lineTo(29, 24); context.lineTo(67, 24); context.lineTo(74, 40); context.closePath(); context.stroke();
      context.beginPath(); context.moveTo(48, 48); context.lineTo(48, 63); context.moveTo(40, 55.5); context.lineTo(56, 55.5); context.stroke();
    }
    if (owned) {
      context.fillStyle = '#ffffff'; context.font = '700 25px system-ui, sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'alphabetic';
      context.fillText('自社', 48, 77);
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
