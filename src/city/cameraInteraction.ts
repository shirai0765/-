import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type CameraMode = 'manage' | 'explore';

/** Same inputs on both maps; normal management never maps a gesture to rotation. */
export function configureCameraInteraction(controls: OrbitControls, mode: CameraMode) {
  // Flush residual explore rotation before fixing the management orientation.
  const position = controls.object.position.clone(), target = controls.target.clone();
  controls.enableDamping = false;
  controls.update();
  controls.object.position.copy(position); controls.target.copy(target); controls.update();
  controls.enableRotate = mode === 'explore';
  controls.enableDamping = mode === 'explore';
  controls.screenSpacePanning = mode === 'explore';
  controls.mouseButtons.LEFT = mode === 'explore' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = mode === 'explore' ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
}

/** Restore only the viewing direction, preserving the player's target and zoom. */
export function restoreOverviewDirection(controls: OrbitControls, direction: THREE.Vector3) {
  const distance = Math.max(controls.minDistance, controls.object.position.distanceTo(controls.target));
  controls.object.position.copy(controls.target).addScaledVector(direction.clone().normalize(), distance);
  controls.update();
}
