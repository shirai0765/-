import type { GameState } from '../model';
import { LOTS } from '../data/district';
import { operatingConditions } from './engine';

/** Descriptive bands for authored weekly street traffic, never customer forecasts. */
export function getFootfallBand(footfall: number): { id: 'quiet' | 'steady' | 'busy'; label: string; rank: 0 | 1 | 2 } {
  if (footfall < 30_000) return { id: 'quiet', label: '落ち着いている', rank: 0 };
  if (footfall < 50_000) return { id: 'steady', label: 'ほどよい', rank: 1 };
  return { id: 'busy', label: '多い', rank: 2 };
}

export function getPurchasingPowerBand(affluence: number): { id: 'modest' | 'medium' | 'higher'; label: string; rank: 0 | 1 | 2 } {
  const normalized = affluence > 3 ? affluence / 100 : affluence;
  if (normalized < 1) return { id: 'modest', label: '控えめ', rank: 0 };
  if (normalized < 1.25) return { id: 'medium', label: '中程度', rank: 1 };
  return { id: 'higher', label: '高め', rank: 2 };
}

/** Known location and lease facts. Does not calculate demand, sales or outcomes. */
export function getSiteContext(state: GameState, lotId: string) {
  const lot = LOTS.find(candidate => candidate.id === lotId && candidate.available);
  if (!lot) return null;
  const ownsProperty = state.properties.some(property => property.lotId === lotId);
  const nearby = state.stores.filter(store => {
    if (store.lotId === lotId) return false;
    const other = LOTS.find(candidate => candidate.id === store.lotId);
    return other !== undefined && Math.hypot(other.x - lot.x, other.z - lot.z) < 70;
  });
  return {
    lotId, description: lot.description, footfallWeekly: lot.footfall,
    footfallBand: getFootfallBand(lot.footfall), purchasingPowerBand: getPurchasingPowerBand(lot.affluence),
    weeklyRent: ownsProperty ? 0 : Math.round(lot.rent * operatingConditions(state).rents), ownsProperty,
    nearbyOwnStores: nearby.length, nearbyOwnStoreNames: nearby.map(store => store.name),
  };
}
