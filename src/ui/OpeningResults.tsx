import { ArrowUpRight, Coffee, MapPin } from 'lucide-react';
import type { GameState, OpeningRecord } from '../model';
import { OPENING_RECORD_LIMIT } from '../sim/openingJournal';
import './opening-results.css';

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const signedYen = (n: number) => `${n > 0 ? '+' : ''}${yen(n)}`;
const styles = { standard: '街角カフェ', premium: 'プレミアム', takeaway: 'テイクアウト' };

interface Props {
  state: GameState;
  mode?: 'latest' | 'history';
  reportWeeks?: number[];
  onSelectStore?: (lotId: string) => void;
  onViewStore?: (lotId: string) => void;
  onNavigate?: (tab: 'city' | 'stores' | 'finance') => void;
  onBrowseSites?: () => void;
  onContinue?: () => void;
}

function OpeningResult({ record, state, onSelectStore, onViewStore }: {
  record: OpeningRecord;
  state: GameState;
  onSelectStore?: (lotId: string) => void;
  onViewStore?: (lotId: string) => void;
}) {
  const result = record.result;
  const stillOperating = record.closedWeek === undefined && state.stores.some(store => store.id === record.storeId && store.lotId === record.lotId);
  const difference = result ? result.companyNetProfit - record.netProfitAfter : 0;
  const status = result ? `第${result.week}週に初決算` : record.closedWeek !== undefined ? '初営業前に閉店' : stillOperating ? '初決算前' : '初決算の記録なし';
  const profitClass = result ? result.storeProfit > 0 ? 'positive' : result.storeProfit < 0 ? 'negative' : undefined : undefined;

  return <article className="opening-result" aria-label={`${record.storeName}の出店記録`}>
    <header>
      <div><span className="eyebrow">第{record.decisionWeek}週 · {styles[record.style]}</span><h4>{record.storeName}</h4></div>
      <span className={`opening-result-status${result ? ' is-settled' : ''}`}>{status}</span>
    </header>
    {result ? <>
      <div className="opening-result-actual" aria-label={`第${result.week}週の店舗実績`}>
        <p className={`opening-result-outcome${profitClass ? ` ${profitClass}` : ''}`}>{result.storeProfit > 0 ? 'この店の初営業は黒字でした。' : result.storeProfit === 0 ? 'この店の初営業は収支が均衡しました。' : 'この店の初営業は赤字でした。'}</p>
        <dl className="opening-result-metrics opening-result-actual-metrics">
          <div><dt>初決算の店舗利益</dt><dd className={profitClass}>{yen(result.storeProfit)}</dd></div>
          <div><dt>初週の来店者数</dt><dd>{result.customers.toLocaleString('ja-JP')} <span>人</span></dd></div>
        </dl>
      </div>
      <p>客足・営業状況や出店後の変更によって、出店時の基準見込みと実績には差が出ます。</p>
      {!stillOperating && <p>この店は現在営業していません。初決算時の記録を表示しています。</p>}
    </> : record.closedWeek !== undefined ? <p>第{record.closedWeek}週、初めての営業を終える前に閉店しました。この店の営業実績はありません。</p> : stillOperating ? <p>営業を終えると、この店の初決算が記録されます。実績は客足・営業状況や出店後の変更で変わります。</p> : <p>この店の営業実績はまだ記録されていません。現在の運営店舗に該当する店がありません。</p>}
    {(onViewStore && stillOperating || onSelectStore) && <div className="opening-result-actions">
      {onViewStore && stillOperating && <button className="primary" onClick={() => onViewStore(record.lotId)}><MapPin size={15}/>店の様子を見る</button>}
      {onSelectStore && <button className="secondary" onClick={() => onSelectStore(record.lotId)}><Coffee size={15}/>{stillOperating ? 'この店の運営を見る' : 'この区画を見る'}</button>}
    </div>}
    <details className="opening-result-details">
      <summary>{result ? '出店時の基準見込み・支払いと比べる' : '出店時の基準見込み・支払いを確認'}</summary>
      <div className="opening-result-comparison">
        <span>出店時の全社純利益 · 基準見込み / 週</span>
        <strong>{yen(record.netProfitBefore)} → {yen(record.netProfitAfter)}</strong>
        <p>同じ週の基準見込みの前後差 {signedYen(record.netProfitAfter - record.netProfitBefore)}。既存店との競合・本部費・利息も含みます。</p>
      </div>
      {result ? <>
        <dl className="opening-result-metrics">
          <div><dt>開店後の初決算 · 全社純利益</dt><dd className={result.companyNetProfit > 0 ? 'positive' : result.companyNetProfit < 0 ? 'negative' : undefined}>{yen(result.companyNetProfit)}</dd></div>
          <div><dt>その週の全社現金増減</dt><dd>{signedYen(result.cashChange)}</dd></div>
          <div><dt>この店の週間利益 · 基準見込み → 初決算</dt><dd>{yen(record.initialStoreProfit)} → {yen(result.storeProfit)}</dd></div>
        </dl>
        <p>{difference !== 0 ? `出店時の全社基準見込みとの差は ${signedYen(difference)}。` : '出店時の全社基準見込みと一致。'} 全社決算は他店・契約・客足や営業状況の変動も含みます。</p>
      </> : <p>出店時のこの店の週間利益の基準見込みは {yen(record.initialStoreProfit)}。まだ営業実績ではありません。</p>}
      <dl className="opening-result-metrics">
        <div><dt>開業費用</dt><dd>{yen(record.openingCost)}</dd></div>
        <div><dt>出店後の運営店舗数</dt><dd>{record.companyStoreCount} 店舗</dd></div>
        <div><dt>支払い前の現金</dt><dd>{yen(record.cashBefore)}</dd></div>
        <div><dt>支払い後の現金</dt><dd>{yen(record.cashAfter)}</dd></div>
      </dl>
      <p>開業費用は出店時の現金から支払済みです。週間純利益から再び差し引く費用ではありません。</p>
    </details>
  </article>;
}

