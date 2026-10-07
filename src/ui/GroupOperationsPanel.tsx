import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameAction, GameState, MarketOperationPolicy, MarketOperationProject } from '../model';
import { applyAction, getWeekOutlook } from '../sim/engine';
import {
  getActiveMarketOperation, getMarketOperationCohort, getMarketOperationCosts, getMarketOperationOutcome,
  getMarketOperationQuote, getMarketOperationSectors, MARKET_OPERATION_TERM_WEEKS,
} from '../sim/marketOperations';
import type { InvestmentIntent, InvestmentVisit } from './investmentPlanning';
import { GameIcon } from './GameIcon';
import './group-operations.css';

export interface GroupOperationsPanelProps {
  state: GameState;
  onAction: (action: GameAction) => boolean | void | Promise<boolean | void>;
  busy?: boolean;
  initialSector?: string | null;
  onPlanInvestment?: (intent: InvestmentIntent) => void;
  investmentVisit?: InvestmentVisit | null;
}

type Choice = 'retain' | MarketOperationPolicy;
const labels: Record<Choice, string> = { retain: '現状を維持', growth: '成長に投資', stability: '変動を抑える' };
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const signedYen = (value: number) => `${value > 0 ? '+' : ''}${yen(value)}`;
const rangeYen = (range: { min: number; max: number }) => `約${yen(Math.floor(range.min / 1000) * 1000)}〜${yen(Math.ceil(range.max / 1000) * 1000)}`;
const differenceClass = (value: number) => value < 0 ? 'negative' : value > 0 ? 'positive' : undefined;

function ProgramProgress({ state, project }: { state: GameState; project: MarketOperationProject }) {
  const result = getMarketOperationOutcome(state, project);
  const cohort = getMarketOperationCohort(state, project);
  const costs = getMarketOperationCosts(state, project);
  return <section className="group-operation-history" data-operation-start-week={project.startWeek} data-operation-end-week={project.endWeek}>
    <h4><GameIcon name={result.complete ? 'check' : 'briefcase'} size={24} tone={result.complete ? 'green' : 'blue'}/>{result.complete ? '終了した事業計画' : '進行中の事業計画'} · {project.sector}</h4>
    <div className="group-operation-history-row">
      <strong>{labels[project.policy]} · {result.settledWeeks} / {MARKET_OPERATION_TERM_WEEKS}週 · 対象{cohort.length}件</strong>
      <dl className="group-operation-values"><div className="group-operation-range"><dt>決算済みの事業内の資金効果・初回支払込み</dt><dd className={differenceClass(result.netContribution)}>{signedYen(result.netContribution)}</dd></div></dl>
      {result.complete ? <p>第{project.endWeek}週から通常運営に戻りました。自動更新しません。</p> : <p>第{project.endWeek}週に通常運営へ戻り、次の計画を選べます。途中では終了できず、自動更新しません。</p>}
      <details className="group-operation-details"><summary>結果と支払の内訳</summary>
        <dl className="group-operation-values"><div><dt>初回支払・支払済み</dt><dd>{yen(result.upfrontCost)}</dd></div><div><dt>計画運営費 / 週</dt><dd>{yen(costs.weeklyCost)}</dd></div></dl>
        <p>決算済みの計画運営費 {yen(result.weeklyCosts)}。終了した週だけ、同じ景況・個別業績で現状維持と比較しています。事業利益の差額から初回支払を引いた額で、全社の現金増減や前週差とは別です。</p>
        <p>開始時点で稼働済みだった事業が対象です。その後の取得や稼働開始では対象が増えません。</p>
      </details>
    </div>
  </section>;
}

