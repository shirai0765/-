import './design-panel.css';

export type DesignChoice = 'daylight' | 'metro' | 'night';
export const DESIGNS: {id:DesignChoice; name:string; subtitle:string; description:string; colors:string[]}[] = [
  {id:'daylight',name:'01  City Burst',subtitle:'澄んだ青 × ゴールドの一手',description:'白い情報カード、太い見出し、青とゴールドの操作ボタン。街の広がりと毎週の成果を楽しむ標準デザイン。',colors:['#ffffff','#082348','#1265dc','#ffcd3f']},
  {id:'metro',name:'02  City Burst Slate',subtitle:'落ち着いた青 × くっきりした区切り',description:'少し落ち着いた青い背景と濃い区切り線。ゲームらしい見出しとゴールドの操作ボタンで、経営の判断を支えます。',colors:['#eef3fa','#082348','#8caeca','#ffcd3f']},
  {id:'night',name:'03  City Burst Night',subtitle:'夜の青 × 明るいシアン',description:'深い青の画面に明るい文字。夜の読書にも使える配色で、街の昼景とゴールドの操作ボタンはそのまま楽しめます。',colors:['#0b203b','#edf5ff','#63deff','#ffcd3f']},
];
export default function DesignPanel({value,onChange}:{value:DesignChoice;onChange:(choice:DesignChoice)=>void}) {
  return <section className="design-panel"><p className="muted">選ぶと、ゲーム画面全体がすぐに切り替わります。設定はこの端末に保存されます。</p><div className="design-options">{DESIGNS.map(d=><button key={d.id} className={`design-option design-${d.id} ${value===d.id?'selected':''}`} aria-pressed={value===d.id} onClick={()=>onChange(d.id)}><div className="design-preview"><span className="design-preview-rail"/><span className="design-preview-main"><small>SHIBUYA CAPITAL</small><strong>渋谷の、その先へ。</strong><span>週間利益 <b>¥328,450</b></span><i>次の1週間へ →</i></span></div><span className="design-name">{d.name}<span>{value===d.id?'使用中':'選択する'}</span></span><strong className="design-subtitle">{d.subtitle}</strong><span className="design-description">{d.description}</span><span className="design-swatches">{d.colors.map(c=><i key={c} style={{background:c}}/>)}</span></button>)}</div><div className="design-type"><div><span className="eyebrow">TYPOGRAPHY</span><strong>渋谷から、世界へ。<br/><b>Capital grows here. 0123456789</b></strong></div><p>見出しは Dela Gothic One、決算などの大きな数字は Barlow Condensed。本文は Noto Sans JP と Manrope で読みやすく。すべてのフォントを同梱しています。</p></div></section>;
}
