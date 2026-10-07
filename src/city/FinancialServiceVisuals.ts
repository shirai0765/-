import * as THREE from 'three';
import { CITY_SERVICES } from '../data/cityServices';
import { CityArt, compactRigidGroup, disposeScene } from './art';

/** Fictional civic destinations; they never represent buyable property or ownership. */
export class FinancialServiceVisuals {
  readonly group = new THREE.Group();
  readonly markers: THREE.Sprite[] = [];
  private readonly targets: THREE.Mesh[] = [];
  private height = 0;
  private fov = 0;
  private buttons: HTMLButtonElement[] = [];

  constructor() {
    this.group.name = 'Financial_services';
    for (const service of CITY_SERVICES) {
      const art = new CityArt(), bank = service.kind === 'bank';
      const w = service.width, d = service.depth, h = service.height;
      art.group.name = `Financial_service_${service.kind}`;
      art.group.position.set(service.x, 0, service.z);
      art.group.userData = { serviceId: service.id, serviceKind: service.kind };
      const box = (x: number, y: number, z: number, width: number, height: number, depth: number, color: string) => art.batch(x, y, z, width, height, depth, color);
      box(0, .25, 0, w, .5, d, '#c6c3b7');
      if (bank) {
        // Recessed lobby beneath a stone entablature, with six freestanding columns.
        box(0, h / 2, -d * .13, w - 1.4, h - 1, d * .7, '#d6d2c5');
        box(0, 3.6, d * .225, w - 3, 5.8, .18, '#375e79');
        for (const x of [-w * .35, -w * .21, -w * .07, w * .07, w * .21, w * .35]) {
          art.cylinder(x, 3.95, d * .36, .46, 6.7, '#e8e4d7', 12);
          box(x, .77, d * .36, 1.15, .3, 1.15, '#b7b2a5');
          box(x, 7.36, d * .36, 1.2, .38, 1.2, '#e8e4d7');
        }
        for (let i = 0; i < 3; i++) box(0, .15 + i * .13, d * .4 + 1.2 - i * .45, w * .84 - i * .6, .22, 2 - i * .4, '#d6d2c5');
        box(0, 8.2, d * .32, w - 1, 1.45, d * .21, '#d6d2c5');
        box(0, 9.02, d * .32, w -.25, .3, d * .24, '#b7b2a5');
        box(0, h -.6, -d * .08, w -.5, .45, d *.83, '#e8e4d7');
        for (const x of [-w *.34, -w *.18, w *.18, w *.34]) {
          box(x, h - 2.1, d *.226, 2, 1.4, .2, '#375e79');
          box(x, h - 2.87, d *.235, 2.3, .18, .38, '#b7b2a5');
        }
        for (const x of [-1.35, 1.35]) box(x, 2.55, d *.24, .08, 4.2, .16, '#bda071');
      } else {
        // Deep glazed trading hall, thin structural fins and a cantilevered entry roof.
        box(0, h / 2, -d * .15, w -.8, h -.5, d *.64, '#bdc9cc');
        box(0, h *.49, d *.19, w - 2.2, h *.85, .3, '#21516e');
        for (let x = -w / 2 + 1.6; x <= w / 2 - 1; x += 3.1) {
          box(x, h *.49, d *.23, .14, h *.9, .6, '#d9e3df');
        }
        for (const y of [5.1, 9.3, 13.5]) box(0, y, d *.25, w - 1.3, .16, .7, '#a1b5ba');
        box(0, 3.85, d *.37, w *.66, .24, d *.32, '#e6ece6');
        for (const x of [-w *.3, w *.3]) box(x, 1.92, d *.43, .18, 3.84, .18, '#a1b5ba');
        box(0, 5.1, d *.28, w *.84, 1.5, .2, '#173c54');
        box(0, h + .1, -d *.035, w, .4, d *.89, '#e6ece6');
        box(w *.39, h * .48, d *.26, .58, h *.9, .55, '#d3ab69');
        for (const x of [-3, 0, 3]) box(x, 1.9, d *.21, .1, 3.2, .3, '#d9e3df');
      }
      for (const x of [-w *.4, w *.4]) {
        box(x, .8, d *.42, 1.6, 1, 1.5, '#b9b7a7');
        box(x, 1.58, d *.42, 1.5, .7, 1.4, '#4e795a');
      }
      // Merge cylinder columns before instancing the box batches (instanced matrices
      // must never be fed to compactRigidGroup, which handles ordinary meshes).
      const columnGeometry = art.group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh).map(child => child.geometry);
      compactRigidGroup(art.group); columnGeometry.forEach(geometry => geometry.dispose()); art.finish();
      if (typeof document !== 'undefined') {
        const sign = art.sign(bank ? '渋谷銀行' : 'SHIBUYA EXCHANGE', bank ? 'BANK · 融資と返済' : '株式市場 · 売買と資金調達', bank ? '#d6d2c5' : '#173c54', bank ? '#3d554f' : '#ecf0e6', w * .7, bank ? 1.1 : 1.35);
        sign.position.set(0, bank ? 8.2 : 5.1, d * (bank ? .431 : .288));
        art.group.add(sign);
      }
      this.group.add(art.group);
      const target = new THREE.Mesh(new THREE.BoxGeometry(w, h + 1, d), new THREE.MeshBasicMaterial());
      target.name = `Financial_service_target_${service.kind}`;
      target.position.set(service.x, h / 2, service.z); target.visible = false;
      target.userData = { lotId: service.id, serviceId: service.id, serviceKind: service.kind, label: service.label };
      this.targets.push(target); this.group.add(target);
      if (typeof document !== 'undefined') {
        const marker = this.createMarker(service.kind, service.label);
        marker.name = `Game_service_marker_${service.kind}`;
        marker.userData = { ...target.userData };
        marker.position.set(service.x, h + 2, service.z); marker.center.set(.5, 0); marker.renderOrder = 35;
        this.markers.push(marker); this.group.add(marker);
      }
    }
  }

  private createMarker(kind: string, label: string) {
    const canvas = document.createElement('canvas'); canvas.width = 224; canvas.height = 100;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('金融施設の目印を描画できません');
    const bank = kind === 'bank', color = bank ? '#23596b' : '#654ba2';
    ctx.fillStyle = '#fffdf5'; ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(216, 8); ctx.lineTo(216, 76); ctx.lineTo(125, 76); ctx.lineTo(112, 95); ctx.lineTo(99, 76); ctx.lineTo(8, 76); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 4;
    if (bank) {
      ctx.beginPath(); ctx.moveTo(20, 31); ctx.lineTo(43, 17); ctx.lineTo(66, 31); ctx.closePath(); ctx.stroke();
      for (const x of [26, 42, 58]) { ctx.beginPath(); ctx.moveTo(x, 35); ctx.lineTo(x, 57); ctx.stroke(); }
      ctx.fillRect(20, 61, 46, 4);
    } else {
      ctx.beginPath(); ctx.moveTo(20, 58); ctx.lineTo(32, 43); ctx.lineTo(44, 49); ctx.lineTo(64, 23); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(50, 23); ctx.lineTo(64, 23); ctx.lineTo(64, 38); ctx.stroke();
    }
    ctx.font = '700 29px "Noto Sans JP Variable", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 144, 42, 132);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthTest: false, depthWrite: false, toneMapped: false }));
  }

  resize(camera: THREE.PerspectiveCamera, height: number) {
    if (height <= 0 || (this.height === height && this.fov === camera.fov)) return;
    this.height = height; this.fov = camera.fov;
    const width = 94 * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height;
    for (const marker of this.markers) marker.scale.set(width, width * 100 / 224, 1);
  }

  pickMarker(raycaster: THREE.Raycaster) {
    return raycaster.intersectObjects(this.markers.filter(marker => marker.visible), false)[0];
  }

  get pickables() { return this.targets; }

  setMarkersVisible(visible: boolean) { for (const marker of this.markers) marker.visible = visible; }

  /** Keyboard/touch targets align with the actual visible canvas labels. */
  attachButtons(host: HTMLElement, onSelect: (id: string) => void) {
    for (const marker of this.markers) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'city-service-target';
      button.setAttribute('aria-label', marker.userData.serviceKind === 'bank' ? '渋谷銀行を開く' : '渋谷証券市場を開く');
      button.title = button.getAttribute('aria-label')!; button.hidden = true;
      button.addEventListener('click', () => onSelect(marker.userData.serviceId));
      host.appendChild(button); this.buttons.push(button);
    }
  }

  updateButtons(camera: THREE.PerspectiveCamera, width: number, height: number) {
    for (let i = 0; i < this.buttons.length; i++) {
      const marker = this.markers[i], button = this.buttons[i];
      const position = marker.position.clone().project(camera);
      const x = (position.x + 1) * width / 2, y = (1 - position.y) * height / 2;
      button.hidden = !marker.visible || position.z < -1 || position.z > 1 || x < -47 || x > width + 47 || y < 0 || y > height + 42;
      if (!button.hidden) button.style.transform = `translate(${x - 47}px, ${y - 42}px)`;
    }
  }

  dispose() {
    for (const button of this.buttons) button.remove(); this.buttons = [];
    this.group.removeFromParent(); disposeScene(this.group); this.group.clear(); this.targets.length = 0; this.markers.length = 0;
  }
}
