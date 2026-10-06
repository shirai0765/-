import type { StoreAccount, StoreWeeklyCosts, WeeklyReport } from '../model';
import './store-settlement-breakdown.css';

interface Props {
  week: number;
  result: WeeklyReport['storeResults'][number];
  account?: StoreAccount;
}

const yen = (value: number) => `${value.toLocaleString('ja-JP')}円`;
const costLabels: Record<keyof StoreWeeklyCosts, string> = {
  ingredients: '材料費',
  fulfilment: '包装・決済など',
  labor: '従業員の人件費',
  rent: '家賃',
  equipment: '店舗・設備の維持費',
  marketing: '広告費',
  manager: '店長費',
};
const costKeys = Object.keys(costLabels) as (keyof StoreWeeklyCosts)[];

/** Historical amounts come only from this report's matching settlement account. */
export default function StoreSettlementBreakdown({ week, result, account }: Props) {
  const recorded = account?.storeId === result.id ? account : undefined;
  const expenseTotal = recorded
    ? costKeys.reduce((sum, key) => sum + recorded.costs[key], 0) + recorded.roundingAdjustment
    : null;
  return <details className="store-settlement-breakdown" data-store-id={result.id}>
    <summary>この週の売上と費用</summary>
    {!recorded ? <p className="store-settlement-note">この週の費用内訳は記録されていません。</p> : <>
      <p className="store-settlement-note">第{week}週に確定した、この店の内訳です。</p>
      {result.profit < 0 && <p className="store-settlement-loss">この週は店舗費用が売上を{yen(-result.profit)}上回りました。</p>}
      {result.profit === 0 && <p className="store-settlement-note">売上と店舗費用が同額でした。</p>}
      <dl className="store-settlement-costs">
        <div className="store-settlement-total"><dt>売上</dt><dd>{yen(result.revenue)}</dd></div>
        {costKeys.map(key => <div key={key}><dt>{costLabels[key]}</dt><dd>{yen(recorded.costs[key])}</dd></div>)}
        {recorded.roundingAdjustment !== 0 && <div><dt>円単位の調整</dt><dd>{recorded.roundingAdjustment > 0 ? '+' : ''}{yen(recorded.roundingAdjustment)}</dd></div>}
        <div className="store-settlement-total"><dt>店舗費用合計</dt><dd>{yen(expenseTotal!)}</dd></div>
        <div className="store-settlement-total"><dt>店舗利益</dt><dd className={result.profit < 0 ? 'negative' : result.profit > 0 ? 'positive' : undefined}>{yen(result.profit)}</dd></div>
      </dl>
      {recorded.roundingAdjustment !== 0 && <p className="store-settlement-note">円単位の調整は内訳の丸め差です。追加の支払いではありません。</p>}
      <p className="store-settlement-note">本部費・利息、開業・改装・設備増強の支出は、この店舗費用には含みません。</p>
    </>}
  </details>;
}
