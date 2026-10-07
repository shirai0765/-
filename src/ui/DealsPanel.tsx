import { useState } from 'react';
import { BriefcaseBusiness, FileSearch, Mail } from 'lucide-react';
import type { DealOffer, GameAction, GameState } from '../model';
import { STOCKS } from '../data/stocks';
import { getWeekOutlook } from '../sim/engine';
import { getOffers, getDealContext, getDealTermNetRange } from '../sim/deals';
import GameDialog from './GameDialog';
import './deals.css';

const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const category = { system: '店舗システム', marketing: '集客支援', property: '不動産提案' };
const totalCost = (o: DealOffer) => o.upfrontCost + o.weeklyFee * o.termWeeks;
export default function DealsPanel({ state, onAction, busy = false }: { state: GameState; onAction: (action: GameAction) => boolean | void | Promise<boolean | void>; busy?: boolean }) {
  const [confirm, setConfirm] = useState<GameAction | null>(null);
  const [error, setError] = useState('');
  const offers = getOffers(state);
  const contracts = state.deals?.contracts ?? [];
  const disabled = busy || state.gameOver;
  const selectedOffer = confirm && 'offerId' in confirm ? offers.find(o => o.id === confirm.offerId) : undefined;
  const selectedContract = confirm && 'contractId' in confirm ? contracts.find(c => c.id === confirm.contractId) : undefined;
  const selected = selectedOffer ?? selectedContract?.offer;
  const charge = confirm?.type === 'acceptOffer' ? selected?.upfrontCost ?? 0 : confirm?.type === 'investigateOffer' ? selected?.investigationCost ?? 0 : confirm?.type === 'cancelContract' ? selected?.cancellationFee ?? 0 : 0;
  const refund = confirm?.type === 'cancelContract' ? selected?.residualValue ?? 0 : 0;
  const preview = getWeekOutlook(state);
  const activeFees = contracts.filter(c => c.status === 'active').reduce((n, c) => n + c.offer.weeklyFee, 0);
  const act = async (action: GameAction) => { setError(''); try { const result = await onAction(action); if (result !== false) setConfirm(null); } catch (e) { setError(e instanceof Error ? e.message : '操作を完了できませんでした。'); } };
  return <div className="deals-panel">
    <div className="deals-intro"><div><span className="eyebrow">OPPORTUNITIES AT YOUR DOOR</span><h3>提案の先にある、経営判断。</h3><p>店舗の導入支援から不動産まで。営業担当の見立てを調べ、費用と条件を比較して決めましょう。</p></div><Mail size={30} strokeWidth={1}/></div>
    <div className="summary-strip"><div className="metric"><span>届いている提案</span><strong>{offers.length} 件</strong><small>第{state.week}週</small></div><div className="metric"><span>契約中の週額費用</span><strong>{yen(activeFees)}</strong><small>{contracts.filter(c => c.status === 'active').length} 件の契約</small></div><div className="metric"><span>手元資金</span><strong>{yen(state.cash)}</strong></div></div>
    <p className="deal-note">営業担当・事業者・提案はゲーム内の架空設定です。提示収益は営業担当の試算で、成果を保証しません。契約費用は利益を減らし、効果は導入後に判明します。借入がある週に利息控除後の利益がゼロ以下になると倒産します。</p>
    {error && <p className="warning" role="alert">{error}</p>}
    <div className="deals-grid">{offers.map(o => { const supplier = STOCKS.find(s => s.id === o.supplierStockId); const term = getDealTermNetRange(o); const context = getDealContext(o); return <article className="deal-card" key={o.id}>
      <div className="deal-card-top"><span className="deal-category">{category[o.category]}</span><span>第{o.expiresWeek}週まで</span></div>
      <h3>{o.title}</h3><div className="deal-sender"><span className="deal-avatar">{o.salesperson.slice(0, 1)}</span><div><strong>{o.salesperson}</strong><small>{o.supplier}{supplier ? ` · 関連銘柄 ${supplier.name}` : ''}</small></div></div>
      <blockquote>「{o.pitch}」</blockquote>
      <div className="deal-claim"><span>営業担当の提示効果 / 週</span><strong>+{yen(o.advertisedWeeklyBenefit)}</strong><small>週額費用を引く前の見込み{o.advertisedAnnualYield > 0 ? ` · 提示年利回り ${(o.advertisedAnnualYield * 100).toFixed(1)}%` : ''}</small></div>
      <dl className="deal-terms"><div><dt>初期支払</dt><dd>{yen(o.upfrontCost)}</dd></div><div><dt>週額費用 × 期間</dt><dd>{yen(o.weeklyFee)} × {o.termWeeks}週</dd></div><div><dt>満了までの固定支払総額</dt><dd>{yen(totalCost(o))}</dd></div><div><dt>効果判明まで</dt><dd>契約から {o.leadWeeks}週</dd></div><div><dt>途中解約料</dt><dd>{yen(o.cancellationFee)}</dd></div><div><dt>満了・解約時の換金額</dt><dd>{yen(o.residualValue)}</dd></div></dl>
      <div className="deal-fit" aria-label="満了までの収支比較"><strong>{context ? '作成時の店舗状況を反映した見込み' : '契約条件から見る収支幅'}</strong><p>週額費用控除前の効果：{yen(o.conservativeWeeklyBenefit)} 〜 {yen(o.optimisticWeeklyBenefit)} / 週</p><p>満了までの純収支見込み：<b className={term.high < 0 ? 'negative' : undefined}>{yen(term.low)} 〜 {yen(term.high)}</b></p><small>初期費・全{o.termWeeks}週の週額費・導入待ち{o.leadWeeks}週{o.investigated ? '・支払済み調査費' : ''}を含む。{o.residualValue > 0 ? '満了時の換金を含む。換金は営業利益ではありません。' : '残価なし。'} 解約なしの試算で、回収保証はありません。</small>{term.high < 0 && <p className="negative">上限の効果でも満了までの回収は難しい見込みです。調査せず見送ることもできます。</p>}</div>
      <div className="deal-clues"><strong>提案書で確認できること</strong><ul>{o.signals.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
      {o.investigated ? <div className="deal-report"><strong><FileSearch size={15}/> 調査レポート</strong><ul>{o.investigationNotes.map((n, i) => <li key={i}>{n}</li>)}</ul><p>調査時の週次効果レンジ：{yen(o.conservativeWeeklyBenefit)} 〜 {yen(o.optimisticWeeklyBenefit)}<br/>週額費用控除後：{yen(o.conservativeWeeklyBenefit - o.weeklyFee)} 〜 {yen(o.optimisticWeeklyBenefit - o.weeklyFee)}<br/>調査結果も将来の成果を保証しません。</p></div> : <button className="secondary deal-research" disabled={disabled || state.cash < o.investigationCost} onClick={() => setConfirm({ type: 'investigateOffer', offerId: o.id })}><FileSearch size={15}/> 調査を依頼 · {yen(o.investigationCost)}</button>}
      <div className="deal-buttons"><button className="primary" disabled={disabled || state.cash < o.upfrontCost || contracts.some(c => c.status === 'active' && c.offer.category === o.category)} onClick={() => setConfirm({ type: 'acceptOffer', offerId: o.id })}>契約条件を確認</button><button className="secondary" disabled={disabled} onClick={() => setConfirm({ type: 'declineOffer', offerId: o.id })}>見送る</button></div>
      {contracts.some(c => c.status === 'active' && c.offer.category === o.category) && <p className="deal-note">同じ種類の契約が稼働中です。新たに契約するには現在の契約終了が必要です。</p>}
      {state.cash < o.upfrontCost && <small className="negative">初期支払に必要な手元資金が不足しています。</small>}
    </article>; })}</div>
    {offers.length === 0 && <div className="empty small"><Mail size={28}/><h3>新しい提案を待っています</h3><p>店舗を経営しながら週を進めると営業が訪問します。事業規模が大きくなると不動産の提案も届きます。</p></div>}
    {contracts.length > 0 && <section className="deal-contracts"><span className="eyebrow">AFTER THE SIGNATURE</span><h3>契約と、結果の記録</h3>{contracts.map(c => <article className="deal-contract" key={c.id}><div className="deal-contract-heading"><div><small>{c.offer.supplier}</small><h4>{c.offer.title}</h4></div><span className="deal-category">{c.status === 'active' ? '契約中' : c.status === 'completed' ? '満了' : '解約済み'}</span></div><p>{getDealContext(c.offer) ? `第${c.offer.createdWeek}週の店舗状況を基にした提案。` : ''}第{c.startWeek}週 契約 → 第{c.revealWeek}週 効果判明 → 第{c.endWeek}週 満了</p><dl className="deal-terms"><div><dt>観測された週次効果</dt><dd>{c.realizedWeeklyBenefit === undefined ? '導入中・未確定' : yen(c.realizedWeeklyBenefit)}</dd></div>{c.realizedWeeklyBenefit !== undefined && <div><dt>観測効果 − 週額費用</dt><dd>{yen(c.realizedWeeklyBenefit - c.offer.weeklyFee)}</dd></div>}<div><dt>累積効果 / 累積週額費用</dt><dd>{yen(c.cumulativeBenefit)} / {yen(c.cumulativeFees)}</dd></div><div><dt>初期支払</dt><dd>{yen(c.offer.upfrontCost)}</dd></div><div><dt>累積収支（初期支払含む・換金と解約料除く）</dt><dd>{yen(c.cumulativeBenefit - c.cumulativeFees - c.offer.upfrontCost)}</dd></div></dl>{c.status === 'active' && <button className="secondary" disabled={disabled || state.cash + c.offer.residualValue < c.offer.cancellationFee} onClick={() => setConfirm({ type: 'cancelContract', contractId: c.id })}>解約条件を確認 · 解約料 {yen(c.offer.cancellationFee)}</button>}</article>)}</section>}
    {selected && confirm && <GameDialog className="deal-modal" title={confirm.type === 'acceptOffer' ? '契約内容の確認' : confirm.type === 'investigateOffer' ? '有料調査の確認' : confirm.type === 'cancelContract' ? '解約の確認' : '提案を見送る'} close={() => { if (!busy) setConfirm(null); }}><h3><BriefcaseBusiness size={18}/> {selected.title}</h3><dl className="cost-list"><div><dt>今回の支払</dt><dd>{yen(charge)}</dd></div>{refund > 0 && <div><dt>解約時の資産換金額</dt><dd>{yen(refund)}</dd></div>}<div><dt>支払後の手元資金</dt><dd>{yen(state.cash - charge + refund)}</dd></div></dl>
    {confirm.type === 'acceptOffer' && <><dl className="cost-list"><div><dt>週額費用 / 契約期間</dt><dd>{yen(selected.weeklyFee)} / {selected.termWeeks}週</dd></div><div><dt>固定支払総額（初期支払含む）</dt><dd>{yen(totalCost(selected))}</dd></div><div><dt>途中解約料</dt><dd>{yen(selected.cancellationFee)}</dd></div></dl><p className="warning">導入効果は {selected.leadWeeks}週後に判明します。効果が出るまでの期間も週額費用はかかります。初期支払は別で、営業の実績は週末に確定します。{state.loans.some(l => l.remaining > 0) && preview.netProfit.min - selected.weeklyFee <= 0 ? ' 追加の費用により、借入中の利益条件を満たせないおそれがあります。' : ''}</p><p>提示効果 {yen(selected.advertisedWeeklyBenefit)} / 週は保証されません。悪化する結果もあります。</p></>}
    {confirm.type === 'investigateOffer' && <p>信頼性やリスク、収益見込みを調べます。調査料は即時に支払われ、返金されません。調査だけで契約にはなりません。</p>}
    {confirm.type === 'cancelContract' && <p>解約後は効果と週額費用が終了します。初期支払・支払済み費用は返金されません。残存価値 {yen(selected.residualValue)} は解約時に現金として受け取り、解約料を差し引きます。</p>}
    {confirm.type === 'declineOffer' && <p>この提案を受信一覧から取り下げます。費用は発生しません。</p>}
    <button className="primary" disabled={disabled || charge > state.cash + refund} onClick={() => void act(confirm)}>{confirm.type === 'acceptOffer' ? `契約する · ${yen(charge)}` : confirm.type === 'investigateOffer' ? `調査する · ${yen(charge)}` : confirm.type === 'cancelContract' ? `解約する · ${yen(charge)}` : 'この提案を見送る'}</button></GameDialog>}
  </div>;
}
