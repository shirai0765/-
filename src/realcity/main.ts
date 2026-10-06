import './realcity.css';
import { assetURL } from './assets';
import { parseTextureQuality } from './textureBudget';
import type { TextureQuality } from './textureBudget';
import { createRealCityScene } from './RealCityScene';
import type { RealCityController, RealCityProgress } from './RealCityScene';

const host=document.querySelector<HTMLElement>('#real-city')!;
host.innerHTML=`<div class="heading"><span>PROJECT PLATEAU / TOKYO</span><h1>実際の渋谷を、3Dで。</h1><p>航空写真等に基づく建物テクスチャ・LOD2 / 2025年度公開データ</p></div><nav aria-label="視点"><a class="back" href="./index.html">ゲームへ戻る</a><button data-view="crossing">交差点周辺</button><button data-view="109">109周辺</button><button data-view="overhead">街区全体</button><label class="brightness">建物の明るさ <input id="brightness" aria-label="建物の明るさ" type="range" min="1" max="1.8" step="0.05" value="1.15"/></label><label class="texture-quality">建物写真の精細さ <select id="texture-quality" aria-label="建物写真の精細さ" aria-describedby="texture-help"><option value="1024">軽量・1024</option><option value="2048">高精細・2048</option><option value="original">原寸</option></select></label><small id="texture-help"></small></nav><div class="loading-panel"><div id="loading" role="status">実際の建物データを読み込み中…</div><button id="retry" hidden>再読み込み</button></div><footer>出典：東京都・国土交通省 Project PLATEAU「建築物モデル（渋谷区）」2025 / 実測データを部分抽出・座標変換<br>地表：地理院タイル（シームレス空中写真）。平面近似のため高低差は未再現。写真の撮影時期は場所により異なります。ドラッグで回転・ホイールで拡大。<br><a href="https://www.mlit.go.jp/plateau/opendata/" target="_blank" rel="noreferrer">公式データ案内</a> · <a href="https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto" target="_blank" rel="noreferrer">地理院タイル</a> · <a href="./models/real-shibuya/manifest.json" target="_blank">取得記録</a></footer>`;
const manifestLink=host.querySelector<HTMLAnchorElement>('a[href="./models/real-shibuya/manifest.json"]');if(manifestLink)manifestLink.href=assetURL('./models/real-shibuya/manifest.json');
const status=document.querySelector<HTMLElement>('#loading')!;
const qualitySelect=document.querySelector<HTMLSelectElement>('#texture-quality')!;
const retry=document.querySelector<HTMLButtonElement>('#retry')!;
let quality:TextureQuality=parseTextureQuality(new URL(location.href).searchParams.get('texture'));
qualitySelect.value=quality;
function describeQuality(){document.querySelector<HTMLElement>('#texture-help')!.textContent=quality==='original'?'原寸は建物画像だけで約1GiBを使用（ミップマップ等は別）。読み込みには時間がかかります。':`建物の形・範囲は同じです。写真を縮小してメモリを抑えます（建物画像 約${quality==='1024'?'76':'304'}MiB、ミップマップ等は別）。`;}
describeQuality();

const debug=window as unknown as Record<string,unknown>;
let controller:RealCityController|undefined,closed=false;
function onProgress(progress:RealCityProgress){
  debug.__realCityProgress=progress;retry.hidden=progress.status!=='failed';status.classList.toggle('loaded',progress.status==='ready');
  if(progress.status==='ready'){debug.__realCity=controller?.getSnapshot();status.textContent=`実測の建物データを表示中 · ${progress.buildingTiles} タイル`;}
  else {delete debug.__realCity;if(progress.status==='loading')status.textContent=progress.buildingTiles<20?`実際の建物データ ${progress.buildingTiles} / 20`:`実際の街路写真 ${progress.groundTiles} / 72`;}
}
function start(){
  try{controller=createRealCityScene(host,{textureQuality:quality,cameraMode:'explore',onProgress,onError:error=>{status.textContent=`読み込みに失敗しました：${error.message}`;retry.hidden=false;}});}
  catch(error){status.textContent=`3D表示を開始できませんでした：${error instanceof Error?error.message:String(error)}`;retry.hidden=false;}
}
qualitySelect.onchange=()=>{quality=parseTextureQuality(qualitySelect.value);describeQuality();const url=new URL(location.href);url.searchParams.set('texture',quality);history.replaceState(null,'',url);controller?.setQuality(quality);};
retry.onclick=()=>controller?controller.setQuality(quality):start();
document.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach(button=>button.onclick=()=>controller?.setPreset(button.dataset.view as 'crossing'|'109'|'overhead'));
document.querySelector<HTMLInputElement>('#brightness')!.oninput=event=>controller?.setExposure(Number((event.target as HTMLInputElement).value));
const observer=new ResizeObserver(()=>controller?.resize());observer.observe(host);
addEventListener('pagehide',()=>{closed=true;observer.disconnect();delete debug.__realCity;debug.__realCityProgress={...(debug.__realCityProgress as object),status:'disposed'};void controller?.dispose();});
addEventListener('pageshow',event=>{if(event.persisted&&closed)location.reload();});
start();
