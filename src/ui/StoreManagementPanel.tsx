import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Coffee, Megaphone, Users, ReceiptText } from 'lucide-react';
import type { GameAction, GameState, Store, StoreStyle } from '../model';
import { getStoreOperatingInsight, operatingConditions } from '../sim/engine';
import { StoreOperatingInsightPanel } from './StoreOperatingInsightPanel';
import { StoreStaffCapacityNote } from './StorePlanFeedback';
import './store-management.css';

export interface StoreManagementPanelProps {
  state: GameState;
  store: Store;
  onAction: (action: GameAction) => boolean;
  disabled?: boolean;
  onViewStore?: (lotId: string) => void;
}

type Purpose = 'home' | 'product' | 'people' | 'promotion' | 'results';
const styles: Record<StoreStyle, string> = { standard: '街角カフェ', premium: 'プレミアム', takeaway: 'テイクアウト' };
const yen = (value: number) => `${Math.round(value).toLocaleString('ja-JP')}円`;
const purposeTitles = { home: '店舗トップ', product: '商品・価格', people: '人員・店長', promotion: '広告・改装', results: '営業実績' };
const purposes = [
  { id: 'product', title: purposeTitles.product, detail: '一杯の価格と品質', icon: Coffee },
  { id: 'people', title: purposeTitles.people, detail: '従業員と運営の委任', icon: Users },
  { id: 'promotion', title: purposeTitles.promotion, detail: '集客・内装・設備', icon: Megaphone },
  { id: 'results', title: purposeTitles.results, detail: '営業を終えた結果', icon: ReceiptText },
] as const;

interface DraftFieldProps {
  label: string;
  value: number | string;
  onCommit: (value: string) => boolean;
  disabled: boolean;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
}

/** Draft text is visibly pending until the existing synchronous action accepts it. */
function DraftField({ label, value, onCommit, disabled, min, max, step, maxLength }: DraftFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [rejected, setRejected] = useState(false);
  const statusId = useId();
  useEffect(() => { setDraft(String(value)); setRejected(false); }, [value]);
  const dirty = draft !== String(value);
  const commit = () => {
    if (!dirty || disabled) return;
    const accepted = onCommit(draft);
    setRejected(!accepted);
    // Preserve rejected input with an explicit pending label, never as a saved setting.
    if (accepted) setDraft(typeof value === 'number' ? String(Number(draft)) : draft.trim());
  };
  return <label className="store-management-field">{label}
    <input type={typeof value === 'number' ? 'number' : 'text'} value={draft}
      min={min} max={max} step={step} maxLength={maxLength} disabled={disabled}
      aria-invalid={rejected || undefined} aria-describedby={dirty || rejected ? statusId : undefined}
      onChange={event => { setDraft(event.target.value); setRejected(false); }} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
    {(dirty || rejected) && <small id={statusId} className="store-management-draft" role={rejected ? 'alert' : undefined}>
      {rejected ? `反映できませんでした。現在の設定：${value}` : '編集中 · 入力を終えると反映'}
    </small>}
  </label>;
}

