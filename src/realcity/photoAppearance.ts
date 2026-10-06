import * as THREE from 'three';

export const DEFAULT_PHOTO_GAIN = 1.15;
const originalColors = new WeakMap<THREE.MeshBasicMaterial, THREE.Color>();

export function photoGain(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(1.8, value)) : DEFAULT_PHOTO_GAIN;
}

/** Keep baked photographic shading; transfer texture ownership to the replacement material. */
export function usePhotoAppearance(root: THREE.Object3D, gain = DEFAULT_PHOTO_GAIN) {
  const replacements = new Map<THREE.MeshStandardMaterial, THREE.MeshBasicMaterial>();
  function replace(source: THREE.Material): THREE.Material {
    if (!(source instanceof THREE.MeshStandardMaterial)) return source;
    const cached = replacements.get(source);
    if (cached) return cached;
    const material = new THREE.MeshBasicMaterial({
      name: source.name, map: source.map, color: source.color.clone(),
      alphaMap: source.alphaMap, opacity: source.opacity, transparent: source.transparent,
      alphaTest: source.alphaTest, side: source.side, vertexColors: source.vertexColors,
      depthTest: source.depthTest, depthWrite: source.depthWrite, visible: source.visible,
      polygonOffset: source.polygonOffset, polygonOffsetFactor: source.polygonOffsetFactor,
      polygonOffsetUnits: source.polygonOffsetUnits, toneMapped: false,
    });
    material.userData = { ...source.userData };
    originalColors.set(material, source.color.clone());
    replacements.set(source, material);
    return material;
  }
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
  });
  // Material.dispose releases shader state, not its shared map or decoded image.
  // Those remain owned by root and are released once by disposeRealObject.
  for (const source of replacements.keys()) source.dispose();
  setPhotoBrightness(root, gain);
}

/** Always multiply the retained linear color, never the previous slider result. */
export function setPhotoBrightness(root: THREE.Object3D, gain: number) {
  const value = photoGain(gain);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshBasicMaterial)) continue;
      const original = originalColors.get(material);
      if (original) material.color.copy(original).multiplyScalar(value);
    }
  });
}

/** Export original photo color factors, independently of the current display gain. */
export function clonePhotoModelForExport<T extends THREE.Object3D>(root: T): T {
  const clone = root.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  function copy(source: THREE.Material): THREE.Material {
    const existing = materials.get(source);
    if (existing) return existing;
    const material = source.clone();
    if (source instanceof THREE.MeshBasicMaterial && material instanceof THREE.MeshBasicMaterial) {
      const original = originalColors.get(source);
      if (original) material.color.copy(original);
    }
    materials.set(source, material);
    return material;
  }
  clone.traverse(object => {
    if (object instanceof THREE.Mesh) object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
  });
  return clone;
}

/** Export clones share geometry and textures; only their new material instances are owned. */
export function disposePhotoExportMaterials(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) material.dispose();
  root.clear();
}
