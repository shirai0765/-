import type { DistrictId, Lot } from '../model';

/** Optional outer neighborhoods within the existing four districts. All values are authored game data. */
const rows: [DistrictId, number, string, number, number, number, number, number, number, string][] = [
  ['center', 9, '神南北の小路', -78, -250, 24000, 1, 68000, 38000000, '中心街の北に続く静かな小路。控えめな家賃と人通りを見比べたい。'],
  ['center', 10, '北通りの角店', -20, -250, 36000, 1.18, 118000, 66000000, '街歩きの途中にある角地。人通りと固定費は中程度。'],
  ['center', 11, '神南の住宅坂', -78, -310, 19000, 1.35, 94000, 59000000, '住宅に近い落ち着いた通り。人通りは少なく、購買力は高め。'],
  ['center', 12, '北の大通り入口', -20, -310, 54000, 1.06, 175000, 99000000, '人が行き交う北側の入口。人員と毎週の家賃を考えて選びたい。'],
  ['dogenzaka', 9, '坂西の小さな路面店', -270, -26, 22000, .9, 55000, 28000000, '坂を越えた小さな通り。少ない人通りと低い家賃が特徴。'],
  ['dogenzaka', 10, '西通りの旧雑貨店', -330, -26, 28000, 1.02, 74000, 39000000, '西へ延びる通り沿いの小型物件。日常の街歩きが見える。'],
  ['dogenzaka', 11, '松濤西の住宅前', -270, 42, 17000, 1.42, 96000, 62000000, '静かな住宅地の入口。購買力は高めだが通行量は限られる。'],
  ['dogenzaka', 12, '西の商店通り', -330, 42, 51000, 1.15, 169000, 94000000, '商店が連なる人通りの多い通り。客数を受け止める運営が必要。'],
  ['miyashita', 9, '東の並木小路', 260, -72, 24000, 1.38, 112000, 70000000, '並木沿いの静かな一角。高めの購買力と家賃を見比べたい。'],
  ['miyashita', 10, '東通りの角店', 320, -72, 38000, 1.24, 145000, 92000000, '東へ広がる街の角地。中程度の人通りが続く。'],
  ['miyashita', 11, '東のオフィス街口', 260, 45, 56000, 1.34, 238000, 161000000, 'オフィス街へ続く通り。人通りも家賃も高く、運営費の負担は大きい。'],
  ['miyashita', 12, '東端の小さな店', 320, 45, 20000, .98, 64000, 34000000, '賑わいから離れた小さな店。静かな通りで固定費を抑える選択肢。'],
  ['sakuragaoka', 9, '桜丘南の住宅小路', -78, 250, 18000, .85, 51000, 27000000, '生活圏の小さな通り。控えめな購買力と少ない通行量に合わせて考えたい。'],
  ['sakuragaoka', 10, '南坂の角店', -20, 250, 31000, 1.07, 91000, 49000000, '南へ続く坂の角地。人通りと家賃はほどほど。'],
  ['sakuragaoka', 11, '桜丘南の庭園横', -78, 310, 23000, 1.36, 101000, 64000000, '落ち着いた住宅地の庭園横。少ない人通りと高めの購買力が特徴。'],
  ['sakuragaoka', 12, '南のオフィス通り', -20, 310, 53000, 1.22, 192000, 128000000, '南側のオフィスへ続く通り。人通りは多く、家賃も高め。'],
];
const colors: Record<DistrictId, string> = { center: '#e6d1b4', dogenzaka: '#bdaaa1', miyashita: '#b1c5c9', sakuragaoka: '#c7c1b7' };
export const OUTER_NEIGHBORHOOD_LOTS: Lot[] = rows.map(([district, number, name, x, z, footfall, affluence, rent, purchasePrice, description]) => ({
  id: `${district}-${String(number).padStart(2, '0')}`, district, name, x, z,
  width: [14, 16, 14, 18][number - 9], depth: [14, 16, 14, 16][number - 9], height: [12, 19, 15, 26][number - 9],
  type: 'retail', color: colors[district], footfall, affluence, rent, purchasePrice, available: true, description,
}));

export const OUTER_NEIGHBORHOOD_ROADS: { id: string; name: string; points: [number, number][]; width: number }[] = [
  { id: 'north-west-link', name: '文化村北通り', points: [[-107, -202], [-107, -345]], width: 12 },
  { id: 'north-east-link', name: '明治北通り', points: [[43, -202], [43, -345]], width: 18 },
  { id: 'north-neighborhood', name: '神南北小路', points: [[-107, -230], [43, -230]], width: 10 },
  { id: 'north-outer', name: '神南外通り', points: [[-107, -290], [43, -290]], width: 10 },
  { id: 'west-link', name: '道玄坂西通り', points: [[-202, 0], [-350, 0]], width: 20 },
  { id: 'west-neighborhood', name: '西の商店小路', points: [[-350, 65], [-240, 65]], width: 10 },
  { id: 'west-cross-link', name: '西の坂道', points: [[-240, 0], [-240, 65]], width: 10 },
  { id: 'east-link', name: '東口大通り', points: [[202, 0], [350, 0]], width: 20 },
  { id: 'east-cross-link', name: '東の並木通り', points: [[220, -48], [220, 68]], width: 10 },
  { id: 'east-neighborhood', name: '東の北小路', points: [[220, -48], [350, -48]], width: 10 },
  { id: 'east-outer', name: '東の南小路', points: [[220, 68], [350, 68]], width: 10 },
  { id: 'south-west-link', name: '桜丘南坂', points: [[-107, 202], [-107, 345]], width: 12 },
  { id: 'south-east-link', name: '南口連絡通り', points: [[43, 202], [43, 345]], width: 18 },
  { id: 'south-neighborhood', name: '桜丘南小路', points: [[-107, 270], [43, 270]], width: 10 },
  { id: 'south-outer', name: '桜丘外通り', points: [[-107, 330], [43, 330]], width: 10 },
];
