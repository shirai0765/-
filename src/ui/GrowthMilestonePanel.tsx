import { useEffect, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { GameState } from '../model';
import { LOTS } from '../data/district';
import { getSummary, getWeekOutlook } from '../sim/engine';
import { getDevelopmentPrograms } from '../sim/development';
import { getRailProjects } from '../sim/railProjects';
import { getMarketAcquisitionTargets } from '../sim/marketAcquisitions';
import './growth-milestone.css';

export type GrowthMilestoneTarget = 'city' | 'development' | 'market' | 'finance';
export interface GrowthMilestonePanelProps {
  /** The snapshots around one applied IPO. This receipt does not claim durable saving. */
  before: GameState;
  after: GameState;
  onClose: () => void;
  onNavigate: (target: GrowthMilestoneTarget) => void;
}
const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const estimate = ({ min, max }: { min: number; max: number }) => `${yen(Math.floor(min / 1000) * 1000)}〜${yen(Math.ceil(max / 1000) * 1000)}`;
const percent = (value: number) => `${(value * 100).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}%`;

/** Read-only success receipt. Closing and navigation never execute an investment. */
export default function GrowthMilestonePanel({ before, after, onClose, onNavigate }: GrowthMilestonePanelProps) {
  const dialog = useRef<HTMLElement>(null);
  const isIPO = before.id === after.id && !before.listed && after.listed;
  useEffect(() => {
    if (!isIPO) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, [isIPO]);
  if (!isIPO) return null;

  const summary = getSummary(after), forecast = getWeekOutlook(after);
  const projects = getRailProjects(after);
  const ownedDistricts = new Set(after.properties.map(p => LOTS.find(l => l.id === p.lotId)?.district));
  const readyRail = projects.find(p => p.options.some(c => c.unlocked));
  const relevantProjects = ownedDistricts.size > 0 ? projects.filter(p => ownedDistricts.has(p.districtId)) : projects;
  const blockedRail = relevantProjects.flatMap(p => p.options).find(c => c.reason)?.reason;
  const readyDevelopment = getDevelopmentPrograms(after).filter(p => p.choices.some(c => c.unlocked)).length;
  const targets = getMarketAcquisitionTargets(after);
  const readyAcquisitions = targets.filter(t => t.unlocked).length;
  const listedCandidates = targets.filter(t => t.requiresListing && t.status !== 'owned' && t.status !== 'integrating').length;
  const cashGain = after.cash - before.cash;
  const navigate = (target: GrowthMilestoneTarget) => { onClose(); onNavigate(target); };

  return <div className="modal-shade growth-milestone-shade" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal growth-milestone" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="growth-milestone-title" onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}>
      <header><div><span className="eyebrow">NEXT CHAPTER</span><h2 id="growth-milestone-title">上場しました</h2></div><button className="icon-button" aria-label="上場の結果を閉じる" onClick={onClose}><X size={20}/></button></header>
      <p className="growth-milestone-lead">{after.companyName}は、株式を公開して新しい出資を受け入れました。</p>
      <div className="growth-milestone-results">
        <div><span>今回調達した現金</span><strong>{cashGain >= 0 ? '+' : '−'}{yen(Math.abs(cashGain))}</strong><small>上場直後の手元資金 {yen(after.cash)}</small></div>
        <div><span>自分が持つ会社の株の割合</span><strong>{percent(before.founderShares / before.sharesOutstanding)} → {percent(summary.ownership)}</strong><small>出資を受けた分、創業者持分が変わりました</small></div>
      </div>
      <p className="growth-milestone-note">IPO実行直後の結果です。調達した現金は売上や週の利益ではありません。</p>
      {forecast.risk.debtLossPossible && <p className="growth-milestone-warning" role="alert">今週の利益見込みは{estimate(forecast.netProfit)}です。下限では借入中の利益条件を満たせず、倒産のおそれがあります。</p>}
      {forecast.risk.cashShortfallPossible && <p className="growth-milestone-warning" role="alert">週末の現金見込みは{estimate(forecast.cashAfter)}です。資金不足のおそれがあります。次の投資の前に支払いを確認してください。</p>}
      <h3 className="growth-milestone-next-title">次の資金の使い道を、選べます。</h3>
      <div className="growth-milestone-next">
        <article><h4>企業を迎える</h4><p>上場が必要だった企業も、取得の検討対象になります。</p><small>{readyAcquisitions > 0 ? `独立運営で取得可能：${readyAcquisitions}件。` : `${listedCandidates}件の上場要件を満たしました。`}調査・信用・取得資金は企業ごとに必要です。</small><button className="secondary" onClick={() => navigate('market')}>企業取得を検討 <ArrowUpRight size={14}/></button></article>
        <article><h4>街と沿線を育てる</h4><p>地区の次の工程や、商業・賃貸の共同開発を検討できます。</p><small>{readyRail ? `${readyRail.name}に着工できる沿線計画があります。` : `沿線：${blockedRail || '地区の物件・信用・資金条件を確認してください。'}`}沿線には地区の直接保有物件も必要です。{readyDevelopment > 0 ? `地区開発は${readyDevelopment}地区に着工案があります。` : ''}</small><button className="secondary" onClick={() => navigate('development')}>街区・沿線を検討 <ArrowUpRight size={14}/></button></article>
      </div>
      <footer><p>今は投資せず、今の店の運営を続けても構いません。</p><div className="growth-milestone-actions"><button className="primary" onClick={() => navigate('city')}>今の運営を続ける</button><button className="secondary" onClick={() => navigate('finance')}>資金と持分を確認</button></div></footer>
    </section>
  </div>;
}
