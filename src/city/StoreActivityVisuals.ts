import * as THREE from 'three';
import type { GameState, Lot } from '../model';

const MAX_PEOPLE = 8;

/** A small impression of the last settled service, never a forecast or a live queue. */
export class StoreActivityVisuals {
  readonly group = new THREE.Group();
  private readonly bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(.44, .82, .3), new THREE.MeshStandardMaterial({ color: '#376577', roughness: .95 }), MAX_PEOPLE);
  private readonly heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.19, 6, 4), new THREE.MeshStandardMaterial({ color: '#bd9479', roughness: 1 }), MAX_PEOPLE);
  private readonly matrix = new THREE.Matrix4();
  private lot: Lot | undefined;

  constructor(private readonly lots: readonly Lot[], private readonly reducedMotion: boolean) {
    this.group.name = 'Settled_store_activity';
    this.bodies.name = 'Settled_store_visitors_body';
    this.heads.name = 'Settled_store_visitors_head';
    // Positions change within a bounded frontage; do not retain the first frame's bounds.
    this.bodies.frustumCulled = this.heads.frustumCulled = false;
    this.bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.bodies, this.heads);
    this.group.visible = false;
    this.bodies.count = this.heads.count = 0;
  }

  update(state: GameState, focusedLotId: string | null | undefined) {
    const store = state.stores.find(item => item.lotId === focusedLotId);
    this.lot = store ? this.lots.find(item => item.id === store.lotId) : undefined;
    // Store.customers is populated by advanceWeek and retained across plan edits.
    const customers = store && Number.isFinite(store.customers) ? Math.max(0, store.customers) : 0;
    const count = this.lot ? Math.min(MAX_PEOPLE, Math.ceil(customers / 250)) : 0;
    this.bodies.count = this.heads.count = count;
    this.group.visible = count > 0;
    this.group.userData = { lotId: this.lot?.id ?? null, source: 'last-settled-service', sourceCustomers: customers, count };
    if (this.lot) {
      this.group.position.set(this.lot.x, 0, this.lot.z);
      this.group.rotation.y = this.lot.rotation ?? 0;
      this.animate(0);
    }
  }

  animate(time: number) {
    if (!this.group.visible || !this.lot) return;
    const span = this.lot.width * .8;
    for (let i = 0; i < this.bodies.count; i++) {
      const phase = i / MAX_PEOPLE + (this.reducedMotion ? 0 : time * .000035 * (i % 2 ? -1 : 1));
      // Smooth out-and-back paths, outside terraces. No invented doorway/queue position.
      const x = Math.sin(phase * Math.PI * 2) * span / 2;
      const z = this.lot.depth / 2 + 4.5 + (i % 3) * .85;
      this.matrix.makeTranslation(x, .92, z); this.bodies.setMatrixAt(i, this.matrix);
      this.matrix.makeTranslation(x, 1.56, z); this.heads.setMatrixAt(i, this.matrix);
    }
    this.bodies.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    for (const mesh of [this.bodies, this.heads]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  }
}
