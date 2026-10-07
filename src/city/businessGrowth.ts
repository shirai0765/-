import type { GameState, Lot } from '../model';

/** A visual scale for the group's administration, never company addresses or capacity. */
export const HEADQUARTERS_BAY_THRESHOLDS = [1, 5, 15, 30, 60, 100] as const;
// Property Lv5 reaches h+14.11; the pavilion/preparation frame adds at most 4.22m.
export const MAX_HEADQUARTERS_EXTRA_HEIGHT = 18.5;

export interface BusinessGrowthState {
  headquartersLotId: string | null;
  visible: boolean;
  marketOperating: number;
  subsidiaryOperating: number;
  operating: number;
  integrating: number;
  activeBays: number;
  label: string;
}

/** Readiness follows the same current-week boundary as the market business accounts. */
export function getBusinessGrowth(state: Pick<GameState, 'week' | 'stores' | 'properties' | 'subsidiaries' | 'marketAcquisitions' | 'listed'>, lots: readonly Lot[]): BusinessGrowthState {
  const validOwned = (id: string) => lots.some(lot => lot.id === id && lot.available);
  const headquartersLotId = state.properties.find(property => validOwned(property.lotId))?.lotId
    ?? state.stores.find(store => validOwned(store.lotId))?.lotId ?? null;
  const companies = state.marketAcquisitions?.companies ?? [];
  const marketOperating = companies.filter(company => state.week >= company.readyWeek).length;
  const subsidiaryOperating = state.subsidiaries.length;
  const operating = marketOperating + subsidiaryOperating;
  const integrating = companies.length - marketOperating;
  return {
    headquartersLotId,
    // Small market acquisitions are allowed before IPO and need a visible home too.
    visible: headquartersLotId !== null && (state.listed || operating + integrating > 0),
    marketOperating, subsidiaryOperating, operating, integrating,
    activeBays: HEADQUARTERS_BAY_THRESHOLDS.filter(threshold => operating >= threshold).length,
    label: `グループ本部 · 稼働事業 ${operating} / 引継ぎ ${integrating}`,
  };
}

/** Match the authored game roofs, including the purchased-property pavilions. */
export function getHeadquartersRoof(lot: Lot, sceneryIndex: number, propertyLevel = 1) {
  const level = Math.max(1, Math.min(5, Math.floor(propertyLevel)));
  const roofSurfaceY = lot.height + (level >= 2 ? 4.81 + (level - 2) * 3.1 : 1.95);
  const equipmentTop = lot.id === 'center-03' ? lot.height + .7
    : lot.height + (sceneryIndex % 4 === 1 ? 4.21 : sceneryIndex % 2 ? 4 : 3.4);
  const platformY = Math.max(roofSurfaceY, equipmentTop) + .12;
  return { roofSurfaceY, equipmentTop, platformY, supportHeight: platformY - roofSurfaceY, supportXFraction: level >= 2 ? .34 : .4 };
}
