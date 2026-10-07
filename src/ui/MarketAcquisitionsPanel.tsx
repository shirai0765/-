import { formatReputation } from '../format';
import { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { GameAction, GameState, MarketAcquisitionMode } from '../model';
import { STOCKS } from '../data/stocks';
import { getMarketAcquisitionTargets, getMarketGroupFinancials } from '../sim/marketAcquisitions';
import { applyAction, getWeekOutlook } from '../sim/engine';
import { getAcquisitionComparison, previewAcquisitionComparison } from '../sim/acquisitionComparison';
import MarketAcquisitionComparison from './MarketAcquisitionComparison';
import type { InvestmentIntent, InvestmentVisit } from './investmentPlanning';
import GameDialog from './GameDialog';
import './market-acquisitions.css';
const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

const rangeYen = (range: { min: number; max: number }) => `約${yen(Math.floor(range.min / 1000) * 1000)}〜${yen(Math.ceil(range.max / 1000) * 1000)}`;
const markets: Record<string, string> = { Prime: 'プライム', Standard: 'スタンダード', Growth: 'グロース', REIT: 'REIT' };
const pageSize = 12;
export default function MarketAcquisitionsPanel({ state, onAction, busy = false, onPlanInvestment, investmentVisit, onManageSector }: { state: GameState; onAction: (action: GameAction) => boolean | void | Promise<boolean | void>; busy?: boolean; onPlanInvestment?: (intent: InvestmentIntent) => void; investmentVisit?: InvestmentVisit | null; onManageSector?: (sector: string) => void }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('all');
  const [sector, setSector] = useState('all');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('quote');
  const [budget, setBudget] = useState('');
  const [risk, setRisk] = useState('all');
  const [listMode, setListMode] = useState<MarketAcquisitionMode>('autonomous');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonModes, setComparisonModes] = useState<Record<string, MarketAcquisitionMode>>({});
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'autonomous' | 'integrated'>('autonomous');
  const [step, setStep] = useState<'detail' | 'research' | 'acquire'>('detail');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handledVisit = useRef<string | null>(null);
  useEffect(() => {
    if (!investmentVisit || investmentVisit.intent.kind !== 'acquisition' || handledVisit.current === investmentVisit.id) return;
    handledVisit.current = investmentVisit.id;
    setSelectedId(investmentVisit.intent.stockId);
    setMode(investmentVisit.intent.mode);
    setStep('detail');
    setError('');
  }, [investmentVisit]);
  const targets = getMarketAcquisitionTargets(state);
  const financials = getMarketGroupFinancials(state);
  const groupProfitRange = { min: getMarketGroupFinancials(state, 'low').weeklyProfit, max: getMarketGroupFinancials(state, 'high').weeklyProfit };
  const selected = targets.find(t => t.stockId === selectedId);
  const stock = STOCKS.find(s => s.id === selectedId);
  const plan = selected?.choices.find(c => c.mode === mode);
  const heldValue = selected ? Math.round((state.positions.find(p => p.stockId === selected.stockId)?.shares ?? 0) * (state.stockPrices[selected.stockId] ?? 0)) : 0;
  const acquiredCompany = state.marketAcquisitions?.companies.find(c => c.stockId === selectedId);
  const acquiredPlan = selected?.choices.find(c => c.mode === acquiredCompany?.mode);
  const owned = selected?.status === 'owned' || selected?.status === 'integrating';
  const disabled = busy || submitting || state.gameOver;
  const rows = targets.map(t => getAcquisitionComparison(state, t, listMode));
  const visible = rows.filter(row => {
    const t = row.target, source = STOCKS.find(s => s.id === t.stockId)!;
    return (market === 'all' || t.market === market) && (sector === 'all' || source.sector === sector)
      && (filter === 'all' || (filter === 'affordable' ? !row.owned && row.remainingCashBudget <= state.cash : filter === 'owned' ? row.owned : filter === 'unowned' ? !row.owned : filter === 'ready' ? row.ready : !t.researched && !row.owned))
      && (budget === '' || (!row.owned && row.remainingCashBudget <= Math.max(0, Number(budget))))
      && (risk === 'all' || row.risk <= Number(risk))
      && `${t.name} ${source.realName} ${source.code}`.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a, b) => (sort === 'budget' ? a.remainingCashBudget - b.remainingCashBudget : sort === 'profit' ? b.choice.weeklyProfitRange.min - a.choice.weeklyProfitRange.min : sort === 'risk' ? a.risk - b.risk : sort === 'lead' ? a.choice.leadWeeks - b.choice.leadWeeks : a.target.quotePrice - b.target.quotePrice) || a.target.quotePrice - b.target.quotePrice);
  const comparisons = comparisonIds.flatMap(id => {
    const target = targets.find(t => t.stockId === id);
    if (!target || target.status === 'owned' || target.status === 'integrating') return [];
    const comparisonMode = comparisonModes[id] ?? 'autonomous';
    return [{ ...getAcquisitionComparison(state, target, comparisonMode), forecast: previewAcquisitionComparison(state, target, comparisonMode) }];
  });
  const openDetails = (id: string, selectedMode: MarketAcquisitionMode = 'autonomous') => { setSelectedId(id); setMode(selectedMode); setStep('detail'); setError(''); };
  const toggleComparison = (id: string) => setComparisonIds(ids => {
    const active = ids.filter(existing => targets.some(t => t.stockId === existing && t.status !== 'owned' && t.status !== 'integrating'));
    return active.includes(id) ? active.filter(existing => existing !== id) : active.length < 3 ? [...active, id] : active;
  });
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / pageSize) - 1));
  const action: GameAction | null = selected && step === 'research' ? { type: 'researchMarketCompany', stockId: selected.stockId } : selected && step === 'acquire' ? { type: 'acquireMarketCompany', stockId: selected.stockId, mode } : null;
  let after: GameState | null = null;
  let actionError = '';
  if (action) {
    try { after = applyAction(state, action); } catch (e) { actionError = e instanceof Error ? e.message : '現在の条件では実行できません。'; }
  }
  const afterForecast = after ? getWeekOutlook(after) : null;
  const execute = async () => {
    if (!action || !after || disabled) return;
    setSubmitting(true); setError('');
    try { const result = await onAction(action); if (result === false) setError('操作を完了できませんでした。条件を確認してください。'); else setStep('detail'); }
    catch (e) { setError(e instanceof Error ? e.message : '操作を完了できませんでした。'); }
    finally { setSubmitting(false); }
  };
  return <div className="market-acquisitions">
    <header className="ma-intro"><div><span className="eyebrow">FROM SHAREHOLDER TO BUSINESS OWNER</span><h3>100の企業・投資法人と、次の事業へ。</h3><p>調査を行い、友好的買収で事業をグループへ迎えます。経営陣に任せるか、時間と費用をかけて統合するかを選びましょう。</p></div><Building2 size={28}/></header>
    <div className="summary-strip"><div className="metric"><span>稼働中 / 引継ぎ中</span><strong>{financials.operating} / {financials.integrating}</strong><small>対象 {targets.length} 社・投資法人</small></div><div className="metric"><span>市場買収事業の利益幅 / 週</span><strong>{rangeYen(groupProfitRange)}</strong><small>稼働利益と引継ぎ費用を反映</small></div><div className="metric"><span>手元資金</span><strong>{yen(state.cash)}</strong><small>調査と投資の余力を確認</small></div></div>
    <p className="market-note">買収額はゲーム専用の企業評価額です。1株の株価・実在企業の時価総額とは異なります。架空の企業・投資法人の友好的買収として扱い、買収後は通常の株式売買を終了します。</p>
    <div className="ma-filters"><input aria-label="買収候補を検索" placeholder="架空名・実在名・コードで検索" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/><select aria-label="買収候補の市場" value={market} onChange={e => { setMarket(e.target.value); setPage(0); }}><option value="all">すべての市場</option>{Object.entries(markets).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select aria-label="買収候補の業種" value={sector} onChange={e => { setSector(e.target.value); setPage(0); }}><option value="all">すべての業種</option>{[...new Set(STOCKS.map(s => s.sector))].sort().map(s => <option key={s} value={s}>{s}</option>)}</select><select aria-label="買収候補の状態" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="all">すべての候補</option><option value="affordable">手元資金内（準備費を確保）</option><option value="ready">今すぐ取得可能</option><option value="unowned">未取得</option><option value="unresearched">未調査</option><option value="owned">グループ傘下</option></select></div>
    <div className="ma-strategy-filters">
      <label>一覧の運営方式<select aria-label="一覧の運営方式" value={listMode} onChange={e => { setListMode(e.target.value as MarketAcquisitionMode); setPage(0); }}><option value="autonomous">独立運営を維持</option><option value="integrated">グループへ統合</option></select></label>
      <label>比較する順序<select aria-label="買収候補の並べ替え" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="quote">買収評価額の低い順</option><option value="budget">残り必要現金の少ない順</option><option value="profit">稼働利益レンジ下限の高い順</option><option value="risk">業績変動幅の小さい順</option><option value="lead">稼働開始まで短い順</option></select></label>
      <label>準備費込みの現金予算<input aria-label="買収候補の現金予算" type="number" min="0" step="100000" placeholder="上限なし（円）" value={budget} onChange={e => { setBudget(e.target.value); setPage(0); }}/></label>
      <label>業績変動幅<select aria-label="買収候補の変動幅" value={risk} onChange={e => { setRisk(e.target.value); setPage(0); }}><option value="all">すべて</option><option value="0.14">最大約14%以下</option><option value="0.28">最大約28%以下</option><option value="0.35">最大約35%以下</option></select></label>
    </div>
    <p className="market-note">{visible.length} 件該当 · 一覧は{listMode === 'autonomous' ? '独立運営' : 'グループ統合'}で比較。残り必要現金は未払調査費・株式充当後の取得費・引継ぎ準備費を含みます。予算内でも信用・上場・調査条件の確認が必要です。</p>
    <MarketAcquisitionComparison comparisons={comparisons} cash={state.cash}
      onClear={() => setComparisonIds([])} onRemove={toggleComparison}
      onModeChange={(stockId, chosenMode) => setComparisonModes(modes => ({ ...modes, [stockId]: chosenMode }))}
      onOpenDetails={openDetails}
      onRequestFunding={onPlanInvestment ? (stockId, chosenMode) => onPlanInvestment({ kind: 'acquisition', stockId, mode: chosenMode }) : undefined}/>
    <div className="ma-list">{visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(row => { const t = row.target; const source = STOCKS.find(s => s.id === t.stockId)!; return <article className="ma-card" key={t.stockId}><header className="ma-card-header"><span>{source.code} · {t.market ? markets[t.market] : 'その他'}</span><span className={t.status === 'owned' || t.status === 'integrating' ? 'ma-owned' : ''}>{t.status === 'owned' ? '稼働中' : t.status === 'integrating' ? `引継ぎ中 · あと${t.remainingWeeks}週` : t.researched ? '調査済み' : '未調査'}</span></header><h3>{t.name}</h3><p>{source.sector}{t.isFund ? ' · 投資法人' : ''}</p><div className="ma-card-cost"><span>ゲーム内買収評価額</span><strong>{yen(t.quotePrice)}</strong></div>{!row.owned && <dl className="ma-card-strategy"><div><dt>残り必要現金</dt><dd>{yen(row.remainingCashBudget)}</dd></div><div><dt>稼働利益 / 週（{t.researched ? '調査済' : '暫定'}）</dt><dd>{yen(row.choice.weeklyProfitRange.min)} 〜 {yen(row.choice.weeklyProfitRange.max)}</dd></div><div><dt>開始まで / 業績変動幅</dt><dd>{row.choice.leadWeeks}週 / 最大約{Math.round(row.risk * 100)}%</dd></div></dl>}<p>{t.status === 'owned' || t.status === 'integrating' ? '取得済みの事業を確認できます。'  : t.reason || (row.ready ? '選択した方式の買収条件を満たしています。' : '選択した方式の統合費を含む資金が不足しています。')}</p><button className="secondary" onClick={() => openDetails(t.stockId, listMode)}>{row.owned ? '事業の状況を見る' : '調査・買収条件を見る'}</button>{!row.owned && <button className="secondary ma-compare-toggle" aria-pressed={comparisons.some(c => c.target.stockId === t.stockId)} disabled={comparisons.length >= 3 && !comparisons.some(c => c.target.stockId === t.stockId)} onClick={() => { setComparisonModes(modes => ({ ...modes, [t.stockId]: listMode })); toggleComparison(t.stockId); }}>{comparisons.some(c => c.target.stockId === t.stockId) ? '比較から外す' : '比較に追加'}</button>}</article>; })}</div>
    {!visible.length && <div className="empty small"><p>条件に合う候補がありません。</p><button className="secondary" onClick={() => { setQuery(''); setMarket('all'); setSector('all'); setFilter('all'); setBudget(''); setRisk('all'); setPage(0); }}>絞り込みを解除</button></div>}
    {visible.length > pageSize && <nav className="ma-pagination" aria-label="買収候補のページ"><button className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>前へ</button><span>{currentPage + 1} / {Math.ceil(visible.length / pageSize)} ページ</span><button className="secondary" disabled={(currentPage + 1) * pageSize >= visible.length} onClick={() => setPage(currentPage + 1)}>次へ</button></nav>}
    {selected && stock && <GameDialog title={`${selected.name}の${owned ? '事業の状況' : step === 'research' ? '調査確認' : step === 'acquire' ? '買収確認' : '買収条件'}`} className="ma-modal" close={() => { if (!busy && !submitting) setSelectedId(null); }}>
      <dl className="cost-list"><div><dt>ゲーム専用の企業買収評価額</dt><dd>{yen(selected.quotePrice)}</dd></div><div><dt>参考：ゲーム内株価 / 1株</dt><dd>{yen(state.stockPrices[stock.id] ?? stock.basePrice)}</dd></div><div><dt>必要信用 / 現在</dt><dd>{selected.minReputation} / {formatReputation(state.reputation)}</dd></div><div><dt>自社の上場条件</dt><dd>{selected.requiresListing ? '上場が必要' : '未上場でも取得可能'}</dd></div></dl>
      <p className="ma-note">参照元：{stock.realName} · {stock.priceKind === 'market-reference' ? '初期参考株価' : '仮設定株価'} {yen(stock.basePrice)} / {stock.priceDate ?? '取得日なし'}。買収評価額は実在企業の価値を示しません。</p>
      {owned ? <section className="ma-forecast"><h3>{selected.status === 'owned' ? 'グループ事業として稼働中' : '経営の引継ぎ中'}</h3><p>{selected.status === 'integrating' ? `引継ぎ完了まであと ${selected.remainingWeeks} 週。` : '今週の会社予測に事業収支を反映しています。'}通常の株式売買は終了しています。</p>{acquiredPlan && <><p>選択した運営方式：{acquiredPlan.name}</p><p>稼働後の週次利益レンジ：{yen(acquiredPlan.weeklyProfitRange.min)} 〜 {yen(acquiredPlan.weeklyProfitRange.max)}</p>{selected.status === 'integrating' && <p>引継ぎ期間の費用：{yen(acquiredPlan.weeklyIntegrationCost)} / 週</p>}</>}{onManageSector && <button type="button" className="secondary" disabled={busy || submitting} onClick={() => { setSelectedId(null); onManageSector(stock.sector); }}>この業種の運営を考える</button>}</section> : <>
      {selected.researched ? <section><h3>調査結果：{selected.quality ?? '確認済み'}</h3><ul>{selected.risks.map(r => <li key={r}>{r}</li>)}</ul><p className="ma-note">利益レンジはゲーム内の試算です。景況と稼働条件により変動し、収益を保証しません。</p></section> : <section><h3>取得前に事業を調べる</h3><p>調査費 {yen(selected.researchCost)}。一度の調査で事業品質とリスクを確認できます。買収には調査の完了が必要です。</p><ul>{selected.risks.map(r => <li key={r}>{r}</li>)}</ul></section>}
      {step === 'detail' && onPlanInvestment && <button className="secondary" disabled={disabled} onClick={() => onPlanInvestment({ kind: 'acquisition', stockId: selected.stockId, mode })}>この案の資金調達を比較</button>}
      {step === 'detail' && !selected.researched && <button className="primary" disabled={disabled || state.cash < selected.researchCost} onClick={() => { setStep('research'); setError(''); }}>有料調査の支払を確認 · {yen(selected.researchCost)}</button>}
      {selected.researched && step !== 'research' && <><div className="ma-mode-options" role="group" aria-label="買収後の運営方式">{selected.choices.map(c => <button key={c.mode} aria-pressed={mode === c.mode} disabled={submitting} onClick={() => setMode(c.mode)}><strong>{c.name}</strong><small>{c.description}</small><small>引継ぎ {c.leadWeeks} 週 · 統合費 {yen(c.integrationCost)}</small><small>引継ぎ中の費用 {yen(c.weeklyIntegrationCost)} / 週</small><small>稼働後利益 {yen(c.weeklyProfitRange.min)} 〜 {yen(c.weeklyProfitRange.max)} / 週</small></button>)}</div>{plan && <dl className="cost-list"><div><dt>買収評価額 ＋ 統合費</dt><dd>{yen(selected.quotePrice + plan.integrationCost)}</dd></div><div><dt>保有株式の時価（全株充当）</dt><dd>{yen(heldValue)}</dd></div><div><dt>今回支払う現金</dt><dd>{yen(plan.upfrontCost)}</dd></div>{plan.refund > 0 && <div><dt>超過保有分の現金受取</dt><dd>{yen(plan.refund)}</dd></div>}</dl>}<p className="ma-note">保有株は現在のゲーム内時価で充当し、買収時に株式ポートフォリオから取り除きます。取得後の取り消し・通常売却はできません。</p>{selected.reason && <p className="ma-warning">{selected.reason}</p>}{step === 'detail' && <button className="primary" disabled={disabled || !selected.unlocked || !plan || state.cash < plan.upfrontCost} onClick={() => { setStep('acquire'); setError(''); }}>買収と引継ぎを確認</button>}</>}
      {step !== 'detail' && <><section className="ma-forecast"><h4>{step === 'research' ? `調査費 ${yen(selected.researchCost)} を支払います` : '取得時の支払と精算'}</h4><p>手元資金：{yen(state.cash)} → {after ? yen(after.cash) : '条件未達'}</p></section><p className="ma-note">{step === 'research' ? '調査費は即時支払い・返金不可です。調査だけでは買収されません。' : '引継ぎ中も準備費がかかります。対象事業の稼働後利益は試算で、店舗を含む全社の実績は週末の決算で確認します。'}</p>{afterForecast?.risk.debtLossPossible && <p className="warning" role="alert">借入中の収支にリスクがあります。週末の実際の利益（利息後）が0以下なら倒産します。</p>}{afterForecast?.risk.cashShortfallPossible && <p className="warning" role="alert">実行後の支払いに備える資金が不足するおそれがあります。引継ぎ費用や返済に備えて現金を残してください。</p>}{(error || actionError) && <p className="ma-error" role="alert">{error || actionError}</p>}<div className="button-row"><button className="secondary" disabled={submitting} onClick={() => { setStep('detail'); setError(''); }}>条件に戻る</button><button className="primary" disabled={disabled || !after} onClick={() => void execute()}>{submitting ? '処理中…' : step === 'research' ? '調査費を支払う' : '友好的買収を実行する'}</button></div></>}
      </>}
    </GameDialog>}
  </div>;
}
