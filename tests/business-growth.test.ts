import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GameState } from '../src/model';
import { getBusinessGrowth, getHeadquartersRoof, MAX_HEADQUARTERS_EXTRA_HEIGHT } from '../src/city/businessGrowth';
import { CityGrowth } from '../src/city/growth';
import { CityArt, disposeScene } from '../src/city/art';
import { LOTS, ACQUISITION_TARGETS } from '../src/data/district';
import { STOCKS } from '../src/data/stocks';
import { applyAction, createGame } from '../src/sim/engine';
import { getMarketAcquisitionTargets, getMarketGroupFinancials } from '../src/sim/marketAcquisitions';

function fixture() {
  return applyAction({ ...createGame('本部の成長', 919), cash: 50_000_000_000, reputation: 95 }, { type: 'openStore', lotId: 'center-01', style: 'standard' });
}
function acquired() {
  let state = fixture();
  const stockId = getMarketAcquisitionTargets(state).find(target => !target.requiresListing)!.stockId;
  state = applyAction(state, { type: 'researchMarketCompany', stockId });
  return applyAction(state, { type: 'acquireMarketCompany', stockId, mode: 'autonomous' });
}
// Explicit large-group rendering fixture; not a campaign reachability claim.
function fullGroup(state = fixture()): GameState {
  return { ...state, marketAcquisitions: { research: [], companies: STOCKS.map(stock => ({ stockId: stock.id, mode: 'autonomous' as const, acquiredWeek: 1, readyWeek: 1 })) } };
}

describe('business growth presentation', () => {
  it('matches the account readiness boundary for autonomous and integrated acquisitions before IPO', () => {
    let researched = fixture();
    const stockId = getMarketAcquisitionTargets(researched).find(target => !target.requiresListing)!.stockId;
    researched = applyAction(researched, { type: 'researchMarketCompany', stockId });
    const autonomous = applyAction(researched, { type: 'acquireMarketCompany', stockId, mode: 'autonomous' });
    const integrated = applyAction(researched, { type: 'acquireMarketCompany', stockId, mode: 'integrated' });
    expect(autonomous.marketAcquisitions!.companies[0].readyWeek).toBeLessThan(integrated.marketAcquisitions!.companies[0].readyWeek);
    for (const state of [autonomous, integrated]) {
      const readyWeek = state.marketAcquisitions!.companies[0].readyWeek;
      for (const week of [readyWeek - 1, readyWeek, readyWeek + 1]) {
        const atWeek = { ...state, week }, before = JSON.stringify(atWeek);
        const growth = getBusinessGrowth(atWeek, LOTS), accounts = getMarketGroupFinancials(atWeek);
        expect(growth.visible).toBe(true); expect(atWeek.listed).toBe(false);
        expect(growth.marketOperating).toBe(accounts.operating); expect(growth.integrating).toBe(accounts.integrating);
        expect(growth.activeBays).toBe(week < readyWeek ? 0 : 1);
        expect(JSON.stringify(atWeek)).toBe(before);
      }
    }
  });

  it('keeps property-first anchoring, skips invalid lots and hides if all owned sites disappear', () => {
    let state = acquired();
    expect(getBusinessGrowth(state, LOTS).headquartersLotId).toBe('center-01');
    state = applyAction(state, { type: 'buyProperty', lotId: 'dogenzaka-01' });
    expect(getBusinessGrowth(state, LOTS).headquartersLotId).toBe('dogenzaka-01');
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties[0].id });
    expect(getBusinessGrowth(state, LOTS).headquartersLotId).toBe('center-01');
    state = applyAction(state, { type: 'closeStore', storeId: state.stores[0].id });
    expect(getBusinessGrowth(state, LOTS)).toMatchObject({ headquartersLotId: null, visible: false, integrating: 1 });
    const invalid = { ...state, properties: [{ id: 'bad', lotId: LOTS.find(lot => !lot.available)!.id, purchasePrice: 1, level: 1, occupancy: 1, weeklyIncome: 0 }] };
    expect(getBusinessGrowth(invalid, LOTS).visible).toBe(false);
    expect(getBusinessGrowth(fixture(), LOTS).visible).toBe(false);
    expect(getBusinessGrowth({ ...fixture(), listed: true }, LOTS).visible).toBe(true);
  });

  it('counts REIT assets as business units and caps administration at six bays for all 108 acquisitions', () => {
    const state = fullGroup();
    const before = JSON.stringify(state);
    expect(getBusinessGrowth(state, LOTS)).toMatchObject({ operating: 100, marketOperating: 100, subsidiaryOperating: 0, integrating: 0, activeBays: 6 });
    const subsidiaries = ACQUISITION_TARGETS.map(target => ({ id: target.id, name: target.name, sector: target.sector, purchasePrice: target.price, weeklyProfit: target.weeklyProfit, risk: target.risk }));
    expect(getBusinessGrowth({ ...state, subsidiaries }, LOTS)).toMatchObject({ operating: 108, activeBays: 6, label: 'グループ本部 · 稼働事業 108 / 引継ぎ 0' });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('clears the authored equipment and every property roof while staying within the reserved envelope', () => {
    for (const [index, lot] of LOTS.entries()) {
      if (!lot.available) continue;
      for (const level of [1, 2, 3, 4, 5]) {
        const roof = getHeadquartersRoof(lot, index, level);
        expect(roof.platformY).toBeGreaterThan(roof.equipmentTop);
        expect(roof.platformY).toBeGreaterThan(roof.roofSurfaceY);
        expect(roof.platformY - roof.supportHeight).toBeCloseTo(roof.roofSurfaceY);
        expect(roof.platformY + 4.1).toBeLessThan(lot.height + MAX_HEADQUARTERS_EXTRA_HEIGHT);
        if (level >= 2) {
          expect(roof.roofSurfaceY).toBeCloseTo(lot.height + 4.81 + (level - 2) * 3.1);
          expect(roof.supportXFraction * lot.width + .07).toBeLessThan(lot.width * .37);
          expect(lot.depth * .31 + .07).toBeLessThan(lot.depth * .34);
        }
      }
    }
  });
});

