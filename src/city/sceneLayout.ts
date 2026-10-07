import { LOTS, ROADS } from '../data/district';
import { CITY_SERVICES } from '../data/cityServices';

type Footprint = { x: number; z: number; width: number; depth: number };
const overlaps = (a: Footprint, b: Footprint) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
const reservations: Footprint[] = [
  ...LOTS.filter(lot => lot.available).map(lot => ({ x: lot.x, z: lot.z + 4, width: lot.width + 3, depth: lot.depth + 10 })),
  ...CITY_SERVICES.map(service => ({ x: service.x, z: service.z + 4, width: service.width + 3, depth: service.depth + 10 })),
  ...ROADS.flatMap(road => road.points.slice(1).map((b, index) => {
    const a = road.points[index];
    return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, width: Math.abs(a[0] - b[0]) + road.width + 5, depth: Math.abs(a[1] - b[1]) + road.width + 5 };
  })),
];

/** Background envelopes include their forward wings and leave shops/sidewalks clear. */
export function isOuterSceneryBlocked(x: number, z: number, width: number, depth: number) {
  return reservations.some(reserved => overlaps({ x, z: z + 4.5, width: width + 2, depth: depth + 11 }, reserved));
}

/** Share the actual distant fabric with close-view clearance checks. */
export const OUTER_SCENERY: { x: number; z: number; w: number; d: number; h: number; seed: number }[] = [];
for (let row = -8; row <= 8; row++) for (let col = -8; col <= 8; col++) {
  if (Math.abs(row) < 5 && Math.abs(col) < 5) continue;
  const seed = Math.abs(row * 73 + col * 131), x = col * 52 + (row % 2) * 11 + (seed % 9) - 4, z = row * 52 + (seed % 13) - 6;
  const w = 18 + seed % 19, d = 19 + (seed * 7) % 18, h = 9 + (seed * 13) % 43;
  if (!isOuterSceneryBlocked(x, z, w, d)) OUTER_SCENERY.push({ x, z, w, d, h, seed });
}
