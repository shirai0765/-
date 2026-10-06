import * as THREE from 'three';

export type TextureQuality = '1024' | '2048' | 'original';
export function parseTextureQuality(value: string | null): TextureQuality {
  return value === '2048' || value === 'original' ? value : '1024';
}
export function limitedImageSize(width: number, height: number, quality: TextureQuality): [number, number] {
  const ratio = quality === 'original' ? 1 : Math.min(1, Number(quality) / Math.max(width, height));
  return [Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio))];
}
export function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Loading cancelled', 'AbortError');
}
const closedImages = new WeakSet<object>();
/** Texture.dispose does not release ImageBitmap's decoded CPU pixels. */
export function closeImage(image: unknown) {
  if (image && typeof image === 'object' && 'close' in image && typeof image.close === 'function' && !closedImages.has(image)) {
    closedImages.add(image); image.close();
  }
}
export function objectTextures(root: THREE.Object3D): Set<THREE.Texture> {
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Sprite)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  return textures;
}
export function texturePixels(root: THREE.Object3D) {
  const images = new Set<{ width: number; height: number }>();
  for (const texture of objectTextures(root)) if (texture.image?.width && texture.image?.height) images.add(texture.image);
  return { images: images.size, rgbaBaseBytes: [...images].reduce((sum, image) => sum + image.width * image.height * 4, 0), dimensions: [...images].map(image => [image.width, image.height]) };
}
export type ResizeImage = (image: CanvasImageSource, width: number, height: number) => Promise<CanvasImageSource>;
const resizeImage: ResizeImage = async (image, width, height) => {
  if (typeof createImageBitmap === 'function') {
    try {
      const resized = await createImageBitmap(image, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      // Some browsers accept the options but ignore resizeWidth/Height.
      if (resized.width === width && resized.height === height) return resized;
      closeImage(resized);
    } catch { /* Canvas fallback also works with HTMLImageElement GLTFLoader paths. */ }
  }
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('画像の縮小に必要な描画機能を利用できません');
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(image, 0, 0, width, height);
  return canvas;
};
/** Call after GLTF parsing, BEFORE adding the model to a rendered scene. */
export async function fitTextureBudget(root: THREE.Object3D, quality: TextureQuality, signal?: AbortSignal, resize: ResizeImage = resizeImage) {
  const byImage = new Map<CanvasImageSource & { width: number; height: number }, THREE.Texture[]>();
  for (const texture of objectTextures(root)) {
    const image = texture.image;
    if (!image?.width || !image?.height) continue;
    const refs = byImage.get(image) ?? []; refs.push(texture); byImage.set(image, refs);
  }
  for (const [image, textures] of byImage) {
    checkAbort(signal);
    const [width, height] = limitedImageSize(image.width, image.height, quality);
    for (const texture of textures) texture.userData.originalDimensions = [image.width, image.height];
    if (width === image.width && height === image.height) continue;
    const resized = await resize(image, width, height);
    if (signal?.aborted) { closeImage(resized); checkAbort(signal); }
    // All references are replaced before closing a shared decoded bitmap.
    for (const texture of textures) { texture.image = resized; texture.needsUpdate = true; }
    closeImage(image);
  }
  checkAbort(signal);
  root.userData.textureQuality = quality;
}
/** Each generation owns its resources; call for detached or partially loaded groups too. */
export function disposeRealObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const textures = objectTextures(root);
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Sprite)) return;
    if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const texture of textures) { texture.dispose(); closeImage(texture.image); texture.source.data = null; }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  root.clear();
}
/** Yield to input/paint between individual files; cancellation never queues another file. */
export async function yieldLoading(signal?: AbortSignal) {
  await new Promise<void>(resolve => setTimeout(resolve, 0)); checkAbort(signal);
}
