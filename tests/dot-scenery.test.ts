import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CityArt, disposeScene } from '../src/city/art';
import { LoadedAssetPool, waitForLoadedAssets } from '../src/city/loadedAsset';
import { addSceneryBuilding } from '../src/city/SceneryBuildings';
import { DOT_SCENERY_PLACEMENTS, mountDotScenery } from '../src/city/dotScenery';
import { OUTER_SCENERY } from '../src/city/sceneLayout';
import { CITY_DISPLAY_LOTS } from '../src/city/displayLayout';
import { ROADS } from '../src/data/district';
import { CITY_SERVICES } from '../src/data/cityServices';
import office from '../docs/external/dot/validation/sakura-office/glb-report.json';
import residential from '../docs/external/dot/validation/sakura-residential/glb-report.json';
import akari from '../docs/external/dot/validation/dogenzaka-akari-b/glb-report.json';
import sakamichi from '../docs/external/dot/validation/revisions/dogenzaka-sakamichi-a-4b0dabe359f0/glb-report.json';

// These independent binary inspections measure complete meshes, including roof
// equipment, pads and stairs. This is a geometry test, not native appearance QA.
const inspections = [office, residential, akari, sakamichi];
const hashes = [
  '39ffc13b5843e8ffe9d535bb954ab41f4841b8a8bbe6f8833a93e964fad3ca08',
  'efe9c02f15c840f69c930153edc2165fddeadba1ce5efd98d9aa4e258899912b',
  '484c926c4cfb1a5de45c1826e7f46ccb655a7fb609342a9eead6e7b854550888',
  '4b0dabe359f0005f91e35192263ea03bca9a820bb32b6270081d4e14770a4835',
];
const box = (x: number, z: number, w: number, d: number) => new THREE.Box3(
  new THREE.Vector3(x - w / 2, -1, z - d / 2),
  new THREE.Vector3(x + w / 2, 1000, z + d / 2),
);
const reservation = (building: typeof OUTER_SCENERY[number]) =>
  box(building.x, building.z + 4.5, building.w + 2, building.d + 11);
function scene() {
  const owner = new THREE.Scene(), art = new CityArt();
  owner.add(art.group); return { owner, art };
}
function template() {
  const group = new THREE.Group(), geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture(), material = new THREE.MeshStandardMaterial({ map: texture });
  group.add(new THREE.Mesh(geometry, material));
  return { group, disposed: [vi.spyOn(geometry, 'dispose'), vi.spyOn(material, 'dispose'), vi.spyOn(texture, 'dispose')] };
}
function instanceWorldMatrices(group: THREE.Object3D) {
  group.updateWorldMatrix(true, true);
  const result: number[][] = [];
  group.traverse(object => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    for (let i = 0; i < object.count; i++) {
      const matrix = new THREE.Matrix4(); object.getMatrixAt(i, matrix);
      result.push(object.matrixWorld.clone().multiply(matrix).toArray());
    }
  });
  return result;
}

