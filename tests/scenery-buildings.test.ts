import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CityArt, disposeScene } from '../src/city/art';
import { addSceneryBuilding } from '../src/city/SceneryBuildings';
import { OUTER_SCENERY } from '../src/city/sceneLayout';

// CPU bounds and resource contracts only; native screenshots assess appearance.
describe('shared distant building fabric', () => {
  it('keeps each style and roof inside the existing scenery clearance envelope', () => {
    const cases = [...Array.from({ length: 36 }, (_, seed) => ({
      x: seed * 13 - .5, z: seed * -8.5, w: 18 + seed % 19,
      d: 19 + seed * 7 % 18, h: 9 + seed * 13 % 43, seed,
    })), ...OUTER_SCENERY];
    for (const building of cases) {
      const { seed } = building;
      const original = { ...building }, art = new CityArt();
      addSceneryBuilding(art, building); art.finish();
      const bounds = new THREE.Box3().setFromObject(art.group), tolerance = .0001;
      expect(bounds.min.x).toBeGreaterThanOrEqual(building.x - (building.w + 2) / 2 - tolerance);
      expect(bounds.max.x).toBeLessThanOrEqual(building.x + (building.w + 2) / 2 + tolerance);
      expect(bounds.min.z).toBeGreaterThanOrEqual(building.z - building.d / 2 - 1 - tolerance);
      expect(bounds.max.z).toBeLessThanOrEqual(building.z + building.d / 2 + 10 + tolerance);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-tolerance);
      expect(bounds.max.y).toBeLessThanOrEqual(building.h + (seed % 3 === 0 ? 6 + seed % 12 : 0) + 3 + tolerance);
      expect(art.group.userData.sceneryInstances).toBeLessThanOrEqual(96);
      expect(building).toEqual(original);
      disposeScene(art.group);
    }
  });

  it('uses one shared box geometry and a bounded opaque palette for every style', () => {
    const art = new CityArt();
    for (let seed = 0; seed < 6; seed++) addSceneryBuilding(art, { x: seed * 40, z: 0, w: 26, d: 28, h: 35, seed });
    art.finish();
    const batches = art.group.children as THREE.InstancedMesh[];
    expect(batches.every(mesh => mesh instanceof THREE.InstancedMesh)).toBe(true);
    expect(new Set(batches.map(mesh => mesh.geometry))).toEqual(new Set([art.boxGeometry]));
    expect(batches.length).toBeLessThanOrEqual(13);
    for (const mesh of batches) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.map).toBeNull();
    }
    expect(art.group.userData.sceneryStyles).toEqual({ office: 2, 'mixed-use': 2, residential: 2 });
    expect(batches.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(art.group.userData.sceneryInstances);
    disposeScene(art.group);
  });

  it('produces deterministic geometry without scene or economic ownership identifiers', () => {
    const a = new CityArt(), b = new CityArt(), building = { x: -210, z: 320, w: 28, d: 25, h: 40, seed: 77 };
    addSceneryBuilding(a, building); addSceneryBuilding(b, building); a.finish(); b.finish();
    const snapshot = (art: CityArt) => art.group.children.map(object => {
      const mesh = object as THREE.InstancedMesh;
      expect(mesh.userData.lotId).toBeUndefined();
      expect(mesh.userData.storefrontLotId).toBeUndefined();
      return { color: (mesh.material as THREE.MeshStandardMaterial).color.getHexString(),
        transforms: Array.from(mesh.instanceMatrix.array) };
    });
    expect(snapshot(a)).toEqual(snapshot(b));
    disposeScene(a.group); disposeScene(b.group);
  });
});
