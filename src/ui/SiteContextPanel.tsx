import type { GameState } from '../model';
import { getSiteContext } from '../sim/siteContext';
import './site-context.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;

/** Conditions of the selected place, without calculating an operating outcome. */
export default function SiteContextPanel({ state, lotId }: { state: GameState; lotId: string }) {
  const site = getSiteContext(state, lotId);
  if (!site) return null;
  return <section className="site-context" aria-label="この場所の環境" data-site-context={lotId}>
    <h3>この場所の環境</h3>
    <p className="site-context-description">{site.description}</p>
    <dl className="site-context-facts">
      <div><dt>人通り</dt><dd>{site.footfallBand.label}<small>基準の通行量 {site.footfallWeekly.toLocaleString('ja-JP')}人 / 週</small></dd></div>
      <div><dt>周辺の購買力</dt><dd>{site.purchasingPowerBand.label}</dd></div>
      <div><dt>現在の店舗家賃 / 週</dt><dd>{site.ownsProperty ? '自社物件・家賃なし' : yen(site.weeklyRent)}</dd></div>
      <div><dt>近くの自社店舗</dt><dd>{site.nearbyOwnStores}店</dd></div>
    </dl>
    {site.nearbyOwnStores > 0 && <p className="site-context-note">近くに自分の店があります。同じ地域のお客様を分け合うことがあります。</p>}
    <p className="site-context-note">通行量は来店者数とは異なります。お店の形と価格、毎週の運営で結果は変わります。</p>
  </section>;
}
