import * as THREE from 'three';
import type { Lot } from '../model';
import { getFootfallBand } from '../sim/siteContext';

export const FOOTFALL_COLORS = ['#699dc5', '#40b3ac', '#e9a746'] as const;
const PEOPLE = [2, 5, 8] as const;

/** A symbolic comparison of authored site traffic, never customers or live counts. */
export class StreetFootfallVisuals {
  readonly group = new THREE.Group();
  private readonly sites: { lot: Lot; rank: number; count: number }[];
  private readonly bodies: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly heads: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly ribbons: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private readonly matrix = new THREE.Matrix4();

  constructor(lots: readonly Lot[], private readonly reducedMotion: boolean) {
    this.sites = lots.filter(lot => lot.available).map(lot => {
      const { rank } = getFootfallBand(lot.footfall);
      return { lot, rank, count: PEOPLE[rank] };
    });
    const total = this.sites.reduce((sum, site) => sum + site.count, 0);
    const ribbonCount = this.sites.reduce((sum, site) => sum + site.rank + 1, 0);
    this.bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .95, .36), new THREE.MeshStandardMaterial({ roughness: .9 }), total);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.2, 6, 4), new THREE.MeshStandardMaterial({ color: '#c49d7c', roughness: 1 }), total);
    this.ribbons = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), ribbonCount);
    this.group.name = 'Street_baseline_footfall';
    this.bodies.name = 'Footfall_symbolic_bodies'; this.heads.name = 'Footfall_symbolic_heads'; this.ribbons.name = 'Footfall_frontage_ribbons';
    this.bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bodies.frustumCulled = this.heads.frustumCulled = false;
    let person = 0, stripe = 0;
    const position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    for (const { lot, rank, count } of this.sites) {
      const r = lot.rotation ?? 0, c = Math.cos(r), s = Math.sin(r);
      rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r);
      for (let i = 0; i <= rank; i++) {
        const z = lot.depth / 2 + 4.15 + i * .27;
        position.set(lot.x + z * s, .31, lot.z + z * c); scale.set(lot.width * .72, .025, .14);
        this.ribbons.setMatrixAt(stripe, this.matrix.compose(position, rotation, scale));
        this.ribbons.setColorAt(stripe++, new THREE.Color(FOOTFALL_COLORS[rank]));
      }
      for (let i = 0; i < count; i++) this.bodies.setColorAt(person++, new THREE.Color(['#295d7d', '#bf713e', '#e0c99c', '#455d59'][i % 4]));
    }
    this.ribbons.computeBoundingSphere();
    this.group.add(this.ribbons, this.bodies, this.heads);
    this.group.userData = { source: 'authored-lot-footfall', sites: this.sites.map(({ lot, rank, count }) => ({ lotId: lot.id, band: getFootfallBand(lot.footfall).id, rank, symbolicPeople: count })) };
    this.group.visible = true; this.animate(0); this.group.visible = false;
  }

  setVisible(visible: boolean) { this.group.visible = visible; }

  animate(time: number) {
    if (!this.group.visible) return;
    let index = 0;
    for (const { lot, count } of this.sites) {
      const r = lot.rotation ?? 0, c = Math.cos(r), s = Math.sin(r);
      for (let i = 0; i < count; i++) {
        const phase = (i + .35) / count + (this.reducedMotion ? 0 : time * .000025 * (i % 2 ? -1 : 1));
        const x = Math.sin(phase * Math.PI * 2) * lot.width * .33;
        const z = lot.depth / 2 + 5.3 + (i % 2) * .4;
        const xx = lot.x + x * c + z * s, zz = lot.z - x * s + z * c;
        this.matrix.makeTranslation(xx, .98, zz); this.bodies.setMatrixAt(index, this.matrix);
        this.matrix.makeTranslation(xx, 1.66, zz); this.heads.setMatrixAt(index++, this.matrix);
      }
    }
    this.bodies.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    for (const mesh of [this.bodies, this.heads, this.ribbons]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    this.group.clear();
  }
}
