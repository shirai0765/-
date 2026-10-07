import * as THREE from 'three';
import { CityArt } from './art';
import { LoadedAssetPool } from './loadedAsset';
import { addSceneryBuilding } from './SceneryBuildings';
import type { SceneryBuilding } from './sceneLayout';

interface DotSceneryPlacement {
  id: string;
  index: number;
  source: SceneryBuilding;
  asset: string;
  position: readonly [number, number, number];
  yaw: number;
}

// These four complete GLB envelopes fit the existing storeViewpoints reserves.
// Match the original entry as well as its index: a changed layout must keep its
// normal procedural building instead of putting an asset in an unreviewed slot.
export const DOT_SCENERY_PLACEMENTS: readonly DotSceneryPlacement[] = [
  { id: 'sakura-office', index: 165,
    source: { x: -127, z: 322, w: 15, d: 14, h: 18, seed: 4470 },
    asset: 'models/external-v080/sakura-midrise/sakura-office.glb',
    position: [-125, 0, 322], yaw: Math.PI / 2 },
  { id: 'sakura-residential', index: 163,
    source: { x: 67, z: 257, w: 23, d: 20, h: 34, seed: 6418 },
    asset: 'models/external-v080/sakura-midrise/sakura-residential.glb',
    position: [64, 0, 257], yaw: -Math.PI / 2 },
  { id: 'dogenzaka-akari-b', index: 195,
    source: { x: -419, z: 29, w: 15, d: 14, h: 32, seed: 8960 },
    asset: 'models/external-v080/dogenzaka-mixed/dogenzaka-akari-b.glb',
    position: [-419, 0, 27.5], yaw: Math.PI },
  { id: 'dogenzaka-sakamichi-a', index: 242,
    source: { x: -386, z: -64, w: 15, d: 14, h: 18, seed: 9150 },
    asset: 'models/external-v080/dogenzaka-mixed/dogenzaka-sakamichi-a.glb',
    position: [-386, 0, -53], yaw: 0 },
];

const UP = new THREE.Vector3(0, 1, 0);

/** Replace only a reviewed background slot, using the scene's existing pool. */
export function mountDotScenery(
  art: CityArt, assets: LoadedAssetPool, building: SceneryBuilding, index: number,
  baseURL = import.meta.env.BASE_URL,
): boolean {
  const placement = DOT_SCENERY_PLACEMENTS.find(candidate => candidate.index === index);
  if (!placement || (Object.keys(placement.source) as (keyof SceneryBuilding)[])
    .some(key => placement.source[key] !== building[key])) return false;

  // Pool success disposes the fallback. It must never borrow the main City's
  // instanced box geometry or materials, which hundreds of buildings still use.
  const fallbackArt = new CityArt();
  addSceneryBuilding(fallbackArt, { ...building, x: 0, z: 0 });
  fallbackArt.finish();
  const fallback = new THREE.Group();
  fallback.name = `dot_scenery_${placement.id}`;
  fallback.position.set(...placement.position);
  fallback.rotation.y = placement.yaw;
  fallback.userData = { dotSceneryAssetId: placement.id, sourceSceneryId: `outer-scenery-${index}` };

  // Stable slot uses the approved model pose M. Its procedural child uses M⁻¹B,
  // preserving the ORIGINAL building pose B while loading or after a failure.
  fallbackArt.group.position.set(building.x - placement.position[0], 0,
    building.z - placement.position[2]).applyAxisAngle(UP, -placement.yaw);
  fallbackArt.group.rotation.y = -placement.yaw;
  fallback.add(fallbackArt.group);
  const handle = assets.mount(`${baseURL}${placement.asset}`, fallback);
  handle.group.name = `dot_scenery_${placement.id}`;
  art.group.add(handle.group);
  return true;
}
