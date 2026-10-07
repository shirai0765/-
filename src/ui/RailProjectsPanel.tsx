import { useEffect, useRef, useState } from 'react';
import { TrainFront } from 'lucide-react';
import type { DistrictId, GameAction, GameState, RailProjectChoiceId } from '../model';
import { getRailProjects, getRailProjectFinancials } from '../sim/railProjects';
import { applyAction, getWeekOutlook } from '../sim/engine';
import type { InvestmentIntent, InvestmentVisit } from './investmentPlanning';
import GameDialog from './GameDialog';
import './rail-projects.css';

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

const percent = (n: number) => `+${(n * 100).toFixed(0)}%`;
const labels = { available: '計画を選べます', locked: '条件を確認', building: '工事中', operating: '共同開発が稼働中', suspended: '保有物件なし・運営休止' };
type Selection = { districtId: DistrictId; choiceId: RailProjectChoiceId };

export default function RailProjectsPanel({ state, onAction, busy = false, onShowProject, onPlanInvestment, investmentVisit }: {
  state: GameState; onAction: (action: GameAction) => boolean | void | Promise<boolean | void>; busy?: boolean;
  onShowProject?: (districtId: DistrictId) => void;
  onPlanInvestment?: (intent: InvestmentIntent) => void;
  investmentVisit?: InvestmentVisit | null;
}) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const handledVisit = useRef<string | null>(null);
  const projects = getRailProjects(state), financials = getRailProjectFinancials(state);
  const project = projects.find(p => p.districtId === selected?.districtId);
  const choice = project?.options.find(c => c.id === selected?.choiceId);
  let after: GameState | null = null, previewError = '';
  if (selected && choice) {
    try { after = applyAction(state, { type: 'startRailProject', ...selected }); }
    catch (e) { previewError = e instanceof Error ? e.message : 'この条件では着工できません。'; }
  }
  const forecast = after ? getWeekOutlook(after) : null;
  const disabled = busy || submitting || state.gameOver;
  useEffect(() => {
    if (!investmentVisit || investmentVisit.intent.kind !== 'rail' || handledVisit.current === investmentVisit.id) return;
    handledVisit.current = investmentVisit.id;
    const { districtId, choiceId } = investmentVisit.intent;
    const target = getRailProjects(state).find(p => p.districtId === districtId);
    setError('');
    // An explicit return visit can review a currently unaffordable plan. It never starts it.
    setSelected(target?.options.some(c => c.id === choiceId) ? { districtId, choiceId } : null);
    document.getElementById(`rail-project-${districtId}`)?.scrollIntoView({ block: 'start' });
  }, [investmentVisit, state]);
  const confirm = async () => {
    if (!selected || !after || disabled || inFlight.current) return;
    inFlight.current = true; setSubmitting(true); setError('');
    try {
      const result = await onAction({ type: 'startRailProject', ...selected });
      if (result !== false) setSelected(null);
      else setError('着工できませんでした。最新の資金と条件を確認してください。');
    } catch (e) { setError(e instanceof Error ? e.message : '着工できませんでした。'); }
    finally { inFlight.current = false; setSubmitting(false); }
  };
  return <div className="rail-projects-panel">
    <header className="rail-projects-intro"><div><span className="eyebrow">STATION AREA PARTNERSHIPS</span><h3>鉄道の先に、育てる街を選ぶ。</h3><p>上場・信用45・地区内の物件保有で、駅周辺の共同開発に参加できます。各地区で商業回遊か賃貸設備のどちらか1計画を選びます。</p></div><TrainFront size={30}/></header>
    <p className="rail-projects-note">鉄道会社の取得とは別の任意投資です。鉄道の所有権や会社利益は付与されず、キャンペーン完遂の必須条件も増えません。</p>
    <div className="rail-projects-summary"><span>選択済み <strong>{projects.filter(p => p.choice).length} / 4地区</strong></span><span>今週の共同開発維持費 <strong>{yen(financials.weeklyUpkeep)}</strong></span></div>
    <p className="rail-projects-note">維持費は工事中から毎週発生し、完成時から需要・賃料へ効果が加わります。既存の地区開発と合わせて需要+40%・賃料+50%が上限。地区の最後の保有物件を売ると効果・維持費が止まり、再取得で再開します。工期は休止中も経過します。</p>
    {projects.map(p => <section id={`rail-project-${p.districtId}`} key={p.districtId} className="rail-projects-district" aria-label={`${p.name}の駅周辺共同開発`}>
      <header><h3>{p.name}</h3><span>{labels[p.status]}</span></header>
      {p.choice ? <div className="rail-projects-current"><h4>{p.choice.name}</h4><p>{p.remainingWeeks > 0 ? `完成まであと${p.remainingWeeks}週。完成前の効果はありません。` : '工事は完了しています。'}{p.status === 'suspended' ? '地区の物件を再取得すると運営が再開します。' : ''}</p><dl><div><dt>今週の追加需要</dt><dd>{percent(p.effects.cafeDemandBonus)}</dd></div><div><dt>今週の追加賃料効果</dt><dd>{percent(p.effects.propertyYieldBonus)}</dd></div><div><dt>今週の維持費</dt><dd>{yen(p.effects.weeklyUpkeep)}</dd></div></dl>{onShowProject && <button className="secondary" onClick={() => onShowProject(p.districtId)}>沿線の様子を見る</button>}</div> : <div className="rail-projects-options">{p.options.map(c => <article key={c.id}><h4>{c.name}</h4><p>{c.description}</p><dl><div><dt>着工時の支払</dt><dd>{yen(c.cost)}</dd></div><div><dt>工期</dt><dd>{c.weeks}週</dd></div><div><dt>工事中・完成後の維持費 / 週</dt><dd>{yen(c.weeklyUpkeep)}</dd></div><div><dt>完成後の店舗需要</dt><dd>{percent(c.cafeDemandBonus)}</dd></div><div><dt>完成後の外部賃料</dt><dd>{percent(c.propertyYieldBonus)}</dd></div></dl><p className="rail-projects-note">{c.reason || '着工条件を満たしています。効果は地区開発との合算上限内で反映されます。'}</p><button className="secondary" disabled={disabled || !c.unlocked} onClick={() => { setError(''); setSelected({ districtId: p.districtId, choiceId: c.id }); }}>支払と工期を確認</button>{onPlanInvestment && <button className="secondary" disabled={disabled} onClick={() => onPlanInvestment({ kind: 'rail', districtId: p.districtId, choiceId: c.id })}>この計画の資金を確認</button>}</article>)}</div>}
    </section>)}
    {selected && project && choice && <GameDialog title={`${project.name}・共同開発の確認`} className="rail-projects-modal" close={() => { if (!busy && !inFlight.current) setSelected(null); }}>
      <h3>{choice.name}</h3><p>{choice.description}</p><dl className="cost-list"><div><dt>着工時の支払</dt><dd>{yen(choice.cost)}</dd></div><div><dt>{after ? '支払後の現金' : '現在の現金'}</dt><dd>{yen(after?.cash ?? state.cash)}</dd></div><div><dt>工期</dt><dd>{choice.weeks}週</dd></div><div><dt>工事中から毎週の維持費</dt><dd>{yen(choice.weeklyUpkeep)}</dd></div>{forecast && <div><dt>今週の元本返済</dt><dd>{yen(forecast.expected.loanRepayment)}</dd></div>}</dl>
      <p>完成後は店舗需要 {percent(choice.cafeDemandBonus)} ／ 外部賃料 {percent(choice.propertyYieldBonus)}（地区開発との合算上限あり）。自用物件には追加賃料が発生しません。</p>
      <p className="rail-projects-note">着工費は開始時に支払い、維持費は工事中から毎週かかります。需要・賃料への効果は完成後に加わります。利益は店舗の空き能力、賃貸物件、景況によって変わり、週末に確定します。</p>
      {forecast?.risk.debtLossPossible && <p className="warning" role="alert">着工後の維持費により、借入中の利益が不足するおそれがあります。週末の利息後利益が0以下なら倒産します。</p>}
      {forecast?.risk.cashShortfallPossible && <p className="warning" role="alert">着工後、週末の支払い資金が不足するおそれがあります。</p>}
      <p className="rail-projects-note">着工後の変更・中止・返金はできません。この地区でもう一方の計画を選ぶことはできなくなります。</p>
      {(error || previewError) && <p className="rail-projects-error" role="alert">{error || previewError}</p>}
      <div className="button-row"><button className="secondary" disabled={submitting} onClick={() => setSelected(null)}>戻る</button><button className="primary" disabled={disabled || !after} onClick={() => void confirm()}>{submitting ? '着工中…' : `着工する · ${yen(choice.cost)}`}</button></div>
    </GameDialog>}
  </div>;
}
