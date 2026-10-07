import type { DistrictId, Lot } from '../model';

/** Optional outer sites in the same four districts. Weekly traffic, rent and
 * purchase prices are authored game data; they do not promise cafe earnings. */
const rows: [DistrictId, number, string, number, number, number, number, number, number, string][] = [
  ['center', 13, '神南北の生活通り', -78, -360, 23000, 1.04, 73000, 41000000, '住宅へ続く静かな通り。低めの家賃でも、客数は限られる。'],
  ['center', 14, '北街道の角店', -20, -360, 40000, 1.12, 136000, 79000000, '街歩きと日常利用が交わる角地。人通りと固定費は中程度。'],
  ['center', 15, '神南奥の住宅前', -78, -400, 20000, 1.4, 112000, 72000000, '落ち着いた住宅地の一角。通行量は少なく、品質への期待は高め。'],
  ['center', 16, '北の通勤広場前', -20, -400, 62000, 1.1, 220000, 139000000, '朝夕に働く人が行き交う通り。家賃と提供能力の負担を見比べたい。'],
  ['center', 17, '北端の工房通り', -78, -440, 32000, 1.3, 147000, 94000000, '工房や専門店へ目的を持って訪れる客層。購買力は高め、賃料も高い。'],
  ['center', 18, '北街道の商業入口', -20, -440, 74000, 1.2, 315000, 209000000, '外周の商業通りに面する大型候補。厚い人通りと高い固定費が特徴。'],
  ['dogenzaka', 13, '坂西の生活小路', -360, -29, 20000, .94, 60000, 32000000, '生活圏へ続く小さな通り。少ない人通りに合わせて固定費を考えたい。'],
  ['dogenzaka', 14, '西坂の角店', -360, 41, 33000, 1.03, 96000, 52000000, '買い物と日常利用が混ざる角地。人通りと賃料はほどほど。'],
  ['dogenzaka', 15, '松濤外縁の住宅前', -400, -29, 16000, 1.48, 107000, 70000000, '静かな住宅地の入口。購買力は高いが、通行量はかなり限られる。'],
  ['dogenzaka', 16, '西の商店広場前', -400, 41, 56000, 1.08, 179000, 104000000, '商店を巡る人が集まる通り。価格帯と提供能力を合わせて考えたい。'],
  ['dogenzaka', 17, '坂西の専門店通り', -440, -29, 27000, 1.24, 118000, 71000000, '専門店へ向かう落ち着いた通り。中程度の購買力と少ない人通り。'],
  ['dogenzaka', 18, '西街道の商業入口', -440, 41, 65000, 1.16, 251000, 164000000, '西へ続く商業通りの入口。多い人通りに対し、家賃の負担も大きい。'],
  ['miyashita', 13, '東外縁の並木小路', 360, -72, 22000, 1.14, 86000, 49000000, '大通りから離れた並木の小路。人通りを抑えめに見積もる立地。'],
  ['miyashita', 14, '東街道の角店', 360, 44, 38000, 1.29, 157000, 98000000, '街歩きと働く人の休憩が混ざる角地。購買力と家賃は高め。'],
  ['miyashita', 15, '東の住宅庭園前', 400, -72, 18000, 1.5, 123000, 81000000, '静かな庭園と住宅の前。高い購買力だけで客数は補えない。'],
  ['miyashita', 16, '東外周のオフィス通り', 400, 44, 61000, 1.37, 260000, 175000000, '働く人の多い通り。品質への期待と毎週の固定費がともに高い。'],
  ['miyashita', 17, '東端のブティック横', 440, -72, 29000, 1.45, 162000, 106000000, '買い物に訪れる高単価の客層。通行量は少なく、家賃は重め。'],
  ['miyashita', 18, '東街道の商業入口', 440, 44, 73000, 1.32, 352000, 248000000, '外周の商業通りに面する大型候補。通行量は厚いが固定費の負担も大きい。'],
  ['sakuragaoka', 13, '桜丘南の生活通り', -78, 360, 19000, .93, 59000, 31000000, '住宅へ続く日常の通り。低い家賃と控えめな客数を見比べたい。'],
  ['sakuragaoka', 14, '南街道の角店', -20, 360, 32000, 1.07, 95000, 53000000, '住民と働く人が交わる角地。人通りと固定費は中程度。'],
  ['sakuragaoka', 15, '桜丘奥の住宅前', -78, 400, 18000, 1.4, 105000, 67000000, '落ち着いた住宅地の一角。購買力は高めだが、通行量は限られる。'],
  ['sakuragaoka', 16, '南のオフィス広場前', -20, 400, 51000, 1.22, 180000, 114000000, '朝夕と昼に働く人が行き交う通り。人員と家賃の負担を考えたい。'],
  ['sakuragaoka', 17, '南端の工房小路', -78, 440, 26000, 1.26, 113000, 71000000, '工房と住宅が並ぶ落ち着いた通り。少ない人通りと高めの購買力。'],
  ['sakuragaoka', 18, '南街道の商業入口', -20, 440, 62000, 1.16, 237000, 158000000, '南へ続く商業通りの入口。客数を受け止める運営と運転資金が必要。'],
];
const colors: Record<DistrictId, string> = { center: '#e6d1b4', dogenzaka: '#bdaaa1', miyashita: '#b1c5c9', sakuragaoka: '#c7c1b7' };

