import type { StoreOperatingInsight } from '../sim/engine';
import { StoreStaffCapacityNote } from './StorePlanFeedback';
import './store-operating-insight.css';

interface Props {
  insight: StoreOperatingInsight | null;
  storeName: string;
  reasonsId?: string;
}

const number = (value: number) => Math.round(value).toLocaleString('ja-JP');
const yen = (value: number) => `${number(value)}円`;
const fixedCosts = [
  ['labor', '従業員の人件費'], ['rent', '家賃'], ['equipment', '店舗・設備の維持費'],
  ['marketing', '広告費'], ['manager', '店長費'],
] as const;

/** Known settings, costs and serving constraints. Demand and outcomes are not observations. */
export function StoreOperatingInsightPanel({ insight, storeName, reasonsId }: Props) {
  if (!insight) return null;
  const { costs, effectiveSettings: effective, context } = insight;
  const managerChanged = (['price', 'staff', 'quality', 'marketing'] as const)
    .some(key => insight.inputSettings[key] !== effective[key]);
  return <details className="store-operating-insight" aria-label={`${storeName}の設定と費用`} data-store-id={insight.storeId}>
    <summary>設定・費用と対応枠</summary>
    <div className="store-insight-content">
      <header className="store-insight-heading"><h4>{storeName}</h4><span>第{insight.week}週の設定</span></header>
      <dl className="store-insight-flow" aria-label="設備と人員による対応枠">
        <div><dt>設備が活かせる従業員数</dt><dd>{context.staffCapacityLimit.toLocaleString('ja-JP')}<small>人分</small></dd></div>
        <div><dt>人員・設備による対応枠</dt><dd><small>約</small>{number(Math.round(insight.flow.capacity / 10) * 10)}<small>人／週</small></dd></div>
      </dl>
      <p className="store-insight-note">対応枠は今の人員・設備で提供できる量の基準です。来店者数ではなく、営業状況でも変わります。増員だけでは来店は増えません。</p>
      <StoreStaffCapacityNote insight={insight}/>
      {!effective.manager && context.founderCapacity < 1 && <p className="store-insight-note store-insight-founder">自主管理の店舗数により、対応枠が下がっています。</p>}
      <p className="store-insight-note">近隣の自社店舗：{context.nearbyStores}店。同じ地域の自社店が増えると需要が分散します。</p>

      {effective.manager && <div className="store-insight-manager" aria-label="今週の店長案">
        <h5>今週の店長案</h5>
        <p className="store-insight-note">{managerChanged ? '入力した配分枠から、営業時に次の設定へ調整する案です。入力値は変更していません。' : '現在の店長案は入力と同じ設定です。'} 来店者数や利益を確約するものではありません。</p>
        <dl className="store-insight-manager-settings">
          <div><dt>価格</dt><dd>{yen(effective.price)}</dd></div>
          <div><dt>従業員数</dt><dd>{effective.staff}人</dd></div>
          <div><dt>品質</dt><dd>{effective.quality}</dd></div>
          <div><dt>広告費</dt><dd>{yen(effective.marketing)}／週</dd></div>
        </dl>
      </div>}

      <details className="store-insight-costs" id={reasonsId}>
        <summary>設定に伴う週の支払い</summary>
        <p className="store-insight-note">{effective.manager ? '店長案' : '反映済みの設定'}による費用です。人員・広告や設備を変えると支払いも変わります。</p>
        <dl className="store-insight-cost-list">
          {fixedCosts.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{yen(costs[key])}／週</dd></div>)}
        </dl>
        <p className="store-insight-note">材料費・包装や決済などの費用は実際の販売で変わります。費用全体と売上・利益は、営業後の実績で確認できます。</p>
        <p className="store-insight-note">価格・品質・混雑は満足度に関わります。品質を上げると材料費も増えます。広告や設備の効果は、営業結果を見ながら判断しましょう。</p>
        {context.ownsProperty && <p className="store-insight-note store-insight-owned-property">自社物件のため家賃は0円です。保有物件の維持費は全社の収支で別に差し引きます。</p>}
        {effective.manager && insight.delegationBudget !== null && <p className="store-insight-note store-insight-manager-budget">店長の配分枠は{yen(insight.delegationBudget)}です。入力人数の基準人件費と広告費から決まり、景況による給与差と店長費は別のため、実際の費用合計とは異なります。</p>}
        <p className="store-insight-note store-insight-scope">本部費・利息・元本返済・配当は、店舗の支払いとは別です。</p>
      </details>
    </div>
  </details>;
}
