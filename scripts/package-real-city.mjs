/** Bundle only rendered leaf tiles and local decoders into a single offline HTML. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { build } from 'esbuild';
const root=resolve(import.meta.dirname,'..'),publicRoot=resolve(root,'public');
const output=resolve(process.argv[2]??'/workspace/shared/shibuya-artifacts/real-shibuya-viewer.html');
const tileset=JSON.parse(await readFile(resolve(publicRoot,'models/real-shibuya/tileset.json'),'utf8'));
const leaves=[];
function visit(tile){if(tile.children?.length)tile.children.forEach(visit);else if(tile.content){const uri=tile.content.uri??tile.content.url;if(uri)leaves.push(uri);}}
visit(tileset.root);
const paths=['models/real-shibuya/tileset.json','models/real-shibuya/manifest.json',...new Set(leaves.map(uri=>'models/real-shibuya/'+uri)),'decoders/draco/draco_wasm_wrapper.js','decoders/draco/draco_decoder.wasm','decoders/draco/LICENSE.txt','decoders/draco/THREE-LICENSE.txt'];
const groundManifest=JSON.parse(await readFile(resolve(publicRoot,'models/real-shibuya-ground/manifest.json'),'utf8'));
paths.push('models/real-shibuya-ground/manifest.json',...groundManifest.tiles.map(tile=>'models/real-shibuya-ground/'+tile.file));
const assets={};let totalBytes=0;
for(const path of paths){const local=resolve(publicRoot,path);if(relative(publicRoot,local).startsWith('..'))throw new Error('Asset escapes public root');const bytes=await readFile(local);totalBytes+=bytes.length;const ext=path.split('.').pop();assets[path]={mime:({json:'application/json',js:'text/javascript',wasm:'application/wasm',txt:'text/plain',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',b3dm:'application/octet-stream'})[ext]??'application/octet-stream',base64:bytes.toString('base64')};}
const result=await build({absWorkingDir:root,entryPoints:['src/realcity/main.ts'],bundle:true,write:false,outdir:'offline-bundle',format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'inline'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text.replaceAll('</script','<\\/script');
const css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const three=await readFile(resolve(publicRoot,'decoders/draco/THREE-LICENSE.txt'),'utf8'),draco=await readFile(resolve(publicRoot,'decoders/draco/LICENSE.txt'),'utf8');
const html=`<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><link rel="icon" href="data:,"><title>実際の渋谷 — PLATEAU 3D・オフライン</title><style>${css}\n.back{display:none}.offline-license{position:absolute;right:18px;bottom:18px;z-index:5;font-size:10px}.offline-license summary{cursor:pointer;background:#f6f6eeeb;border-radius:6px;padding:8px}.offline-license pre{position:absolute;right:0;bottom:22px;width:min(560px,90vw);max-height:55vh;overflow:auto;background:white;padding:15px;white-space:pre-wrap}</style></head><body><main id="real-city"></main><details class="offline-license"><summary>ライセンス・オフライン版</summary><pre>このHTMLだけで表示できます。外部接続は不要です。\n建物：東京都・国土交通省 Project PLATEAU 建築物モデル（渋谷区）2025年度公開データ。部分抽出・座標変換。出典と取得記録は画面左下に記載。地表：地理院タイル（シームレス空中写真）、平面近似。\n\n${escape(three)}\n\n${escape(draco)}</pre></details><script id="real-city-assets" type="application/json">${JSON.stringify(assets).replaceAll('<','\\u003c')}</script><script>${js}</script></body></html>`;
const htmlBytes=Buffer.byteLength(html);if(htmlBytes>100*1024*1024)throw new Error(`Single-file viewer exceeds100MiB: ${htmlBytes}`);
await mkdir(dirname(output),{recursive:true});await writeFile(output,html);
console.log(JSON.stringify({output,tiles:leaves.length,groundTiles:groundManifest.tiles.length,embeddedFiles:paths.length,assetBytes:totalBytes,htmlBytes,selfContained:true},null,2));
