import { ArrowUpRight, Check, Flag, ShieldCheck } from 'lucide-react';
import type { GameState } from '../model';
import { getProgression } from '../sim/progression';
import './progression.css';
const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
export default function ProgressionPanel({ state, onNavigate }: { state: GameState; onNavigate: (tab: string) => void }) {
  const p = getProgression(state);
  return <div className="progression-panel">
    <header className="progression-intro"><div><span className="eyebrow">YOUR COMPANY, YOUR NEXT CHAPTER</span><h3>一軒のカフェから、街を育てる会社へ。</h3><p>今の経営状況から、次の一歩を考えましょう。ロードマップは目安です。条件を満たせば、順序を変えて挑戦できます。</p></div><Flag size={30}/></header>
    <section className="progression-advice" aria-label="次の経営判断">{p.recommendations.map(r => <article key={r.title} className={r.urgent ? 'is-urgent' : ''}><span className="eyebrow">{r.urgent ? '週末前に確認' : 'NEXT ACTION'}</span><h3>{r.title}</h3><p>{r.body}</p><button className="secondary" onClick={() => onNavigate(r.tab)}>確認する <ArrowUpRight size={15}/></button></article>)}</section>
    <section className="progression-health" aria-label="経営の余力">
      <article><ShieldCheck size={18}/><span>運転資金の目安</span><strong>{yen(p.reserve)}</strong><p>予想費用・利息・元本返済の4週分。手元資金との差額 {yen(state.cash - p.reserve)}。投資の必須条件ではありません。</p></article>
      <article><span>現金の持続期間</span><strong>{p.runway === null ? '今週予測では減少なし' : `約 ${p.runway.toFixed(1)} 週`}</strong><p>週次現金増減 {yen(p.forecast.cashChange)} を固定した概算。借入中の赤字倒産条件は別途適用されます。</p></article>
      <article><span>利益の集中 / 借入</span><strong>{(p.concentration * 100).toFixed(0)}% / {yen(p.summary.debt)}</strong><p>黒字店舗の利益に占める最大1店舗の割合。利息は週 {yen(p.forecast.interest)}。赤字店舗・子会社を含む全社構成比ではありません。</p></article>
    </section>
    {p.capital && <section className="progression-capital"><div><span className="eyebrow">NEXT CAPITAL GOAL</span><h3>{p.capital.title}</h3><p>投資額 {yen(p.capital.cost)} ＋ 運転資金目安 {yen(p.reserve)}<br/>目標まであと <strong>{yen(Math.max(0, p.capital.cost + p.reserve - state.cash))}</strong></p></div><button className="secondary" onClick={() => onNavigate(p.capital!.tab)}>投資先を比較 <ArrowUpRight size={16}/></button></section>}
    <div className="section-rule"><h3>成長のロードマップ</h3><span>現在 {p.roadmap.filter(s => s.achieved).length} / {p.roadmap.length} 目標を達成中</span></div>
    <ol className="progression-roadmap">{p.roadmap.map((step, index) => <li key={step.id} className={step.achieved ? 'is-achieved' : p.next?.id === step.id ? 'is-next' : ''}><div className="progression-marker">{step.achieved ? <Check size={17}/> : String(index + 1).padStart(2, '0')}</div><div className="progression-step"><span className="eyebrow">{step.achieved ? '現在達成中' : p.next?.id === step.id ? '次の目標' : 'これからの目標'}</span><h3>{step.title}</h3><p>{step.description}</p>{!step.achieved && <ul>{step.requirements.map(req => <li key={req.label}><span className={req.met ? 'positive' : 'muted'}>{req.met ? '✓' : '○'}</span>{req.label}</li>)}</ul>}<button className="text-button" onClick={() => onNavigate(step.tab)}>経営画面へ <ArrowUpRight size={14}/></button></div></li>)}</ol>
    <section className="progression-districts"><h3>街への広がり</h3><p>4地区の店舗分布。同じ地区でも立地によって需要・家賃・競争が異なります。</p><div>{p.districts.map(d => <article key={d.id}><span>{d.name}</span><strong>{d.stores}<small> 店舗</small></strong></article>)}</div></section>
  </div>;
}