let fillText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  // CPU object/resource checks only; this stub cannot establish rendered appearance.
  fillText = vi.fn();
  const context = { fillText, ...Object.fromEntries(['fillRect', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'arc', 'stroke'].map(name => [name, () => {}])) };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
});
afterEach(() => vi.unstubAllGlobals());

function runtime() {
  const art = new CityArt(), growth = new CityGrowth(art, [], LOTS);
  const pavilion = art.group.getObjectByName('Group_operations_pavilion') as THREE.Group;
  const bays = pavilion.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
  return { art, growth, pavilion, bays };
}
function sceneResources(group: THREE.Object3D) {
  const nodes: THREE.Object3D[] = [], geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
  group.traverse(object => {
    nodes.push(object);
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
  });
  return { nodes, geometries, textures };
}

describe('headquarters pavilion resource lifetime', () => {
  it('changes a preparation frame into occupied bays without new nodes, geometry, textures or state writes', () => {
    const { art, growth, pavilion, bays } = runtime();
    const pending = acquired(), pendingJSON = JSON.stringify(pending);
    growth.update(pending);
    expect(pavilion.visible).toBe(true); expect(bays.every(mesh => mesh.count === 0)).toBe(true);
    const preparation = pavilion.getObjectByName('Headquarters_integration_frame')!;
    expect(preparation.visible).toBe(true);
    const frameMeshes = preparation.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
    const posts = frameMeshes.find(mesh => mesh.material.color.getHexString() === 'a87943')!;
    const header = frameMeshes.find(mesh => mesh.material.color.getHexString() === 'e9c276')!;
    posts.geometry.computeBoundingBox(); header.geometry.computeBoundingBox();
    expect(posts.geometry.boundingBox!.max.y).toBeGreaterThanOrEqual(header.geometry.boundingBox!.min.y);
    const resources = sceneResources(art.group), matrices = bays.map(mesh => Array.from(mesh.instanceMatrix.array));
    const ready = { ...pending, week: pending.marketAcquisitions!.companies[0].readyWeek };
    growth.update(ready);
    expect(preparation.visible).toBe(false); expect(bays.every(mesh => mesh.count === 1)).toBe(true);
    const full = fullGroup(ready), fullJSON = JSON.stringify(full);
    growth.update(full);
    expect(bays).toHaveLength(5); expect(bays.every(mesh => mesh.count === 6 && mesh.instanceMatrix.count === 6)).toBe(true);
    expect(pavilion.userData.label).toBe('グループ本部 · 稼働事業 100 / 引継ぎ 0');
    expect(sceneResources(art.group)).toEqual(resources); expect(bays.map(mesh => Array.from(mesh.instanceMatrix.array))).toEqual(matrices);
    const sign = art.group.getObjectByName('Group headquarters center-01')!.children.find(child => child.userData.displayedText) as THREE.Mesh;
    const texture = (sign.material as THREE.MeshStandardMaterial).map!;
    const version = texture.version;
    growth.update({ ...full, week: full.week + 1 });
    expect(texture.version).toBe(version);
    expect(JSON.stringify(pending)).toBe(pendingJSON); expect(JSON.stringify(full)).toBe(fullJSON);
    disposeScene(art.group);
  });

  it('reuses the same pavilion through relocation, level changes and removal, then disposes every attached texture', () => {
    const { art, growth, pavilion, bays } = runtime();
    let state = fullGroup();
    growth.update(state);
    const geometries = bays.map(mesh => mesh.geometry);
    state = applyAction(state, { type: 'buyProperty', lotId: 'dogenzaka-01' });
    growth.update(state);
    expect(pavilion.parent?.name).toBe('Group headquarters dogenzaka-01');
    const headquarters = pavilion.parent!;
    const lowY = headquarters.position.y;
    for (let level = 2; level <= 5; level++) state = applyAction(state, { type: 'upgradeProperty', propertyId: state.properties[0].id });
    growth.update(state);
    expect(headquarters.position.y).toBeGreaterThan(lowY);
    expect(headquarters.position.y).toBeCloseTo(LOTS.find(lot => lot.id === 'dogenzaka-01')!.height + 14.23);
    expect(bays.map(mesh => mesh.geometry)).toEqual(geometries);
    state = applyAction(state, { type: 'sellProperty', propertyId: state.properties[0].id });
    growth.update(state);
    expect(pavilion.parent?.name).toBe('Group headquarters center-01');
    state = applyAction(state, { type: 'closeStore', storeId: state.stores[0].id });
    growth.update(state);
    expect(pavilion.visible).toBe(false);
    const resources = sceneResources(art.group), disposeCounts = new Map<THREE.Texture, number>();
    for (const texture of resources.textures) texture.addEventListener('dispose', () => disposeCounts.set(texture, (disposeCounts.get(texture) ?? 0) + 1));
    disposeScene(art.group);
    expect(resources.textures.size).toBeGreaterThan(0);
    expect([...resources.textures].every(texture => disposeCounts.get(texture) === 1)).toBe(true);
  });

  it('draws long company names as bounded text and retains exact counts without interpreting markup', () => {
    const { art, growth } = runtime();
    const state = fullGroup({ ...fixture(), companyName: '成長する珈琲と暮らしの会社<script>街</script>株式会社' });
    growth.update(state);
    const headquarters = art.group.getObjectByName('Group headquarters center-01')!;
    const sign = headquarters.children.find(child => child.userData.displayedText === state.companyName) as THREE.Mesh;
    expect(sign.userData.accessibleLabel).toBe(`${state.companyName} · グループ本部 · 稼働事業 100 / 引継ぎ 0`);
    expect(fillText.mock.calls.some(call => call[0] === state.companyName && call[3] === 956)).toBe(true);
    expect(fillText.mock.calls.some(call => call[0] === 'グループ本部 · 稼働事業 100 / 引継ぎ 0' && call[3] === 942)).toBe(true);
    disposeScene(art.group);
  });
});
