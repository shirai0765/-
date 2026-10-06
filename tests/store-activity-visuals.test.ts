import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { StoreActivityVisuals } from '../src/city/StoreActivityVisuals';
import { LOTS } from '../src/data/district';
import { advanceWeek, applyAction, createGame } from '../src/sim/engine';

const open = () => applyAction(createGame('直近営業の街', 812), { type: 'openStore', lotId: 'center-01', style: 'standard' });
const matrices = (visual: StoreActivityVisuals) => Array.from((visual.group.children[0] as THREE.InstancedMesh).instanceMatrix.array);

describe('settled store activity visuals', () => {
  it('waits for service, keeps the actual count through plan edits, and hides on close or overview without changing saves', () => {
    const visual = new StoreActivityVisuals(LOTS, false);
    let state = open();
    visual.update(state, 'center-01');
    expect(visual.group.visible).toBe(false);
    state = advanceWeek(state);
    const saved = JSON.stringify(state);
    visual.update(state, 'center-01');
    expect(visual.group.visible).toBe(true);
    expect(visual.group.userData.sourceCustomers).toBe(state.lastReport!.storeResults[0].customers);
    const count = visual.group.userData.count;
    expect(count).toBeGreaterThan(0); expect(count).toBeLessThanOrEqual(8);
    visual.animate(2000);
    expect(JSON.stringify(state)).toBe(saved);
    state = applyAction(state, { type: 'updateStore', storeId: state.stores[0].id, changes: { price: 1400, quality: 100, staff: 7, manager: true } });
    visual.update(state, 'center-01');
    expect(visual.group.userData.count).toBe(count);
    visual.update(state, null);
    expect(visual.group.visible).toBe(false);
    state = applyAction(state, { type: 'closeStore', storeId: state.stores[0].id });
    visual.update(state, 'center-01');
    expect(visual.group.visible).toBe(false);
    visual.dispose();
  });

  it('keeps the reduced-motion pool static, bounds local paths, and disposes its owned geometry', () => {
    const state = advanceWeek(open());
    const lot = LOTS.find(item => item.id === 'center-01')!;
    for (const reduced of [false, true]) {
      const visual = new StoreActivityVisuals(LOTS, reduced);
      const scene = new THREE.Scene(); scene.add(visual.group);
      visual.update(state, lot.id);
      const before = matrices(visual);
      visual.animate(3200);
      if (reduced) expect(matrices(visual)).toEqual(before);
      else expect(matrices(visual)).not.toEqual(before);
      const mesh = visual.group.children[0] as THREE.InstancedMesh;
      for (let index = 0; index < mesh.count; index++) {
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
        const position = new THREE.Vector3().setFromMatrixPosition(matrix);
        expect(Math.abs(position.x)).toBeLessThanOrEqual(lot.width * .4);
        expect(position.z).toBeGreaterThanOrEqual(lot.depth / 2 + 4.49);
        expect(position.z).toBeLessThanOrEqual(lot.depth / 2 + 6.21);
      }
      let disposed = false; mesh.geometry.addEventListener('dispose', () => { disposed = true; });
      visual.dispose();
      expect(disposed).toBe(true); expect(scene.children).toHaveLength(0);
    }
  });
});
