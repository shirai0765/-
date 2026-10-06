import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameSiteMarkers } from '../src/city/GameSiteMarkers';
import { LOTS } from '../src/data/district';
import { applyAction, createGame } from '../src/sim/engine';

beforeEach(() => {
  // CPU geometry/raycast check only; this canvas stub is not rendering evidence.
  const context = Object.fromEntries(['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'arc', 'quadraticCurveTo', 'bezierCurveTo', 'fillRect', 'strokeRect'].map(name => [name, () => {}]));
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('game site marker targets', () => {
  it('only exposes economic sites and tracks ordinary opening without changing the state', () => {
    const markers = new GameSiteMarkers(LOTS);
    const state = applyAction(createGame('marker QA'), { type: 'openStore', lotId: 'center-01', style: 'standard' });
    const before = JSON.stringify(state);
    markers.update(state, 'center-01');
    expect(markers.pickables).toHaveLength(32);
    expect(markers.pickables.every(marker => LOTS.find(lot => lot.id === marker.userData.lotId)?.available)).toBe(true);
    expect(markers.pickables.find(marker => marker.userData.lotId === 'center-01')?.userData.siteStatus).toBe('store');
    expect(markers.pickables.find(marker => marker.userData.lotId === 'dogenzaka-01')?.userData.siteStatus).toBe('candidate');
    expect(JSON.stringify(state)).toBe(before);
    markers.dispose();
  });

  it('raycasts the visible screen-sized icon to the same lot at different viewport sizes', () => {
    const lot = LOTS.find(lot => lot.id === 'center-01')!;
    const markers = new GameSiteMarkers([lot]);
    const camera = new THREE.PerspectiveCamera(36, 1, .5, 1800);
    camera.position.set(lot.x, lot.height + 3, lot.z + 200);
    camera.lookAt(lot.x, lot.height + 3, lot.z);
    camera.updateMatrixWorld();
    for (const height of [320, 960]) {
      markers.resize(camera, height);
      markers.group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(0, 2 * 22 / height), camera);
      expect(ray.intersectObjects(markers.pickables)[0]?.object.userData.lotId).toBe(lot.id);
      ray.setFromCamera(new THREE.Vector2(2 * 25 / height, 2 * 22 / height), camera);
      expect(ray.intersectObjects(markers.pickables)).toHaveLength(0);
    }
    markers.dispose();
  });
});