/** Purpose navigation is local presentation state. All store mutations use existing actions. */
export default function StoreManagementPanel({ state, store, onAction, disabled = false, onViewStore }: StoreManagementPanelProps) {
  const [purpose, setPurpose] = useState<Purpose>('home');
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const locked = disabled || state.gameOver;
  const insight = state.gameOver ? null : getStoreOperatingInsight(state, store.id);
  const reasonsId = `store-insight-reasons-${store.lotId}`;
  const report = state.lastReport;
  const actual = report?.storeResults.find(result => result.id === store.id);
  const wages = operatingConditions(state).wages;
  const update = (changes: Extract<GameAction, { type: 'updateStore' }>['changes']) => onAction({ type: 'updateStore', storeId: store.id, changes });
  const numeric = (text: string) => text.trim() === '' ? Number.NaN : Number(text);
  const commitActiveDraft = () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && root.current?.contains(active)) active.blur();
  };
  const changePurpose = (next: Purpose) => {
    commitActiveDraft();
    moved.current = true;
    setPurpose(next);
  };
  useEffect(() => {
    if (moved.current) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [purpose]);
  const noResults = store.openedWeek === state.week
    ? '初営業の結果を待っています。週を終了すると結果が届きます。'
    : '直近の営業実績はまだ記録されていません。';

  return <div className="store-controls store-management" ref={root} data-store-id={store.id} data-store-purpose={purpose}
    onPointerDownCapture={event => {
      // Secure button clicks before a blur-triggered validation notice can move them.
      if (event.button === 0 && event.target instanceof Element && event.target.closest('button')) event.preventDefault();
    }}
    onClickCapture={event => {
      if (event.target instanceof Element && event.target.closest('button')) commitActiveDraft();
    }}>
    {purpose === 'home' ? <>
      <p className="store-management-status">{styles[store.style]} · 設備 Lv.{store.level}{store.manager ? ' · 店長に委任中' : ' · 自主管理'}</p>
      {actual && report ? <section className="store-management-latest" aria-label="直近の営業実績">
        <p>第{report.week}週の営業実績</p>
        <dl><div><dt>店舗利益</dt><dd className={actual.profit < 0 ? 'negative' : undefined}>{yen(actual.profit)}</dd></div>
          <div><dt>来店者数</dt><dd>{actual.customers.toLocaleString('ja-JP')}人</dd></div></dl>
      </section> : <p className="store-management-empty">{noResults}</p>}
      <h3 className="store-management-heading" ref={heading} tabIndex={-1}>この店で何をしますか？</h3>
      <nav className="store-management-purposes" aria-label="店舗の操作">
        {purposes.map(({ id, title, detail, icon: Icon }) => <button type="button" key={id} onClick={() => changePurpose(id)}>
          <Icon size={20} aria-hidden="true"/><span>{title}<small>{detail}</small></span><ArrowUpRight size={14} aria-hidden="true"/>
        </button>)}
      </nav>
      {onViewStore && <button type="button" className="text-button store-management-view" onClick={() => onViewStore(store.lotId)}>街でこの店を見る <ArrowUpRight size={14}/></button>}
      <details className="store-management-admin"><summary>店舗管理</summary>
        <DraftField label="店舗名" value={store.name} maxLength={35} disabled={locked} onCommit={name => update({ name: name.trim() })}/>
        <button type="button" className="danger-link" disabled={locked} onClick={() => {
          if (window.confirm(`${store.name} を閉店しますか？`)) onAction({ type: 'closeStore', storeId: store.id });
        }}>この店を閉店する</button>
      </details>
    </> : <>
      <button type="button" className="store-management-back" onClick={() => changePurpose('home')}><ArrowLeft size={15}/> 店舗トップへ</button>
      <h3 className="store-management-heading" ref={heading} tabIndex={-1}>{purposeTitles[purpose]}</h3>
      {purpose !== 'results' && <p className="store-management-hint">入力を終えると設定に反映されます。実績は週末に確定します。</p>}
      {purpose === 'product' && <>
        <DraftField label="販売価格（円）" value={store.price} min={200} max={2500} step={50} disabled={locked} onCommit={price => update({ price: numeric(price) })}/>
        <label>品質 <span>{store.quality}</span><input type="range" min={20} max={100} step={5} value={store.quality} disabled={locked} onChange={event => update({ quality: Number(event.target.value) })}/></label>
        <p className="store-management-hint">品質は満足度と材料費に関わります。</p>
        {store.manager && <p className="store-management-hint">店長に委任中です。営業時には価格と品質も必要に応じて調整されます。</p>}
      </>}
      {purpose === 'people' && <>
        <DraftField label="従業員数" value={store.staff} min={1} max={30} step={1} disabled={locked} onCommit={staff => update({ staff: numeric(staff) })}/>
        <StoreStaffCapacityNote insight={insight}/>
        <label className="toggle"><input type="checkbox" checked={store.manager} disabled={locked} onChange={event => update({ manager: event.target.checked })}/>
          <span>店長に運営を委任<small>店長費 週{yen(72_000 * wages)}</small></span></label>
        <p className="store-management-hint">店長は価格・人員・品質・広告を必要に応じて調整します。入力した人員と広告費が配分枠になります。出店・改装は自分で決めます。</p>
      </>}
      {purpose === 'promotion' && <>
        <DraftField label="週間広告費（円）" value={store.marketing} min={0} max={500000} step={10000} disabled={locked} onCommit={marketing => update({ marketing: numeric(marketing) })}/>
        <label>内装・営業スタイル<select value={store.style} disabled={locked} onChange={event => update({ style: event.target.value as StoreStyle })}>
          {Object.entries(styles).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select><small className="store-management-cost">変更時に800,000円を支払います。</small></label>
        <div className="store-management-upgrade"><p>設備 Lv.{store.level}</p>
          {store.level < 5 ? <button type="button" className="secondary" disabled={locked} onClick={() => onAction({ type: 'upgradeStore', storeId: store.id })}>設備を増強 · {yen(1_200_000 * store.level)}</button>
            : <span className="owned-label">設備は最大レベルです</span>}
        </div>
      </>}
      {purpose === 'results' && (actual && report ? <>
        <p className="store-management-hint">第{report.week}週に確定した、この店の実績です。</p>
        <dl className="store-management-results"><div><dt>売上</dt><dd>{yen(actual.revenue)}</dd></div>
          <div><dt>店舗利益</dt><dd className={actual.profit < 0 ? 'negative' : undefined}>{yen(actual.profit)}</dd></div>
          <div><dt>来店者数</dt><dd>{actual.customers.toLocaleString('ja-JP')}人</dd></div>
          <div><dt>満足度</dt><dd>{actual.satisfaction} / 100</dd></div></dl>
        <p className="store-management-hint">店舗利益は本部費・利息などを含みません。</p>
      </> : <p className="store-management-empty">{noResults}</p>)}
      {purpose !== 'results' && <StoreOperatingInsightPanel insight={insight} storeName={store.name} reasonsId={reasonsId}/>} 
    </>}
  </div>;
}