describe('four reviewed Dot background placements', () => {
  it('replaces exactly four unchanged background entries and refuses moved or reindexed slots', async () => {
    expect(DOT_SCENERY_PLACEMENTS).toHaveLength(4);
    const { owner, art } = scene(), load = vi.fn(async (_url: string) => template().group);
    const pool = new LoadedAssetPool(owner, load);
    const original = structuredClone(OUTER_SCENERY);
    const replaced = OUTER_SCENERY.flatMap((building, index) =>
      mountDotScenery(art, pool, building, index, '/-/') ? [index] : []);
    expect(replaced.sort((a, b) => a - b)).toEqual([163, 165, 195, 242]);
    const placement = DOT_SCENERY_PLACEMENTS[0];
    expect(mountDotScenery(art, pool, { ...placement.source, x: placement.source.x + 1 }, placement.index)).toBe(false);
    expect(mountDotScenery(art, pool, placement.source, placement.index + 1)).toBe(false);
    expect(OUTER_SCENERY).toEqual(original);
    await pool.ready(); expect(load).toHaveBeenCalledTimes(4);
    expect(load.mock.calls.map(([url]) => url).sort()).toEqual(DOT_SCENERY_PLACEMENTS.map(p => '/-/' + p.asset).sort());
    await pool.dispose(); disposeScene(owner);
  });

  it('fits every complete measured model into its old reserve, clear of roads, rail, lots and approaches', () => {
    const obstacles = ROADS.flatMap(road => road.points.slice(1).map((b, i) => {
      const a = road.points[i]; return box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
        Math.abs(a[0] - b[0]) + road.width + 5, Math.abs(a[1] - b[1]) + road.width + 5);
    }));
    obstacles.push(box(75, 0, 22, 432), ...CITY_DISPLAY_LOTS.map(l => box(l.x, l.z, l.width, l.depth)),
      ...[...CITY_DISPLAY_LOTS.filter(l => l.available), ...CITY_SERVICES]
        .map(l => box(l.x, l.z + 4, l.width + 3, l.depth + 10)));
    for (const [i, placement] of DOT_SCENERY_PLACEMENTS.entries()) {
      const inspected = inspections[i];
      expect(inspected.passed).toBe(true); expect(inspected.sha256).toBe(hashes[i]);
      expect(inspected.external_uris).toEqual([]);
      const measured = inspected.world_bounds_gltf_y_up_m;
      const model = new THREE.Box3(new THREE.Vector3().fromArray(measured.min), new THREE.Vector3().fromArray(measured.max));
      model.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...placement.position),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yaw), new THREE.Vector3(1, 1, 1)));
      const reserved = reservation(placement.source);
      expect(reserved.containsBox(model)).toBe(true);
      expect(model.min.y).toBeGreaterThanOrEqual(-.000001);
      expect(model.max.y).toBeLessThanOrEqual(placement.source.h + (placement.source.seed % 3 === 0 ? 6 + placement.source.seed % 12 : 0) + 3);
      for (const obstacle of obstacles) expect(model.intersectsBox(obstacle), placement.id).toBe(false);
      for (const [index, other] of OUTER_SCENERY.entries()) if (index !== placement.index) {
        expect(model.intersectsBox(reservation(other)), `${placement.id} touches scenery ${index}`).toBe(false);
      }
    }
  });

  it('retains the original procedural world pose and geometry when any of the four files fails', async () => {
    const { owner, art } = scene(), load = vi.fn(async () => { throw new Error('missing local asset'); });
    const pool = new LoadedAssetPool(owner, load);
    for (const placement of DOT_SCENERY_PLACEMENTS) mountDotScenery(art, pool, placement.source, placement.index);
    await waitForLoadedAssets(owner);
    for (const placement of DOT_SCENERY_PLACEMENTS) {
      const slot = art.group.getObjectByName(`dot_scenery_${placement.id}`)!;
      expect(slot.userData.assetStatus).toBe('fallback');
      expect(slot.userData.assetLoadError).toBe('missing local asset');
      const original = new CityArt(); addSceneryBuilding(original, placement.source); original.finish();
      const expected = instanceWorldMatrices(original.group), actual = instanceWorldMatrices(slot);
      expect(actual).toHaveLength(expected.length);
      // Instance translations are Float32: local and world batches round at
      // different magnitudes, within fifty micrometres of the original shape.
      for (const [i, matrix] of actual.entries()) for (const [j, value] of matrix.entries()) expect(value).toBeCloseTo(expected[i][j], 4);
      disposeScene(original.group);
    }
    expect(load).toHaveBeenCalledTimes(4);
    await pool.dispose(); disposeScene(owner);
  });

  it('loads one model per slot at the approved pose and disposes only private fallbacks', async () => {
    const { owner, art } = scene(), loaded = DOT_SCENERY_PLACEMENTS.map(template);
    art.box(0, 1, 0, 1, 1, 1, '#a6aaa5');
    const mainGeometry = vi.spyOn(art.boxGeometry, 'dispose');
    const mainMaterial = vi.spyOn(art.material('#a6aaa5'), 'dispose');
    const load = vi.fn(async (url: string) => loaded[DOT_SCENERY_PLACEMENTS.findIndex(p => url.endsWith(p.asset))].group);
    const pool = new LoadedAssetPool(owner, load), privateDisposals: ReturnType<typeof vi.spyOn>[] = [];
    for (const placement of DOT_SCENERY_PLACEMENTS) {
      mountDotScenery(art, pool, placement.source, placement.index);
      const slot = art.group.getObjectByName(`dot_scenery_${placement.id}`)!;
      const resources = new Set<THREE.BufferGeometry | THREE.Material>();
      slot.traverse(object => { if (object instanceof THREE.Mesh) {
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
        expect(object.geometry).not.toBe(art.boxGeometry);
      } });
      for (const resource of resources) privateDisposals.push(vi.spyOn(resource, 'dispose'));
    }
    await waitForLoadedAssets(owner);
    for (const placement of DOT_SCENERY_PLACEMENTS) {
      const slot = art.group.getObjectByName(`dot_scenery_${placement.id}`)!;
      expect(slot.userData).toMatchObject({ dotSceneryAssetId: placement.id,
        sourceSceneryId: `outer-scenery-${placement.index}`, assetStatus: 'loaded' });
      expect(slot.userData.lotId).toBeUndefined(); expect(slot.userData.storefrontLotId).toBeUndefined();
      expect(slot.position.toArray()).toEqual(placement.position);
      expect(slot.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.yaw))).toBeLessThan(.0000001);
      expect(slot.scale.toArray()).toEqual([1, 1, 1]);
      expect(slot.children).toHaveLength(1);
      expect(instanceWorldMatrices(slot)).toHaveLength(0); // No procedural duplicate remains.
    }
    privateDisposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
    expect(mainGeometry).not.toHaveBeenCalled(); expect(mainMaterial).not.toHaveBeenCalled();
    loaded.forEach(asset => asset.disposed.forEach(dispose => expect(dispose).not.toHaveBeenCalled()));
    await pool.dispose(); disposeScene(owner);
    loaded.forEach(asset => asset.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1)));
    expect(mainGeometry).toHaveBeenCalledTimes(1); expect(mainMaterial).toHaveBeenCalledTimes(1);
    privateDisposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it('never attaches a late Dot response after scene teardown', async () => {
    let resolve!: (group: THREE.Group) => void, signal!: AbortSignal;
    const { owner, art } = scene(), loaded = template();
    const pool = new LoadedAssetPool(owner, (_url, currentSignal) => {
      signal = currentSignal; return new Promise<THREE.Group>(done => { resolve = done; });
    });
    const placement = DOT_SCENERY_PLACEMENTS[0];
    mountDotScenery(art, pool, placement.source, placement.index);
    const slot = art.group.getObjectByName(`dot_scenery_${placement.id}`)!;
    await Promise.resolve(); const pending = pool.dispose(); disposeScene(owner);
    expect(signal.aborted).toBe(true); resolve(loaded.group); await pending;
    expect(slot.parent).toBeNull(); expect(slot.children).toHaveLength(0);
    loaded.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });
});
