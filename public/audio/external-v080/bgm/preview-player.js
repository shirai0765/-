
const lengths={'cafe-lounge':2016000/44100,'shibuya-citypop':1512000/44100};
const status=document.querySelector('#status'),slider=document.querySelector('#volume');
const cache=new Map();let context,gain,source,request=0;
function stop(){request++;if(source){source.stop();source.disconnect();source=null}document.querySelectorAll('audio').forEach(a=>{a.pause();a.currentTime=0});status.textContent='停止しました。'}
document.querySelector('#stop').addEventListener('click',stop);
slider.addEventListener('input',()=>{document.querySelector('#volume-value').value=Math.round(+slider.value*100)+'%';if(gain)gain.gain.setTargetAtTime(+slider.value,context.currentTime,.04);document.querySelectorAll('audio').forEach(a=>a.volume=+slider.value)});
document.querySelectorAll('audio').forEach(a=>{a.volume=+slider.value;a.addEventListener('play',()=>{request++;if(source){source.stop();source.disconnect();source=null}document.querySelectorAll('audio').forEach(other=>{if(other!==a)other.pause()});status.textContent='接続部分を試聴しています。'})});
document.querySelectorAll('article').forEach(card=>card.querySelector('.play').addEventListener('click',async()=>{
  stop();const token=++request,button=card.querySelector('.play'),id=card.dataset.track,format=card.querySelector('select').value;
  button.disabled=true;status.textContent='音源を読み込んでいます。';
  try{
    context??=new (window.AudioContext||window.webkitAudioContext)({sampleRate:44100});
    if(!gain){gain=context.createGain();gain.gain.value=+slider.value;gain.connect(context.destination)}
    await context.resume();const key=id+'.'+format;let buffer=cache.get(key);
    if(!buffer){const response=await fetch('./'+key);if(!response.ok)throw new Error('音源を読み込めません');buffer=await context.decodeAudioData(await response.arrayBuffer());cache.set(key,buffer)}
    if(token!==request)return;
    if(Math.abs(buffer.duration-lengths[id])>2/context.sampleRate)throw new Error('この形式の再生長が一致しません。WAVを選んでください');
    source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=Math.min(lengths[id],buffer.duration);source.connect(gain);source.start();
    status.textContent=card.querySelector('h2').textContent+' をループで再生しています。';
  }catch(error){if(token===request)status.textContent=error.message+'。ローカルHTTPサーバーから開いてください。'}
  finally{button.disabled=false}
}));
window.addEventListener('pagehide',stop);

