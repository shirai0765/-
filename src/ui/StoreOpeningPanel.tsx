import { useMemo } from 'react';
import type { GameState, StoreStyle } from '../model';
import { getStoreOpeningPlans } from '../sim/storePlanning';
import SiteContextPanel from './SiteContextPanel';
import { GameIcon } from './GameIcon';
import { emitCityAudioCue } from '../audio/CityAudioCues';
import './store-opening.css';

const labels: Record<StoreStyle, string> = { standard: '街角カフェ', premium: 'プレミアム', takeaway: 'テイクアウト' };
const descriptions: Record<StoreStyle, string> = {
  standard: '中間の開業費と提供能力。価格と品質を調整して育てる。',
  premium: '高い初期品質と魅力。開業費が高く、提供能力は控えめ。',
  takeaway: '開業費を抑え、素早く提供する形態。初期価格と品質は低め。',
};
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

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
  const shortfall = selected.openingCost === null ? 0 : Math.max(0, selected.openingCost - state.cash);
  return <section className="store-opening" aria-label="出店プランの比較">
    <SiteContextPanel state={state} lotId={lotId} compact/>
    <div className="opening-section-title"><GameIcon name="coffee" size={26}/><h3>お店の形を選ぶ</h3><span>3つのスタイル</span></div>
    <div className="opening-options" role="group" aria-label="店舗スタイル">
      {plans.map(plan => <button type="button" key={plan.style} className={'opening-option' + (style === plan.style ? ' selected' : '')} aria-pressed={style === plan.style} disabled={blocked} onClick={() => { if (style !== plan.style) emitCityAudioCue({ kind: 'button' }); onStyleChange(plan.style); }}>
        <span className={`opening-option-illustration opening-option-${plan.style}`} aria-hidden="true"><span className="opening-option-emblem"><GameIcon name={plan.style === 'premium' ? 'celebrate' : plan.style === 'takeaway' ? 'lightning' : 'coffee'} size={28} tone={plan.style === 'premium' ? 'gold' : 'blue'}/></span></span>
        {style === plan.style && <span className="opening-option-check" aria-hidden="true"><GameIcon name="check" size={18}/></span>}
        <span className="opening-option-heading"><strong>{labels[plan.style]}</strong><span>{plan.openingCost === null ? '出店不可' : yen(plan.openingCost)}</span></span>
      </button>)}
    </div>
    <p className="opening-style-description">{descriptions[style]}</p>
    {selected.openingCost !== null && <div className="opening-payment">
      <dl className="opening-comparison opening-primary-values">
        <div><dt>開業費</dt><dd><strong>{yen(selected.openingCost)}</strong></dd></div>
        <div><dt>{selected.available && selected.cashAfter !== null ? '支払い後の手元資金' : '現在の手元資金'}</dt><dd><strong>{yen(selected.available && selected.cashAfter !== null ? selected.cashAfter : state.cash)}</strong></dd></div>
      </dl>
      <span className="opening-payment-arrow" aria-hidden="true"><GameIcon name="arrow-right" size={23} tone="gold"/></span>
      {shortfall > 0 && <p className="opening-payment-shortfall">開業資金が{yen(shortfall)}不足しています。</p>}
    </div>}
    {selected.available && selected.cashAfter !== null ? <>
      {(selected.overheadDelta ?? 0) > 0 && <p className="opening-note">この出店で本部費が週{yen(selected.overheadDelta!)}増えます。</p>}
      {selected.debtProfitRisk && <p className="opening-warning" role="alert">借入があります。この出店後は営業結果によって利益不足となるおそれがあります。借入中に利息後の利益がゼロ以下で週を終えると倒産します。</p>}
      {selected.cashRisk && <p className="opening-warning" role="alert">この出店後は週末の支払いで資金が不足するおそれがあります。運営に使う現金を残してください。</p>}
    </> : <p className="opening-warning">{selected.reason}</p>}
    <button type="button" className="primary opening-submit opening-launch" disabled={blocked || !selected.available} onClick={() => { emitCityAudioCue({ kind: 'button' }); onOpen(style); }}>この場所にカフェを開業<GameIcon name="arrow-right" size={26}/></button>
    <p className="opening-note opening-timing">開業で時間は進みません。来店者数と利益は、営業して週末に確かめましょう。</p>
    {selected.openingCost !== null && !state.stores.some(store => store.lotId === lotId) && <button type="button" className="secondary opening-submit opening-finance" disabled={blocked} onClick={() => { emitCityAudioCue({ kind: 'button' }); onFinance(); }}><GameIcon name="wallet" size={22}/>この出店の資金を比較<GameIcon name="arrow-right" size={18}/></button>}
    <details className="opening-detail"><summary>開業時の設定と費用</summary>
      {selected.defaults && <dl className="opening-comparison opening-defaults">
        <div><dt>商品価格</dt><dd>{yen(selected.defaults.price)}</dd></div>
        <div><dt>品質</dt><dd>{selected.defaults.quality} / 100</dd></div>
        <div><dt>人員</dt><dd>{selected.defaults.staff}人・店長なし</dd></div>
        <div><dt>広告費 / 週</dt><dd>{yen(selected.defaults.marketing)}</dd></div>
      </dl>}
      <p className="opening-note">開業後に価格・品質・人員・広告を調整できます。開業費は一度だけ支払い、週の利益から再び差し引きません。</p>
      {selected.founderCapacity !== null && selected.founderCapacity < 1 && <p className="opening-note">この出店後、店長のいない店舗の運営能力は{Math.round(selected.founderCapacity * 100)}%になります。自分で見る店が3店を超えると管理の負担が増えます。</p>}
      <p className="opening-note">人通りが多くても、全員が来店するわけではありません。価格と品質、認知度、提供できる人数を考えて運営しましょう。</p>
    </details>
  </section>;
}
