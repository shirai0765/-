import type { StoreOperatingInsight } from '../sim/engine';
import './store-plan-feedback.css';

interface Props {
  insight: StoreOperatingInsight | null;
  storeName: string;
  reasonsId: string;
  group: 'product' | 'people' | 'promotion';
}

const groupLabels = { product: '商品・価格', people: '人員・店長', promotion: '広告・改装' };

/** Outward rounding keeps a forecast a readable interval, including near zero. */
export function formatStoreEstimateRange(range: { min: number; max: number }, unit = 1) {
  const min = Math.floor(range.min / unit) * unit;
  const max = Math.ceil(range.max / unit) * unit;
  return `${min.toLocaleString('ja-JP')}〜${max.toLocaleString('ja-JP')}`;
}

export function StoreStaffCapacityNote({ insight }: { insight: StoreOperatingInsight | null }) {
  if (!insight || insight.effectiveSettings.staff <= insight.context.staffCapacityLimit) return null;
  return <p className="store-plan-staff-note">
    {insight.effectiveSettings.manager ? '調整後の店長案では、' : ''}設備の対応人数を超えています。超過分も人件費がかかります。
  </p>;
}

/** A compact planning range near the inputs; actual results arrive at week end. */
export function StorePlanFeedback({ insight, storeName, reasonsId, group }: Props) {
  if (!insight) return null;
  const showReasons = () => {
    // Commit the existing onBlur edit after the click is secured. A new warning
    // can move this button, so committing during pointerdown would lose the click.
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement) active.blur();
    const details = document.getElementById(reasonsId);
    if (!(details instanceof HTMLDetailsElement)) return;
    details.open = true;
    let ancestor = details.parentElement;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    const summary = details.querySelector('summary');
    summary?.focus({ preventScroll: true });
    summary?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };

  return <div className="store-plan-feedback" data-store-id={insight.storeId} data-feedback-group={group}
    role="group" aria-label={`${storeName}の${groupLabels[group]}設定の店舗利益見込み`}>
    <p className="store-plan-feedback-period">第{insight.week}週 · 反映済みの設定{insight.effectiveSettings.manager && 'からの店長案'}</p>
    <p className="store-plan-feedback-profit">
      <span>店舗利益見込み／週</span>
      <span className="store-plan-feedback-range">{formatStoreEstimateRange(insight.resultRange.profit, 1000)}円</span>
    </p>
    <p className="store-plan-feedback-scope">実績は週末に確定。本部費・利息などは含みません。</p>
    <button type="button" aria-controls={reasonsId} onPointerDown={event => {
      if (event.button === 0) event.preventDefault();
    }} onClick={showReasons}>見込みの理由</button>
  </div>;
}
