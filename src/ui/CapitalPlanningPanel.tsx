import { useEffect, useMemo, useState } from 'react';
import type { GameAction, GameState } from '../model';
import { getSummary } from '../sim/engine';
import { getActiveMarketOperation } from '../sim/marketOperations';
import { capitalBudgetError, getCapitalPlans, type CapitalPlanId } from '../sim/capitalPlanning';
import './capital-planning.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const signedYen = (value: number) => `${value > 0 ? '+' : ''}${yen(value)}`;

/** UI-only draft; never part of GameState or its save envelope. */
export interface CapitalPlanningDraft {
  borrowAmount: number;
  borrowWeeks: number;
  selectedId: CapitalPlanId;
  useBudget: boolean;
  spending: number;
  reserve: number;
  contextId?: string;
}

export interface CapitalPlanningPanelProps {
  state: GameState;
  onAction: (action: GameAction) => void;
  disabled?: boolean;
  planningContext?: { id: string; label: string; spending: number; returnLabel: string };
  onReturnToInvestment?: () => void;
  initialDraft?: CapitalPlanningDraft;
  onDraftChange?: (draft: CapitalPlanningDraft) => void;
  /** A physical city service offers only its relevant financing methods. */
  service?: 'bank' | 'exchange';
}

export default function CapitalPlanningPanel({ state, onAction, disabled = false, planningContext, onReturnToInvestment, initialDraft, onDraftChange, service }: CapitalPlanningPanelProps) {
  const hasNewContext = planningContext && planningContext.id !== initialDraft?.contextId;
  const [borrowAmount, setBorrowAmount] = useState(initialDraft?.borrowAmount ?? 3_000_000);
  const [borrowWeeks, setBorrowWeeks] = useState(initialDraft?.borrowWeeks ?? 52);
  const [selectedId, setSelectedId] = useState<CapitalPlanId>(service === 'bank' ? 'borrow' : service === 'exchange' ? 'equity' : initialDraft?.selectedId ?? 'hold');
  const [useBudget, setUseBudget] = useState(hasNewContext ? true : initialDraft?.useBudget ?? Boolean(planningContext));
  const [spending, setSpending] = useState(hasNewContext ? planningContext.spending : initialDraft?.spending ?? planningContext?.spending ?? 0);
  const [reserve, setReserve] = useState(initialDraft?.reserve ?? 0);
  const [budgetContextId, setBudgetContextId] = useState(planningContext?.id);
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  // Reset only for a different investment. Same-ID price/state updates must not erase edits.
  // A guarded render adjustment avoids showing the previous target's budget for one render.
  if (planningContext?.id !== budgetContextId) {
    setBudgetContextId(planningContext?.id);
    if (planningContext) {
      setSpending(planningContext.spending);
      setUseBudget(true);
    }
  }
  const draft = useMemo<CapitalPlanningDraft>(() => ({ borrowAmount, borrowWeeks, selectedId, useBudget, spending, reserve, contextId: budgetContextId }), [borrowAmount, borrowWeeks, selectedId, useBudget, spending, reserve, budgetContextId]);
  useEffect(() => { onDraftChange?.(draft); }, [draft, onDraftChange]);
  const budget = useBudget ? { spending, reserve } : undefined;
  const budgetError = capitalBudgetError(budget);
  const plans = useMemo(() => getCapitalPlans(state, { borrowAmount, borrowWeeks, budget: useBudget ? { spending, reserve } : undefined }), [state, borrowAmount, borrowWeeks, useBudget, spending, reserve]);
  const summary = useMemo(() => getSummary(state), [state]);
  const selected = plans.find(plan => plan.id === selectedId)!;
  const blocked = disabled || state.gameOver;
  const labels = { hold: '今は調達しない', borrow: '銀行から借りる', equity: state.listed ? '10%増資する' : '株式公開する' };
  const gap = useBudget && !budgetError ? Math.max(0, spending + reserve - state.cash) : null;
  const after = selected.after;
  const before = selected.before;
  const rows = after ? [
    { label: '調達直後の手元資金', before: yen(before.cash), after: yen(after.cash) },
    { label: '借入残高', before: yen(before.debt), after: yen(after.debt) },
    { label: '創業者持分', before: percent(before.ownership), after: percent(after.ownership) },
    { label: '支払利息 / 今週', before: yen(before.report.interest), after: yen(after.report.interest) },
    { label: '元本返済 / 今週', before: yen(before.report.loanRepayment), after: yen(after.report.loanRepayment) },
  ] : [];

  return <section className="card capital-planning" aria-label="資金調達の比較">
    <span className="eyebrow">CAPITAL PLAN</span><h3>{service === 'bank' ? '事業資金を借りる' : service === 'exchange' ? state.listed ? '増資で事業を広げる' : '株式を公開する' : '次の投資に、どの資金を使う？'}</h3>
    <p className="capital-note">第{state.week}週の会社に、調達だけを実行した場合の比較です。選ぶだけでは現金も週も変わりません。</p>
    {getActiveMarketOperation(state) && <p className="capital-note">26週間の事業計画による一時的な利益変化は、企業価値と借入枠の収益評価には含めません。支出済みの現金と今週の営業収支には反映しています。</p>}
    {planningContext && <div className="capital-context">
      <strong>計画中：{planningContext.label}</strong>
      <p className="capital-note">投資先から受け取った金額は概算メモです。取得済み・価格変更などの条件は反映せず、投資先へ戻って確認します。</p>
    </div>}
    <div className="capital-options" role="group" aria-label="調達方法を比較">
      {plans.filter(plan => !service || plan.id === 'hold' || plan.id === (service === 'bank' ? 'borrow' : 'equity')).map(plan => <button type="button" key={plan.id} className={'capital-option' + (selectedId === plan.id ? ' selected' : '')} aria-pressed={selectedId === plan.id} onClick={() => setSelectedId(plan.id)}>
        <strong>{labels[plan.id]}</strong>
        {plan.after ? <><span>得る現金 <b>{signedYen(plan.raisedCash ?? 0)}</b></span><span>持分 {percent(plan.after.ownership)} / 元本 {yen(plan.after.report.loanRepayment)}/週</span>{plan.budgetGap !== null && <span className={plan.budgetGap > 0 ? 'negative' : 'positive'}>計画資金 {plan.budgetGap > 0 ? `${yen(plan.budgetGap)}不足` : '確保できる'}</span>}{plan.after.debtProfitRisk && <span className="negative">借入中の利益不足リスク</span>}{plan.after.cashRisk && <span className="negative">週末の資金不足</span>}</> : <span className="capital-unavailable">{plan.reason}</span>}
      </button>)}
    </div>
    {selectedId === 'borrow' && <div className="capital-borrow-settings">
      <div className="capital-inputs">
        <label>借入希望額（円）<input type="number" min={100000} step={100000} value={Number.isFinite(borrowAmount) ? borrowAmount : ''} disabled={blocked} onChange={event => setBorrowAmount(event.target.value === '' ? NaN : Number(event.target.value))}/></label>
        <label>元本の返済期間（週）<input type="number" min={13} max={260} step={1} value={Number.isFinite(borrowWeeks) ? borrowWeeks : ''} disabled={blocked} onChange={event => setBorrowWeeks(event.target.value === '' ? NaN : Number(event.target.value))}/></label>
      </div>
      <p className="capital-note">追加借入可能額 {yen(summary.availableCredit)}。13〜260週の元本均等返済。長い期間ほど週の元本支払は減りますが、借入が長く残ります。</p>
    </div>}
    <h4>{labels[selectedId]}場合</h4>
    <p className="capital-note">{selectedId === 'hold' ? '今ある現金と営業収支を使います。追加の利息や持分低下はありません。' : selectedId === 'borrow' ? '持分を保って現金を増やします。利息は利益を、元本返済は現金を減らします。' : state.listed ? '調達額の5%を控除した現金が入ります。新たな返済はありませんが、持分が下がり、追加増資の余地が減ります。' : '株式を新たに発行し、持分は100%から80%へ。大型の取得や後半の地区開発へ進む条件の一つを満たします。'}</p>
    {after ? <>
      <div className="capital-outcome" aria-label="選んだ調達案の主な結果">
        <dl className="capital-key-values">
          <div className="capital-key-main"><dt>得る現金</dt><dd>{signedYen(selected.raisedCash ?? 0)}</dd></div>
          <div className="capital-key-main"><dt>調達直後の手元資金</dt><dd>{yen(after.cash)}</dd></div>
          <div><dt>自分の持分</dt><dd>{percent(after.ownership)}</dd></div>
          <div><dt>元本返済 / 今週</dt><dd>{yen(after.report.loanRepayment)}</dd></div>
          <div><dt>支払利息 / 今週</dt><dd>{yen(after.report.interest)}</dd></div>
        </dl>
        <p className="capital-note">調達した直後の金額です。この後の投資や営業による増減は含みません。売上と利益は週末に確定します。元本は利益ではなく現金から支払います。</p>
      </div>
      {selected.loanAnnualRate !== null && <p className="capital-note">この新規融資の年利 {(selected.loanAnnualRate * 100).toFixed(2)}% · {borrowWeeks}週返済</p>}
      {after.debtProfitRisk && <p className="capital-warning" role="alert">現在の営業計画では、借入中の利益不足が懸念されます。週末の利息後利益が0以下なら倒産します。現金や受取配当が十分でも、週末に元本を完済しても回避できません。</p>}
      {after.cashRisk && <p className="capital-warning" role="alert">週末の支払い資金が不足するおそれがあります。利益が黒字でも元本返済などの支払いで倒産するリスクがあります。</p>}
    </> : <p className="capital-warning">{selected.reason}</p>}
    {useBudget && <div className="capital-budget-result">
      {budgetError ? <p className="capital-warning" role="alert">{budgetError}</p> : <>
        <p className="capital-note">計画支出 <strong>{yen(spending)}</strong> ＋ 残す現金 <strong>{yen(reserve)}</strong> <button type="button" className="secondary capital-edit-budget" onClick={() => setBudgetExpanded(!budgetExpanded)} aria-expanded={budgetExpanded}>{budgetExpanded ? '計画額の編集を閉じる' : '計画額を編集'}</button></p>
        {selected.cashAfterBudget !== null && <p className="capital-note">この案なら、計画支出後に <strong>{yen(selected.cashAfterBudget)}</strong>（営業前の単純差額）。{(selected.budgetGap ?? 0) > 0 ? `留保も含めて、なお${yen(selected.budgetGap!)}不足します。` : '入力した支出と現金留保を賄えます。'}</p>}
      </>}
    </div>}
    <div className="capital-actions">
      {selected.action ? <button type="button" className="primary capital-submit" disabled={blocked || !selected.available} onClick={() => { if (selected.available && selected.action) onAction(selected.action); }}>{selectedId === 'borrow' ? `${Number.isFinite(borrowAmount) ? yen(borrowAmount) : '指定額'}を借り入れる` : labels.equity}</button> : <p className="capital-hold">調達せず、今の資金を使う方針です。</p>}
      {planningContext && onReturnToInvestment && <button type="button" className="secondary capital-return" disabled={disabled} onClick={onReturnToInvestment}>{planningContext.returnLabel}</button>}
    </div>
    <p className="capital-rule">借入中の週は「営業利益 − 利息」が0以下で倒産。調達後の投資では、固定費と手元に残す資金も確認してください。</p>
    <details className="capital-budget" open={budgetExpanded} onToggle={event => setBudgetExpanded(event.currentTarget.open)}>
      <summary>計画支出と残す現金を入力・編集</summary>
      <label className="capital-budget-toggle"><input type="checkbox" checked={useBudget} disabled={blocked} onChange={event => setUseBudget(event.target.checked)}/>予定する支出から、調達不足を計算する</label>
      {useBudget && <>
        <div className="capital-inputs">
          <label>計画する支出（円）<input type="number" min={0} step={100000} value={Number.isFinite(spending) ? spending : ''} disabled={blocked} onChange={event => setSpending(event.target.value === '' ? NaN : Number(event.target.value))}/></label>
          <label>支出後に残す現金（円）<input type="number" min={0} step={100000} value={Number.isFinite(reserve) ? reserve : ''} disabled={blocked} onChange={event => setReserve(event.target.value === '' ? NaN : Number(event.target.value))}/></label>
        </div>
        {!budgetError && <p className="capital-note">今の現金に対する不足額 <strong>{yen(gap ?? 0)}</strong>。{service !== 'exchange' && <button type="button" className="secondary" disabled={blocked || gap === null || gap < 100000 || gap > summary.availableCredit} onClick={() => { if (gap !== null) { setBorrowAmount(gap); setSelectedId('borrow'); } }}>不足額を借入希望額へ</button>}</p>}
      </>}
      <p className="capital-note">比較用のメモです。入力では投資を実行しません。取得条件と投資後の収支は、投資先の画面で再確認してください。</p>
    </details>
    {after && <details className="capital-details">
      <summary>調達条件を詳しく比べる</summary>
      <div className="capital-table-wrap"><table className="capital-table"><thead><tr><th scope="col">比較項目</th><th scope="col">今のまま</th><th scope="col">選んだ案</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody></table></div>
      <p className="capital-note">調達条件と確定した支払いを比較しています。将来の集客や営業利益は含めません。景況や店の運営で、週末に残る現金は変わります。</p>
      {selectedId === 'equity' && <p className="capital-note">IPOは既存株数の25%を新たに発行します。上場後の増資は10%ずつ、創業者持分20%が下限です。持分は会社の株の割合で、創業者個人の現金残高ではありません。</p>}
    </details>}
    {state.listed && <p className="capital-note">現在の配当は会社の現金を減らします。創業者個人の資産には還元されず、会社の成長資金を残す目的では配当0%が有利です。</p>}
  </section>;
}
