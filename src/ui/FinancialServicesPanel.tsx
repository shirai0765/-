import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Landmark, TrendingUp } from 'lucide-react';
import type { GameAction, GameState } from '../model';
import { getSummary } from '../sim/engine';
import { isLoanApplicationCurrent, screenLoanApplication, type LoanApplication } from '../sim/loanApplication';
import CapitalPlanningPanel from './CapitalPlanningPanel';
import './financial-services.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

interface Props {
  kind: 'bank' | 'exchange';
  state: GameState;
  onAction: (action: GameAction) => boolean | void;
  onMarket: (section: 'investment' | 'acquisitions') => void;
  disabled?: boolean;
}

const amountPresets = [100_000, 1_000_000, 3_000_000, 5_000_000];
const termPresets = [13, 26, 52, 104, 260];

function BankApplicationPanel({ state, onAction, disabled = false }: Pick<Props, 'state' | 'onAction' | 'disabled'>) {
  const [amount, setAmount] = useState(3_000_000);
  const [weeks, setWeeks] = useState(52);
  const [review, setReview] = useState<LoanApplication | null>(null);
  const [submission, setSubmission] = useState<{ before: GameState; amount: number; weeks: number; annualRate: number; status: 'pending' | 'submitted' | 'rejected' } | null>(null);
  const proposal = useMemo(() => screenLoanApplication(state, amount, weeks), [state, amount, weeks]);
  const quote = proposal.quote;
  const locked = disabled || state.gameOver;
  const currentReview = isLoanApplicationCurrent(review, state, amount, weeks);
  const approved = currentReview && review?.approved;
  const actualNewLoan = submission && state.loans.some(loan =>
    !submission.before.loans.some(previous => previous.id === loan.id)
    && loan.principal === submission.amount && loan.annualRate === submission.annualRate);
  const submitted = submission?.status === 'submitted' || (submission?.status === 'pending' && actualNewLoan);
  const showReceipt = submission !== null && submission.status !== 'rejected';
  const phase = showReceipt ? 'receipt' : approved ? 'contract' : currentReview ? 'review' : 'quote';
  const phaseHeading = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(phase);
  useLayoutEffect(() => {
    if (previousPhase.current === phase) return;
    previousPhase.current = phase;
    phaseHeading.current?.focus({ preventScroll: true });
    phaseHeading.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [phase]);
  const changeAmount = (value: number) => { setAmount(value); setReview(null); setSubmission(null); };
  const changeWeeks = (value: number) => { setWeeks(value); setReview(null); setSubmission(null); };

  const confirmBorrowing = () => {
    if (locked || !approved || !quote) return;
    // Recheck current company conditions immediately before the only durable action.
    const latest = screenLoanApplication(state, amount, weeks);
    if (!latest.approved || latest.quote?.annualRate !== review?.quote?.annualRate) {
      setReview(latest);
      return;
    }
    setReview(null);
    const result = onAction(latest.action);
    setSubmission({ before: state, amount, weeks, annualRate: latest.quote!.annualRate, status: result === true ? 'submitted' : result === false ? 'rejected' : 'pending' });
  };

  return <section className="card bank-application" aria-label="銀行の借入相談" data-loan-step={phase}>
    <span className="eyebrow">BANK LOAN</span><h3 ref={phaseHeading} tabIndex={-1}>{showReceipt ? '借入契約の確認' : currentReview ? '融資審査の結果' : '借りる金額と、返済期間を選ぶ'}</h3>
    <ol className="bank-steps" aria-label="借入の手順">
      <li data-current={!currentReview && !showReceipt}>1 条件を選ぶ</li><li data-current={currentReview && !approved}>2 融資審査</li><li data-current={Boolean(approved) || showReceipt}>3 契約・入金</li>
    </ol>
    {!currentReview && !showReceipt && <>
    <p className="bank-note">金額と利息を確認して、融資審査へ進みます。審査だけでは借入を実行しません。</p>
    <fieldset className="bank-settings" disabled={locked}>
      <legend>借入希望額</legend>
      <div className="bank-presets" role="group" aria-label="借入希望額の候補">{amountPresets.map(value => <button type="button" className="secondary" key={value} aria-pressed={amount === value} onClick={() => changeAmount(value)}>{(value / 10_000).toLocaleString('ja-JP')}万円</button>)}</div>
      <label>借入希望額（円）<input type="number" min={100000} step={1} inputMode="numeric" value={Number.isFinite(amount) ? amount : ''} onChange={event => changeAmount(event.target.value === '' ? NaN : Number(event.target.value))}/></label>
      <p className="bank-note">最低10万円 · 追加の借入枠 <strong>{yen(proposal.availableCredit)}</strong>。希望額は自由に入力できます。</p>
    </fieldset>
    <fieldset className="bank-settings" disabled={locked}>
      <legend>元本の返済期間</legend>
      <div className="bank-presets bank-term-presets" role="group" aria-label="返済期間の候補">{termPresets.map(value => <button type="button" className="secondary" key={value} aria-pressed={weeks === value} onClick={() => changeWeeks(value)}>{value}週</button>)}</div>
      <label>元本の返済期間（週）<input type="number" min={13} max={260} step={1} inputMode="numeric" value={Number.isFinite(weeks) ? weeks : ''} onChange={event => changeWeeks(event.target.value === '' ? NaN : Number(event.target.value))}/></label>
      <p className="bank-note">13〜260週。長い期間ほど毎週の元本返済は減り、利息総額は増えます。</p>
    </fieldset>
    {quote ? <section className="bank-quote" aria-label="選んだ借入の利息と返済" data-loan-quote>
      <div className="bank-quote-heading"><h4>この条件で借りると</h4><span>{quote.weeks}週返済</span></div>
      <dl className="bank-quote-values">
        <div className="bank-quote-emphasis"><dt>契約の年利</dt><dd data-loan-field="annual-rate">{(quote.annualRate * 100).toFixed(2)}%</dd></div>
        <div className="bank-quote-emphasis"><dt>追加の初週支払（元本＋利息）</dt><dd data-loan-field="initial-payment">{yen(quote.initialPayment)}</dd></div>
        <div className="bank-quote-emphasis"><dt>利息総額 / 満期まで</dt><dd data-loan-field="total-interest">{yen(quote.totalInterest)}</dd></div>
      </dl>
      <p className="bank-note">利息は残っている元本にかかり、返済につれて減ります。</p>
      <details className="bank-payment-details"><summary>支払額と計算の詳細</summary>
        <dl className="bank-payment-values">
          <div><dt>借りる元本</dt><dd>{yen(quote.amount)}</dd></div>
          <div><dt>追加の初週利息</dt><dd data-loan-field="initial-interest">{yen(quote.initialInterest)}</dd></div>
          <div><dt>追加の元本返済 / 初週</dt><dd data-loan-field="weekly-principal">{yen(quote.initialPrincipalPayment)}</dd></div>
          <div><dt>返済総額（元本＋利息）</dt><dd>{yen(quote.totalPayments)}</dd></div>
          <div><dt>調達直後の手元資金</dt><dd>{yen(quote.cashAfterBorrowing)}</dd></div>
          <div><dt>調達直後の借入残高</dt><dd>{yen(quote.debtAfterBorrowing)}</dd></div>
        </dl>
        <p className="bank-note">元本均等返済です。年利は現在の借入残高と企業価値で決まります。表示額は満期まで予定どおり返済し、追加借入・一括返済をしない場合の追加支払額です。利息と元本はそれぞれ全契約を合算し、毎週1円単位に四捨五入します。元本の支払合計と契約額には端数の差が生じる場合があります。</p>
      </details>
    </section> : <p className="bank-note bank-invalid-quote">金額と期間を選び、審査で借入できる条件を確認してください。</p>}
    <button type="button" className="primary bank-screen" disabled={locked} onClick={() => { setReview(screenLoanApplication(state, amount, weeks)); setSubmission(null); }}>この条件で融資審査する</button>
    {review && !currentReview && <p className="bank-review-stale" role="status">会社の状態が変わりました。現在の条件で、もう一度審査してください。</p>}
    </>}
    {currentReview && review && <section className={'bank-review ' + (review.approved ? 'bank-approved' : 'bank-declined')} data-loan-review={review.approved ? 'approved' : 'declined'} aria-label="融資審査の結果" aria-live="polite">
      <h4>{review.approved ? '審査通過 · 契約できます' : '審査不通過 · 条件を見直してください'}</h4>
      {review.approved ? <p className="bank-note">借入はまだ実行していません。下の契約ボタンで入金します。</p> : review.checks.filter(check => !check.passed).map(check => <p className="bank-decline-reason" key={check.id}>{check.detail}</p>)}
      {review.approved && quote && <>
        <dl className="bank-contract-values">
          <div><dt>借りる元本</dt><dd>{yen(quote.amount)}</dd></div>
          <div><dt>年利</dt><dd data-loan-field="annual-rate">{(quote.annualRate * 100).toFixed(2)}%</dd></div>
          <div><dt>返済期間</dt><dd>{quote.weeks}週</dd></div>
          <div><dt>追加の初週支払</dt><dd data-loan-field="initial-payment">{yen(quote.initialPayment)}</dd></div>
        </dl>
        <p className="bank-contract-summary">契約後の手元資金 {yen(quote.cashAfterBorrowing)} · 借入残高 {yen(quote.debtAfterBorrowing)}</p>
        <button type="button" className="primary bank-confirm" data-loan-confirm disabled={locked} onClick={confirmBorrowing}>契約して{yen(quote.amount)}を借りる</button>
      </>}
      {!review.approved && <div className="bank-alternative">
        {(!Number.isSafeInteger(amount) || amount < 100_000) && review.availableCredit >= 100_000 && <button type="button" className="secondary" disabled={locked} onClick={() => changeAmount(100_000)}>最低額の10万円で見直す</button>}
        {Number.isSafeInteger(amount) && amount > review.availableCredit && review.availableCredit >= 100_000 && <button type="button" className="secondary" disabled={locked} onClick={() => changeAmount(Math.floor(review.availableCredit))}>借入枠の{yen(review.availableCredit)}で見直す</button>}
        {(!Number.isInteger(weeks) || weeks < 13 || weeks > 260) && <button type="button" className="secondary" disabled={locked} onClick={() => changeWeeks(52)}>52週返済で見直す</button>}
        {review.availableCredit < 100_000 && <p className="bank-note">借入枠が最低額の10万円に届いていません。既存借入の返済などで枠が変わった後に、再度確認できます。</p>}
      </div>}
      <button type="button" className="secondary bank-edit" onClick={() => { setReview(null); setSubmission(null); }}>条件を変更する</button>
      <details className="bank-screening-details"><summary>審査項目と判定理由</summary><ul>{review.checks.map(check => <li key={check.id} data-passed={check.passed}><span className="bank-check-mark" aria-hidden="true">{check.passed ? '✓' : '×'}</span><div><strong>{check.label} · {check.passed ? '適合' : '不適合'}</strong><p>{check.detail}</p></div></li>)}</ul></details>
    </section>}
    {submission && <p className="bank-submission" role="status">{submitted ? `${yen(submission.amount)}の借入契約を実行しました。契約と返済は下で確認できます。` : submission.status === 'rejected' ? '借入を実行できませんでした。現在の条件でもう一度審査してください。' : '借入の実行結果を確認しています。契約一覧に反映されるまでお待ちください。'}</p>}
    {showReceipt && submitted && <button type="button" className="secondary bank-edit" disabled={locked} onClick={() => { setSubmission(null); setReview(null); }}>新しい借入を相談する</button>}
    <p className="bank-rule">借入中の週は、営業利益から利息を引いた利益が0以下で倒産します。審査通過は将来の黒字を保証しません。元本返済は手元資金から支払います。</p>
  </section>;
}

/** City services navigate to ordinary financing actions; visiting costs nothing. */
export default function FinancialServicesPanel({ kind, state, onAction, onMarket, disabled = false }: Props) {
  const summary = getSummary(state);
  const locked = disabled || state.gameOver;
  return <section className="financial-service" data-financial-service={kind}>
    <header className="financial-service-intro">
      {kind === 'bank' ? <Landmark size={28} aria-hidden="true"/> : <TrendingUp size={28} aria-hidden="true"/>}
      <div><h3>{kind === 'bank' ? '借入と返済の窓口' : state.listed ? '資本市場で、次の成長へ' : 'あなたの会社を株式市場へ'}</h3>
        <p>{kind === 'bank' ? '資金を借りる前に、利息と毎週の返済額を確認できます。' : '上場・増資と、ほかの企業への投資をここから行えます。'}</p></div>
    </header>
    {kind === 'bank' ? <dl className="service-balances">
      <div><dt>手元資金</dt><dd>{yen(state.cash)}</dd></div>
      <div><dt>借入残高</dt><dd>{yen(summary.debt)}</dd></div>
      <div><dt>追加の借入枠</dt><dd>{yen(summary.availableCredit)}</dd></div>
    </dl> : !state.listed ? <section className="service-listing-conditions" aria-label="上場の条件">
      <h4>上場までの準備</h4>
      <ul>{summary.ipoRequirements.map((requirement, index) => <li key={index} data-met={requirement.met}>
        <span aria-hidden="true">{requirement.met ? '✓' : '○'}</span>
        <span>{index === 0 ? `営業中 ${state.stores.length} / 3店舗` : index === 1 ? `累計黒字 ${state.profitableWeeks} / 12週` : index === 2 ? `純資産 ${yen(summary.netWorth)} / 2,000万円` : state.lastReport ? `直近の決算が黒字：第${state.lastReport.week}週・利息後 ${yen(state.lastReport.netProfit)}` : '直近の決算が黒字：営業実績は未記録'}</span>
        <small>{requirement.met ? '達成' : '準備中'}</small>
      </li>)}</ul>
      <p>物件の購入や店長の雇用は上場の必須条件ではありません。</p>
    </section> : <dl className="service-balances">
      <div><dt>自社株価</dt><dd>{yen(state.sharePrice)}</dd></div>
      <div><dt>創業者持分</dt><dd>{(summary.ownership * 100).toFixed(1)}%</dd></div>
      <div><dt>発行済株式</dt><dd>{state.sharesOutstanding.toLocaleString('ja-JP')}株</dd></div>
    </dl>}
    {kind === 'bank' ? <BankApplicationPanel state={state} onAction={onAction} disabled={locked}/> : <CapitalPlanningPanel state={state} onAction={onAction} disabled={locked} service={kind}/>}
    {kind === 'bank' ? <section className="service-loans" aria-label="借入契約">
      <h3>借入契約と返済</h3>
      {!state.loans.length ? <p className="muted">現在の借入はありません。</p> : state.loans.map(loan => <article key={loan.id}>
        <div><strong>{yen(loan.remaining)}</strong><p>年利 {(loan.annualRate * 100).toFixed(2)}% · 残り{loan.weeksLeft}週</p></div>
        <button type="button" className="secondary" disabled={locked || state.cash < loan.remaining} onClick={() => onAction({ type: 'repayLoan', loanId: loan.id })}>一括返済</button>
      </article>)}
    </section> : <nav className="service-market-links" aria-label="市場でできること">
      <button type="button" className="secondary" onClick={() => onMarket('investment')}>他社の株式に投資する</button>
      <button type="button" className="secondary" onClick={() => onMarket('acquisitions')}>企業の買収を検討する</button>
    </nav>}
  </section>;
}