// Shallow parcels keep the +z storefront apron clear of paved roads and
// neighboring rows. Width and height do not change the operating formulas.
export const V080_NEIGHBORHOOD_LOTS: Lot[] = rows.map(([district, number, name, x, z, footfall, affluence, rent, purchasePrice, description]) => ({
  id: `${district}-${String(number).padStart(2, '0')}`, district, name, x, z,
  width: [14, 16, 14, 18, 16, 18][number - 13], depth: 14, height: [12, 19, 15, 26, 19, 26][number - 13],
  type: 'retail', color: colors[district], footfall, affluence, rent, purchasePrice, available: true, description,
}));

/** Connected axis-aligned segments; append after the existing road array. */
export const V080_NEIGHBORHOOD_ROADS: { id: string; name: string; points: [number, number][]; width: number }[] = [
  { id: 'v080-north-west-link', name: '文化村北外周通り', points: [[-107, -345], [-107, -460]], width: 12 },
  { id: 'v080-north-east-link', name: '明治北外周通り', points: [[43, -345], [43, -460]], width: 18 },
  { id: 'v080-north-neighborhood', name: '神南北生活通り', points: [[-107, -336], [43, -336]], width: 10 },
  { id: 'v080-north-middle', name: '神南北住宅通り', points: [[-107, -376], [43, -376]], width: 10 },
  { id: 'v080-north-outer', name: '神南北街道', points: [[-107, -416], [43, -416]], width: 10 },
  { id: 'v080-south-west-link', name: '桜丘南外周坂', points: [[-107, 345], [-107, 480]], width: 12 },
  { id: 'v080-south-east-link', name: '南口外周連絡通り', points: [[43, 345], [43, 480]], width: 18 },
  { id: 'v080-south-neighborhood', name: '桜丘南生活通り', points: [[-107, 384], [43, 384]], width: 10 },
  { id: 'v080-south-middle', name: '桜丘南住宅通り', points: [[-107, 424], [43, 424]], width: 10 },
  { id: 'v080-south-outer', name: '桜丘南街道', points: [[-107, 464], [43, 464]], width: 10 },
  { id: 'v080-west-link', name: '道玄坂西外周通り', points: [[-350, 0], [-465, 0]], width: 20 },
  { id: 'v080-west-neighborhood', name: '道玄坂西街道', points: [[-350, 65], [-465, 65]], width: 10 },
  { id: 'v080-east-link', name: '東口外周大通り', points: [[350, 0], [465, 0]], width: 20 },
  { id: 'v080-east-neighborhood', name: '東口外周北小路', points: [[350, -48], [465, -48]], width: 10 },
  { id: 'v080-east-outer', name: '東口外周南街道', points: [[350, 68], [465, 68]], width: 10 },
];