/** Sector selection and financing visits are presentation state; only Start mutates the company. */
export default function GroupOperationsPanel({ state, onAction, busy = false, initialSector, onPlanInvestment, investmentVisit }: GroupOperationsPanelProps) {
  const initialIntent = investmentVisit?.intent.kind === 'marketOperation' ? investmentVisit.intent : null;
  const [sector, setSector] = useState<string | null>(initialIntent?.sector ?? initialSector ?? null);
  const [choice, setChoice] = useState<Choice>(initialIntent?.policy ?? 'retain');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const handledVisit = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const sectors = useMemo(() => getMarketOperationSectors(state), [state]);
  const active = getActiveMarketOperation(state);
  const selected = sectors.find(row => row.sector === sector);
  const blocked = busy || submitting || state.gameOver;
  const latestCompleted = [...(state.marketOperations?.projects ?? [])].reverse().find(project => project.endWeek <= state.week && (!sector || project.sector === sector));
  const quote = useMemo(() => selected && choice !== 'retain' ? getMarketOperationQuote(state, selected.sector, choice) : null, [state, selected, choice]);
  const preview = useMemo(() => {
    if (!quote?.canStart) return null;
    const after = applyAction(state, { type: 'startMarketOperation', sector: quote.sector, policy: quote.policy });
    return { cash: after.cash, risk: getWeekOutlook(after).risk };
  }, [state, quote]);

  useEffect(() => {
    setSector(initialSector ?? null); setChoice('retain'); setConfirming(false); setError('');
  }, [initialSector]);
  useEffect(() => {
    if (!investmentVisit || investmentVisit.intent.kind !== 'marketOperation' || handledVisit.current === investmentVisit.id) return;
    handledVisit.current = investmentVisit.id;
    setSector(investmentVisit.intent.sector); setChoice(investmentVisit.intent.policy); setConfirming(false); setError('');
  }, [investmentVisit]);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'nearest' });
  }, [sector, confirming]);

  const openSector = (next: string | null) => {
    focusHeading.current = true;
    setSector(next); setChoice('retain'); setConfirming(false); setError('');
  };
  const choose = (next: Choice) => { setChoice(next); setConfirming(false); setError(''); };
  const execute = async () => {
    if (!quote || blocked) return;
    // A finance return, a settled week or another action may change the cohort and cost.
    const current = getMarketOperationQuote(state, quote.sector, quote.policy);
    if (!current.canStart) { setError(current.reason); setConfirming(false); return; }
    setSubmitting(true); setError('');
    try {
      const result = await onAction({ type: 'startMarketOperation', sector: current.sector, policy: current.policy });
      if (result === false) setError('計画を開始できませんでした。現在の条件を確認してください。');
      else { setChoice('retain'); setConfirming(false); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : '計画を開始できませんでした。'); }
    finally { setSubmitting(false); }
  };

  return <section className="group-operations" data-group-operations data-operation-sector={sector ?? undefined}>
    {sector && <button type="button" className="group-operation-back" disabled={submitting} onClick={() => openSector(null)}><GameIcon name="arrow-left" size={21} tone="blue"/> 業種一覧へ</button>}
    <header className="group-operation-intro"><span className="group-operation-emblem"><GameIcon name="briefcase" size={38} tone="gold"/></span><div><span className="eyebrow">GROUP OPERATIONS</span>
    <h3 ref={heading} tabIndex={-1} className="group-operation-heading">{sector ? `${sector}の運営・投資` : '市場から迎えた事業'}</h3></div></header>
    {!sector ? <>
      <p className="group-operation-note">傘下の事業は、そのままでも運営を続けます。余力ができたら、一つの業種に26週の事業計画を選べます。</p>
      {active && <ProgramProgress state={state} project={active}/>}
      {!sectors.length ? <p className="group-operation-note">市場の友好的買収で迎えた事業が、ここに表示されます。</p> : <div className="group-sector-list">{sectors.map(row => <article className="group-sector-row" key={row.sector} data-group-sector={row.sector}>
        <div><h4>{row.sector}{active?.sector === row.sector && <span className="group-operation-badge">計画実行中</span>}</h4>
          <p>稼働中 {row.eligibleCount}件{row.integratingCount > 0 && ` · 引継ぎ中 ${row.integratingCount}件`}</p>
          <p>事業利益の見込み / 今週 <strong>{rangeYen(row.weeklyProfitRange)}</strong></p></div>
        <button type="button" className="secondary" onClick={() => openSector(row.sector)}>運営・投資を考える</button>
      </article>)}</div>}
      {latestCompleted && <details className="group-operation-details"><summary>直近の事業計画の結果</summary><ProgramProgress state={state} project={latestCompleted}/></details>}
    </> : !selected ? <p className="group-operation-note">この業種の傘下事業はありません。業種一覧から現在の事業を選んでください。</p> : <>
      <p className="group-operation-note">稼働中 {selected.eligibleCount}件{selected.integratingCount > 0 && ` · 引継ぎ中 ${selected.integratingCount}件`}</p>
      {active && <ProgramProgress state={state} project={active}/>}
      {!active && <>
        <div className="group-operation-choices" role="group" aria-label={`${sector}の事業計画を比較`}>{(['retain', 'growth', 'stability'] as const).map(option => <button type="button" key={option} data-operation-policy={option} aria-pressed={choice === option} disabled={submitting} onClick={() => choose(option)}><GameIcon name={option === 'growth' ? 'trend-up' : option === 'stability' ? 'check' : 'briefcase'} size={27} tone={choice === option ? 'gold' : 'blue'}/>{labels[option]}</button>)}</div>
        {choice === 'retain' ? <>
          <p className="group-operation-note">追加の計画費用を使わず、今の運営を続けます。週末に業績が確定します。</p>
          <dl className="group-operation-values"><div className="group-operation-range"><dt>この業種の事業利益の見込み / 今週</dt><dd>{rangeYen(selected.weeklyProfitRange)}</dd></div></dl>
        </> : quote && <>
          <p className="group-operation-note">{choice === 'growth' ? '収益を伸ばす投資です。固定の運営費が増え、業績の振れ幅も大きくなります。' : '収益の一部と初期費用を使い、景気・個別業績による振れ幅を抑えます。'}</p>
          <section className="group-operation-comparison" data-operation-confirm={confirming || undefined} aria-label={`${labels[choice]}の支払と事業収支`}>
            <h4>{confirming ? '開始前の支払と収支を確認' : `${labels[choice]}場合`}</h4>
            <dl className="group-operation-values">
              <div><dt>開始時に支払う現金</dt><dd data-operation-upfront={quote.upfrontCost}>{yen(quote.upfrontCost)}</dd></div>
              <div><dt>追加の計画運営費 / 週</dt><dd data-operation-weekly-cost={quote.weeklyCost}>{yen(quote.weeklyCost)}</dd></div>
              <div className="group-operation-range"><dt>現状維持と比べた事業内の資金効果 / 26週</dt><dd>{rangeYen(quote.netContributionRange)}</dd></div>
            </dl>
            <p className="group-operation-note">保有事業数が変わらない場合の26週試算。収益・回収を保証する幅ではありません。</p>
            <table className="group-operation-compare-table"><thead><tr><th scope="col">開始時の資金</th><th scope="col">現状を維持</th><th scope="col">{labels[choice]}</th></tr></thead><tbody>
              <tr><th scope="row">支払直後の現金</th><td>{yen(state.cash)}</td><td>{preview ? yen(preview.cash) : '実行条件を確認'}</td></tr>
            </tbody></table>
          </section>
          <p className="group-operation-note">第{quote.project.startWeek}週〜第{quote.project.endWeek - 1}週の26週間。途中では終了できません。第{quote.project.endWeek}週から通常運営へ戻り、自動更新しません。</p>
          <p className="group-operation-note">初回支払と運営費の確保目安 <strong data-operation-reserve={quote.reserveRequired}>{yen(quote.reserveRequired)}</strong></p>
          {quote.reserveRequired > state.cash && <p className="group-operation-warning">全期間の運営費を確保するには、現金が {yen(quote.reserveRequired - state.cash)} 不足しています。</p>}
          {!quote.canStart && <p className="group-operation-warning" role="alert">{quote.reason}</p>}
          {preview?.risk.debtLossPossible && <p className="group-operation-warning" role="alert">借入中の収支にリスクがあります。週末の実際の利益（利息後）が0以下なら倒産します。</p>}
          {preview?.risk.cashShortfallPossible && <p className="group-operation-warning" role="alert">計画開始後の支払いに備える資金が不足するおそれがあります。計画運営費や返済に備えて現金を残してください。</p>}
          <div className="group-operation-actions">
            {confirming ? <><button type="button" className="secondary" disabled={submitting} onClick={() => setConfirming(false)}>比較に戻る</button><button type="button" className="primary" disabled={blocked || !quote.canStart} onClick={() => void execute()}>{submitting ? '処理中…' : `26週の計画を始める · ${yen(quote.upfrontCost)}`}</button></> : <button type="button" className="primary" disabled={blocked || !quote.canStart} onClick={() => { focusHeading.current = true; setConfirming(true); }}>開始前の支払と収支を確認</button>}
            {onPlanInvestment && quote.eligibleCount > 0 && <button type="button" className="secondary" disabled={blocked} onClick={() => onPlanInvestment({ kind: 'marketOperation', sector: quote.sector, policy: quote.policy })}>この計画の資金調達を比較</button>}
          </div>
          <details className="group-operation-details"><summary>試算と支払の内訳</summary>
            <p className="group-operation-note">開始時点で稼働済みの {quote.eligibleCount}件が対象です。その後の取得や稼働開始では対象が増えません。</p>
            <p className="group-operation-note">26週の資金効果は、同じ景況・個別業績での事業利益差額から初回支払を引いた試算です。計画運営費を含み、配当・借入返済・他事業の現金変動は含みません。他社の取得でグループ管理費が増えると、この幅から外れる場合があります。</p>
            <p className="group-operation-note">店舗を含む全社の実績は、週末の決算で確認します。ここに示す事業内の資金効果は、会社全体の現金増減とは別です。</p>
            <p className="group-operation-note">対象事業のゲーム内基準取得価額合計 {yen(quote.baseValue)} を費用の基準にしています。初回支払 {yen(quote.upfrontCost)} ＋ 運営費 {yen(quote.weeklyCost)} × 26週 ＝ 確保目安 {yen(quote.reserveRequired)}。初回支払は開始時、運営費は毎週の決算に計上します。確保額は全社資金繰りの保証ではありません。</p>
          </details>
        </>}
      </>}
      {latestCompleted && <details className="group-operation-details"><summary>この業種の直近の計画結果</summary><ProgramProgress state={state} project={latestCompleted}/></details>}
    </>}
    {error && <p className="group-operation-warning" role="alert">{error}</p>}
  </section>;
}
