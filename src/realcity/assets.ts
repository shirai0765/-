/** Ordinary URLs in Vite; lazy blob URLs in the single-file offline package. */
interface EmbeddedAsset { mime: string; base64: string }
let embedded: Record<string, EmbeddedAsset> | undefined;
const urls = new Map<string, string>();
function registry(): Record<string, EmbeddedAsset> | undefined {
  if (embedded) return embedded;
  const element = document.getElementById('real-city-assets');
  if (!element) return undefined;
  embedded = JSON.parse(element.textContent || '{}') as Record<string, EmbeddedAsset>;
  element.textContent = '';
  return embedded;
}
export function assetURL(path: string): string {
  const assets = registry(); if (!assets) return path;
  // LoadingManager may receive relative or document-resolved absolute decoder URLs.
  const key = new URL(path, document.baseURI).pathname.replace(/^\//, '');
  const normalized = path.replace(/^\.\//, '').replace(/^\//, '');
  const match = assets[normalized] ? normalized : Object.keys(assets).find(k => key === k || key.endsWith('/' + k));
  if (!match) return path;
  const previous = urls.get(match); if (previous) return previous;
  const asset = assets[match], raw = atob(asset.base64), data = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([data], { type: asset.mime }));
  urls.set(match, url); asset.base64 = ''; return url;
}
export function isEmbeddedViewer(): boolean { return !!document.getElementById('real-city-assets'); }
addEventListener('pagehide', event => { if (!event.persisted) { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); } });
