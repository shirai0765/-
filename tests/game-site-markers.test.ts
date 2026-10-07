import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameSiteMarkers } from '../src/city/GameSiteMarkers';
import { LOTS } from '../src/data/district';
import { applyAction, createGame } from '../src/sim/engine';

beforeEach(() => {
  // CPU geometry/raycast check only; this canvas stub is not rendering evidence.
  const context = Object.fromEntries(['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'arc', 'quadraticCurveTo', 'bezierCurveTo', 'fillRect', 'strokeRect', 'fillText'].map(name => [name, () => {}]));
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('game site marker targets', () => {
  it('only exposes economic sites and tracks ordinary opening without changing the state', () => {
    const markers = new GameSiteMarkers(LOTS);
    const state = applyAction(createGame('marker QA'), { type: 'openStore', lotId: 'center-01', style: 'standard' });
    const before = JSON.stringify(state);
    markers.update(state, 'center-01');
    expect(markers.pickables).toHaveLength(48);
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

  it('picks the visibly foremost owned or selected marker when actual overview lots overlap', () => {
    const markers = new GameSiteMarkers(LOTS);
    const state = applyAction({ ...createGame('marker overlap QA'), cash: 1_000_000_000 }, { type: 'openStore', lotId: 'center-05', style: 'standard' });
    markers.update(state, null);
    const camera = new THREE.PerspectiveCamera(36, 1.6, .5, 1800);
    camera.position.set(-290, 255, 325);
    camera.lookAt(0, 8, 0);
    camera.updateMatrixWorld();
    markers.resize(camera, 320);
    markers.group.updateMatrixWorld(true);
    const owned = markers.pickables.find(marker => marker.userData.lotId === 'center-05')!;
    const base = owned.position.clone().project(camera);
    const ray = new THREE.Raycaster();
    // The owned pin's filled tip overlaps a closer candidate in this overview.
    ray.setFromCamera(new THREE.Vector2(base.x, base.y + 2 * 10 / 320), camera);
    const hits = ray.intersectObjects(markers.pickables);
    expect(hits[0].object.userData.lotId).toBe('center-01');
    expect(hits.some(hit => hit.object === owned)).toBe(true);
    expect(markers.pick(ray)?.object.userData.lotId).toBe('center-05');
    markers.update(state, 'center-01');
    expect(markers.pick(ray)?.object.userData.lotId).toBe('center-01');
    markers.setVisibility('owned');
    expect(markers.pick(ray)?.object.userData.lotId).toBe('center-05');
    markers.setVisibility('all');
    expect(markers.pick(ray)?.object.userData.lotId).toBe('center-01');
    markers.update(createGame('all candidates'), null);
    expect(markers.pick(ray)?.object.userData.lotId).toBe('center-01');
    markers.dispose();
  });

  it('filters store, property and combined ownership through closes and sales without removing any lot', () => {
    const markers = new GameSiteMarkers(LOTS);
    const targets = [...markers.pickables];
    expect(targets).toHaveLength(48);
    expect(targets.every(marker => marker.visible)).toBe(true);
    let state = { ...createGame('marker visibility QA'), cash: 1_000_000_000 };
    state = applyAction(state, { type: 'openStore', lotId: 'center-01', style: 'standard' });
    state = applyAction(state, { type: 'buyProperty', lotId: 'dogenzaka-01' });
    state = applyAction(state, { type: 'openStore', lotId: 'miyashita-01', style: 'standard' });
    state = applyAction(state, { type: 'buyProperty', lotId: 'miyashita-01' });
    markers.setVisibility('owned');
    const check = (expected: string[]) => {
      const before = JSON.stringify(state);
      // Selecting a candidate from the independent list does not bypass the filter.
      markers.update(state, 'center-02');
      expect(markers.pickables.filter(marker => marker.visible).map(marker => marker.userData.lotId).sort()).toEqual(expected.sort());
      expect(markers.pickables).toEqual(targets);
      expect(markers.group.children).toHaveLength(48);
      expect(JSON.stringify(state)).toBe(before);
    };
    check(['center-01', 'dogenzaka-01', 'miyashita-01']);
    expect(targets.find(marker => marker.userData.lotId === 'center-01')?.userData.siteStatus).toBe('store');
    expect(targets.find(marker => marker.userData.lotId === 'dogenzaka-01')?.userData.siteStatus).toBe('property');
    expect(targets.find(marker => marker.userData.lotId === 'miyashita-01')?.userData.siteStatus).toBe('both');
    state = applyAction(state, { type: 'closeStore', storeId: state.stores.find(store => store.lotId === 'center-01')!.id });
    check(['dogenzaka-01', 'miyashita-01']);
    state = applyAction(state, { type: 'closeStore', storeId: state.stores[0].id });
    check(['dogenzaka-01', 'miyashita-01']);
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties.find(property => property.lotId === 'dogenzaka-01')!.id });
    check(['miyashita-01']);
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties[0].id });
    check([]);
    markers.setVisibility('all');
    expect(markers.pickables.every(marker => marker.visible)).toBe(true);
    expect(markers.pickables).toEqual(targets);
    markers.dispose();
  });

  it('does not pick invisible candidate or close-up pins, and restores the same target afterwards', () => {
    const lot = LOTS.find(lot => lot.id === 'center-01')!;
    const markers = new GameSiteMarkers([lot]);
    const target = markers.pickables[0];
    const camera = new THREE.PerspectiveCamera(36, 1, .5, 1800);
    camera.position.set(lot.x, lot.height + 3, lot.z + 200);
    camera.lookAt(lot.x, lot.height + 3, lot.z);camera.updateMatrixWorld();
    markers.resize(camera, 600);markers.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0, 2 * 22 / 600), camera);
    expect(markers.pick(ray)?.object).toBe(target);
    markers.setVisibility('owned');
    expect(target.visible).toBe(false);
    expect(ray.intersectObjects(markers.pickables)[0]?.object).toBe(target);
    expect(markers.pick(ray)).toBeUndefined();
    const state = applyAction(createGame('hidden marker QA'), { type: 'openStore', lotId: lot.id, style: 'standard' });
    markers.update(state, lot.id);markers.group.updateMatrixWorld(true);
    expect(target.visible).toBe(true);
    expect(markers.pick(ray)?.object).toBe(target);
    const ownedMaterial = target.material;
    markers.setVisibility('none');markers.update(state, lot.id);
    expect(target.visible).toBe(false);
    expect(markers.pick(ray)).toBeUndefined();
    markers.setVisibility('owned');
    expect(target.material).toBe(ownedMaterial);
    expect(markers.pick(ray)?.object).toBe(target);
    markers.group.visible = false;
    expect(markers.pick(ray)).toBeUndefined();
    markers.group.visible = true;
    markers.setVisibility('all');
    expect(markers.pick(ray)?.object).toBe(target);
    markers.dispose();
  });

  it.each([320, 960])('updates the owned target size immediately through ownership changes at a %ipx viewport', height => {
    const lot = LOTS.find(lot => lot.id === 'center-01')!;
    const markers = new GameSiteMarkers([lot]);
    const marker = markers.pickables[0];
    const camera = new THREE.PerspectiveCamera(36, 1, .5, 1800);
    camera.position.set(lot.x, lot.height + 3, lot.z + 200);
    camera.lookAt(lot.x, lot.height + 3, lot.z);
    camera.updateMatrixWorld();
    markers.resize(camera, height);
    const pixelsPerScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const hitAt = (x: number) => {
      markers.group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(2 * x / height, 2 * 22 / height), camera);
      return ray.intersectObjects(markers.pickables)[0]?.object.userData.lotId;
    };
    let state = { ...createGame('marker ownership QA'), cash: 1_000_000_000 };
    const check = (status: string, owned: boolean) => {
      const before = JSON.stringify(state);
      // Deliberately do not resize: business actions must update an existing target.
      markers.update(state, lot.id);
      expect(marker.userData.siteStatus).toBe(status);
      expect(marker.scale.x * pixelsPerScale).toBeCloseTo(owned ? 44 : 34);
      expect(marker.scale.y * pixelsPerScale).toBeCloseTo((owned ? 44 : 34) * 112 / 96);
      expect(hitAt(0)).toBe(lot.id);
      expect(hitAt(20)).toBe(owned ? lot.id : undefined);
      expect(hitAt(25)).toBeUndefined();
      expect(JSON.stringify(state)).toBe(before);
    };
    check('candidate', false);
    const candidateMaterial = marker.material;
    state = applyAction(state, { type: 'openStore', lotId: lot.id, style: 'standard' });
    check('store', true);
    expect(marker.material).not.toBe(candidateMaterial);
    state = applyAction(state, { type: 'buyProperty', lotId: lot.id });
    check('both', true);
    state = applyAction(state, { type: 'closeStore', storeId: state.stores[0].id });
    check('property', true);
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties[0].id });
    check('candidate', false);
    expect(marker.material).toBe(candidateMaterial);
    markers.dispose();
    expect(markers.pickables).toHaveLength(0);
  });
});
