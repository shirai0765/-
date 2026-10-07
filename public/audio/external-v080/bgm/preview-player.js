
const status=document.querySelector('#status'),slider=document.querySelector('#volume');
const cache=new Map(),manifests=new Map();let context,gain,source,request=0;
function stop(){request++;if(source){source.stop();source.disconnect();source=null}document.querySelectorAll('audio').forEach(a=>{a.pause();a.currentTime=0});status.textContent='停止しました。'}
document.querySelector('#stop').addEventListener('click',stop);
slider.addEventListener('input',()=>{document.querySelector('#volume-value').value=Math.round(+slider.value*100)+'%';if(gain)gain.gain.setTargetAtTime(+slider.value,context.currentTime,.04);document.querySelectorAll('audio').forEach(a=>a.volume=+slider.value)});
document.querySelectorAll('audio').forEach(a=>{a.volume=+slider.value;a.loop=false;a.addEventListener('play',()=>{request++;if(source){source.stop();source.disconnect();source=null}document.querySelectorAll('audio').forEach(other=>{if(other!==a)other.pause()});status.textContent='確認用音源を単発で試聴しています。'})});
document.querySelectorAll('article').forEach(card=>card.querySelector('.play').addEventListener('click',async()=>{
  stop();const token=++request,button=card.querySelector('.play'),id=card.dataset.track,format=card.querySelector('select').value;
  button.disabled=true;status.textContent='音源を読み込んでいます。';
  try{
    context??=new (window.AudioContext||window.webkitAudioContext)({sampleRate:44100});
    if(!gain){gain=context.createGain();gain.gain.value=+slider.value;gain.connect(context.destination)}
    await context.resume();const key=id+'.'+format;let buffer=cache.get(key),manifest=manifests.get(id);
    if(!manifest){const response=await fetch('./'+id+'.manifest.json');if(!response.ok)throw new Error('測定metadataを読み込めません');manifest=await response.json();manifests.set(id,manifest)}
    if(!buffer){const response=await fetch('./'+key);if(!response.ok)throw new Error('音源を読み込めません');buffer=await context.decodeAudioData(await response.arrayBuffer());cache.set(key,buffer)}
    if(token!==request)return;
    const asset=manifest[format];if(!asset)throw new Error('この形式の測定がありません');
    // Prior verified WAV/OGG/MP3 periods remain usable while delivery QA is prepared.
    // AAC has no fallback to raw buffer.duration: require its decoded delivery metadata.
    const measured=asset.deliveryVerification;
    if(format==='m4a'&&!measured)throw new Error('AACの明示境界が未測定です');
    const loopStart=measured?.loopStart??manifest.loopStartSeconds,loopEnd=measured?.loopEnd??manifest.loopEndSeconds;
    if(!Number.isFinite(loopStart)||!Number.isFinite(loopEnd)||loopStart<0||loopEnd<=loopStart||loopEnd>buffer.duration)throw new Error('測定済み境界が再生bufferに収まりません。別の形式を選んでください');
    if(!measured&&Math.abs(buffer.duration-loopEnd)>2/context.sampleRate)throw new Error('旧形式の再生長が一致しません。WAVを選んでください');
    source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;source.connect(gain);source.start(0,loopStart);
    status.textContent=card.querySelector('h2').textContent+' をループで再生しています。';
  }catch(error){if(token===request)status.textContent=error.message+'。ローカルHTTPサーバーから開いてください。'}
  finally{button.disabled=false}
}));
window.addEventListener('pagehide',stop);
