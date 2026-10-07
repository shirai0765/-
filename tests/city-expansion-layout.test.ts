import { describe, expect, it } from 'vitest';
import { CITY_DISPLAY_LOTS } from '../src/city/displayLayout';
import { OUTER_SCENERY, OUTER_SCENERY_BUILDING_BUDGET } from '../src/city/sceneLayout';
import { ROADS } from '../src/data/district';
import { CITY_SERVICES } from '../src/data/cityServices';

interface Rectangle { left: number; right: number; near: number; far: number }
const rectangle = (x: number, z: number, width: number, depth: number): Rectangle => ({
  left: x - width / 2, right: x + width / 2, near: z - depth / 2, far: z + depth / 2,
});
const intersects = (a: Rectangle, b: Rectangle) =>
  a.left < b.right && a.right > b.left && a.near < b.far && a.far > b.near;
const scenery = OUTER_SCENERY.map(building => rectangle(building.x, building.z + 4.5, building.w + 2, building.d + 11));

describe('expanded outer city fabric', () => {
  it('adds bounded scenery across all four sides without replacing central parcels', () => {
    expect(OUTER_SCENERY.length).toBeGreaterThanOrEqual(240);
    expect(OUTER_SCENERY.length).toBeLessThanOrEqual(OUTER_SCENERY_BUILDING_BUDGET);
    expect(new Set(OUTER_SCENERY.map(building => `${building.x}:${building.z}`)).size).toBe(OUTER_SCENERY.length);
    for (const building of OUTER_SCENERY) expect(Math.max(Math.abs(building.x), Math.abs(building.z))).toBeGreaterThanOrEqual(218);
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      expect(OUTER_SCENERY.filter(building => building.x * x > 0 && building.z * z > 0).length).toBeGreaterThanOrEqual(45);
    }
    for (const envelope of scenery) {
      expect(envelope.left).toBeGreaterThanOrEqual(-550);
      expect(envelope.right).toBeLessThanOrEqual(550);
      expect(envelope.near).toBeGreaterThanOrEqual(-550);
      expect(envelope.far).toBeLessThanOrEqual(550);
    }
  });

  it('keeps full scenery wings separate from neighboring scenery and every displayed lot', () => {
    const lots = CITY_DISPLAY_LOTS.map(lot => rectangle(lot.x, lot.z, lot.width, lot.depth));
    for (const [index, envelope] of scenery.entries()) {
      for (const other of scenery.slice(index + 1)) expect(intersects(envelope, other), `scenery ${index} overlaps a wing`).toBe(false);
      for (const [lotIndex, lot] of lots.entries()) expect(intersects(envelope, lot), `scenery ${index} blocks ${CITY_DISPLAY_LOTS[lotIndex].id}`).toBe(false);
    }
  });

  it('leaves paved roads, the actual railway and storefront/service approaches clear', () => {
    const transport = ROADS.flatMap(road => road.points.slice(1).map((b, index) => {
      const a = road.points[index];
      return rectangle((a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
        Math.abs(a[0] - b[0]) + road.width + 5, Math.abs(a[1] - b[1]) + road.width + 5);
    }));
    transport.push(rectangle(75, 0, 22, 432));
    const approaches = [...CITY_DISPLAY_LOTS.filter(lot => lot.available), ...CITY_SERVICES]
      .map(site => rectangle(site.x, site.z + 4, site.width + 3, site.depth + 10));
    for (const [index, envelope] of scenery.entries()) {
      for (const road of transport) expect(intersects(envelope, road), `scenery ${index} blocks transport`).toBe(false);
      for (const approach of approaches) expect(intersects(envelope, approach), `scenery ${index} blocks an approach`).toBe(false);
    }
  });
});
