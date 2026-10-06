import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { GameState, GameAction, StockDefinition } from '../model';
import { STOCKS } from '../data/stocks';
import { previewWeek } from '../sim/engine';
import { quoteStockTrade, settleStockTradeCash } from '../sim/stockTrading';
import MarketAcquisitionsPanel from './MarketAcquisitionsPanel';
import type { InvestmentIntent, InvestmentVisit } from './investmentPlanning';
import GameDialog from './GameDialog';
import './market.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const stockYen = (value: number) => `¥${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`;
const markets = { Prime: 'プライム', Standard: 'スタンダード', Growth: 'グロース', REIT: 'REIT' };
const profiles = { defensive: '安定重視', income: '配当重視', growth: '成長期待', cyclical: '景気連動', speculative: '値動き大' };
const riskNotes = { defensive: '比較的穏やかな値動き。下落する週もあります。', income: '配当を重視した設定。株価下落で配当以上の損失が出ることもあります。', growth: '将来の成長期待で動く銘柄。上昇と下落の幅が大きめです。', cyclical: '景気や業種の波を受けやすい銘柄です。', speculative: '値動きが大きく、短期間に大きく下落する可能性があります。' };

export default function MarketPanel({ state, onAction, busy = false, onPlanInvestment, investmentVisit, initialSection = 'investment' }: { state: GameState; onAction: (action: GameAction) => boolean | void | Promise<boolean | void>; busy?: boolean; onPlanInvestment?: (intent: InvestmentIntent) => void; investmentVisit?: InvestmentVisit | null; initialSection?: 'investment' | 'acquisitions' }) {
  const [section, setSection] = useState<'investment' | 'acquisitions'>(initialSection);
  const [activeVisit, setActiveVisit] = useState<InvestmentVisit | null>(null);
  const handledVisit = useRef<string | null>(null);
  useEffect(() => {
    if (!investmentVisit || investmentVisit.intent.kind !== 'acquisition' || handledVisit.current === investmentVisit.id) return;
    handledVisit.current = investmentVisit.id;
    setActiveVisit(investmentVisit);
    setSelectedId(null);
    setSection('acquisitions');
  }, [investmentVisit]);
  const acquired = new Set(state.marketAcquisitions?.companies.map(c => c.stockId) ?? []);
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('all');
  const [profile, setProfile] = useState('all');
  const [budget, setBudget] = useState('all');
  const [sort, setSort] = useState('price');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [side, setSide] = useState<'buyStock' | 'sellStock'>('buyStock');
  const priceOf = (stock: StockDefinition) => state.stockPrices[stock.id] ?? stock.basePrice;
  const portfolioValue = state.positions.reduce((sum, position) => sum + (state.stockPrices[position.stockId] ?? STOCKS.find(s => s.id === position.stockId)?.basePrice ?? 0) * position.shares, 0);
  const cost = state.positions.reduce((sum, position) => sum + position.averageCost * position.shares, 0);
  const annualDividends = previewWeek(state).dividendsReceived * 52;
  const selected = STOCKS.find(stock => stock.id === selectedId);
  const position = state.positions.find(item => item.stockId === selectedId);
  const shares = Number(quantity);
  const validShares = Number.isSafeInteger(shares) && shares > 0 && shares <= 1_000_000_000;
  let total: number | null = null, cashAfter: number | null = null, tradeError: string | null = null;
  if (selected && validShares) {
    try {
      total = quoteStockTrade(priceOf(selected), shares, side === 'buyStock' ? 'buy' : 'sell');
      cashAfter = settleStockTradeCash(state.cash, total, side === 'buyStock' ? 'buy' : 'sell');
    } catch (error) { tradeError = error instanceof Error ? error.message : '取引金額を確認できません。'; }
  }
  const canTrade = !!selected && !acquired.has(selected.id) && validShares && !tradeError && cashAfter !== null && !busy && !state.gameOver && (side === 'buyStock' || shares <= (position?.shares ?? 0));
  const visible = STOCKS.filter(stock => {
    let withinBudget = budget === 'all';
    if (!withinBudget) {
      try {
        const purchase = quoteStockTrade(priceOf(stock), 1, 'buy');
        if (budget === 'cash') { settleStockTradeCash(state.cash, purchase, 'buy'); withinBudget = true; }
        else withinBudget = purchase <= Number(budget);
      } catch { withinBudget = false; }
    }
    return (market === 'all' || stock.market === market) && (profile === 'all' || stock.profile === profile)
      && (!ownedOnly || state.positions.some(p => p.stockId === stock.id))
      && withinBudget
      && `${stock.name} ${stock.realName} ${stock.code}`.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => sort === 'price' ? priceOf(a) - priceOf(b) : sort === 'yield' ? b.dividendYield - a.dividendYield : a.code.localeCompare(b.code));
  const openOrder = (id: string, action: 'buyStock' | 'sellStock') => { setSelectedId(id); setSide(action); setQuantity('1'); };
  return <div className="investment-panel">
    <div className="market-tabs market-section-tabs" role="group" aria-label="株式市場の使い方"><button className={section === 'investment' ? 'active' : ''} aria-pressed={section === 'investment'} onClick={() => { setActiveVisit(null); setSection('investment'); }}>株式投資</button><button className={section === 'acquisitions' ? 'active' : ''} aria-pressed={section === 'acquisitions'} onClick={() => { setActiveVisit(null); setSelectedId(null); setSection('acquisitions'); }}>友好的買収</button></div>
    {section === 'acquisitions' ? <MarketAcquisitionsPanel state={state} onAction={onAction} busy={busy} onPlanInvestment={onPlanInvestment} investmentVisit={activeVisit}/> : <>
    <div className="summary-strip">
      <div className="metric"><span>株式評価額</span><strong>{yen(portfolioValue)}</strong><small>取得総額 {yen(cost)}</small></div>
      <div className="metric"><span>評価損益</span><strong className={portfolioValue >= cost ? 'positive' : 'negative'}>{yen(portfolioValue - cost)}</strong><small>{state.positions.length} 銘柄を保有</small></div>
      <div className="metric"><span>年間受取配当の目安</span><strong>{yen(annualDividends)}</strong><small>今週の配当予測 × 52週</small></div>
    </div>
    <div className="market-intro"><div><span className="eyebrow">A SMALL INVESTMENT, A BIGGER WORLD</span><h3>1株から、企業の成長に参加する。</h3><p>少額株、大型株、新興企業、不動産投資まで。手元資金 {yen(state.cash)} から投資できます。</p></div><span className="market-total">{STOCKS.length}<small>銘柄</small></span></div>
    <div className="market-tabs" role="group" aria-label="上場市場で絞り込み">
      <button className={market === 'all' ? 'active' : ''} onClick={() => setMarket('all')}>すべて <small>{STOCKS.length}</small></button>
      {Object.entries(markets).map(([key, label]) => <button key={key} className={market === key ? 'active' : ''} onClick={() => setMarket(key)}>{label} <small>{STOCKS.filter(stock => stock.market === key).length}</small></button>)}
    </div>
    <p className="market-note">グロースには旧マザーズの企業も含みます。全銘柄1株単位で売買できるゲーム独自のルールです。安い株価でも、値下がりリスクが小さいとは限りません。</p>
    <div className="investment-filters">
      <label className="search-field"><Search size={17}/><input aria-label="銘柄を検索" placeholder="架空名・実在名・コード" value={query} onChange={e => setQuery(e.target.value)}/></label>
      <select aria-label="投資タイプ" value={profile} onChange={e => setProfile(e.target.value)}><option value="all">すべての投資タイプ</option>{Object.entries(profiles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="1株の購入予算" value={budget} onChange={e => setBudget(e.target.value)}><option value="all">1株の予算：指定なし</option><option value="500">500円以下</option><option value="1000">1,000円以下</option><option value="5000">5,000円以下</option><option value="cash">手元資金で買える</option></select>
      <select aria-label="並び順" value={sort} onChange={e => setSort(e.target.value)}><option value="price">少額で買える順</option><option value="yield">設定配当利回り順</option><option value="code">コード順</option></select>
    </div>
    <div className="market-results"><span>{visible.length} 銘柄を表示 · 第{state.week}週のゲーム内価格</span><label><input type="checkbox" checked={ownedOnly} onChange={e => setOwnedOnly(e.target.checked)}/> 保有銘柄のみ</label></div>
    <div className="table-wrap"><table><thead><tr><th>銘柄 / 投資タイプ</th><th>ゲーム内株価</th><th>保有 / 評価損益</th><th>1株から取引</th></tr></thead><tbody>{visible.map(stock => {
      const held = state.positions.find(p => p.stockId === stock.id);
      const price = priceOf(stock);
      return <tr key={stock.id}><td><strong>{stock.name}</strong><small>{stock.code} · {stock.market ? markets[stock.market] : 'その他'} · {stock.sector}</small><span className={`investment-tag ${stock.profile ?? ''}`}>{stock.profile ? profiles[stock.profile] : '一般'}</span></td><td><strong>{stockYen(price)}</strong><small>設定配当利回り {(stock.dividendYield * 100).toFixed(1)}%</small><small>{stock.priceKind === 'market-reference' ? '初期参考値' : '仮設定価格'} {stockYen(stock.basePrice)}{stock.priceDate ? ` / ${stock.priceDate}` : ' / 取得日なし'}</small></td><td>{held ? <><strong>{held.shares.toLocaleString()} 株</strong><small className={price >= held.averageCost ? 'positive' : 'negative'}>{yen((price - held.averageCost) * held.shares)}</small><small>取得単価 {stockYen(held.averageCost)}</small></> : <span className="muted">未保有</span>}</td><td><div className="button-row"><button className="secondary" disabled={busy || state.gameOver || acquired.has(stock.id)} onClick={() => openOrder(stock.id, 'buyStock')}>買う</button>{held && <button className="secondary" disabled={busy || state.gameOver || acquired.has(stock.id)} onClick={() => openOrder(stock.id, 'sellStock')}>売る</button>}</div>{acquired.has(stock.id) && <small className="positive">グループ傘下・通常売買終了</small>}</td></tr>;
    })}</tbody></table>{visible.length === 0 && <div className="empty small"><p>条件に合う銘柄がありません。</p><button className="secondary" onClick={() => { setQuery(''); setMarket('all'); setProfile('all'); setBudget('all'); setOwnedOnly(false); }}>絞り込みを解除</button></div>}</div>
    <p className="market-note">株価は週ごとに変動するシミュレーションです。初期参考値は取得日時点の値で、現在の実市場価格ではありません。配当利回り・投資タイプはゲーム用の設定です。受取配当は毎週計上され、借入中の倒産判定に使う事業利益には含まれません。</p>
    {selected && <GameDialog title={`${selected.name}の${side === 'buyStock' ? '購入' : '売却'}`} className="investment-order" close={() => { if (!busy) setSelectedId(null); }}><p className="market-note">{selected.code} · {selected.market ? markets[selected.market] : ''}</p>
      <p>{selected.profile ? riskNotes[selected.profile] : '株価は週ごとに変動します。'}</p><dl className="cost-list"><div><dt>ゲーム内株価 / 第{state.week}週</dt><dd>{stockYen(priceOf(selected))}</dd></div><div><dt>保有株数</dt><dd>{position?.shares.toLocaleString() ?? 0} 株</dd></div><div><dt>手元資金</dt><dd>{yen(state.cash)}</dd></div></dl>
      <label>{side === 'buyStock' ? '購入株数' : '売却株数'}<input autoFocus type="number" min={1} max={1_000_000_000} step={1} value={quantity} onChange={e => setQuantity(e.target.value)}/></label><div className="button-row">{[1, 10, 100].map(n => <button key={n} className="secondary" onClick={() => setQuantity(String(n))}>{n} 株</button>)}{side === 'sellStock' && position && <button className="secondary" onClick={() => setQuantity(String(position.shares))}>全株</button>}</div>
      <dl className="cost-list"><div><dt>{side === 'buyStock' ? '購入総額' : '売却総額'}</dt><dd>{!validShares ? '株数を入力してください' : total === null ? '見積もり不可' : yen(total)}</dd></div>{validShares && <div><dt>取引後の手元資金</dt><dd>{cashAfter === null ? '取引できません' : yen(cashAfter)}</dd></div>}</dl>
      {!validShares ? <p className="warning">1以上の整数で株数を入力してください。</p> : tradeError ? <p className="warning">{side === 'buyStock' && total !== null && total > state.cash ? '購入総額が手元資金を超えています。' : tradeError}</p> : side === 'sellStock' && shares > (position?.shares ?? 0) ? <p className="warning">売却株数が保有株数を超えています。</p> : null}
      <p className="market-note">取引総額の1円未満は、購入時に切り上げ、売却時に切り捨てます。</p><p className="market-note">{selected.priceKind === 'market-reference' ? '初期参考値' : '仮設定価格'} {stockYen(selected.basePrice)} · {selected.priceDate ?? '取得日なし（仮設定）'}<br/>参考企業：{selected.realName} {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">参考データを見る</a>}</p><button className="primary" disabled={!canTrade} onClick={() => { if (canTrade) { void Promise.resolve(onAction({ type: side, stockId: selected.id, shares })).then(result => { if (result !== false) setSelectedId(null); }); } }}>{!validShares ? '株数を入力してください' : total === null ? '取引金額を確認できません' : `${shares.toLocaleString()}株を${side === 'buyStock' ? '購入' : '売却'}する · ${yen(total)}`}</button>
    </GameDialog>}
  </>}
  </div>;
}
