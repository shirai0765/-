import { Landmark, TrendingUp } from 'lucide-react';
import type { GameAction, GameState } from '../model';
import { getSummary } from '../sim/engine';
import CapitalPlanningPanel from './CapitalPlanningPanel';
import './financial-services.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

interface Props {
  kind: 'bank' | 'exchange';
  state: GameState;
  onAction: (action: GameAction) => void;
  onMarket: (section: 'investment' | 'acquisitions') => void;
  disabled?: boolean;
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
        <span>{index === 0 ? `営業中 ${state.stores.length} / 3店舗` : index === 1 ? `累計黒字 ${state.profitableWeeks} / 12週` : index === 2 ? `純資産 ${yen(summary.netWorth)} / 2,000万円` : '現在の営業計画が黒字の審査基準を満たす'}</span>
        <small>{requirement.met ? '達成' : '準備中'}</small>
      </li>)}</ul>
      <p>物件の購入や店長の雇用は上場の必須条件ではありません。</p>
    </section> : <dl className="service-balances">
      <div><dt>自社株価</dt><dd>{yen(state.sharePrice)}</dd></div>
      <div><dt>創業者持分</dt><dd>{(summary.ownership * 100).toFixed(1)}%</dd></div>
      <div><dt>発行済株式</dt><dd>{state.sharesOutstanding.toLocaleString('ja-JP')}株</dd></div>
    </dl>}
    <CapitalPlanningPanel state={state} onAction={onAction} disabled={locked} service={kind}/>
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
