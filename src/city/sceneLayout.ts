import { LOTS, ROADS } from '../data/district';
import { CITY_SERVICES } from '../data/cityServices';

type Footprint = { x: number; z: number; width: number; depth: number };
export type SceneryBuilding = { x: number; z: number; w: number; d: number; h: number; seed: number };
export const OUTER_SCENERY_BUILDING_BUDGET = 340;
const overlaps = (a: Footprint, b: Footprint) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
const reservations: Footprint[] = [
  ...LOTS.filter(lot => lot.available).map(lot => ({ x: lot.x, z: lot.z + 4, width: lot.width + 3, depth: lot.depth + 10 })),
  ...CITY_SERVICES.map(service => ({ x: service.x, z: service.z + 4, width: service.width + 3, depth: service.depth + 10 })),
  ...ROADS.flatMap(road => road.points.slice(1).map((b, index) => {
    const a = road.points[index];
    return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, width: Math.abs(a[0] - b[0]) + road.width + 5, depth: Math.abs(a[1] - b[1]) + road.width + 5 };
  })),
  // The visual railway is longer and wider than the economic core reservation.
  { x: 75, z: 0, width: 22, depth: 432 },
];

/** Background envelopes include their forward wings and leave shops/sidewalks clear. */
export function isOuterSceneryBlocked(x: number, z: number, width: number, depth: number) {
  return reservations.some(reserved => overlaps({ x, z: z + 4.5, width: width + 2, depth: depth + 11 }, reserved));
}

/** Share the actual distant fabric with close-view clearance checks. */
export const OUTER_SCENERY: SceneryBuilding[] = [];
for (let row = -8; row <= 8; row++) for (let col = -8; col <= 8; col++) {
  if (Math.abs(row) < 5 && Math.abs(col) < 5) continue;
  const seed = Math.abs(row * 73 + col * 131), x = col * 52 + (row % 2) * 11 + (seed % 9) - 4, z = row * 52 + (seed % 13) - 6;
  const w = 18 + seed % 19, d = 19 + (seed * 7) % 18, h = 9 + (seed * 13) % 43;
  if (!isOuterSceneryBlocked(x, z, w, d)) OUTER_SCENERY.push({ x, z, w, d, h, seed });
}

const sceneryEnvelope = (building: SceneryBuilding): Footprint => ({
  x: building.x, z: building.z + 4.5, width: building.w + 2, depth: building.d + 11,
});
const occupied = OUTER_SCENERY.map(sceneryEnvelope);
const infill: { building: SceneryBuilding; band: number; order: number }[] = [];
for (let row = -14; row <= 14; row++) for (let col = -14; col <= 14; col++) {
  const seed = Math.abs(row * 193 + col * 389) + 4096;
  const x = col * 32 + seed % 7 - 3, z = row * 32 + (seed * 3) % 7 - 3;
  // Keep the accepted central buildings intact. Fill the existing neighborhood
  // gaps first, then the outer edge; the economic parcels remain separate.
  if (Math.abs(x) < 218 && Math.abs(z) < 218) continue;
  const building = { x, z, w: 15 + seed % 10, d: 14 + (seed * 7) % 10, h: 12 + (seed * 13) % 36, seed };
  infill.push({ building, band: Math.max(Math.abs(x), Math.abs(z)) <= 352 ? 0 : 1,
    order: ((row + 17) * 193 + (col + 17) * 389) % 997 });
}
for (const { building } of infill.sort((a, b) => a.band - b.band || a.order - b.order)) {
  if (OUTER_SCENERY.length >= OUTER_SCENERY_BUILDING_BUDGET) break;
  if (isOuterSceneryBlocked(building.x, building.z, building.w, building.d)) continue;
  const envelope = sceneryEnvelope(building);
  if (occupied.some(other => overlaps(envelope, other))) continue;
  OUTER_SCENERY.push(building);
  occupied.push(envelope);
}
