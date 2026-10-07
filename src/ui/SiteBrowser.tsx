import { useState } from 'react';
import { Building2, Coffee, Plus, Search } from 'lucide-react';
import type { DistrictId, GameState } from '../model';
import { DISTRICTS, LOTS } from '../data/district';
import { getSiteContext } from '../sim/siteContext';
import { hasRealCityAnchor } from '../realcity/gameSites';
import './site-browser.css';

export interface SiteBrowserProps {
  state: GameState;
  selectedLotId: string | null;
  onSelectLot: (lotId: string) => void;
  mapMode: 'game' | 'real';
}

type StatusFilter = 'all' | 'available' | 'store' | 'property';
type SiteSort = 'district' | 'footfall' | 'rent' | 'purchase';
const sites = LOTS.filter(lot => lot.available);
const districts = Object.entries(DISTRICTS) as [DistrictId, (typeof DISTRICTS)[DistrictId]][];
const districtOrder = new Map(districts.map(([id], index) => [id, index]));
const searchText = (text: string) => text.normalize('NFKC').toLowerCase().trim();
const compact = (value: number) => value >= 10_000
  ? `${(value / 10_000).toFixed(1)}万円`
  : `¥${Math.round(value).toLocaleString('ja-JP')}`;

/** All economic sites remain selectable regardless of map support or rendering status. */
export default function SiteBrowser({ state, selectedLotId, onSelectLot, mapMode }: SiteBrowserProps) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [district, setDistrict] = useState<DistrictId | 'all'>('all');
  const [sort, setSort] = useState<SiteSort>('district');
  const [query, setQuery] = useState('');
  const search = searchText(query);
  const stores = new Map(state.stores.map(store => [store.lotId, store]));
  const properties = new Set(state.properties.map(property => property.lotId));
  const contexts = new Map(sites.map(lot => [lot.id, getSiteContext(state, lot.id)!]));
  const visible = sites.filter(lot => (district === 'all' || lot.district === district)
    && (!search || searchText(`${lot.name} ${stores.get(lot.id)?.name ?? ''}`).includes(search))
    && (status === 'all'
      || (status === 'available' && !stores.has(lot.id))
      || (status === 'store' && stores.has(lot.id))
      || (status === 'property' && properties.has(lot.id))))
    .sort((a, b) => sort === 'footfall' ? b.footfall - a.footfall
      : sort === 'rent' ? contexts.get(a.id)!.weeklyRent - contexts.get(b.id)!.weeklyRent
      : sort === 'purchase' ? a.purchasePrice - b.purchasePrice
      : districtOrder.get(a.district)! - districtOrder.get(b.district)!);
  const filtered = status !== 'all' || district !== 'all' || !!search;
  const resetFilters = () => { setStatus('all'); setDistrict('all'); setQuery(''); };

  return <section className="site-browser" aria-label="区画一覧">
    <header className="site-browser-heading">
      <h3>区画一覧</h3>
      <span role="status" aria-live="polite">表示 {visible.length} / 全{sites.length}区画</span>
    </header>
    <label className="site-browser-search"><Search size={17} aria-hidden="true"/><input type="search" aria-label="物件名・店舗名で検索" placeholder="物件名・店舗名で探す" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <div className="site-browser-filters">
      <label>区画の状態
        <select aria-label="区画の状態" value={status} onChange={event => setStatus(event.target.value as StatusFilter)}>
          <option value="all">全て</option>
          <option value="available">出店可能</option>
          <option value="store">店舗</option>
          <option value="property">保有物件</option>
        </select>
      </label>
      <label>地区
        <select aria-label="地区" value={district} onChange={event => setDistrict(event.target.value as DistrictId | 'all')}>
          <option value="all">全地区</option>
          {districts.map(([id, value]) => <option key={id} value={id}>{value.name}</option>)}
        </select>
      </label>
      <label className="site-browser-sort">並び順
        <select aria-label="区画の並び順" value={sort} onChange={event => setSort(event.target.value as SiteSort)}>
          <option value="district">地区ごと</option>
          <option value="footfall">人通りが多い順</option>
          <option value="rent">現在の店舗家賃が低い順</option>
          <option value="purchase">物件の購入価格が低い順</option>
        </select>
      </label>
    </div>
    {status === 'available' && <p className="site-browser-note">店舗のない区画です。開業に必要な資金などは区画を選ぶと確認できます。</p>}
    {mapMode === 'real' && <p className="site-browser-note">実測表示は{sites.filter(lot => hasRealCityAnchor(lot.id)).length}地点に対応。全{sites.length}区画の経営操作ができます。</p>}
    {filtered && visible.length > 0 && <button type="button" className="site-browser-reset" onClick={resetFilters}>全区画を表示</button>}
    {visible.length === 0
      ? <div className="site-browser-empty"><p>この条件に合う区画はありません。条件を変えると他の区画を選べます。</p><button type="button" className="site-browser-reset" onClick={resetFilters}>条件を解除する</button></div>
      : <div className="site-list site-browser-list">
        {visible.map(lot => {
          const store = stores.get(lot.id);
          const owned = properties.has(lot.id);
          const context = contexts.get(lot.id)!;
          const selected = selectedLotId === lot.id;
          const statusLabel = store && owned ? '店舗営業中・物件保有' : store ? '店舗営業中' : owned ? '物件保有' : '店舗なし・未保有';
          const StatusIcon = store ? Coffee : owned ? Building2 : Plus;
          return <button type="button" key={lot.id} data-lot-id={lot.id} data-site-footfall={lot.footfall} data-site-rent={context.weeklyRent} aria-pressed={selected} onClick={() => onSelectLot(lot.id)}>
            <span className={`site-browser-icon ${store ? 'is-store' : owned ? 'is-property' : 'is-candidate'}`} aria-hidden="true"><StatusIcon size={17}/></span>
            <span className="site-browser-row">
              <small className="site-browser-district">{DISTRICTS[lot.district].name}{selected && <span className="site-browser-selected">選択中</span>}</small>
              <strong>{lot.name}</strong>
              <span className="site-browser-state">{statusLabel}{hasRealCityAnchor(lot.id) && <span className="site-browser-anchor">実測対応</span>}</span>
              {store && <small className="site-browser-store-name">店舗：{store.name}</small>}
              <small className="site-browser-factors">人通り {context.footfallBand.label} · 購買力 {context.purchasingPowerBand.label}</small>
              <small>{owned ? '自社物件・店舗家賃なし' : sort === 'purchase' ? `物件購入価格 ¥${Math.round(lot.purchasePrice).toLocaleString('ja-JP')}` : `現在の店舗家賃 ${compact(context.weeklyRent)} / 週`}</small>
            </span>
            <span className="site-browser-chevron" aria-hidden="true">›</span>
          </button>;
        })}
      </div>}
  </section>;
}
