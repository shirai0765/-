import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { configureCameraInteraction, restoreOverviewDirection } from '../src/city/cameraInteraction';

// Real OrbitControls event handlers, CPU only; no WebGL or browser-layout claim.
class Surface extends EventTarget {
  style = { touchAction: '' }; clientWidth = 960; clientHeight = 600;
  getRootNode() { return this; }
  setPointerCapture() {} releasePointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  emit(type: string, values: object) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, ctrlKey: false, shiftKey: false, metaKey: false }, values);
    this.dispatchEvent(event);
  }
  drag(pointerType = 'mouse') {
    this.emit('pointerdown', { pointerType, clientX: 200, clientY: 200, pageX: 200, pageY: 200 });
    this.emit('pointermove', { pointerType, clientX: 260, clientY: 230, pageX: 260, pageY: 230 });
    this.emit('pointerup', { pointerType });
  }
}

describe('map camera interaction modes', () => {
  it('pans on ordinary mouse/touch drags and zooms on wheel without changing viewing angle', () => {
    const surface = new Surface(), camera = new THREE.PerspectiveCamera(36, 1.6, .5, 1800);
    camera.position.set(-290, 255, 325);
    const controls = new OrbitControls(camera, surface as unknown as HTMLElement);
    configureCameraInteraction(controls, 'manage');
    for (const pointer of ['mouse', 'touch']) {
      const orientation = camera.quaternion.clone(), target = controls.target.clone();
      surface.drag(pointer);
      expect(controls.target.distanceTo(target)).toBeGreaterThan(1);
      expect(controls.target.y).toBeCloseTo(target.y);
      expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
    }
    const distance = camera.position.distanceTo(controls.target), orientation = camera.quaternion.clone();
    surface.emit('wheel', { deltaY: 100, deltaMode: 0, clientX: 300, clientY: 300 });
    expect(camera.position.distanceTo(controls.target)).not.toBeCloseTo(distance);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
    controls.dispose();
  });

  it('only rotates in explore and returns to a stable overview without losing target or zoom', () => {
    const surface = new Surface(), camera = new THREE.PerspectiveCamera(); camera.position.set(-290, 255, 325);
    const controls = new OrbitControls(camera, surface as unknown as HTMLElement);
    configureCameraInteraction(controls, 'explore');
    expect(controls.screenSpacePanning).toBe(true);
    const previous = camera.quaternion.clone(); surface.drag();
    expect(camera.quaternion.angleTo(previous)).toBeGreaterThan(.01);
    const target = controls.target.clone(), distance = camera.position.distanceTo(target);
    configureCameraInteraction(controls, 'manage');
    const direction = new THREE.Vector3(-290, 247, 325).normalize();
    restoreOverviewDirection(controls, direction);
    expect(controls.target.toArray()).toEqual(target.toArray());
    expect(camera.position.distanceTo(target)).toBeCloseTo(distance);
    expect(camera.position.clone().sub(target).normalize().distanceTo(direction)).toBeLessThan(1e-10);
    const settled = camera.position.clone(); controls.update(); expect(camera.position.distanceTo(settled)).toBeLessThan(1e-10);
    controls.dispose();
  });
});
