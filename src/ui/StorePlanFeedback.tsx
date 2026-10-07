import type { StoreOperatingInsight } from '../sim/engine';
import './store-plan-feedback.css';

interface Props {
  insight: StoreOperatingInsight | null;
  storeName: string;
  reasonsId: string;
  group: 'product' | 'people' | 'promotion';
}

const groupLabels = { product: '商品・価格', people: '人員・店長', promotion: '広告・改装' };

export function StoreStaffCapacityNote({ insight }: { insight: StoreOperatingInsight | null }) {
  if (!insight || insight.effectiveSettings.staff <= insight.context.staffCapacityLimit) return null;
  return <p className="store-plan-staff-note">
    {insight.effectiveSettings.manager ? '調整後の店長案では、' : ''}設備の対応人数を超えています。超過分も人件費がかかります。
  </p>;
}

/** Applied settings and qualitative tradeoffs; outcomes arrive only after settlement. */
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
    role="group" aria-label={`${storeName}の${groupLabels[group]}設定の確認`}>
    <p className="store-plan-feedback-period">第{insight.week}週 · 反映済みの設定{insight.effectiveSettings.manager && 'からの店長案'}</p>
    <p className="store-plan-feedback-effect">{group === 'product'
      ? '価格は一杯の売上と選ばれやすさに、品質は満足度と材料費に関わります。'
      : group === 'people' ? '人員は対応枠と人件費に関わります。設備の上限を超える増員にも人件費がかかります。'
      : '広告は店を知るきっかけを増やし、設備は対応枠と維持費に関わります。'}</p>
    <p className="store-plan-feedback-scope">売上・来店者数・利益は営業を終えてから確認できます。</p>
    <button type="button" aria-controls={reasonsId} onPointerDown={event => {
      if (event.button === 0) event.preventDefault();
    }} onClick={showReasons}>設定・費用と対応枠</button>
  </div>;
}
