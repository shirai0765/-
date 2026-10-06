import { createContext, useContext, useLayoutEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import './game-dialog.css';

export const GameNoticeContext = createContext<{ notice?: string; onClearNotice?: () => void }>({});

interface Props {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  notice?: string;
  onClearNotice?: () => void;
  /** Applied to the visible panel, alongside the existing modal classes. */
  className?: string;
}

/** Native top-layer shell. The caller owns visibility, including busy-state close guards. */
export default function GameDialog({ title, children, close, wide, className, notice, onClearNotice }: Props) {
  const inheritedNotice = useContext(GameNoticeContext);
  const shownNotice = notice ?? inheritedNotice.notice;
  const clearNotice = onClearNotice ?? inheritedNotice.onClearNotice;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const backdropPress = useRef<{ id: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} className="game-dialog" aria-labelledby={titleId}
    onKeyDownCapture={event => {
      // Child confirmation handlers may unmount their shade before the native
      // cancel event fires. Cancel that browser default while leaving the
      // child's own Escape handler free to dismiss only the confirmation.
      if (event.target instanceof Element && event.target.closest('dialog') !== event.currentTarget) return;
      if (event.key === 'Escape' && event.currentTarget.querySelector('.modal-shade')) event.preventDefault();
    }}
    onCancel={event => {
      if (event.target !== event.currentTarget) return;
      event.stopPropagation();
      // Never let the browser bypass a caller's busy guard by closing itself.
      event.preventDefault();
      // Existing feature confirmations live inside this native dialog. Their
      // own Escape handler/close button must win over dismissing the whole page.
      if (event.currentTarget.querySelector('.modal-shade')) return;
      close();
    }}
    onPointerDown={event => {
      backdropPress.current = event.target === event.currentTarget && event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    }}
    onPointerMove={event => {
      const press = backdropPress.current;
      if (press && (press.id !== event.pointerId || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8)) backdropPress.current = null;
    }}
    onPointerCancel={() => { backdropPress.current = null; }}
    onPointerUp={event => {
      const press = backdropPress.current;
      backdropPress.current = null;
      if (press && press.id === event.pointerId && event.button === 0
        && event.target === event.currentTarget
        && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 8) close();
    }}>
    <section className={['modal', wide && 'wide', className].filter(Boolean).join(' ')}>
      <header><div><span className="eyebrow">SHIBUYA CAPITAL</span><h2 id={titleId}>{title}</h2></div>
        <button ref={closeButtonRef} type="button" className="icon-button" onClick={close} aria-label="閉じる"><X size={20}/></button>
      </header>
      {shownNotice && <div className="game-dialog-notice" role="alert"><span>{shownNotice}</span>{clearNotice && <button type="button" className="icon-button" onClick={() => { closeButtonRef.current?.focus(); clearNotice(); }} aria-label="通知を閉じる"><X size={16}/></button>}</div>}
      {children}
    </section>
  </dialog>;
}
