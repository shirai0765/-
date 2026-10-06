import type { StoreOperatingInsight } from '../sim/engine';
import { StoreStaffCapacityNote, formatStoreEstimateRange } from './StorePlanFeedback';
import './store-operating-insight.css';

interface Props {
  insight: StoreOperatingInsight | null;
  storeName: string;
  reasonsId?: string;
}

const number = (value: number) => Math.round(value).toLocaleString('ja-JP');
const yen = (value: number) => `${number(value)}円`;
const costLabels: Record<keyof StoreOperatingInsight['costs'], string> = {
  ingredients: '材料費',
  fulfilment: '包装・決済など',
  labor: '従業員の人件費',
  rent: '家賃',
  equipment: '店舗・設備の維持費',
  marketing: '広告費',
  manager: '店長費',
};

/** Read-only explanation of the current plan; never stores a previous forecast or runs an action. */
export function StoreOperatingInsightPanel({ insight, storeName, reasonsId }: Props) {
  if (!insight) return null;
  const { flow, result, resultRange, costs, effectiveSettings: effective, context } = insight;
  const nearDisplayedFlow = Math.round(flow.demand) === Math.round(flow.capacity) || Math.round(Math.abs(flow.demand - flow.capacity)) === 0;
  const capacityLimited = flow.demand > flow.capacity;
  const diagnosis = nearDisplayedFlow
    ? '需要と対応上限が近い状態です。'
    : capacityLimited
      ? '来店需要が、対応できる上限を上回る見込みです。'
      : '来店需要に対して、対応する余力があります。';
  const costEntries = Object.entries(costs) as [keyof typeof costs, number][];
  const managerChanged = (['price', 'staff', 'quality', 'marketing'] as const)
    .some(key => insight.inputSettings[key] !== effective[key]);
  return <details className="store-operating-insight" aria-label={`${storeName}の今週の運営見込み`} data-store-id={insight.storeId}>
    <summary>集客・費用の見込み</summary>
    <div className="store-insight-content">
    <header className="store-insight-heading">
      <h4>{storeName}</h4>
      <span>第{insight.week}週の目安</span>
    </header>
    <dl className="store-insight-result store-forecast">
      <div>
        <dt>利益見込み <span>／週</span></dt>
        <dd>{formatStoreEstimateRange(resultRange.profit, 1000)}円</dd>
      </div>
    </dl>
    <p className="store-insight-note">客足や営業状況により変動します。実績は週末に確定します。</p>
    <p className="store-insight-diagnosis">{diagnosis}</p>
    <dl className="store-insight-flow" aria-label="今週の集客と対応上限の目安">
      <div><dt>需要の目安</dt><dd><small>約</small>{number(Math.round(flow.demand / 10) * 10)}<small>人／週</small></dd></div>
      <div><dt>対応上限の目安</dt><dd><small>約</small>{number(Math.round(flow.capacity / 10) * 10)}<small>人／週</small></dd></div>
      <div><dt>来店人数の見込み</dt><dd>{formatStoreEstimateRange(resultRange.customers, 10)}<small>人／週</small></dd></div>
    </dl>
    {effective.staff > context.staffCapacityLimit && <p className="store-insight-note store-insight-staff-limit">
      設備の対応人数を超えています。超過分も人件費はかかります。
    </p>}
    {!effective.manager && context.founderCapacity < 1 && <p className="store-insight-note store-insight-founder">
      自主管理の店舗数により、対応上限が下がっています。
    </p>}
    <div className="store-insight-satisfaction">
      <dl><div><dt>満足度の目安</dt><dd>{formatStoreEstimateRange(resultRange.satisfaction)}<span>／100</span></dd></div></dl>
    </div>
    <p className="store-insight-note store-insight-short-scope">本部費・利息などを除く、店舗の利益です。</p>

    {effective.manager && <div className="store-insight-manager" aria-label="今週の店長案">
      <h5>今週の店長案</h5>
      <p className="store-insight-note">{managerChanged ? '見込みには次の調整後の設定を使っています。' : '今週は入力と同じ設定を使う見込みです。'} 店長費は従業員の人件費と別に{yen(costs.manager)}／週です。</p>
      <dl className="store-insight-manager-settings">
        <div><dt>価格</dt><dd>{yen(effective.price)}</dd></div>
        <div><dt>従業員数</dt><dd>{effective.staff}人</dd></div>
        <div><dt>品質</dt><dd>{effective.quality}</dd></div>
        <div><dt>広告費</dt><dd>{yen(effective.marketing)}／週</dd></div>
      </dl>
    </div>}

    <details className="store-insight-costs" id={reasonsId}>
      <summary>見込みの理由・費用の目安</summary>
      <StoreStaffCapacityNote insight={insight}/>
      {!nearDisplayedFlow && <p className="store-insight-note store-insight-flow-note">
        {capacityLimited
          ? `上限を超える需要の目安は約${number(flow.unservedDemand)}人です。集客が増えても、今の上限では客数が増えない場合があります。`
          : `対応の余力は約${number(flow.unusedCapacity)}人です。増員だけでは来店需要は増えません。`}
      </p>}
      <p className="store-insight-note">満足度には価格・品質・混雑などが影響します。品質は材料費にも関わります。</p>
      <p className="store-insight-note store-insight-reputation">会社の信用は、全店の平均満足度と会社の利益をもとに週末に更新されます。この店の満足度だけでは上昇は決まりません。</p>
      <dl className="store-insight-cost-list">
        <div className="store-insight-cost-total"><dt>売上の見込み</dt><dd>{formatStoreEstimateRange(resultRange.revenue, 1000)}円</dd></div>
        {costEntries.map(([key, value]) => <div key={key}><dt>{costLabels[key]}</dt><dd>{yen(value)}</dd></div>)}
        <div className="store-insight-cost-total"><dt>店舗費用合計の目安</dt><dd>約{yen(Math.round((result.revenue - result.profit) / 1000) * 1000)}</dd></div>
      </dl>
      <p className="store-insight-note">費用内訳は今の設定をもとにした目安です。材料費・包装費などは実際の来店人数で変わります。</p>
      {context.ownsProperty && <p className="store-insight-note store-insight-owned-property">自社物件のため家賃は0円です。保有物件の維持費は全社の収支で別に差し引きます。</p>}
      {effective.manager && insight.delegationBudget !== null && <p className="store-insight-note store-insight-manager-budget">店長の配分枠は{yen(insight.delegationBudget)}です。入力人数の基準人件費と広告費から決まり、景況による給与差と店長費は別のため、実際の費用合計とは異なります。</p>}
      <p className="store-insight-note store-insight-scope">店舗利益は、本部費・利息・元本返済・配当を含みません。会社全体の利益や資金の増減とは異なります。</p>
    </details>
    </div>
  </details>;
}
