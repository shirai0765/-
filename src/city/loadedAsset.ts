import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeScene } from './art';

export type AssetLoad = (url: string, signal: AbortSignal) => Promise<THREE.Group>;
export interface LoadedAssetHandle {
  readonly group: THREE.Group;
  setActive(active: boolean): void;
  release(): void;
}
interface Entry { promise: Promise<void>; template?: THREE.Group; error?: string }
interface Instance { url: string; handle: LoadedAssetHandle; fallback?: THREE.Group; clone?: THREE.Group; active: boolean }
// Symbol.for survives Vite HMR module generations and independent debug imports.
// Keep the hook outside userData so GLB exports do not serialize runtime objects.
const readyKey = Symbol.for('shibuya.city.loadedAssetsReady');
type AssetOwner = THREE.Object3D & { [readyKey]?: () => Promise<void> };
export const AUTHORED_ASSETS = {
  departmentStore: './models/authored/108-polished.glb',
  cafe: './models/authored/cafe-polished.glb',
};

async function loadGLB(url: string, signal: AbortSignal): Promise<THREE.Group> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
  gltf.scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.castShadow = !materials.some(material => material.transparent);
      object.receiveShadow = true;
    }
  });
  return gltf.scene;
}

/** One scene owns every loaded template. Clones borrow its immutable GPU resources. */
export class LoadedAssetPool {
  private entries = new Map<string, Entry>();
  private instances = new Set<Instance>();
  private controller = new AbortController();
  private closed = false;
  constructor(private owner: THREE.Object3D, private load: AssetLoad = loadGLB) {
    (owner as AssetOwner)[readyKey] = () => this.ready();
  }

  /** The fallback must own its resources exclusively. Its transform moves to the stable slot. */
  mount(url: string, fallback: THREE.Group, active = true): LoadedAssetHandle {
    if (this.closed) throw new Error('Cannot mount an asset into a disposed pool');
    const group = new THREE.Group(); group.name = `${fallback.name}_asset_slot`;
    group.position.copy(fallback.position); group.quaternion.copy(fallback.quaternion); group.scale.copy(fallback.scale);
    group.userData = { ...fallback.userData, authoredAssetURL: url, assetStatus: 'fallback' };
    fallback.position.set(0, 0, 0); fallback.quaternion.identity(); fallback.scale.set(1, 1, 1); group.add(fallback);
    const handle: LoadedAssetHandle = {
      group,
      setActive: value => this.activate(instance, value),
      release: () => this.release(handle),
    };
    const instance: Instance = { url, handle, fallback, active: false };
    this.instances.add(instance); this.activate(instance, active); return handle;
  }

  private activate(instance: Instance, active: boolean): void {
    if (this.closed || !this.instances.has(instance)) return;
    instance.active = active; instance.handle.group.visible = active;
    if (!active || instance.clone) return;
    let entry = this.entries.get(instance.url);
    if (!entry) {
      entry = { promise: Promise.resolve() }; this.entries.set(instance.url, entry);
      const current = entry;
      current.promise = Promise.resolve().then(() => {
        if (this.closed) return undefined;
        return this.load(instance.url, this.controller.signal);
      }).then(template => {
        if (!template) return;
        // GLTF parsing cannot be aborted mid-parse: a late result is never attached.
        if (this.closed) { disposeScene(template); return; }
        current.template = template;
        for (const candidate of this.instances) if (candidate.url === instance.url && candidate.active) this.attach(candidate, template);
      }).catch(error => {
        if (this.closed) return;
        current.error = error instanceof Error ? error.message : String(error);
        for (const candidate of this.instances) if (candidate.url === instance.url) {
          candidate.handle.group.userData.assetStatus = 'fallback';
          candidate.handle.group.userData.assetLoadError = current.error;
        }
        // A failed local asset retains the procedural model; no repetitive alerts or retries.
      });
    }
    if (entry.template) this.attach(instance, entry.template);
    else if (!entry.error) instance.handle.group.userData.assetStatus = 'loading';
    else instance.handle.group.userData.assetLoadError = entry.error;
  }

  private attach(instance: Instance, template: THREE.Group): void {
    if (this.closed || !instance.active || !this.instances.has(instance) || instance.clone) return;
    const clone = template.clone(true); clone.name = `${instance.url.split('/').pop()}_instance`;
    instance.clone = clone;
    if (instance.fallback) {
      instance.fallback.removeFromParent(); disposeScene(instance.fallback); instance.fallback = undefined;
    }
    instance.handle.group.add(clone); instance.handle.group.userData.assetStatus = 'loaded';
  }

  /** Call BEFORE a caller disposes an individual slot or parent containing borrowed clones. */
  release(handle: LoadedAssetHandle): void {
    const instance = [...this.instances].find(candidate => candidate.handle === handle);
    if (!instance) return;
    this.instances.delete(instance); instance.active = false;
    instance.clone?.removeFromParent(); instance.clone = undefined; // Shared resources stay with the template.
    if (instance.fallback) { instance.fallback.removeFromParent(); disposeScene(instance.fallback); instance.fallback = undefined; }
    handle.group.removeFromParent(); handle.group.userData.assetStatus = 'released';
  }

  /** Includes any requests started while an earlier request was completing. Failure is settled. */
  async ready(): Promise<void> {
    let count = -1;
    while (!this.closed && count !== this.entries.size) {
      count = this.entries.size; await Promise.all([...this.entries.values()].map(entry => entry.promise));
    }
  }

  /** Must run BEFORE disposeScene(owner), including when changing rendering quality. */
  dispose(): void {
    if (this.closed) return;
    this.closed = true; this.controller.abort();
    for (const instance of [...this.instances]) this.release(instance.handle);
    // All template resources are deduplicated together; never dispose each borrowed clone.
    const resources = new THREE.Group();
    for (const entry of this.entries.values()) if (entry.template) resources.add(entry.template);
    disposeScene(resources); resources.clear(); this.entries.clear(); delete (this.owner as AssetOwner)[readyKey];
  }
}

export async function waitForLoadedAssets(scene: THREE.Object3D): Promise<void> {
  await (scene as AssetOwner)[readyKey]?.();
  if(typeof document!=='undefined')await document.fonts?.ready;
}