export default function OpeningResults({ state, mode = 'latest', reportWeeks, onSelectStore, onViewStore, onNavigate, onBrowseSites, onContinue }: Props) {
  const includedWeeks = new Set(reportWeeks ?? (state.lastReport ? [state.lastReport.week] : []));
  const records = [...(state.openingRecords ?? [])].reverse().filter(record => mode === 'history' || record.result !== undefined && includedWeeks.has(record.result.week));
  if (!records.length && mode === 'latest') return null;

  return <section className="opening-results" aria-label={mode === 'latest' ? '開店後の初決算' : '最近の出店記録'}>
    <div className="opening-results-heading"><Coffee size={22}/><div><h3>{mode === 'latest' ? '開店後の初決算' : '最近の出店記録'}</h3><p>{mode === 'latest' ? '最初の営業で、この店にどんな結果が出たかを確認しましょう。' : `最近${OPENING_RECORD_LIMIT}件までの出店と初決算。出店時点の記録です。`}</p></div></div>
    {!records.length ? <p className="opening-result-empty">出店記録はまだありません。記録機能の追加前に開いた店の見込み・初決算は、後から作成しません。</p> : <div className="opening-results-list">{records.map(record => <OpeningResult key={record.id} record={record} state={state} onSelectStore={onSelectStore} onViewStore={onViewStore}/>)}</div>}
    {records.length > 0 && !state.gameOver && (onBrowseSites || onNavigate || onContinue) && <div className="opening-result-actions">
      {(onBrowseSites || onNavigate) && <button className="secondary" onClick={() => onBrowseSites ? onBrowseSites() : onNavigate?.('city')}>次の出店候補を見る <ArrowUpRight size={15}/></button>}
      {onContinue && <button className="text-button" onClick={onContinue}>今の運営を続ける</button>}
    </div>}
  </section>;
}
