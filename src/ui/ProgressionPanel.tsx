import { ArrowUpRight, Check, Flag, ShieldCheck } from 'lucide-react';
import type { GameState } from '../model';
import { getProgression } from '../sim/progression';
import './progression.css';
const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
export default function ProgressionPanel({ state, onNavigate }: { state: GameState; onNavigate: (tab: string) => void }) {
  const p = getProgression(state);
  const capital = p.capital;
  return <div className="progression-panel">
    <header className="progression-intro"><div><span className="eyebrow">YOUR COMPANY, YOUR NEXT CHAPTER</span><h3>一軒のカフェから、街を育てる会社へ。</h3><p>今の経営状況から、次の一歩を考えましょう。ロードマップは目安です。条件を満たせば、順序を変えて挑戦できます。</p></div><Flag size={30}/></header>
    <section className="progression-advice" aria-label="次の経営判断">{p.recommendations.map(r => <article key={r.title} className={r.urgent ? 'is-urgent' : ''}><span className="eyebrow">{r.urgent ? '週末前に確認' : 'NEXT ACTION'}</span><h3>{r.title}</h3><p>{r.body}</p><button className="secondary" onClick={() => onNavigate(r.tab)}>確認する <ArrowUpRight size={15}/></button></article>)}</section>
    <section className="progression-health" aria-label="経営の余力">
      <article><ShieldCheck size={18}/><span>現在の手元資金 / 借入</span><strong>{yen(state.cash)} / {yen(p.summary.debt)}</strong><p>投資の支払いと借入残高を確認できます。売上・利益は営業後に確定します。</p></article>
      <article><span>{state.lastReport ? `第${state.lastReport.week}週の全社純利益` : '全社純利益の実績'}</span><strong>{state.lastReport ? yen(state.lastReport.netProfit) : '営業実績はまだありません'}</strong><p>直近の決算で確定した結果です。今の設定による次の結果ではありません。</p></article>
      <article><span>{state.lastReport ? `第${state.lastReport.week}週の現金増減` : '決算時の現金増減'}</span><strong>{state.lastReport ? yen(state.lastReport.cashChange) : '営業実績はまだありません'}</strong><p>決算時の返済・配当などを含みます。その後の投資や調達は現在の手元資金に反映されます。</p></article>
    </section>
    {capital && <section className="progression-capital" data-capital-kind={capital.kind}>
      <div><span className="eyebrow">{capital.kind === 'ipo' ? '株式公開の検討' : '任意の投資例'}</span><h3>{capital.title}</h3>
        {capital.kind === 'ipo'
          ? <p>{capital.eligible ? '現在の上場条件を満たしています。' : '未達の条件は下の上場項目で確認できます。'}</p>
          : <p>参考：投資額 {yen(capital.cost)}<br/>現在の手元資金 {yen(state.cash)}。営業の支払いに残す資金も確認しましょう。</p>}
      </div>
      <button type="button" className="secondary" onClick={() => onNavigate(capital.tab)}>{capital.kind === 'ipo' ? '公開条件と資金を確認' : '投資先を比較'} <ArrowUpRight size={16}/></button>
    </section>}
    <div className="section-rule"><h3>成長のロードマップ</h3><span>現在 {p.roadmap.filter(s => s.achieved).length} / {p.roadmap.length} 目標を達成中</span></div>
    <ol className="progression-roadmap">{p.roadmap.map((step, index) => <li key={step.id} data-roadmap-step={step.id} className={step.achieved ? 'is-achieved' : p.next?.id === step.id ? 'is-next' : ''}>
      <div className="progression-marker">{step.achieved ? <Check size={17}/> : String(index + 1).padStart(2, '0')}</div>
      <div className="progression-step"><span className="eyebrow">{step.achieved ? '現在達成中' : step.optionalBeforeIPO ? state.listed ? '物件投資の選択肢' : '上場前は任意' : p.next?.id === step.id ? '次の目標' : 'これからの目標'}</span><h3>{step.title}</h3><p>{step.description}</p>
        {!step.achieved && <ul>{step.requirements.map((req, requirementIndex) => <li key={req.label} data-ipo-requirement={step.id === 'ipo' ? requirementIndex + 1 : undefined} data-met={step.id === 'ipo' ? req.met : undefined}><span className={req.met ? 'positive' : 'muted'}>{req.met ? '✓' : '○'}</span>{req.label}</li>)}</ul>}
        <button type="button" className="text-button" onClick={() => onNavigate(step.tab)}>経営画面へ <ArrowUpRight size={14}/></button>
      </div>
    </li>)}</ol>
    <section className="progression-districts"><h3>街への広がり</h3><p>4地区の店舗分布。同じ地区でも立地によって需要・家賃・競争が異なります。</p><div>{p.districts.map(d => <article key={d.id}><span>{d.name}</span><strong>{d.stores}<small> 店舗</small></strong></article>)}</div></section>
  </div>;
}
