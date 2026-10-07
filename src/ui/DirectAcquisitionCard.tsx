import type { AcquisitionTarget, GameAction, GameState } from '../model';
import { formatReputation } from '../format';

interface Props {
  state: GameState;
  target: AcquisitionTarget;
  onAction: (action: GameAction) => void;
  onManageStores: () => void;
  disabled?: boolean;
}
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const sectors = { food: 'FOOD & BEVERAGE', property: 'REAL ESTATE', rail: 'RAILWAY' };

/** Eligibility uses the same raw balances and reputation as the acquisition action. */
export default function DirectAcquisitionCard({ state, target, onAction, onManageStores, disabled = false }: Props) {
  const owned = state.subsidiaries.some(company => company.id === target.id);
  const reputationMet = state.reputation >= target.minReputation;
  const cashMet = state.cash >= target.price;
  const locked = disabled || state.gameOver;
  const canAcquire = !owned && !locked && reputationMet && cashMet;
  return <article className="card acquisition" data-target-id={target.id}>
    <span className="eyebrow">{sectors[target.sector]}</span><h3>{target.name}</h3><p>{target.description}</p>
    <div className="mini-metrics">
      <div className="metric"><span>買収価格</span><strong>{yen(target.price)}</strong></div>
      <div className="metric"><span>週間利益の目安</span><strong>{yen(target.weeklyProfit)}</strong></div>
    </div>
    <p className="muted" data-reputation-met={reputationMet}>ブランド評価 {formatReputation(state.reputation)} / 必要 {formatReputation(target.minReputation)} · {reputationMet ? '条件達成' : '条件未達'}</p>
    <small className="muted">事業リスク {(target.risk * 100).toFixed(0)}%</small>
    {owned ? <span className="owned-label">グループ傘下</span> : <>
      {!reputationMet && <>
        <p className="muted">ブランド評価が買収条件に届いていません。店舗の満足度と全社の黒字・赤字が、毎週のブランド評価に影響します。</p>
        <button type="button" className="text-button" disabled={disabled} onClick={() => { if (!disabled) onManageStores(); }}>店舗の営業実績を確認</button>
      </>}
      {!cashMet && <p className="muted">購入資金が{yen(Math.ceil(target.price - state.cash))}不足しています。</p>}
      {disabled && !state.gameOver && <p className="muted">進行中の操作が完了するまでお待ちください。</p>}
      {state.gameOver && <p className="muted">経営が終了しているため買収できません。</p>}
      <button type="button" className="primary" disabled={!canAcquire} onClick={() => { if (canAcquire) onAction({ type: 'acquire', targetId: target.id }); }}>買収する</button>
    </>}
  </article>;
}
