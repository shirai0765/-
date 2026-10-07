import { useEffect, useRef, useState } from 'react';
import type { GameState, OpeningRecord } from '../model';
import StoreSettlementBreakdown from './StoreSettlementBreakdown';
import GroupWeeklyResults from './GroupWeeklyResults';
import './weekly-results.css';

export interface WeeklyResultsProps {
  state: GameState;
  onManageStore?: (lotId: string) => void;
  onViewStore?: (lotId: string) => void;
  onBrowseSites?: () => void;
  onContinue?: () => void;
  onFinance?: () => void;
  onManageSector?: (sector: string) => void;
  /** The full-view review supplies its own concise settlement summary. */
  mode?: 'full' | 'details';
}

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const signedYen = (value: number) => `${value > 0 ? '+' : ''}${yen(value)}`;
const outcomeClass = (value: number) => value > 0 ? 'positive' : value < 0 ? 'negative' : '';

// Presentation memory only: reopening a settled report must not replay its reveal.
const revealedReports = new Set<string>();
export function recordedSettlement(state: GameState) {
  const report = state.lastReport;
  if (!report) return null;
  const settled = state.history.find(point => point.week === report.week);
  const previous = state.history.find(point => point.week === report.week - 1);
  return {
    profit: report.netProfit,
    cashChange: report.cashChange,
    cash: settled?.cash ?? null,
    profitDifference: previous ? report.netProfit - previous.profit : null,
  };
}

function useSettlementReveal(key: string, profit: number, cashChange: number, cash: number | null) {
  const reduceMotion = () => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const final = { profit, cashChange, cash };
  const initial = { profit: 0, cashChange: 0, cash: cash === null ? null : cash - cashChange };
  const [display, setDisplay] = useState(() => revealedReports.has(key) || reduceMotion() ? final : initial);
  const decision = useRef<{ key: string; animate: boolean } | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (decision.current?.key !== key) decision.current = { key, animate: !revealedReports.has(key) && !media.matches };
    revealedReports.add(key);
    if (revealedReports.size > 200) revealedReports.delete(revealedReports.values().next().value!);
    if (!decision.current.animate || media.matches) { setDisplay({ profit, cashChange, cash }); return; }
    let frame = 0;
    let started: number | null = null;
    let stopped = false;
    setDisplay({ profit: 0, cashChange: 0, cash: cash === null ? null : cash - cashChange });
    const finish = () => { stopped = true; cancelAnimationFrame(frame); setDisplay({ profit, cashChange, cash }); };
    const tick = (time: number) => {
      if (stopped) return;
      started ??= time;
      const progress = Math.min(1, (time - started) / 800);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay({
        profit: Math.round(profit * eased),
        cashChange: Math.round(cashChange * eased),
        cash: cash === null ? null : Math.round(cash - cashChange + cashChange * eased),
      });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const onMotionChange = () => { if (media.matches) finish(); };
    frame = requestAnimationFrame(tick);
    media.addEventListener('change', onMotionChange);
    return () => { stopped = true; cancelAnimationFrame(frame); media.removeEventListener('change', onMotionChange); };
  }, [key, profit, cashChange, cash]);
  return display;
}

/** All three amounts come from this settlement, even after later spending. */
export function WeeklySettlementSummary({ state }: { state: GameState }) {
  const report = state.lastReport;
  const recorded = recordedSettlement(state);
  if (!report || !recorded) return null;
  return <SettlementSummary key={`${state.id}:${report.week}`} reportKey={`${state.id}:${report.week}`} report={report} recorded={recorded}/>;
}

function SettlementSummary({ reportKey, report, recorded }: {
  reportKey: string;
  report: NonNullable<GameState['lastReport']>;
  recorded: NonNullable<ReturnType<typeof recordedSettlement>>;
}) {
  const display = useSettlementReveal(reportKey, recorded.profit, recorded.cashChange, recorded.cash);
  const outcome = report.netProfit > 0 ? '黒字で営業を終えました' : report.netProfit < 0 ? '赤字の決算です' : '収支は均衡しました';
  return <div className="weekly-results-company">
    <div className="weekly-results-profit">
      <span>今週の全社純利益</span>
      <strong className={outcomeClass(report.netProfit)} aria-label={`全社純利益 ${yen(report.netProfit)}`} data-profit-complete={display.profit === report.netProfit}>
        <span aria-hidden="true">{yen(display.profit)}</span>
      </strong>
      <small>{outcome}{recorded.profitDifference !== null ? ` · 前週比 ${signedYen(recorded.profitDifference)}` : ''}</small>
    </div>
    <dl className="weekly-results-cash">
      <div><dt>この決算の現金増減</dt><dd className={outcomeClass(report.cashChange)} aria-label={signedYen(report.cashChange)} data-cash-change-complete={display.cashChange === report.cashChange}><span aria-hidden="true">{signedYen(display.cashChange)}</span></dd></div>
      <div><dt>決算後の手元資金</dt><dd aria-label={recorded.cash === null ? '記録なし' : yen(recorded.cash)} data-cash-complete={display.cash === recorded.cash}><span aria-hidden="true">{display.cash === null ? '記録なし' : yen(display.cash)}</span></dd></div>
    </dl>
    <p className="weekly-results-customers">今週は <strong>{report.customers.toLocaleString('ja-JP')}人</strong> が来店しました。</p>
  </div>;
}

