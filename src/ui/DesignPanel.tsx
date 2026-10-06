import './design-panel.css';

export type DesignChoice = 'daylight' | 'metro' | 'night';
export const DESIGNS: {id:DesignChoice; name:string; subtitle:string; description:string; colors:string[]}[] = [
  {id:'daylight',name:'01  Tokyo Daylight',subtitle:'明るい街 × 端正な経営画面',description:'白い画面、濃紺の文字、青い操作ボタン。街の色と、毎週の数字を主役にした標準デザイン。',colors:['#ffffff','#13203a','#2563eb','#19a66d']},
  {id:'metro',name:'02  Metro Editorial',subtitle:'東京の交通案内を、経営の道具に',description:'白と黒の明快な対比に、案内標識のオレンジ。区切り線と太めの見出しで素早く情報を読み取る。',colors:['#ffffff','#17191d','#e65516','#e7e9ee']},
  {id:'night',name:'03  After Hours',subtitle:'夜の経営室で、次の一手を',description:'濃いチャコールに澄んだシアン。長時間の経営に向けた画面テーマ。街の昼景はそのまま楽しめます。',colors:['#141923','#eef3fa','#4ad9f3','#84e5b1']},
];
export default function DesignPanel({value,onChange}:{value:DesignChoice;onChange:(choice:DesignChoice)=>void}) {
  return <section className="design-panel"><p className="muted">選ぶと、ゲーム画面全体がすぐに切り替わります。設定はこの端末に保存されます。</p><div className="design-options">{DESIGNS.map(d=><button key={d.id} className={`design-option design-${d.id} ${value===d.id?'selected':''}`} aria-pressed={value===d.id} onClick={()=>onChange(d.id)}><div className="design-preview"><span className="design-preview-rail"/><span className="design-preview-main"><small>SHIBUYA CAPITAL</small><strong>渋谷の、その先へ。</strong><span>週間利益 <b>¥328,450</b></span><i>次の1週間へ →</i></span></div><span className="design-name">{d.name}<span>{value===d.id?'使用中':'選択する'}</span></span><strong className="design-subtitle">{d.subtitle}</strong><span className="design-description">{d.description}</span><span className="design-swatches">{d.colors.map(c=><i key={c} style={{background:c}}/>)}</span></button>)}</div><div className="design-type"><div><span className="eyebrow">TYPOGRAPHY</span><strong>渋谷から、世界へ。<br/><b>Capital grows here. 0123456789</b></strong></div><p>日本語は Noto Sans JP、英数字は Manrope。どちらもフォントを同梱し、Windowsとブラウザーで同じ書体を使います。</p></div></section>;
}
