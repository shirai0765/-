import { useState } from 'react';
import { Building2, Check } from 'lucide-react';
import type { DistrictId, GameAction, GameState } from '../model';
import { getDevelopmentPrograms } from '../sim/development';
import { applyAction, getWeekOutlook } from '../sim/engine';
import GameDialog from './GameDialog';
import './development.css';
const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const estimate = ({ min, max }: { min: number; max: number }) => `${yen(Math.floor(min / 1000) * 1000)}〜${yen(Math.ceil(max / 1000) * 1000)}`;
const percent = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(0)}%`;
const statusLabel = { available: '計画を選べます', locked: '着工条件を確認', building: '工事中', complete: '全工程完了', suspended: '地区の保有物件なし・稼働停止' };
const phases = ['街の基盤', '回遊と収益', '地区の未来'];
export default function DevelopmentPanel({ state, onAction, busy = false }: { state: GameState; onAction: (action: GameAction) => boolean | void | Promise<boolean | void>; busy?: boolean }) {
  const [selected, setSelected] = useState<{ districtId: DistrictId; choiceId: string } | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const programs = getDevelopmentPrograms(state);
  const program = programs.find(p => p.districtId === selected?.districtId);
  const choice = program?.choices.find(c => c.id === selected?.choiceId);
  const disabled = busy || submitting || state.gameOver;
  let after: GameState | null = null;
  let previewError = '';
  if (selected && choice) {
    try { after = applyAction(state, { type: 'startDevelopment', ...selected }); }
    catch (e) { previewError = e instanceof Error ? e.message : '現在の条件では着工できません。'; }
  }
  const forecast = after ? getWeekOutlook(after) : null;
  const debtRisk = forecast?.risk.debtLossPossible ?? false;
  const confirm = async () => {
    if (!selected || disabled || !after) return;
    setSubmitting(true); setError('');
    try {
      const success = await onAction({ type: 'startDevelopment', ...selected });
      if (success !== false) setSelected(null);
      else setError('着工できませんでした。条件を確認して再度お試しください。');
    } catch (e) { setError(e instanceof Error ? e.message : '着工できませんでした。'); }
    finally { setSubmitting(false); }
  };
  return <div className="development-panel">
    <header className="development-intro"><div><span className="eyebrow">FOUR DISTRICTS, TWELVE DECISIONS</span><h3>次の投資先は、街そのもの。</h3><p>各地区で3段階の開発を進めます。店舗の集客か、不動産の収益か。2つの計画から、その街の育て方を選びましょう。</p></div><Building2 size={30}/></header>
    <div className="development-summary"><div><span>全工程を完了した地区</span><strong>{programs.filter(p => p.phase === 3).length} / {programs.length}</strong><small>完成済みの工程は保有物件を売却しても残ります</small></div><div><span>進行中の工事</span><strong>{programs.filter(p => p.status === 'building').length} 件</strong><small>週を進めると工期が経過します</small></div><div><span>稼働中の維持費 / 週</span><strong>{yen(programs.filter(p => p.active).reduce((n, p) => n + p.effects.weeklyUpkeep, 0))}</strong><small>今週の予測に反映する開発費用</small></div></div>
    <p className="development-note">完成後の効果は、その地区の自社店舗と直接保有する賃貸物件に反映されます。需要の上昇は利益を保証しません。地区の最後の保有物件を売ると効果と維持費が停止し、再取得で再開します。</p>
    {error && !selected && <p className="development-error" role="alert">{error}</p>}
    {programs.map(p => <section className="development-district" key={p.districtId} aria-label={`${p.name}の開発`}><header><div><span className="eyebrow">DISTRICT DEVELOPMENT</span><h3>{p.name}</h3></div><strong>{statusLabel[p.status]}</strong></header>
      <ol className="development-phases">{phases.map((name, index) => <li key={name} className={p.phase > index ? 'is-complete' : p.phase === index ? 'is-current' : ''}>{p.phase > index ? <Check size={13}/> : `PHASE ${index + 1}`}<strong>{name}</strong><span>{p.phase > index ? '完成' : p.phase === index && p.status === 'building' ? '工事中' : p.phase === index ? '次の工程' : '前の工程の完成後'}</span></li>)}</ol>
      {p.status === 'building' ? <div className="development-construction"><strong>{p.remainingWeeks > 0 ? `完成まで、あと ${p.remainingWeeks} 週` : '今週の決算で完成'}</strong><p>{p.choices.find(c => c.id === state.development?.programs.find(row => row.districtId === p.districtId)?.construction?.choiceId)?.name}</p><p>{p.remainingWeeks > 0 ? '完成前は、この工程の効果は反映されません。' : p.active ? '今週の予測には、新しい効果と維持費を反映しています。' : '今週完成しますが、保有物件がないため稼働は停止します。'}次の工程は決算後に選べます。</p><small>現在の工程：{p.phase + 1} / 3</small></div> : p.phase < 3 ? <div className="development-choices">{p.choices.map(c => <article className="development-choice" key={c.id}><span className="eyebrow">PHASE {p.phase + 1} / PLAN</span><h4>{c.name}</h4><p>{c.description}</p><dl><div><dt>着工時の支払</dt><dd>{yen(c.cost)}</dd></div><div><dt>工期</dt><dd>{c.weeks} 週</dd></div><div><dt>完成後の追加維持費 / 週</dt><dd>{yen(c.weeklyUpkeep)}</dd></div><div><dt>地区内の自社店舗需要</dt><dd>{percent(c.cafeDemandBonus)}</dd></div><div><dt>地区内の保有物件賃貸収入</dt><dd>{percent(c.propertyYieldBonus)}</dd></div></dl><p className="development-note">{c.unlocked ? '着工条件を満たしています。' : c.reason}</p><button className="secondary" disabled={disabled || !c.unlocked} onClick={() => { setError(''); setSelected({ districtId: p.districtId, choiceId: c.id }); }}>計画と支払を確認</button></article>)}</div> : <p>3段階の開発が完成しました。店舗の運営と不動産の保有を見直し、街への投資を収益につなげましょう。</p>}
      <div className="development-effects"><span>{p.active ? '現在稼働中' : '現在停止中'}の予測反映効果</span><span>店舗需要 {percent(p.active ? p.effects.cafeDemandBonus : 0)}</span><span>賃貸収入 {percent(p.active ? p.effects.propertyYieldBonus : 0)}</span><span>維持費 {yen(p.active ? p.effects.weeklyUpkeep : 0)} / 週</span></div>
    </section>)}
    {selected && choice && program && <GameDialog title={`${program.name}の開発計画`} className="development-modal" close={() => { if (!submitting) setSelected(null); }}><h3>{choice.name}</h3><p>{choice.description}</p><dl className="cost-list"><div><dt>着工時の支払</dt><dd>{yen(choice.cost)}</dd></div><div><dt>支払後の手元資金</dt><dd>{yen(state.cash - choice.cost)}</dd></div><div><dt>工期</dt><dd>{choice.weeks} 週</dd></div><div><dt>完成後の追加維持費 / 週</dt><dd>{yen(choice.weeklyUpkeep)}</dd></div>{forecast && <><div><dt>着工後・今週の利益見込み</dt><dd>{estimate(forecast.netProfit)}</dd></div><div><dt>着工後・週末の現金見込み</dt><dd>{estimate(forecast.cashAfter)}</dd></div></>}</dl><p>完成後の追加効果：店舗需要 {percent(choice.cafeDemandBonus)} ／ 賃貸収入 {percent(choice.propertyYieldBonus)}。</p><p className="development-note">今週の予測は着工費支払後の状態で計算しています。工事完了後の需要・収入・維持費を先取りした予測ではありません。利益は客足・営業状況や景況によって変わり、週末に確定します。</p>{debtRisk && <p className="warning" role="alert">利益見込みの下限がゼロ以下です。借入中に週末の利益がゼロ以下になると倒産します。</p>}{forecast?.risk.cashShortfallPossible && <p className="warning" role="alert">着工後は週末の資金が不足するおそれがあります。</p>}<p className="development-note">着工した計画の変更・中止・返金はできません。条件を確認してから着工してください。</p>{(error || previewError) && <p className="development-error" role="alert">{error || previewError}</p>}<div className="button-row"><button className="secondary" disabled={submitting} onClick={() => setSelected(null)}>戻る</button><button className="primary" disabled={disabled || !after} onClick={() => void confirm()}>{submitting ? '着工中…' : `着工する · ${yen(choice.cost)}`}</button></div></GameDialog>}
  </div>;
}
