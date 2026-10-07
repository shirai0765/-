import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FinancialServiceVisuals } from '../src/city/FinancialServiceVisuals';
import { CITY_SERVICES } from '../src/data/cityServices';

beforeEach(() => {
  // CPU geometry and raycast only; canvas stub is not rendered-image evidence.
  const context = Object.fromEntries(['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText'].map(name => [name, () => {}]));
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('fictional financial service destinations', () => {
  it('keeps both facades bounded and retains instanced columns/frames rather than dropping instances', () => {
    const visual = new FinancialServiceVisuals();
    for (const service of CITY_SERVICES) {
      const building = visual.group.getObjectByName(`Financial_service_${service.kind}`)!;
      const bounds = new THREE.Box3().setFromObject(building), size = bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(service.width - 1);
      expect(size.x).toBeLessThanOrEqual(service.width + .01);
      expect(size.z).toBeGreaterThan(service.depth - 1);
      expect(size.z).toBeLessThanOrEqual(service.depth + 1);
      expect(size.y).toBeLessThanOrEqual(service.height + 1);
      const instances = building.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
      expect(instances.reduce((n, mesh) => n + mesh.count, 0)).toBeGreaterThan(20);
      expect(building.children.length).toBeLessThanOrEqual(13);
      expect(visual.pickables.find(mesh => mesh.userData.lotId === service.id)).toBeDefined();
    }
    visual.dispose();
  });

  it('uses fixed readable markers that raycast to service IDs and hides close-view annotations', () => {
    const visual = new FinancialServiceVisuals(), camera = new THREE.PerspectiveCamera(36, 1, .5, 1800);
    for (const height of [390, 960]) for (const marker of visual.markers) {
      camera.position.copy(marker.position).add(new THREE.Vector3(0, 0, 100)); camera.lookAt(marker.position); camera.updateMatrixWorld();
      visual.resize(camera, height); visual.group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 2 * 22 / height), camera);
      expect(visual.pickMarker(ray)?.object.userData.serviceId).toBe(marker.userData.serviceId);
      visual.setMarkersVisible(false); expect(visual.pickMarker(ray)).toBeUndefined(); visual.setMarkersVisible(true);
    }
    const geometries = new Set<THREE.BufferGeometry>(); visual.group.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
    let disposed = 0; for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed++);
    visual.dispose(); expect(disposed).toBe(geometries.size);
  });
});
