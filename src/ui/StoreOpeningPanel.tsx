import { useMemo } from 'react';
import type { GameState, StoreStyle } from '../model';
import { getStoreOpeningPlans } from '../sim/storePlanning';
import './store-opening.css';

const labels: Record<StoreStyle, string> = { standard: '街角カフェ', premium: 'プレミアム', takeaway: 'テイクアウト' };
const descriptions: Record<StoreStyle, string> = {
  standard: '中間の開業費と処理能力。価格と品質を調整して育てる。',
  premium: '高い初期品質と魅力。開業費が高く、処理能力は控えめ。',
  takeaway: '開業費を抑え、客数をさばく形態。初期価格と品質は低め。',
};
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const difference = (value: number) => `${value > 0 ? '+' : ''}${yen(value)}`;
const moneyRange = (value: { min: number; max: number }) => `${yen(Math.floor(value.min / 1000) * 1000)} 〜 ${yen(Math.ceil(value.max / 1000) * 1000)}`;

export interface StoreOpeningPanelProps {
  state: GameState;
  lotId: string;
  style: StoreStyle;
  onStyleChange: (style: StoreStyle) => void;
  onOpen: (style: StoreStyle) => void;
  onFinance: () => void;
  disabled?: boolean;
}

export default function StoreOpeningPanel({ state, lotId, style, onStyleChange, onOpen, onFinance, disabled = false }: StoreOpeningPanelProps) {
  const plans = useMemo(() => getStoreOpeningPlans(state, lotId), [state, lotId]);
  const selected = plans.find(plan => plan.style === style)!;
  const blocked = disabled || state.gameOver;
  return <section className="store-opening" aria-label="出店プランの比較">
    <div className="section-rule"><h3>ここに出店する</h3></div>
    <div className="opening-options" role="group" aria-label="店舗スタイル">
      {plans.map(plan => <button type="button" key={plan.style} className={'opening-option' + (style === plan.style ? ' selected' : '')} aria-pressed={style === plan.style} disabled={blocked} onClick={() => onStyleChange(plan.style)}>
        <span className="opening-option-heading"><strong>{labels[plan.style]}</strong><span>{plan.openingCost === null ? '出店不可' : yen(plan.openingCost)}</span></span>
      </button>)}
    </div>
    <h4>{labels[style]}で開業した場合</h4>
    {selected.available && selected.outlook && selected.cashAfter !== null ? <>
      <dl className="opening-comparison opening-primary-values">
        <div><dt>開業費</dt><dd><strong>{yen(selected.openingCost!)}</strong></dd></div>
        <div><dt>手元資金・開業費支払後</dt><dd><strong>{yen(selected.cashAfter)}</strong></dd></div>
        <div className="opening-profit-range"><dt>今週の全社利益見込み（利息後）</dt><dd><strong className={selected.outlook.netProfit.min > 0 ? 'positive' : selected.outlook.netProfit.max <= 0 ? 'negative' : ''}>{moneyRange(selected.outlook.netProfit)}</strong></dd></div>
      </dl>
      {selected.debtProfitRisk && <p className="opening-warning" role="alert">{selected.debtProfitCertain ? '借入があり、利益見込みの上限も0以下です。返済や計画の見直しが必要です。' : '借入があり、営業結果次第で利息後の利益が0以下になる可能性があります。0以下で週を終えると倒産します。'}</p>}
      {selected.cashRisk && <p className="opening-warning" role="alert">{selected.cashShortfallCertain ? '見込みの範囲すべてで週末の手元資金が不足します。資金計画の見直しが必要です。' : '営業結果次第で週末の手元資金が不足する可能性があります。資金に余裕を残してください。'}</p>}
    </> : <p className="opening-warning">{selected.reason}</p>}
    <button type="button" className="primary opening-submit" disabled={blocked || !selected.available} onClick={() => onOpen(style)}>この場所にカフェを開業</button>
    <p className="opening-note opening-timing">開業で時間は進みません。営業結果は週を終了したときに確定します。</p>
    {selected.openingCost !== null && !state.stores.some(store => store.lotId === lotId) && <button type="button" className="secondary opening-submit" disabled={blocked} onClick={onFinance}>この出店の資金を比較</button>}
    <details className="opening-detail"><summary>初期設定・比較の詳しい内訳</summary>
      <p className="opening-note">比較値は同じ場所・今週の条件での基準の見込みです。実績の約束ではありません。開業後に価格・品質・人員を調整できます。</p>
      <div className="opening-style-details">{plans.map(plan => <div key={plan.style}>
        <strong>{labels[plan.style]}</strong><p className="opening-note">{descriptions[plan.style]}</p>
        {plan.available && plan.netProfitDelta !== null ? <p className="opening-option-profit">全社利益の変化・基準の見込み / 週 <strong className={plan.netProfitDelta > 0 ? 'positive' : 'negative'}>{difference(plan.netProfitDelta)}</strong></p> : <p className="opening-unavailable">{plan.reason}</p>}
      </div>)}</div>
      {selected.available && selected.after && selected.outlook && selected.cashAfter !== null && <>
        {selected.defaults && <p className="opening-note">初期設定：価格{yen(selected.defaults.price)}・品質{selected.defaults.quality}・{selected.defaults.staff}人・広告{yen(selected.defaults.marketing)}/週。店長なし。</p>}
        <dl className="opening-comparison">
          <div><dt>手元資金・開業前 → 開業費支払後</dt><dd><span>{yen(selected.cashBefore)} →</span><strong>{yen(selected.cashAfter)}</strong></dd></div>
          <div><dt>全社利益・基準の見込み / 週・開業前 → 開業後</dt><dd><span>{yen(selected.before.netProfit)} →</span><strong>{yen(selected.after.netProfit)}</strong></dd></div>
          <div><dt>今週の現金増減・基準の見込み</dt><dd><span>{difference(selected.before.cashChange)} →</span><strong>{difference(selected.after.cashChange)}</strong></dd></div>
          <div><dt>開業後・週末の手元資金の見込み</dt><dd><strong className={selected.cashRisk ? 'negative' : ''}>{moneyRange(selected.outlook.cashAfter)}</strong></dd></div>
        </dl>
        <p className="opening-note">開業費は一度だけ手元資金から支払い、週の利益には含めません。現金増減には利息・元本返済・配当などを反映します。</p>
        <h4>既存店への影響と運営能力</h4>
        <dl className="opening-comparison">
          <div><dt>既存店舗の利益変化・基準の見込み / 週</dt><dd>{difference(selected.existingStoreProfitDelta ?? 0)}</dd></div>
          <div><dt>本部費の増加 / 週</dt><dd>{difference(selected.overheadDelta ?? 0)}</dd></div>
          <div><dt>開業後・店長なし店舗の運営能力</dt><dd>{Math.round((selected.founderCapacity ?? 1) * 100)}%</dd></div>
        </dl>
        {(selected.netProfitDelta ?? 0) <= 0 && <p className="opening-warning">基準の見込みでは全社利益が増えません。別の形態や場所と比較できます。</p>}
        <p className="opening-note">近隣店との競合、同一ブランドの需要分散、本部費を含む全社比較です。自分で見る店が3店を超えると運営能力が下がります。客数は需要と処理能力の小さい方で決まり、人員や広告を増やしても利益が増えない場合があります。</p>
      </>}
    </details>
  </section>;
}
