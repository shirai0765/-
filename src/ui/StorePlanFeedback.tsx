import type { StoreOperatingInsight } from '../sim/engine';
import './store-plan-feedback.css';

interface Props {
  insight: StoreOperatingInsight | null;
  storeName: string;
  reasonsId: string;
  group: 'price-staff' | 'operations';
}

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
    role="group" aria-label={`${storeName}の${group === 'price-staff' ? '価格・人員' : '品質・広告・店長'}設定の見込み`}>
    <p className="store-plan-feedback-profit">
      <span>利益見込み</span>
      <span className="store-plan-feedback-range">{formatStoreEstimateRange(insight.resultRange.profit, 1000)}円</span>
    </p>
    <p className="store-plan-feedback-scope">実績は週末に確定します。{insight.effectiveSettings.manager && '店長の調整案を反映。'}</p>
    <button type="button" aria-controls={reasonsId} onPointerDown={event => {
      if (event.button === 0) event.preventDefault();
    }} onClick={showReasons}>見込みの理由</button>
  </div>;
}
