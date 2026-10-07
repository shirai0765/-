import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { configureCameraInteraction } from '../src/city/cameraInteraction';
import { panCameraToSite } from '../src/city/sitePan';

// Real control updates and gesture handlers; no WebGL/browser rendering claim.
class Surface extends EventTarget {
  style = { touchAction: '' }; clientWidth = 960; clientHeight = 600;
  getRootNode() { return this; }
  setPointerCapture() {} releasePointerCapture() {}
  emit(type: string, values: object) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0,
      ctrlKey: false, shiftKey: false, metaKey: false }, values);
    this.dispatchEvent(event);
  }
}

describe('explicit site navigation', () => {
  it.each(['manage', 'explore'] as const)('preserves the rendered pose offset and FOV in %s mode', mode => {
    const surface = new Surface(), camera = new THREE.PerspectiveCamera(36, 1.6, .5, 1800);
    camera.position.set(-290, 255, 325);
    const controls = new OrbitControls(camera, surface as unknown as HTMLElement);
    controls.target.set(0, 8, 0); controls.maxTargetRadius = 460;
    configureCameraInteraction(controls, mode);
    for (const site of [{ x: -440, z: 41 }, { x: -78, z: 440 }, { x: 440, z: -72 }]) {
      const orientation = camera.quaternion.clone(), offset = camera.position.clone().sub(controls.target);
      const height = camera.position.y, targetHeight = controls.target.y, distance = offset.length();
      panCameraToSite(controls, site);
      expect(controls.target.x).toBeCloseTo(site.x, 10);
      expect(controls.target.z).toBeCloseTo(site.z, 10);
      expect(controls.target.y).toBeCloseTo(targetHeight, 10);
      expect(camera.position.y).toBeCloseTo(height, 10);
      expect(camera.position.clone().sub(controls.target).distanceTo(offset)).toBeLessThan(1e-9);
      expect(camera.position.distanceTo(controls.target)).toBeCloseTo(distance, 10);
      expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
      expect(camera.fov).toBe(36);
      expect(controls.enableDamping).toBe(mode === 'explore');
      const settled = camera.position.clone();
      for (let frame = 0; frame < 20; frame++) controls.update();
      expect(camera.position.distanceTo(settled)).toBeLessThan(1e-9);
    }
    controls.dispose();
  });

  it('flushes residual explore damping without rotating or moving after the explicit pan', () => {
    const surface = new Surface(), camera = new THREE.PerspectiveCamera(47, 1.6, .5, 1800);
    camera.position.set(-290, 255, 325);
    const controls = new OrbitControls(camera, surface as unknown as HTMLElement);
    controls.target.set(0, 8, 0);
    configureCameraInteraction(controls, 'explore');
    surface.emit('pointerdown', { clientX: 200, clientY: 200, pageX: 200, pageY: 200 });
    surface.emit('pointermove', { clientX: 260, clientY: 230, pageX: 260, pageY: 230 });
    surface.emit('pointerup', {});
    const orientation = camera.quaternion.clone(), offset = camera.position.clone().sub(controls.target);
    panCameraToSite(controls, { x: -78, z: -440 });
    const settled = camera.position.clone();
    for (let frame = 0; frame < 20; frame++) controls.update();
    expect(camera.position.clone().sub(controls.target).distanceTo(offset)).toBeLessThan(1e-9);
    expect(camera.position.distanceTo(settled)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
    expect(camera.fov).toBe(47);
    expect(controls.enableDamping).toBe(true);
    controls.dispose();
  });
});
