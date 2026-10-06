import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { disposeRealObject, fitTextureBudget, limitedImageSize, parseTextureQuality, texturePixels } from '../src/realcity/textureBudget';
import type { ResizeImage } from '../src/realcity/textureBudget';

function fixture(width=4096,height=2048) {
  const image={width,height,close:vi.fn()};
  const texture=new THREE.Texture(image as unknown as TexImageSource);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
  const clone=texture.clone();
  const geometry=new THREE.BoxGeometry(1,2,3), root=new THREE.Group();
  root.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture})),new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:clone})));
  return {root,geometry,texture,clone,image};
}
describe('real-city pre-upload texture budget',()=>{
  it('also releases sprite label textures when marker groups are rebuilt',()=>{
    const image={width:512,height:128,close:vi.fn()},texture=new THREE.Texture(image as unknown as TexImageSource),group=new THREE.Group();
    group.add(new THREE.Sprite(new THREE.SpriteMaterial({map:texture})));
    const release=vi.spyOn(texture,'dispose');disposeRealObject(group);
    expect(release).toHaveBeenCalledTimes(1);expect(image.close).toHaveBeenCalledTimes(1);expect(group.children).toHaveLength(0);
  });

  it('caps the longest side without enlarging images and defaults unknown preferences to1024',()=>{
    expect(limitedImageSize(4096,2048,'1024')).toEqual([1024,512]);
    expect(limitedImageSize(2048,4096,'2048')).toEqual([1024,2048]);
    expect(limitedImageSize(256,256,'1024')).toEqual([256,256]);
    expect(limitedImageSize(4096,2048,'original')).toEqual([4096,2048]);
    expect(parseTextureQuality(null)).toBe('1024');expect(parseTextureQuality('bad')).toBe('1024');expect(parseTextureQuality('original')).toBe('original');
  });
  it('resizes a shared source once, preserves geometry/UV/samplers, then closes the original',async()=>{
    const f=fixture(), replacement={width:1024,height:512,close:vi.fn()};
    const positions=Array.from(f.geometry.attributes.position.array),uvs=Array.from(f.geometry.attributes.uv.array);
    const resize=vi.fn(async()=>replacement) as unknown as ResizeImage;
    await fitTextureBudget(f.root,'1024',undefined,resize);
    expect(resize).toHaveBeenCalledTimes(1);expect(f.texture.image).toBe(replacement);expect(f.clone.image).toBe(replacement);
    expect(f.image.close).toHaveBeenCalledTimes(1);expect(f.texture.colorSpace).toBe(THREE.SRGBColorSpace);expect(f.texture.flipY).toBe(false);
    expect(Array.from(f.geometry.attributes.position.array)).toEqual(positions);expect(Array.from(f.geometry.attributes.uv.array)).toEqual(uvs);
    expect(texturePixels(f.root)).toMatchObject({images:1,rgbaBaseBytes:1024*512*4});
    disposeRealObject(f.root);expect(replacement.close).toHaveBeenCalledTimes(1);expect(f.root.children).toHaveLength(0);
  });
  it('keeps original pixels intact when original quality is requested',async()=>{
    const f=fixture(),resize=vi.fn();await fitTextureBudget(f.root,'original',undefined,resize);
    expect(resize).not.toHaveBeenCalled();expect(f.texture.image).toBe(f.image);expect(f.image.close).not.toHaveBeenCalled();
    expect(texturePixels(f.root).rgbaBaseBytes).toBe(4096*2048*4);disposeRealObject(f.root);
  });
  it('closes a late resized bitmap on cancellation without attaching it',async()=>{
    const f=fixture(),controller=new AbortController(),replacement={width:1024,height:512,close:vi.fn()};
    const resize:ResizeImage=async()=>{controller.abort();return replacement as unknown as CanvasImageSource;};
    await expect(fitTextureBudget(f.root,'1024',controller.signal,resize)).rejects.toMatchObject({name:'AbortError'});
    expect(replacement.close).toHaveBeenCalledTimes(1);expect(f.texture.image).toBe(f.image);
    disposeRealObject(f.root);expect(f.image.close).toHaveBeenCalledTimes(1);
  });
  it('releases shared textures, materials, geometry and bitmap once on repeated disposal',()=>{
    const f=fixture(),geometryDispose=vi.spyOn(f.geometry,'dispose'),textureDispose=vi.spyOn(f.texture,'dispose');
    disposeRealObject(f.root);disposeRealObject(f.root);
    expect(f.image.close).toHaveBeenCalledTimes(1);expect(geometryDispose).toHaveBeenCalledTimes(1);expect(textureDispose).toHaveBeenCalledTimes(1);
  });
});
