import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import WeeklyResults, { WeeklySettlementSummary } from './WeeklyResults';
import type { WeeklyResultsProps } from './WeeklyResults';
import WeeklyNews from './WeeklyNews';
import './weekly-review-screen.css';

interface Props extends Omit<WeeklyResultsProps, 'mode' | 'onContinue'> {
  onClose: () => void;
  notice?: string;
  onClearNotice?: () => void;
}

type Phase = 'summary' | 'news' | 'details';

/** Presentation only: settlement and autosave have already finished. */
export default function WeeklyReviewScreen(props: Props) {
  const { state, onClose, notice, onClearNotice } = props;
  const report = state.lastReport;
  const [phase, setPhase] = useState<Phase>('summary');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const noticeCloseRef = useRef<HTMLButtonElement>(null);

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

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [phase]);

  if (!report) return null;
  const nextWeek = report.week + 1;
  const title = phase === 'summary' ? `第${report.week}週の営業結果`
    : phase === 'news' ? `第${report.week}週の街と企業ニュース`
      : `第${report.week}週の詳しい営業記録`;
  const returnLabel = state.gameOver ? '結果を閉じる' : '街に戻る';

  return <dialog ref={dialogRef} className="weekly-review-screen" aria-labelledby={titleId} aria-modal="true"
    data-weekly-review-phase={phase} data-settled-week={report.week}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <div className="weekly-review-surface">
      <header className="weekly-review-header">
        <div className="weekly-review-brand"><span aria-hidden="true">SC</span><div><strong>SHIBUYA CAPITAL</strong><small>WEEKLY REVIEW</small></div></div>
        <button ref={noticeCloseRef} type="button" className="weekly-review-exit" onClick={onClose}>{returnLabel}<X size={17}/></button>
      </header>

      <div ref={contentRef} className="weekly-review-content">
        <div className="weekly-review-content-inner">
          <ol className="weekly-review-steps" aria-label="週末レビューの流れ">
            <li aria-current={phase !== 'news' ? 'step' : undefined} className={phase !== 'news' ? 'current' : 'complete'}><span aria-hidden="true">{phase === 'news' ? <Check size={12}/> : '01'}</span>営業結果</li>
            <li aria-current={phase === 'news' ? 'step' : undefined} className={phase === 'news' ? 'current' : ''}><span aria-hidden="true">02</span>街と企業のニュース</li>
          </ol>

          <div className="weekly-review-heading">
            <div>
              {phase !== 'summary' && <p className="weekly-review-kicker">{phase === 'news' ? 'SHIBUYA BUSINESS JOURNAL' : 'SETTLED RECORDS'}</p>}
              <h2 ref={headingRef} id={titleId} tabIndex={-1}>{title}</h2>
            </div>
            {phase === 'summary' && <div className="weekly-review-week-transition" aria-label={state.gameOver ? `第${report.week}週の営業が終了し、会社の経営を終了しました` : `第${report.week}週の営業が終了し、第${nextWeek}週になりました`}>
              <div><small>営業終了</small><strong><span>第</span>{report.week}<span>週</span></strong></div>
              <ArrowRight aria-hidden="true" size={23}/>
              <div className="weekly-review-next-week">{state.gameOver ? <strong className="weekly-review-end-label">経営終了</strong> : <><small>次の経営へ</small><strong><span>第</span>{nextWeek}<span>週</span></strong></>}</div>
            </div>}
          </div>

          {notice && <div className="weekly-review-notice" role="alert"><span>{notice}</span>{onClearNotice && <button type="button" className="weekly-review-notice-close" aria-label="通知を閉じる" onClick={() => { noticeCloseRef.current?.focus(); onClearNotice(); }}><X size={16}/></button>}</div>}
          {state.gameOver && <p className="weekly-review-ended" role="status">{state.gameOverReason ?? '会社の経営を終了しました。'}</p>}

          {phase === 'summary' && <section className="weekly-review-summary" aria-label="確定した会社の実績">
            <WeeklySettlementSummary state={state}/>
            <button type="button" className="weekly-review-detail-link" onClick={() => setPhase('details')}>店舗・収支の詳しい記録<ArrowRight size={15}/></button>
          </section>}

          {phase === 'news' && <section className="weekly-review-news" aria-label="今週の記録から読むニュース">
            <WeeklyNews report={report}/>
          </section>}

          {phase === 'details' && <div className="weekly-review-records">
            <WeeklyResults state={state} mode="details"
              onManageStore={props.onManageStore} onViewStore={props.onViewStore}
              onFinance={props.onFinance} onManageSector={props.onManageSector}/>
          </div>}
        </div>
      </div>

      <footer className="weekly-review-footer">
        <div className="weekly-review-footer-inner">
          <p className="weekly-review-saved"><Check size={13} aria-hidden="true"/><span>営業結果を自動保存しました</span></p>
          <div className="weekly-review-footer-actions">
            {phase !== 'summary' && <button type="button" className="weekly-review-back" onClick={() => setPhase('summary')}><ArrowLeft size={16}/>決算に戻る</button>}
            <button type="button" className="primary weekly-review-primary" onClick={() => phase === 'summary' || phase === 'details' ? setPhase('news') : onClose()}>
              {phase === 'news' ? state.gameOver ? '結果を閉じる' : `第${nextWeek}週の経営を始める` : '今週の街のニュースへ'}<ArrowRight size={18}/>
            </button>
          </div>
        </div>
      </footer>
    </div>
  </dialog>;
}
