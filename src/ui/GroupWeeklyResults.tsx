import type { GameState } from '../model';
import './group-operations.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const signedYen = (value: number) => `${value > 0 ? '+' : ''}${yen(value)}`;
const policies = { growth: '成長に投資', stability: '変動を抑える' };

/** Only the immutable row from this settlement; current projects and forecasts are irrelevant. */
export default function GroupWeeklyResults({ state, onManageSector }: { state: GameState; onManageSector?: (sector: string) => void }) {
  const report = state.lastReport;
  const result = report?.marketOperation;
  if (!result || result.week !== report?.week) return null;
  const settledWeeks = result.week - result.startWeek + 1;
  const complete = result.week + 1 >= result.endWeek;
  return <details className="weekly-group-operation" data-market-operation-result={result.sector}>
    <summary>グループ事業計画の実績 · {result.sector} · {complete ? '26週完了' : `${settledWeeks} / 26週`}</summary>
    <p>{policies[result.policy]} · 第{result.week}週の確定した実績です。</p>
    <dl>
      <div><dt>グループ事業利益・計画実行中</dt><dd>{yen(result.operatingProfit)}</dd></div>
      <div><dt>同じ週に現状を維持した場合</dt><dd>{yen(result.baselineProfit)}</dd></div>
      <div><dt>今週の計画による差額・運営費込み</dt><dd className={result.profitDelta < 0 ? 'negative' : result.profitDelta > 0 ? 'positive' : undefined}>{signedYen(result.profitDelta)}</dd></div>
      <div><dt>今週の計画運営費・計上済み</dt><dd>{yen(result.weeklyCost)}</dd></div>
    </dl>
    <p>差額は同じ景況・個別業績で計画の有無を比較した事業収支です。全社の前週差とは別です。初回支払は開始時に現金から支払い、今週の利益から再び引きません。</p>
    {complete ? <p>26週の計画が終了しました。通常運営へ戻り、自動更新しません。</p> : <p>第{result.endWeek}週に通常運営へ戻ります。</p>}
    {onManageSector && <button type="button" className="text-button" onClick={() => onManageSector(result.sector)}>この業種を確認</button>}
  </details>;
}
