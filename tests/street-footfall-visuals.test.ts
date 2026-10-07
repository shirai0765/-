import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { StreetFootfallVisuals } from '../src/city/StreetFootfallVisuals';
import { LOTS, ROADS, LANDMARKS } from '../src/data/district';
import { CITY_DISPLAY_LOTS } from '../src/city/displayLayout';
import { CITY_SERVICES } from '../src/data/cityServices';
import { getFootfallBand } from '../src/sim/siteContext';
import { isOuterSceneryBlocked } from '../src/city/sceneLayout';

describe('authored street traffic comparison', () => {
  it('covers every economic site with fixed relative density and only three draw groups', () => {
    const lots = LOTS.filter(lot => lot.available), original = JSON.stringify(LOTS);
    const visual = new StreetFootfallVisuals(LOTS, false);
    expect(visual.group.visible).toBe(false);
    expect(visual.group.children).toHaveLength(3);
    expect(visual.group.userData.sites).toHaveLength(72);
    for (const site of visual.group.userData.sites) {
      const lot = lots.find(lot => lot.id === site.lotId)!;
      expect(site.band).toBe(getFootfallBand(lot.footfall).id);
      expect(site.symbolicPeople).toBe([2, 5, 8][getFootfallBand(lot.footfall).rank]);
    }
    visual.setVisible(true); visual.animate(999999);
    expect(JSON.stringify(LOTS)).toBe(original);
    visual.setVisible(false);
    const bodies = visual.group.children[1] as THREE.InstancedMesh;
    const before = Array.from(bodies.instanceMatrix.array);
    visual.animate(7777777);
    expect(Array.from(bodies.instanceMatrix.array)).toEqual(before);
    visual.dispose();
  });

  it('keeps moving people inside clear frontage lanes at every site, including outer neighborhoods', () => {
    const visual = new StreetFootfallVisuals(LOTS, false), lots = LOTS.filter(lot => lot.available);
    visual.setVisible(true);
    const bodies = visual.group.children[1] as THREE.InstancedMesh, matrix = new THREE.Matrix4(), point = new THREE.Vector3();
    const contains = (x: number, z: number, obstacle: { x: number; z: number; width: number; depth: number }) => Math.abs(x - obstacle.x) < obstacle.width / 2 + .3 && Math.abs(z - obstacle.z) < obstacle.depth / 2 + .3;
    const landmarks = LANDMARKS.map(l => ({ ...l, width: l.kind === 'park' ? 62 : l.kind === 'tower' ? 46 : l.kind === 'station' ? 38 : l.kind === 'mall' ? 40 : 45, depth: l.kind === 'park' ? 78 : l.kind === 'tower' ? 52 : l.kind === 'station' ? 70 : l.kind === 'mall' ? 42 : 40 }));
    for (const time of [0, 7500, 23000, 160000]) {
      visual.animate(time); let index = 0;
      for (const lot of lots) {
        for (let person = 0; person < [2, 5, 8][getFootfallBand(lot.footfall).rank]; person++) {
          bodies.getMatrixAt(index++, matrix); point.setFromMatrixPosition(matrix);
          expect(Math.abs(point.x - lot.x)).toBeLessThanOrEqual(lot.width * .331);
          expect(point.z - lot.z).toBeGreaterThan(lot.depth / 2 + 5.29);
          expect(point.z - lot.z).toBeLessThan(lot.depth / 2 + 5.71);
          expect([...CITY_DISPLAY_LOTS.filter(other => other.id !== lot.id), ...CITY_SERVICES, ...landmarks].some(other => contains(point.x, point.z, other)), lot.id).toBe(false);
          for (const road of ROADS) {
            const [a, b] = road.points;
            expect(contains(point.x, point.z, { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, width: Math.abs(a[0] - b[0]) + road.width, depth: Math.abs(a[1] - b[1]) + road.width }), `${lot.id}/${road.id}`).toBe(false);
          }
        }
      }
    }
    visual.dispose();
  });

  it('keeps reduced motion still and releases all three pools exactly once', () => {
    const visual = new StreetFootfallVisuals(LOTS, true), scene = new THREE.Scene(); scene.add(visual.group);
    visual.setVisible(true);
    const bodies = visual.group.children[1] as THREE.InstancedMesh, before = Array.from(bodies.instanceMatrix.array);
    visual.animate(70000); expect(Array.from(bodies.instanceMatrix.array)).toEqual(before);
    const disposed: string[] = [];
    for (const child of visual.group.children as THREE.Mesh[]) child.geometry.addEventListener('dispose', () => disposed.push(child.name));
    visual.dispose(); expect(disposed).toHaveLength(3); expect(scene.children).toHaveLength(0);
  });

  it('reserves economic sites, service forecourts and outer connecting roads from generated scenery', () => {
    for (const lot of LOTS.filter(lot => lot.available)) expect(isOuterSceneryBlocked(lot.x, lot.z, 18, 19), lot.id).toBe(true);
    for (const service of CITY_SERVICES) expect(isOuterSceneryBlocked(service.x, service.z + service.depth / 2 + 4, 18, 19)).toBe(true);
    for (const road of ROADS) { const [a, b] = road.points; expect(isOuterSceneryBlocked((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 18, 19), road.id).toBe(true); }
    expect(isOuterSceneryBlocked(480, 480, 18, 19)).toBe(false);
  });
});
