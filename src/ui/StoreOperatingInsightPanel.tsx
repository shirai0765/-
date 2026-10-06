import type { StoreOperatingInsight } from '../sim/engine';
import './store-operating-insight.css';

interface Props {
  insight: StoreOperatingInsight | null;
  storeName: string;
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
export function StoreOperatingInsightPanel({ insight, storeName }: Props) {
  if (!insight) return null;
  const { flow, result, costs, effectiveSettings: effective, context } = insight;
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
  const profitStatus = result.profit > 0 ? '黒字' : result.profit < 0 ? '赤字' : '収支均衡';

  return <section className="store-operating-insight" aria-label={`${storeName}の今週の運営予測`} data-store-id={insight.storeId}>
    <header className="store-insight-heading">
      <h4>{storeName}</h4>
      <span>第{insight.week}週の予測</span>
    </header>
    <dl className="store-insight-result store-forecast">
      <div>
        <dt>この店の利益予測 <span>／週</span></dt>
        <dd className={result.profit < 0 ? 'is-loss' : undefined}>
          <strong>¥{number(result.profit)}</strong> <span>{profitStatus}</span>
        </dd>
      </div>
    </dl>
    <p className="store-insight-diagnosis">{diagnosis}</p>
    <dl className="store-insight-flow" aria-label="今週の需要と対応上限">
      <div><dt>需要の見込み</dt><dd><small>約</small>{number(flow.demand)}<small>人／週</small></dd></div>
      <div><dt>対応上限</dt><dd><small>約</small>{number(flow.capacity)}<small>人／週</small></dd></div>
      <div><dt>迎える予想人数</dt><dd>{number(flow.customers)}<small>人／週</small></dd></div>
    </dl>
    {effective.staff > context.staffCapacityLimit && <p className="store-insight-note store-insight-staff-limit">
      設備の対応人数を超えています。超過分も人件費はかかります。
    </p>}
    {!effective.manager && context.founderCapacity < 1 && <p className="store-insight-note store-insight-founder">
      自主管理の店舗数により、対応上限が下がっています。
    </p>}
    <div className="store-insight-satisfaction">
      <dl><div><dt>予想満足度</dt><dd>{result.satisfaction}<span>／100</span></dd></div></dl>
    </div>
    <p className="store-insight-note store-insight-short-scope">本部費・利息などを除く、店舗の利益です。</p>

    {effective.manager && <div className="store-insight-manager" aria-label="今週の店長案">
      <h5>今週の店長案</h5>
      <p className="store-insight-note">{managerChanged ? '予測には次の調整後の設定を使っています。' : '今週は入力と同じ設定を使う見込みです。'} 店長費は従業員の人件費と別に{yen(costs.manager)}／週です。</p>
      <dl className="store-insight-manager-settings">
        <div><dt>価格</dt><dd>{yen(effective.price)}</dd></div>
        <div><dt>従業員数</dt><dd>{effective.staff}人</dd></div>
        <div><dt>品質</dt><dd>{effective.quality}</dd></div>
        <div><dt>広告費</dt><dd>{yen(effective.marketing)}／週</dd></div>
      </dl>
    </div>}

    <details className="store-insight-costs">
      <summary>利益・客数の理由と費用</summary>
      {!nearDisplayedFlow && <p className="store-insight-note store-insight-flow-note">
        {capacityLimited
          ? `上限を超える需要の目安は約${number(flow.unservedDemand)}人です。集客が増えても、今の上限では客数が増えない場合があります。`
          : `対応の余力は約${number(flow.unusedCapacity)}人です。増員だけでは来店需要は増えません。`}
      </p>}
      <p className="store-insight-note">予想満足度には価格・品質・混雑などが影響します。品質は材料費にも関わります。</p>
      <p className="store-insight-note store-insight-reputation">会社の信用は、全店の平均満足度と会社の利益をもとに週末に更新されます。この店の満足度だけでは上昇は決まりません。</p>
      <dl className="store-insight-cost-list">
        <div className="store-insight-cost-total"><dt>売上予測</dt><dd>{yen(result.revenue)}</dd></div>
        {costEntries.map(([key, value]) => <div key={key}><dt>{costLabels[key]}</dt><dd>{yen(value)}</dd></div>)}
        {insight.roundedCostAdjustment !== 0 && <div><dt>表示の丸め調整</dt><dd>{yen(insight.roundedCostAdjustment)}</dd></div>}
        <div className="store-insight-cost-total"><dt>店舗費用合計</dt><dd>{yen(result.revenue - result.profit)}</dd></div>
      </dl>
      {insight.roundedCostAdjustment !== 0 && <p className="store-insight-note">内訳を円単位に丸めた差を調整しています。追加の支払いではありません。</p>}
      {context.ownsProperty && <p className="store-insight-note store-insight-owned-property">自社物件のため家賃は0円です。保有物件の維持費は全社の収支で別に差し引きます。</p>}
      {effective.manager && insight.delegationBudget !== null && <p className="store-insight-note store-insight-manager-budget">店長の配分枠は{yen(insight.delegationBudget)}です。入力人数の基準人件費と広告費から決まり、景況による給与差と店長費は別のため、実際の費用合計とは異なります。</p>}
      <p className="store-insight-note store-insight-scope">店舗利益は、本部費・利息・元本返済・配当を含みません。会社全体の利益や資金の増減とは異なります。</p>
    </details>
  </section>;
}
