import type { ReactNode } from 'react';
import { LOTS } from '../data/district';
import type { GameState } from '../model';
import { operatingConditions } from '../sim/engine';
import { GameIcon } from './GameIcon';
import { emitCityAudioCue } from '../audio/CityAudioCues';
import './property-scene.css';

const yen = (value: number) => `¥${Math.round(value).toLocaleString('ja-JP')}`;
const districtNames: Record<string, string> = { center: '渋谷駅前', dogenzaka: '道玄坂', miyashita: '宮下公園', sakuragaoka: '桜丘' };

export interface PropertyScenePanelProps {
  state: GameState;
  lotId: string;
  mapMode: 'game' | 'real';
  disabled?: boolean;
  children: ReactNode;
  onViewSite: () => void;
  onBuyProperty: () => void;
  onUpgradeProperty: () => void;
  onBank: () => void;
}

/** Location presentation only. App retains every action and navigation handler. */
export default function PropertyScenePanel({ state, lotId, mapMode, disabled = false, children, onViewSite, onBuyProperty, onUpgradeProperty, onBank }: PropertyScenePanelProps) {
  const lot = LOTS.find(candidate => candidate.id === lotId);
  if (!lot) return null;
  const store = state.stores.find(candidate => candidate.lotId === lotId);
  const property = state.properties.find(candidate => candidate.lotId === lotId);
  const blocked = disabled || state.gameOver;
  const status = store ? '営業中' : property ? '保有物件' : lot.available ? '出店できます' : '街のランドマーク';
  const rents = operatingConditions(state).rents;
  const upgradeCost = property ? Math.round(property.purchasePrice * .12) : 0;
  const shortfall = Math.max(0, lot.purchasePrice - state.cash);
  const click = (action: () => void) => () => { emitCityAudioCue({ kind: 'button' }); action(); };

  return <div className="property-scene" data-property-scene={lotId}>
    <div className="property-scene-hero">
      <div className="property-scene-hero-art" aria-hidden="true"/>
      <div className="property-scene-hero-copy">
        <p className="facility-district"><GameIcon name="pin" size={18}/><span>{districtNames[lot.district]} · {status}</span></p>
        <p className="property-scene-headline">{store ? '街角から、次の成長へ。' : property ? 'あなたの物件で、次の一杯を。' : lot.available ? 'ここから、あなたのカフェを。' : '渋谷の街を歩こう。'}</p>
      </div>
    </div>
    <div className="property-scene-body">
      {!store && lot.available && <button type="button" className="secondary property-scene-view" disabled={disabled} onClick={click(onViewSite)}><GameIcon name="pin" size={20}/>街でこの建物を見る<GameIcon name="arrow-right" size={18}/></button>}
      {children}
      {property ? <section className="property-scene-owned" aria-label="所有不動産">
        <div className="property-scene-section-title"><GameIcon name="building" size={24}/><h3>所有不動産</h3><span>Lv.{property.level}</span></div>
        <p className="property-scene-property-income"><span>{store ? '自社店舗の家賃を節約 / 週' : '週間賃料の基準'}</span><strong>{yen(store ? lot.rent * rents : property.weeklyIncome * property.occupancy * rents)}</strong></p>
        <button type="button" className="secondary property-scene-upgrade" disabled={blocked || property.level >= 5 || state.cash < upgradeCost} onClick={click(onUpgradeProperty)}><GameIcon name="building" size={21}/>{property.level >= 5 ? '改修は最大レベルです' : <>物件を改修 <span>{yen(upgradeCost)}</span></>}</button>
        {property.level < 5 && state.cash < upgradeCost && <p className="property-scene-shortfall">改修資金が{yen(upgradeCost - state.cash)}不足しています。</p>}
      </section> : lot.available ? <details className="facility-property-options">
        <summary><GameIcon name="building" size={22}/><span>この建物を不動産として購入</span></summary>
        <dl className="property-scene-purchase-facts"><div><dt>物件の購入価格</dt><dd className="property-price">{yen(lot.purchasePrice)}</dd></div><div><dt>現在の手元資金</dt><dd>{yen(state.cash)}</dd></div></dl>
        <button type="button" className="secondary property-scene-buy" disabled={blocked || shortfall > 0} onClick={click(onBuyProperty)}><GameIcon name="building" size={22}/>物件を購入する<GameIcon name="arrow-right" size={20}/></button>
        {shortfall > 0 && <p className="property-scene-shortfall">購入資金が{yen(shortfall)}不足しています。</p>}
        <button type="button" className="text-button property-scene-bank" onClick={click(onBank)}><GameIcon name="bank" size={20}/>銀行で資金を相談</button>
      </details> : null}
      <details className="facility-location-details"><summary><GameIcon name="pin" size={20}/><span>この場所について</span></summary><p>{lot.description}</p>{mapMode === 'real' && <p className="real-lot-note">出店条件はゲーム設定です。実際の募集物件ではありません。</p>}</details>
    </div>
  </div>;
}
