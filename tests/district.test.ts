import { describe, expect, it } from 'vitest';
import { ACQUISITION_TARGETS, DISTRICTS, LANDMARKS, LOTS, ROADS } from '../src/data/district';
import type { Lot } from '../src/model';

const overlaps = (a: Pick<Lot, 'x' | 'z' | 'width' | 'depth'>, b: Pick<Lot, 'x' | 'z' | 'width' | 'depth'>) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;

describe('Shibuya authored district', () => {
  it('has four distinct economic districts and sufficient playable and scenery sites', () => {
    expect(new Set(LOTS.map(l => l.id)).size).toBe(LOTS.length);
    expect(LOTS.filter(l => l.available)).toHaveLength(32);
    expect(LOTS.filter(l => !l.available).length).toBeGreaterThanOrEqual(80);
    for (const district of Object.keys(DISTRICTS)) {
      expect(LOTS.filter(l => l.available && l.district === district)).toHaveLength(8);
    }
  });
  it('keeps buildings separate from one another, roads and rail', () => {
    const roads = ROADS.map(r => {
      const [a, b] = r.points;
      return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2,
        width: Math.abs(a[0] - b[0]) + r.width, depth: Math.abs(a[1] - b[1]) + r.width };
    });
    const rail = { x: 75, z: 0, width: 16, depth: 410 };
    for (const [i, lot] of LOTS.entries()) {
      for (const road of [...roads, rail]) expect(overlaps(lot, road), `${lot.id} on transport`).toBe(false);
      for (const other of LOTS.slice(i + 1)) expect(overlaps(lot, other), `${lot.id} overlaps ${other.id}`).toBe(false);
      expect(Math.abs(lot.x) + lot.width / 2).toBeLessThanOrEqual(202);
      expect(Math.abs(lot.z) + lot.depth / 2).toBeLessThanOrEqual(202);
    }
  });
  it('uses weekly economic units with affordable sites and premium tradeoffs', () => {
    for (const lot of LOTS.filter(l => l.available)) {
      expect(lot.footfall).toBeGreaterThanOrEqual(15_000);
      expect(lot.footfall).toBeLessThanOrEqual(80_000);
      expect(lot.affluence).toBeGreaterThanOrEqual(.7);
      expect(lot.affluence).toBeLessThanOrEqual(1.5);
      expect(lot.rent).toBeGreaterThanOrEqual(65_000);
      expect(lot.purchasePrice).toBeGreaterThanOrEqual(30_000_000);
      expect(lot.purchasePrice).toBeLessThanOrEqual(500_000_000);
    }
    expect(LOTS.some(l => l.available && l.rent <= 80_000 && l.footfall >= 24_000)).toBe(true);
    expect(LOTS.some(l => l.available && l.rent >= 300_000 && l.footfall >= 65_000)).toBe(true);
  });
  it('progresses from small food acquisitions to capital-intensive rail', () => {
    expect(new Set(ACQUISITION_TARGETS.map(t => t.id)).size).toBe(ACQUISITION_TARGETS.length);
    expect(ACQUISITION_TARGETS[0].price).toBe(8_000_000);
    expect(new Set(ACQUISITION_TARGETS.map(t => t.sector)).size).toBe(3);
    for (const target of ACQUISITION_TARGETS) {
      expect(target.risk).toBeGreaterThan(0);
      expect(target.risk).toBeLessThan(1);
      expect(target.weeklyProfit * 52 / target.price).toBeLessThan(.30);
      if (target.sector === 'rail') expect(target.price).toBeGreaterThanOrEqual(400_000_000);
    }
    expect(LANDMARKS.find(l => l.kind === 'crossing')).toMatchObject({ x: 0, z: 0 });
  });
});
