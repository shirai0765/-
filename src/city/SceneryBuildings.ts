import type { CityArt } from './art';

export interface SceneryBuilding {
  x: number; z: number; w: number; d: number; h: number; seed: number;
}

// Reuse the existing street palette. CityArt instances these opaque pieces with
// the rest of the city; each building adds no geometry, canvas or material pool.
const FACADES = ['#a6aaa5', '#918e84', '#b1aea3', '#7f8c91', '#a19889'];
const COLORS = {
  roof: '#737b7a', trim: '#e9e9e3', frame: '#8d9b9f', equipment: '#888d88',
  glass: '#637477', darkGlass: '#405e63', rail: '#697974', timber: '#9f6d43',
} as const;

/** Distant Tokyo street fabric, inside the sceneLayout/storeViewpoints envelope.
 * x ± (w+2)/2, z + [-d/2-1, d/2+10], top h + existing setback + 3.
 * Keep shop recesses, pickable parcels, authored landmarks and real-city assets
 * in their existing renderers. This fabric never represents an economic lot. */
export function addSceneryBuilding(art: CityArt, building: SceneryBuilding): void {
  const { x, z, w, d, h, seed } = building;
  const style = seed % 3;
  const facade = style === 0 ? FACADES[seed % 2 === 0 ? 3 : 0]
    : style === 1 ? FACADES[seed % 2 === 0 ? 4 : 1] : FACADES[seed % 2 === 0 ? 2 : 0];
  const upper = style === 0 ? 6 + seed % 12 : 0;
  const roofY = h + upper;
  let instances = 0;
  const box = (lx: number, y: number, lz: number, width: number, height: number, depth: number, color: string) => {
    art.batch(x + lx, y, z + lz, width, height, depth, color);
    instances++;
  };

  box(0, h / 2, 0, w, h, d, facade);
  box(0, h + .12, 0, w - .3, .24, d - .3, COLORS.roof);
  // Thin parapets distinguish a usable roof from a flat, floating cap.
  for (const side of [-1, 1]) {
    box(0, h + .6, side * (d / 2 - .18), w, .9, .28, COLORS.trim);
    box(side * (w / 2 - .18), h + .6, 0, .28, .9, d - .56, COLORS.trim);
  }
  box(-w * .18, roofY + 1.05, -d * .18, w * .23, 1.9, d * .23, COLORS.equipment);
  box(-w * .18, roofY + 2.07, -d * .18, w * .25, .16, d * .25, COLORS.roof);
  box(w / 2 + .12, h / 2 + 1.2, -d * .25, .14, h - 2.4, .14, COLORS.frame);

  // A bounded number of broad bays reads at distance without tiny per-window
  // mullion meshes. Tall buildings spread these rows over their actual height.
  const floors = Math.max(1, Math.min(12, Math.floor((h - 4.5) / 3.5)));
  const step = (h - 4.5) / floors;
  const glazingHeight = Math.min(2.25, step * .7);
  if (style === 0) {
    // Office: four ribbon facades, tall structural fins and a stepped upper wing.
    for (let floor = 0; floor < floors; floor++) {
      const y = 4.5 + step * (floor + .5);
      for (const side of [-1, 1]) {
        box(0, y, side * (d / 2 + .07), w - 1.2, glazingHeight, .14, COLORS.glass);
        box(side * (w / 2 + .07), y, 0, .14, glazingHeight, d - 1.2, COLORS.glass);
      }
    }
    const columns = Math.min(4, Math.floor(w / 5));
    for (let column = 1; column <= columns; column++) for (const side of [-1, 1]) {
      box(-w / 2 + w * column / (columns + 1), (h + 4.5) / 2, side * (d / 2 + .19), .14, h - 4.5, .16, COLORS.frame);
    }
    box(-w * .12, h + upper / 2, 0, w * .7, upper, d * .64, facade);
    box(-w * .12, roofY + .12, 0, w * .72, .24, d * .66, COLORS.roof);
    for (let y = h + 2.5; y < roofY - .6; y += 3.5) {
      box(-w * .12, y, d * .32 + .06, w * .65, 1.8, .12, COLORS.glass);
      box(w * .23 + .06, y, 0, .12, 1.8, d * .56, COLORS.glass);
    }
    for (const lx of [w * .03, w * .17]) {
      box(lx, roofY + .64, d * .13, w * .1, 1, d * .15, COLORS.equipment);
      box(lx, roofY + 1.18, d * .13, w * .085, .08, d * .13, COLORS.frame);
    }
    box(0, 1.9, d / 2 + .07, w * .72, 3.4, .14, COLORS.darkGlass);
    for (const side of [-1, 1]) box(side * w * .12, 1.9, d / 2 + .21, .12, 3.5, .2, COLORS.frame);
    box(0, 3.88, d / 2 + .5, w * .76, .18, 1.2, COLORS.trim);
    box(0, .12, d / 2 + .5, w * .76, .24, 1.2, COLORS.roof);
  } else if (style === 1) {
    // Mixed use: small masonry openings, a blank party wall and separate shops.
    const bays = Math.max(2, Math.min(5, Math.floor(w / 4.5)));
    const bayWidth = (w - 2) / bays;
    for (let floor = 0; floor < floors; floor++) {
      const y = 4.5 + step * (floor + .5);
      for (let bay = 0; bay < bays; bay++) {
        box(-w / 2 + 1 + bayWidth * (bay + .5), y, d / 2 + .07,
          bayWidth * .65, Math.min(1.9, glazingHeight), .14, COLORS.darkGlass);
      }
      box(0, y - glazingHeight / 2 - .14, d / 2 + .17, w - .6, .16, .35, COLORS.trim);
    }
    box(-w / 2 - .07, (h + 4.5) / 2, -d * .27, .14, h - 4.5, 1.1, COLORS.darkGlass);
    box(0, 1.82, d / 2 + .07, w - 1.4, 3.2, .14, COLORS.darkGlass);
    for (const lx of [-w * .29, 0, w * .29]) box(lx, 1.82, d / 2 + .18, .14, 3.3, .2, COLORS.trim);
    box(0, 3.7, d / 2 + .65, w - .4, .2, 1.5, COLORS.timber);
    box(0, 4.04, d / 2 + .25, w - .8, .46, .2, COLORS.trim);
    // Retain the old forward-wing envelope rather than growing into a sidewalk.
    const wingWidth = w * .45, wingHeight = h * .52, wingZ = d / 2 + 5;
    box(w * .22, wingHeight / 2, wingZ, wingWidth, wingHeight, 9, facade);
    box(w * .22, wingHeight + .12, wingZ, wingWidth + .2, .24, 9.2, COLORS.roof);
    box(w * .22, 1.82, d / 2 + 9.58, wingWidth - .8, 3.2, .14, COLORS.darkGlass);
    box(w * .22, 3.7, d / 2 + 9.68, wingWidth, .2, .45, COLORS.timber);
    box(w * .2, h + .65, d * .16, w * .15, 1, d * .17, COLORS.equipment);
    box(w * .2, h + 1.19, d * .16, w * .13, .08, d * .15, COLORS.frame);
  } else {
    // Residential: shaded private balconies and a quieter shared entrance.
    for (let floor = 0; floor < floors; floor++) {
      const y = 4.5 + step * (floor + .5);
      box(0, y, d / 2 + .07, w - 1.8, glazingHeight, .14, COLORS.darkGlass);
      box(0, y - 1.35, d / 2 + .55, w - .4, .2, 1.5, COLORS.trim);
      box(0, y - .68, d / 2 + 1.22, w - .65, .75, .13, COLORS.rail);
    }
    // Continuous end/privacy fins preserve the balcony silhouette with three
    // pieces instead of repeating three separate walls on every floor.
    for (const lx of [-w / 2 + .4, 0, w / 2 - .4]) {
      box(lx, (h + 4.5) / 2, d / 2 + .55, .18, h - 4.5, 1.5, COLORS.trim);
    }
    box(-w * .22, 1.7, d / 2 + .07, w * .24, 2.9, .14, COLORS.darkGlass);
    for (const side of [-1, 1]) box(-w * .22 + side * w * .125, 1.7, d / 2 + .18, .14, 3, .2, COLORS.trim);
    box(-w * .22, 3.42, d / 2 + .4, w * .3, .18, .9, COLORS.trim);
    box(w * .26, .62, d / 2 + .2, w * .2, 1.2, .3, COLORS.rail);
    box(0, (h + 4.5) / 2, -d / 2 - .07, 1.1, h - 4.5, .14, COLORS.darkGlass);
    box(w * .2, h + .97, -d * .24, w * .18, 1.3, d * .16, COLORS.equipment);
    box(w * .2, h + 1.67, -d * .24, w * .2, .1, d * .18, COLORS.trim);
  }

  const name = ['office', 'mixed-use', 'residential'][style];
  const counts = art.group.userData.sceneryStyles ??= {};
  counts[name] = (counts[name] ?? 0) + 1;
  art.group.userData.sceneryInstances = (art.group.userData.sceneryInstances ?? 0) + instances;
}