function OpeningComparison({ record }: { record: OpeningRecord }) {
  return <details className="weekly-opening-comparison">
    <summary>出店時の支払い</summary>
    <dl>
      <div><dt>開業費・支払済み</dt><dd>{yen(record.openingCost)}</dd></div>
      <div><dt>開業費支払後の現金</dt><dd>{yen(record.cashAfter)}</dd></div>
    </dl>
    <p>第{record.decisionWeek}週に支払った開業費です。この週の利益から再び差し引くことはありません。</p>
  </details>;
}

/** Settled reports only. Never recalculates a forecast or infers a setting's effect. */
export default function WeeklyResults({ state, onManageStore, onViewStore, onBrowseSites, onContinue, onFinance, onManageSector, mode = 'full' }: WeeklyResultsProps) {
  const report = state.lastReport;
  if (!report) return null;
  const previous = state.history.find(point => point.week === report.week - 1);
  const firstResults = new Map((state.openingRecords ?? [])
    .filter(record => record.result?.week === report.week)
    .map(record => [record.storeId, record]));

  return <section className="weekly-results" aria-label={`第${report.week}週の営業結果`}>
    {mode === 'full' && <WeeklySettlementSummary state={state}/>}

    {report.storeResults.length > 0 && <details className="weekly-stores" aria-label="店舗の営業結果">
      <summary>店舗ごとの実績 · {report.storeResults.length}店</summary>
      <p className="weekly-results-note">店舗利益は本部費・利息などを除いた実績です。</p>
      <div className="weekly-store-list">{report.storeResults.map(result => {
        const store = state.stores.find(candidate => candidate.id === result.id);
        const opening = firstResults.get(result.id);
        const recordedName = (state.openingRecords ?? []).find(record => record.storeId === result.id)?.storeName;
        const name = store?.name ?? recordedName ?? '営業を終えた店舗';
        return <article className="weekly-store" key={result.id} data-store-id={result.id} aria-label={`${name}の営業実績`}>
          <header><h4>{name}</h4>{!store ? <span className="weekly-store-badge">閉店済み</span> : opening ? <span className="weekly-store-badge">初営業</span> : null}</header>
          <dl className="weekly-store-metrics">
            <div><dt>店舗利益</dt><dd className={outcomeClass(result.profit)}>{yen(result.profit)}</dd></div>
            <div><dt>来店者数</dt><dd>{result.customers.toLocaleString('ja-JP')}<small>人</small></dd></div>
            <div><dt>満足度</dt><dd>{Math.round(result.satisfaction)}<small> / 100</small></dd></div>
          </dl>
          <StoreSettlementBreakdown week={report.week} result={result} account={report.storeAccounts?.find(account => account.storeId === result.id)}/>
          <div className="weekly-store-actions">
            {onManageStore && <button type="button" className="secondary" disabled={!store || state.gameOver} onClick={() => store && onManageStore(store.lotId)}>この店を調整</button>}
            {onViewStore && <button type="button" className="text-button" disabled={!store} onClick={() => store && onViewStore(store.lotId)}>店の様子を見る</button>}
          </div>
          {opening && <OpeningComparison record={opening}/>}
        </article>;
      })}</div>
    </details>}

    <GroupWeeklyResults state={state} onManageSector={onManageSector}/>

    <details className="weekly-results-detail">
      <summary>全社の収支・今週の出来事</summary>
      <dl>
        <div><dt>週間売上</dt><dd>{yen(report.revenue)}</dd></div>
        <div><dt>営業利益</dt><dd>{yen(report.operatingProfit)}</dd></div>
        <div><dt>利息</dt><dd>{yen(report.interest)}</dd></div>
        <div><dt>借入元本の返済</dt><dd>{yen(report.loanRepayment)}</dd></div>
        <div><dt>受取配当</dt><dd>{yen(report.dividendsReceived)}</dd></div>
        <div><dt>支払配当</dt><dd>{yen(report.dividendsPaid)}</dd></div>
        {previous && <div><dt>週間売上の前週差</dt><dd>{signedYen(report.revenue - previous.revenue)}</dd></div>}
      </dl>
      <p>全社純利益は営業利益から利息を引いた実績です。現金増減には元本返済・配当・契約満了時の回収なども含みます。週の途中の開業費や資金調達とは別です。</p>
      <p>{previous ? '前週差は全社の実績の比較です。設定や店舗構成、客足なども変わるため、ひとつの操作の効果とは限りません。' : '比較できる前週の会社実績はありません。'}</p>
      {report.headlines.length > 0 && <ul className="weekly-results-headlines">{report.headlines.map((headline, index) => <li key={index}>{headline}</li>)}</ul>}
      {onFinance && <button type="button" className="text-button" onClick={onFinance}>財務を見る</button>}
    </details>
    {(onBrowseSites || onContinue) && <div className="weekly-results-actions">
      {onContinue && <button type="button" className="primary" onClick={onContinue}>街に戻る</button>}
      {onBrowseSites && !state.gameOver && <button type="button" className="secondary" onClick={onBrowseSites}>次の出店候補を見る</button>}
    </div>}
  </section>;
}
