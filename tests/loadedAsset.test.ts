import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { LoadedAssetPool, waitForLoadedAssets } from '../src/city/loadedAsset';
import { disposeScene } from '../src/city/art';

function asset() {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  group.add(new THREE.Mesh(geometry, material));
  return { group, geometry, material, texture, disposed: [vi.spyOn(geometry, 'dispose'), vi.spyOn(material, 'dispose'), vi.spyOn(texture, 'dispose')] };
}
function deferred() {
  let resolve!: (group: THREE.Group) => void;
  const promise = new Promise<THREE.Group>(done => { resolve = done; });
  return { promise, resolve };
}

describe('scene-owned Blender asset lifecycle', () => {
  it('shares one load across café clones and releases one without disposing resources borrowed by another', async () => {
    const scene = new THREE.Scene(), loaded = asset(), fallbackA = asset(), fallbackB = asset();
    const load = vi.fn(async () => loaded.group), pool = new LoadedAssetPool(scene, load);
    const a = pool.mount('cafe.glb', fallbackA.group), b = pool.mount('cafe.glb', fallbackB.group);
    scene.add(a.group, b.group); await waitForLoadedAssets(scene);
    expect(load).toHaveBeenCalledTimes(1); expect(a.group.userData.assetStatus).toBe('loaded');
    fallbackA.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
    fallbackB.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
    pool.release(a); disposeScene(a.group);
    loaded.disposed.forEach(dispose => expect(dispose).not.toHaveBeenCalled());
    expect(b.group.children).toHaveLength(1);
    pool.dispose(); disposeScene(scene); pool.dispose();
    loaded.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it('does not attach a pending response to a closed or restyled shop, and can reopen from cache', async () => {
    const pending = deferred(), scene = new THREE.Scene(), loaded = asset(), fallback = asset();
    const pool = new LoadedAssetPool(scene, () => pending.promise), handle = pool.mount('cafe.glb', fallback.group);
    scene.add(handle.group); await Promise.resolve(); handle.setActive(false);
    pending.resolve(loaded.group); await pool.ready();
    expect(handle.group.children[0]).toBe(fallback.group); expect(handle.group.visible).toBe(false);
    handle.setActive(true); expect(handle.group.userData.assetStatus).toBe('loaded');
    expect(handle.group.children[0]).not.toBe(fallback.group);
    pool.dispose(); disposeScene(scene);
  });

  it('individual release invalidates callbacks and never revives a removed slot', async () => {
    const pending = deferred(), scene = new THREE.Scene(), loaded = asset(), fallback = asset();
    const pool = new LoadedAssetPool(scene, () => pending.promise), handle = pool.mount('cafe.glb', fallback.group);
    scene.add(handle.group); await Promise.resolve(); handle.release();
    pending.resolve(loaded.group); await pool.ready(); handle.setActive(true);
    expect(handle.group.parent).toBeNull(); expect(handle.group.children).toHaveLength(0);
    expect(handle.group.userData.assetStatus).toBe('released');
    pool.dispose(); disposeScene(scene);
    loaded.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
    fallback.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it('aborts fetch and disposes a response arriving after a quality-switch scene teardown', async () => {
    const pending = deferred(), scene = new THREE.Scene(), loaded = asset(), fallback = asset();
    let signal!: AbortSignal;
    const pool = new LoadedAssetPool(scene, (_url, currentSignal) => { signal = currentSignal; return pending.promise; });
    const handle = pool.mount('108.glb', fallback.group); scene.add(handle.group); await Promise.resolve();
    const ready = pool.ready(); const disposed = pool.dispose(); disposeScene(scene); expect(signal.aborted).toBe(true);
    let released = false; void disposed.then(() => { released = true; });
    await Promise.resolve(); expect(released).toBe(false); expect(pool.dispose()).toBe(disposed);
    pending.resolve(loaded.group); await ready; await disposed; expect(released).toBe(true);
    expect(handle.group.children).toHaveLength(0);
    loaded.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
    fallback.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it('keeps fallback after failure, settles export readiness, and never retries on weekly activation', async () => {
    const scene = new THREE.Scene(), fallback = asset(), load = vi.fn(async () => { throw new Error('unavailable'); });
    const pool = new LoadedAssetPool(scene, load), handle = pool.mount('cafe.glb', fallback.group);
    scene.add(handle.group); await waitForLoadedAssets(scene);
    handle.setActive(false); handle.setActive(true); await pool.ready();
    expect(load).toHaveBeenCalledTimes(1); expect(handle.group.userData.assetStatus).toBe('fallback');
    expect(handle.group.children[0]).toBe(fallback.group); expect(handle.group.userData.assetLoadError).toBe('unavailable');
    pool.dispose(); disposeScene(scene); fallback.disposed.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it('export/debug readiness survives a separately imported module generation', async () => {
    const pending = deferred(), scene = new THREE.Scene(), loaded = asset();
    const pool = new LoadedAssetPool(scene, () => pending.promise);
    const handle = pool.mount('108.glb', asset().group); scene.add(handle.group);
    vi.resetModules();
    const freshModule = await import('../src/city/loadedAsset');
    let finished = false;
    const ready = freshModule.waitForLoadedAssets(scene).then(() => { finished = true; });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(finished).toBe(false);
    pending.resolve(loaded.group); await ready;
    expect(handle.group.userData.assetStatus).toBe('loaded'); pool.dispose(); disposeScene(scene);
  });

  it('closes a shared decoded ImageBitmap once at final disposal, never on individual clone release', async () => {
    class DecodedBitmap { close = vi.fn(); }
    vi.stubGlobal('ImageBitmap', DecodedBitmap);
    try {
      const scene = new THREE.Scene(), loaded = asset(), bitmap = new DecodedBitmap();
      loaded.texture.source = new THREE.Source(bitmap);
      const roughness = new THREE.Texture(); roughness.source = new THREE.Source(bitmap);
      loaded.material.roughnessMap = roughness;
      const pool = new LoadedAssetPool(scene, async () => loaded.group);
      const a = pool.mount('cafe.glb', asset().group), b = pool.mount('cafe.glb', asset().group);
      scene.add(a.group, b.group); await pool.ready();
      a.release(); disposeScene(a.group); expect(bitmap.close).not.toHaveBeenCalled();
      pool.dispose(); disposeScene(scene); expect(bitmap.close).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it('loads only active premium stores and preserves placement without scaling fallback twice', async () => {
    const scene = new THREE.Scene(), loaded = asset(), fallback = asset();
    fallback.group.position.set(0, 0, 8.35); fallback.group.scale.x = 1.5;
    const load = vi.fn(async () => loaded.group), pool = new LoadedAssetPool(scene, load);
    const handle = pool.mount('cafe.glb', fallback.group, false); scene.add(handle.group);
    await pool.ready(); expect(load).not.toHaveBeenCalled();
    expect(handle.group.position.z).toBe(8.35); expect(handle.group.scale.x).toBe(1.5); expect(fallback.group.scale.x).toBe(1);
    handle.setActive(true); await pool.ready(); expect(load).toHaveBeenCalledTimes(1);
    expect(handle.group.scale.x).toBe(1.5); pool.dispose(); disposeScene(scene);
  });
});
