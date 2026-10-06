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
    <p className="opening-note">同じ場所・今週の条件で3つの形態を比較。開業後に価格・品質・人員を調整できます。</p>
    <div className="opening-options" role="group" aria-label="店舗スタイル">
      {plans.map(plan => <button type="button" key={plan.style} className={'opening-option' + (style === plan.style ? ' selected' : '')} aria-pressed={style === plan.style} disabled={blocked} onClick={() => onStyleChange(plan.style)}>
        <span className="opening-option-heading"><strong>{labels[plan.style]}</strong><span>{plan.openingCost === null ? '出店不可' : yen(plan.openingCost)}</span></span>
        <small>{descriptions[plan.style]}</small>
        {plan.available && plan.netProfitDelta !== null ? <span className="opening-option-profit">全社利益の変化 / 週 <strong className={plan.netProfitDelta > 0 ? 'positive' : 'negative'}>{difference(plan.netProfitDelta)}</strong></span> : <span className="opening-unavailable">{plan.reason}</span>}
      </button>)}
    </div>
    <h4>{labels[style]}で開業した場合</h4>
    {selected.available && selected.after && selected.cashAfter !== null ? <>
      <dl className="opening-comparison">
        <div><dt>手元資金・開業費支払後</dt><dd><span>{yen(selected.cashBefore)} →</span><strong>{yen(selected.cashAfter)}</strong></dd></div>
        <div><dt>全社の利益 / 週・利息控除後</dt><dd><span>{yen(selected.before.netProfit)} →</span><strong className={selected.after.netProfit > 0 ? 'positive' : 'negative'}>{yen(selected.after.netProfit)}</strong></dd></div>
        <div><dt>今週の現金増減</dt><dd><span>{difference(selected.before.cashChange)} →</span><strong>{difference(selected.after.cashChange)}</strong></dd></div>
        <div><dt>開業後・週末の手元資金</dt><dd><strong className={selected.cashRisk ? 'negative' : ''}>{yen(selected.cashAfter + selected.after.cashChange)}</strong></dd></div>
      </dl>
      <p className="opening-note">開業費は一度だけ手元資金から支払い、週の利益には含めません。現金増減には利息・元本返済・配当などを反映します。</p>
      {selected.defaults && <p className="opening-note">初期設定：価格{yen(selected.defaults.price)}・品質{selected.defaults.quality}・{selected.defaults.staff}人・広告{yen(selected.defaults.marketing)}/週。店長なし。</p>}
      <details className="opening-detail"><summary>既存店への影響と運営能力</summary>
        <dl className="opening-comparison">
          <div><dt>既存店舗の利益変化 / 週</dt><dd>{difference(selected.existingStoreProfitDelta ?? 0)}</dd></div>
          <div><dt>本部費の増加 / 週</dt><dd>{difference(selected.overheadDelta ?? 0)}</dd></div>
          <div><dt>開業後・店長なし店舗の運営能力</dt><dd>{Math.round((selected.founderCapacity ?? 1) * 100)}%</dd></div>
        </dl>
        <p className="opening-note">近隣店との競合、同一ブランドの需要分散、本部費を含む全社比較です。自分で見る店が3店を超えると運営能力が下がります。客数は需要と処理能力の小さい方で決まり、人員や広告を増やしても利益が増えない場合があります。</p>
      </details>
      {(selected.netProfitDelta ?? 0) <= 0 && <p className="opening-warning">この初期設定では全社利益が増えません。別の形態や場所と比較できます。</p>}
      {selected.debtProfitRisk && <p className="opening-warning" role="alert">借入があり、開業後の利息控除後利益が0以下です。このまま週を進めると倒産します。</p>}
      {selected.cashRisk && <p className="opening-warning" role="alert">開業後は週末の手元資金が不足する見込みです。</p>}
    </> : <p className="opening-warning">{selected.reason}</p>}
    <button type="button" className="primary opening-submit" disabled={blocked || !selected.available} onClick={() => onOpen(style)}>この場所にカフェを開業</button>
    {selected.openingCost !== null && !state.stores.some(store => store.lotId === lotId) && <button type="button" className="secondary opening-submit" disabled={blocked} onClick={onFinance}>この出店の資金を比較</button>}
    <p className="opening-note">開業で時間は進みません。設定を見直してから週を終了すると、最初の決算を確認できます。</p>
  </section>;
}
