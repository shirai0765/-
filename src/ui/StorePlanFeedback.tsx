import type { StoreOperatingInsight } from '../sim/engine';
import './store-plan-feedback.css';

interface Props {
  insight: StoreOperatingInsight | null;
  storeName: string;
  reasonsId: string;
  group: 'price-staff' | 'operations';
}

export function StoreStaffCapacityNote({ insight }: { insight: StoreOperatingInsight | null }) {
  if (!insight || insight.effectiveSettings.staff <= insight.context.staffCapacityLimit) return null;
  return <p className="store-plan-staff-note">
    {insight.effectiveSettings.manager ? '調整後の店長案では、' : ''}設備の対応人数を超えています。超過分も人件費がかかります。
  </p>;
}

/** Repeats one existing forecast near the inputs; no economic calculation or action. */
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
    const summary = details.querySelector('summary');
    summary?.focus({ preventScroll: true });
    summary?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };

  return <div className="store-plan-feedback" data-store-id={insight.storeId} data-feedback-group={group}
    role="group" aria-label={`${storeName}の${group === 'price-staff' ? '価格・人員' : '品質・広告・店長'}設定の予測`}>
    <p className="store-plan-feedback-profit">
      <span>この店の今週利益予測</span>
      <strong className={insight.result.profit < 0 ? 'is-loss' : undefined}>¥{Math.round(insight.result.profit).toLocaleString('ja-JP')}</strong>
    </p>
    {insight.effectiveSettings.manager && <p className="store-plan-feedback-scope">調整後の店長案による予測です。</p>}
    <button type="button" aria-controls={reasonsId} onPointerDown={event => {
      if (event.button === 0) event.preventDefault();
    }} onClick={showReasons}>利益と客数の理由を見る</button>
  </div>;
}
