import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { clonePhotoModelForExport, DEFAULT_PHOTO_GAIN, disposePhotoExportMaterials, photoGain, setPhotoBrightness, usePhotoAppearance } from '../src/realcity/photoAppearance';
import { disposeRealObject, texturePixels } from '../src/realcity/textureBudget';

describe('real-city photographic appearance', () => {
  it('transfers shared photo materials without replacing pixels, samplers, geometry or UVs', () => {
    const image = { width: 1024, height: 512, close: vi.fn() };
    const map = new THREE.Texture(image as unknown as TexImageSource);
    map.colorSpace = THREE.SRGBColorSpace; map.flipY = false;
    const source = new THREE.MeshStandardMaterial({ map, color: new THREE.Color(.5, .4, .3), side: THREE.DoubleSide, alphaTest: .2 });
    const oldDispose = vi.spyOn(source, 'dispose'), mapDispose = vi.spyOn(map, 'dispose');
    const geometry = new THREE.BoxGeometry(), root = new THREE.Group();
    const a = new THREE.Mesh(geometry, source), b = new THREE.Mesh(geometry, [source, source]);
    root.add(a, b);
    const positions = geometry.attributes.position, uv = geometry.attributes.uv;
    usePhotoAppearance(root);
    const material = a.material as unknown as THREE.MeshBasicMaterial;
    expect(material.isMeshBasicMaterial).toBe(true);
    expect(b.material).toEqual([material, material]);
    expect(material.map).toBe(map); expect(map.image).toBe(image);
    expect(map.colorSpace).toBe(THREE.SRGBColorSpace); expect(map.flipY).toBe(false);
    expect(a.geometry).toBe(geometry); expect(geometry.attributes.position).toBe(positions); expect(geometry.attributes.uv).toBe(uv);
    expect(material.side).toBe(THREE.DoubleSide); expect(material.alphaTest).toBe(.2); expect(material.toneMapped).toBe(false);
    expect(oldDispose).toHaveBeenCalledTimes(1); expect(mapDispose).not.toHaveBeenCalled(); expect(image.close).not.toHaveBeenCalled();
    expect(texturePixels(root)).toMatchObject({ images: 1, rgbaBaseBytes: 1024 * 512 * 4 });
    const newDispose = vi.spyOn(material, 'dispose');
    disposeRealObject(root); disposeRealObject(root);
    expect(mapDispose).toHaveBeenCalledTimes(1); expect(image.close).toHaveBeenCalledTimes(1); expect(newDispose).toHaveBeenCalledTimes(1);
  });

  it('applies the latest brightness from the original linear color without accumulating changes', () => {
    const color = new THREE.Color(.4, .6, .8), source = new THREE.MeshStandardMaterial({ color });
    const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), source); root.add(mesh);
    usePhotoAppearance(root, 1.15);
    setPhotoBrightness(root, 1.8); setPhotoBrightness(root, 1.15); setPhotoBrightness(root, 1.15);
    expect(mesh.material.color.toArray()).toEqual(color.clone().multiplyScalar(1.15).toArray());
    expect(source.color.toArray()).toEqual(color.toArray());
    setPhotoBrightness(root, 1); expect(mesh.material.color.toArray()).toEqual(color.toArray());
    usePhotoAppearance(root, 1.35); // A repeated setup cannot turn the current gain into a new base.
    expect(mesh.material.color.toArray()).toEqual(color.clone().multiplyScalar(1.35).toArray());
    disposeRealObject(root);
  });

  it('matches the comparison for untextured faces and leaves unrelated basic ground untouched', () => {
    const root = new THREE.Group(), source = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const building = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ color: '#888888', toneMapped: false }));
    const originalGround = ground.material.color.clone(); root.add(building, ground);
    usePhotoAppearance(root, DEFAULT_PHOTO_GAIN); setPhotoBrightness(root, 1.8);
    expect(building.material.type).toBe('MeshBasicMaterial');
    expect(building.material.color.toArray()).toEqual([1.8, 1.8, 1.8]);
    expect(ground.material.color.toArray()).toEqual(originalGround.toArray());
    disposeRealObject(root);
  });

  it('uses the existing finite 1–1.8 brightness range', () => {
    expect(photoGain(.5)).toBe(1); expect(photoGain(4)).toBe(1.8);
    expect(photoGain(1.35)).toBe(1.35); expect(photoGain(NaN)).toBe(DEFAULT_PHOTO_GAIN);
  });

  it('exports independent original-color materials without mutating or disposing live shared resources', () => {
    const map = new THREE.Texture(), color = new THREE.Color(.7, .8, .9);
    const geometry = new THREE.BoxGeometry(), source = new THREE.MeshStandardMaterial({ map, color });
    const root = new THREE.Group(); root.add(new THREE.Mesh(geometry, source), new THREE.Mesh(geometry, source));
    usePhotoAppearance(root, 1.8);
    const live = (root.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const clone = clonePhotoModelForExport(root), exported = (clone.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(exported).not.toBe(live); expect((clone.children[1] as THREE.Mesh).material).toBe(exported);
    expect(exported.color.toArray()).toEqual(color.toArray()); expect(live.color.toArray()).toEqual(color.clone().multiplyScalar(1.8).toArray());
    expect(exported.map).toBe(map); expect((clone.children[0] as THREE.Mesh).geometry).toBe(geometry);
    const mapDispose = vi.spyOn(map, 'dispose'), geometryDispose = vi.spyOn(geometry, 'dispose'), liveDispose = vi.spyOn(live, 'dispose'), exportDispose = vi.spyOn(exported, 'dispose');
    disposePhotoExportMaterials(clone);
    expect(exportDispose).toHaveBeenCalledTimes(1); expect(liveDispose).not.toHaveBeenCalled(); expect(mapDispose).not.toHaveBeenCalled(); expect(geometryDispose).not.toHaveBeenCalled();
    expect(root.children).toHaveLength(2); disposeRealObject(root);
  });
});
