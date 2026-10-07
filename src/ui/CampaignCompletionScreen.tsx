import { useId, useLayoutEffect, useRef } from 'react';
import { GameIcon } from './GameIcon';
import type { GameState } from '../model';
import './campaign-completion-screen.css';

export interface CampaignCompletionScreenProps {
  state: GameState;
  onClose: () => void;
  /** App opens the report only while this exact settled week remains available. */
  onReviewWeek?: (week: number) => void;
}

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

/** A saved first achievement. Reopening never recalculates or changes its result. */
export default function CampaignCompletionScreen({ state, onClose, onReviewWeek }: CampaignCompletionScreenProps) {
  const achievement = state.campaignAchievement;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = dialog.ownerDocument.activeElement;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  if (!achievement) return null;
  const businessCount = achievement.subsidiaries + achievement.marketBusinesses;
  const canReview = !!onReviewWeek && state.lastReport?.week === achievement.week;

  return <dialog ref={dialogRef} className="campaign-completion-screen" aria-labelledby={titleId} aria-modal="true"
    data-achievement-week={achievement.week}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <div className="campaign-completion-surface">
      <header className="campaign-completion-header">
        <div className="campaign-completion-brand"><GameIcon name="celebrate" size={34}/><strong>SHIBUYA CAPITAL<small>街と企業の達成記録</small></strong></div>
        <button type="button" className="campaign-completion-exit" onClick={onClose} aria-label="達成記録を閉じる"><GameIcon name="close" size={26}/></button>
      </header>

      <div className="campaign-completion-content">
        <section className="campaign-completion-inner">
          <p className="campaign-completion-kicker"><GameIcon name="check" size={22}/>第{achievement.week}週に達成</p>
          <h2 ref={headingRef} id={titleId} tabIndex={-1}>一軒のカフェから、<br/>渋谷を支える会社へ。</h2>
          <p className="campaign-completion-company">{state.companyName}</p>

          <div className="campaign-completion-milestones" aria-label="達成した事業と街">
            <div className="campaign-completion-businesses"><GameIcon name="building" size={40}/><strong>{businessCount}<span>の事業</span></strong><p>街の企業{achievement.subsidiaries}社と市場{achievement.marketBusinesses}事業<br/>すべての取得と引継ぎを完了</p></div>
            <div className="campaign-completion-city"><span className="campaign-completion-check"><GameIcon name="check" size={35}/></span><strong>{achievement.districts}<span>地区の開発</span></strong><p>全工程が完成・稼働<br/>株式公開を達成</p></div>
          </div>

          <section className="campaign-completion-settlement" aria-label="達成した週の確定決算">
            <h3>第{achievement.week}週の決算</h3>
            <dl><div><dt>全社純利益</dt><dd>{yen(achievement.netProfit)}</dd></div><div><dt>決算後の手元資金</dt><dd>{yen(achievement.cash)}</dd></div></dl>
          </section>
          <p className="campaign-completion-footprint"><GameIcon name="coffee" size={22}/>達成時の店舗 {achievement.storeCount}店 · 直接保有物件 {achievement.propertyCount}件</p>
          <p className="campaign-completion-note">達成した週の決算と保有状況を記録しています。{state.gameOver ? 'この会社の達成は、経営終了後も振り返れます。' : 'これからも、あなたの会社で街の経営を続けられます。'}</p>
        </section>
      </div>

      <footer className="campaign-completion-footer">
        <div>
          {canReview && <button type="button" className="campaign-completion-review" onClick={() => onReviewWeek?.(achievement.week)}><GameIcon name="news" size={24}/>第{achievement.week}週の営業結果を見る</button>}
          <button type="button" className="primary campaign-completion-continue" onClick={onClose}><GameIcon name="shop" size={30}/><span>{state.gameOver ? '達成記録を閉じる' : '街で経営を続ける'}</span><GameIcon name="arrow-right" size={26}/></button>
        </div>
      </footer>
    </div>
  </dialog>;
}
