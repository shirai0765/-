import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Explicit map navigation: move the view, retaining its angle, zoom and height. */
export function panCameraToSite(controls: OrbitControls, site: { x: number; z: number }) {
  const camera = controls.object, position = camera.position.clone(), target = controls.target.clone();
  const damping = controls.enableDamping;
  // Finish queued gesture deltas, then restore the visible pose before moving.
  // Otherwise explore-mode damping can rotate/pan the newly requested view.
  controls.enableDamping = false;
  controls.update();
  const delta = new THREE.Vector3(site.x - target.x, 0, site.z - target.z);
  camera.position.copy(position).add(delta);
  controls.target.copy(target).add(delta);
  controls.update();
  controls.enableDamping = damping;
}
