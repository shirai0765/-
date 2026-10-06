import type { AcquisitionTarget, DistrictId, Lot } from '../model';

/** An authored, compressed Shibuya-inspired map, not surveyed Tokyo GIS data.
 * Coordinates: metres in game space, +x east, +z south; crossing at (0, 0).
 * Money: JPY. Footfall and rent: PER WEEK. See docs/world.md. */
export const DISTRICTS: Record<DistrictId, { name: string; description: string; color: string }> = {
  center: { name: 'センター街', description: '駅前の集客力と若者の回遊。賃料と店舗同士の競合を見極める。', color: '#e8ab59' },
  dogenzaka: { name: '道玄坂', description: '坂道の小さな路面店と夜の街。低い固定費からブランドを育てる。', color: '#ec8b7f' },
  miyashita: { name: '宮下・東口', description: '公園と高層オフィスの街。高単価の需要には品質と接客が必要。', color: '#76bba2' },
  sakuragaoka: { name: '桜丘', description: '住宅と働く人の生活圏。駅前より穏やかな人流で常連をつかむ。', color: '#8d9bd3' },
};

export interface Road { id: string; name: string; points: [number, number][]; width: number }
export const ROADS: Road[] = [
  { id: 'dogenzaka-avenue', name: '道玄坂通り', points: [[-202, 0], [202, 0]], width: 20 },
  { id: 'meiji-avenue', name: '明治通り', points: [[43, -202], [43, 202]], width: 18 },
  { id: 'bunkamura-street', name: '文化村通り', points: [[-107, -202], [-107, 202]], width: 12 },
  { id: 'center-street', name: 'センター街通り', points: [[-202, -89], [33, -89]], width: 10 },
  { id: 'sakura-street', name: '桜丘通り', points: [[-202, 88], [33, 88]], width: 12 },
  { id: 'east-street', name: '東口通り', points: [[86, 100], [202, 100]], width: 10 },
];

export interface Landmark { id: string; name: string; x: number; z: number; kind: 'station' | 'tower' | 'mall' | 'park' | 'crossing'; height?: number }
export const LANDMARKS: Landmark[] = [
  { id: 'scramble', name: 'スクランブル交差点', x: 0, z: 0, kind: 'crossing' },
  { id: 'shibuya-station', name: '渋谷駅', x: 75, z: 42, kind: 'station', height: 20 },
  { id: 'sky-tower', name: 'シブヤ・スカイタワー', x: 124, z: 43, kind: 'tower', height: 108 },
  { id: 'fashion-109', name: 'SHIBUYA 108', x: -43, z: -34, kind: 'mall', height: 45 },
  { id: 'miyashita-park', name: 'ミヤシタ・ガーデン', x: 116, z: -143, kind: 'park', height: 13 },
];

// Named sites are a curated economic map; unrelated scenery is not purchasable.
const cafeSites: Lot[] = [
  {"id": "center-01", "name": "宇田川の角店", "district": "center", "x": -82, "z": -65, "width": 14, "depth": 14, "height": 12, "type": "retail", "color": "#e6d1b4", "footfall": 39000, "affluence": 1.0, "rent": 110000, "purchasePrice": 62000000, "available": true, "description": "回遊客が立ち寄る角地。標準価格帯のカフェ向き。"},
  {"id": "center-02", "name": "センター街入口", "district": "center", "x": -10, "z": -66, "width": 16, "depth": 16, "height": 19, "type": "retail", "color": "#e6d1b4", "footfall": 65000, "affluence": 1.02, "rent": 215000, "purchasePrice": 125000000, "available": true, "description": "人通りが多い一方、家賃と近隣店との競争が重い。"},
  {"id": "center-03", "name": "スクランブル西口", "district": "center", "x": 15, "z": -38, "width": 18, "depth": 14, "height": 26, "type": "retail", "color": "#e6d1b4", "footfall": 80000, "affluence": 1.15, "rent": 360000, "purchasePrice": 240000000, "available": true, "description": "駅前の一等地。十分な処理能力を備えてから出店したい。"},
  {"id": "center-04", "name": "神南の路面店", "district": "center", "x": -82, "z": -126, "width": 14, "depth": 16, "height": 33, "type": "retail", "color": "#e6d1b4", "footfall": 37000, "affluence": 1.16, "rent": 125000, "purchasePrice": 78000000, "available": true, "description": "買い物客の休憩需要。価格と品質の両立が鍵。"},
  {"id": "center-05", "name": "宇田川裏通り", "district": "center", "x": -53, "z": -126, "width": 16, "depth": 14, "height": 12, "type": "retail", "color": "#e6d1b4", "footfall": 28000, "affluence": 0.9, "rent": 82000, "purchasePrice": 43000000, "available": true, "description": "表通りから一歩奥。固定費を抑えた創業候補。"},
  {"id": "center-06", "name": "駅西のテイクアウト窓口", "district": "center", "x": 15, "z": 38, "width": 18, "depth": 16, "height": 19, "type": "retail", "color": "#e6d1b4", "footfall": 58000, "affluence": 0.97, "rent": 170000, "purchasePrice": 96000000, "available": true, "description": "朝夕の急ぐ人に短時間で提供する小型立地。"},
  {"id": "center-07", "name": "センター街北端", "district": "center", "x": -23, "z": -157, "width": 14, "depth": 14, "height": 26, "type": "retail", "color": "#e6d1b4", "footfall": 32000, "affluence": 1.08, "rent": 98000, "purchasePrice": 55000000, "available": true, "description": "駅前ほどの賃料を払わずに回遊客へ届ける。"},
  {"id": "center-08", "name": "公園通り手前", "district": "center", "x": 15, "z": -128, "width": 16, "depth": 16, "height": 33, "type": "retail", "color": "#e6d1b4", "footfall": 47000, "affluence": 1.27, "rent": 182000, "purchasePrice": 112000000, "available": true, "description": "買い物客の客単価は高め。品質投資が活きる。"},
  {"id": "dogenzaka-01", "name": "道玄坂の小さな一階", "district": "dogenzaka", "x": -151, "z": 28, "width": 14, "depth": 14, "height": 12, "type": "retail", "color": "#bdaaa1", "footfall": 31000, "affluence": 0.96, "rent": 72000, "purchasePrice": 36000000, "available": true, "description": "小さく始めやすい路面店。初出店の有力候補。"},
  {"id": "dogenzaka-02", "name": "百軒店の路地角", "district": "dogenzaka", "x": -177, "z": -30, "width": 16, "depth": 16, "height": 19, "type": "retail", "color": "#bdaaa1", "footfall": 26000, "affluence": 0.85, "rent": 65000, "purchasePrice": 30000000, "available": true, "description": "駅から離れる分、家賃は控えめ。常連を育てたい。"},
  {"id": "dogenzaka-03", "name": "文化村前", "district": "dogenzaka", "x": -127, "z": -61, "width": 18, "depth": 14, "height": 26, "type": "retail", "color": "#bdaaa1", "footfall": 46000, "affluence": 1.18, "rent": 155000, "purchasePrice": 88000000, "available": true, "description": "観劇や買い物の合間の需要。上質な空間が似合う。"},
  {"id": "dogenzaka-04", "name": "坂の中腹", "district": "dogenzaka", "x": -151, "z": -126, "width": 14, "depth": 16, "height": 33, "type": "retail", "color": "#bdaaa1", "footfall": 24000, "affluence": 0.92, "rent": 69000, "purchasePrice": 33000000, "available": true, "description": "目的来店を育てる立地。安さだけでは売上が伸びにくい。"},
  {"id": "dogenzaka-05", "name": "道玄坂オフィス下", "district": "dogenzaka", "x": -177, "z": 58, "width": 16, "depth": 14, "height": 12, "type": "retail", "color": "#bdaaa1", "footfall": 42000, "affluence": 1.07, "rent": 129000, "purchasePrice": 71000000, "available": true, "description": "働く人の休憩と朝の一杯を取り込む。"},
  {"id": "dogenzaka-06", "name": "道玄坂西口", "district": "dogenzaka", "x": -127, "z": 58, "width": 18, "depth": 16, "height": 19, "type": "retail", "color": "#bdaaa1", "footfall": 35000, "affluence": 0.94, "rent": 93000, "purchasePrice": 48000000, "available": true, "description": "賃料と通行量のバランスがよい中規模物件。"},
  {"id": "dogenzaka-07", "name": "松濤への小径", "district": "dogenzaka", "x": -178, "z": -158, "width": 14, "depth": 14, "height": 26, "type": "retail", "color": "#bdaaa1", "footfall": 18000, "affluence": 1.38, "rent": 104000, "purchasePrice": 67000000, "available": true, "description": "通行量は少ないが、品質を重視する客層。"},
  {"id": "dogenzaka-08", "name": "坂上の焙煎店跡", "district": "dogenzaka", "x": -151, "z": 125, "width": 16, "depth": 16, "height": 33, "type": "retail", "color": "#bdaaa1", "footfall": 22000, "affluence": 1.03, "rent": 76000, "purchasePrice": 39000000, "available": true, "description": "駅前から離れた落ち着いた街並み。低固定費で育てる。"},
  {"id": "miyashita-01", "name": "東口のオフィス前", "district": "miyashita", "x": 112, "z": -28, "width": 14, "depth": 14, "height": 12, "type": "retail", "color": "#b1c5c9", "footfall": 62000, "affluence": 1.28, "rent": 248000, "purchasePrice": 168000000, "available": true, "description": "働く人の多い東口。サービス品質への期待も高い。"},
  {"id": "miyashita-02", "name": "明治通りの角", "district": "miyashita", "x": 112, "z": -73, "width": 16, "depth": 16, "height": 19, "type": "retail", "color": "#b1c5c9", "footfall": 55000, "affluence": 1.15, "rent": 198000, "purchasePrice": 131000000, "available": true, "description": "通行量の厚い通り。競合との価格差を見極める。"},
  {"id": "miyashita-03", "name": "宮下公園南端", "district": "miyashita", "x": 142, "z": -73, "width": 18, "depth": 14, "height": 26, "type": "retail", "color": "#b1c5c9", "footfall": 48000, "affluence": 1.25, "rent": 181000, "purchasePrice": 117000000, "available": true, "description": "公園を巡る来街者の休憩需要を取り込む。"},
  {"id": "miyashita-04", "name": "宮下のブティック横", "district": "miyashita", "x": 174, "z": -128, "width": 14, "depth": 16, "height": 33, "type": "retail", "color": "#b1c5c9", "footfall": 36000, "affluence": 1.43, "rent": 171000, "purchasePrice": 106000000, "available": true, "description": "高単価向きだが、品質と採用への投資を要する。"},
  {"id": "miyashita-05", "name": "東口の小路", "district": "miyashita", "x": 173, "z": -28, "width": 16, "depth": 14, "height": 12, "type": "retail", "color": "#b1c5c9", "footfall": 29000, "affluence": 1.05, "rent": 102000, "purchasePrice": 58000000, "available": true, "description": "一等地の裏手。規模を抑えて東口へ進出できる。"},
  {"id": "miyashita-06", "name": "青山方面の路面店", "district": "miyashita", "x": 173, "z": 43, "width": 18, "depth": 16, "height": 19, "type": "retail", "color": "#b1c5c9", "footfall": 41000, "affluence": 1.5, "rent": 210000, "purchasePrice": 143000000, "available": true, "description": "高所得の客層。安売りより商品力が問われる。"},
  {"id": "miyashita-07", "name": "高層街の入口", "district": "miyashita", "x": 143, "z": 77, "width": 14, "depth": 14, "height": 26, "type": "retail", "color": "#b1c5c9", "footfall": 72000, "affluence": 1.4, "rent": 390000, "purchasePrice": 285000000, "available": true, "description": "大型店の候補地。人流は大きいが固定費負担も大きい。"},
  {"id": "miyashita-08", "name": "宮下北の小さな店", "district": "miyashita", "x": 173, "z": -177, "width": 16, "depth": 16, "height": 33, "type": "retail", "color": "#b1c5c9", "footfall": 33000, "affluence": 1.17, "rent": 127000, "purchasePrice": 74000000, "available": true, "description": "公園と住宅の境目で日常利用を育てる。"},
  {"id": "sakuragaoka-01", "name": "桜丘のベーカリー隣", "district": "sakuragaoka", "x": -78, "z": 120, "width": 14, "depth": 14, "height": 12, "type": "retail", "color": "#c7c1b7", "footfall": 30000, "affluence": 0.98, "rent": 78000, "purchasePrice": 40000000, "available": true, "description": "住民と働く人が混ざる生活圏。初出店にも向く。"},
  {"id": "sakuragaoka-02", "name": "桜並木の路面店", "district": "sakuragaoka", "x": -48, "z": 120, "width": 16, "depth": 16, "height": 19, "type": "retail", "color": "#c7c1b7", "footfall": 27000, "affluence": 1.08, "rent": 88000, "purchasePrice": 47000000, "available": true, "description": "落ち着いた日常需要。常連が居心地を求める。"},
  {"id": "sakuragaoka-03", "name": "桜丘オフィス下", "district": "sakuragaoka", "x": -18, "z": 120, "width": 18, "depth": 14, "height": 26, "type": "retail", "color": "#c7c1b7", "footfall": 43000, "affluence": 1.2, "rent": 147000, "purchasePrice": 91000000, "available": true, "description": "通勤と昼の需要を受け止める。客数に見合う配置が必要。"},
  {"id": "sakuragaoka-04", "name": "南口の通勤路", "district": "sakuragaoka", "x": 16, "z": 120, "width": 14, "depth": 16, "height": 33, "type": "retail", "color": "#c7c1b7", "footfall": 52000, "affluence": 1.12, "rent": 164000, "purchasePrice": 103000000, "available": true, "description": "駅へ向かう人の導線。持ち帰り需要を狙える。"},
  {"id": "sakuragaoka-05", "name": "桜丘の住宅角", "district": "sakuragaoka", "x": -78, "z": 156, "width": 16, "depth": 14, "height": 12, "type": "retail", "color": "#c7c1b7", "footfall": 21000, "affluence": 0.88, "rent": 67000, "purchasePrice": 32000000, "available": true, "description": "通行量は控えめ。固定費を小さく保ちたい。"},
  {"id": "sakuragaoka-06", "name": "坂南の小さな店", "district": "sakuragaoka", "x": -48, "z": 181, "width": 18, "depth": 16, "height": 19, "type": "retail", "color": "#c7c1b7", "footfall": 15000, "affluence": 0.78, "rent": 65000, "purchasePrice": 30000000, "available": true, "description": "低価格の日常需要。集客を過大評価しないこと。"},
  {"id": "sakuragaoka-07", "name": "桜丘ガーデン前", "district": "sakuragaoka", "x": -17, "z": 156, "width": 14, "depth": 14, "height": 26, "type": "retail", "color": "#c7c1b7", "footfall": 34000, "affluence": 1.3, "rent": 138000, "purchasePrice": 82000000, "available": true, "description": "落ち着いた上質需要。価格と満足度を両立する。"},
  {"id": "sakuragaoka-08", "name": "南口オフィス新館", "district": "sakuragaoka", "x": 16, "z": 181, "width": 16, "depth": 16, "height": 33, "type": "retail", "color": "#c7c1b7", "footfall": 46000, "affluence": 1.26, "rent": 183000, "purchasePrice": 121000000, "available": true, "description": "大きめのオフィス需要。十分な運転資金を持って出店。"},
 ];

// Keep the scenery off roads, the elevated railway (x=67..83) and landmark plots.
const landmarkReservations = [
  { x: 0, z: 0, width: 50, depth: 50 },
  { x: 75, z: 42, width: 38, depth: 70 },
  { x: 124, z: 43, width: 46, depth: 52 },
  { x: -43, z: -34, width: 40, depth: 42 },
  { x: 116, z: -143, width: 62, depth: 78 },
];
type Footprint = { x: number; z: number; width: number; depth: number };
const overlaps = (a: Footprint, b: Footprint, gap = 2) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap &&
  Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + gap;

const roadFootprints: Footprint[] = ROADS.map(road => {
  const [a, b] = road.points;
  return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2,
    width: Math.abs(a[0] - b[0]) + road.width,
    depth: Math.abs(a[1] - b[1]) + road.width };
});
const railway = { x: 75, z: 0, width: 16, depth: 410 };
const blocked = [...roadFootprints, ...landmarkReservations, railway, ...cafeSites];
const backgroundLots: Lot[] = [];
const candidates: { x: number; z: number; order: number }[] = [];
for (let z = -188; z <= 188; z += 20) {
  for (let x = -188; x <= 188; x += 20) {
    // A stable spatial shuffle avoids concentrating scenery at one map edge.
    candidates.push({ x, z, order: ((x + 211) * 193 + (z + 211) * 389) % 997 });
  }
}
for (const candidate of candidates.sort((a, b) => a.order - b.order)) {
  const n = backgroundLots.length;
  const footprint = { ...candidate, width: 11 + (n % 3) * 2, depth: 11 + (n % 2) * 3 };
  if (blocked.some(item => overlaps(footprint, item))) continue;
  const { x, z, width, depth } = footprint;
  const district: DistrictId = x > 43 ? 'miyashita' : z > 88 ? 'sakuragaoka' : x < -107 ? 'dogenzaka' : 'center';
  const type = district === 'sakuragaoka' && n % 3 !== 0 ? 'residential' : n % 4 === 0 ? 'office' : 'retail';
  const colors = ['#a4a5a0', '#c6bfb3', '#939f9f', '#b6aaa0', '#d0cbc2', '#8e959c'];
  backgroundLots.push({
    id: `city-${String(n + 1).padStart(3, '0')}`, name: `${DISTRICTS[district].name} ${type === 'residential' ? '集合住宅' : type === 'office' ? 'オフィス' : '雑居ビル'} ${n + 1}`,
    district, x, z, width, depth, height: type === 'office' ? 32 + (n % 5) * 8 : 10 + (n % 6) * 5,
    type, color: colors[n % colors.length], footfall: 0, affluence: 1, rent: 0, purchasePrice: 0,
    available: false, description: '街を構成する既存建物。この物件は現在取引対象外です。',
  });
  blocked.push(footprint);
  if (backgroundLots.length === 110) break;
}
export const LOTS: Lot[] = [...cafeSites, ...backgroundLots];

/** Prices and earnings are authored gameplay assumptions, not real company valuations.
 * weeklyProfit is a baseline before simulation shocks; risk is a 0..1 model input.
 * Neither earnings nor investment principal is guaranteed. */
export const ACQUISITION_TARGETS: AcquisitionTarget[] = [
  { id: 'morning-bakery', name: '朝日ベーカリー', sector: 'food', price: 8_000_000, weeklyProfit: 35_000, risk: 0.14, minReputation: 12,
    description: '近隣向けの小型ベーカリー。想定営業利益は週3.5万円。原材料高騰と店主交代による常連離れがリスク。' },
  { id: 'hoshi-roasters', name: '星コーヒー焙煎', sector: 'food', price: 19_000_000, weeklyProfit: 85_000, risk: 0.22, minReputation: 25,
    description: '小規模な焙煎・卸事業。想定営業利益は週8.5万円。輸入豆価格と大口顧客への依存に注意。' },
  { id: 'sakura-kitchen', name: '桜キッチン・グループ', sector: 'food', price: 46_000_000, weeklyProfit: 205_000, risk: 0.30, minReputation: 38,
    description: '駅前の惣菜・飲食チェーン。想定営業利益は週20.5万円。採用難と複数店の品質維持が課題。' },
  { id: 'sakura-estate', name: '桜丘プロパティ', sector: 'property', price: 68_000_000, weeklyProfit: 185_000, risk: 0.16, minReputation: 42,
    description: '小型ビルの保有・賃貸会社。想定営業利益は週18.5万円。空室、修繕費、金利上昇が収益を圧迫する。' },
  { id: 'miyashita-development', name: '宮下アーバン開発', sector: 'property', price: 175_000_000, weeklyProfit: 540_000, risk: 0.27, minReputation: 58,
    description: '商業物件の運営・開発会社。想定営業利益は週54万円。大型テナントの撤退と建築費変動に注意。' },
  { id: 'tokyo-table', name: '東京テーブルHD', sector: 'food', price: 290_000_000, weeklyProfit: 1_170_000, risk: 0.34, minReputation: 65,
    description: '多店舗展開する外食企業。想定営業利益は週117万円。景気、衛生管理、買収後の統合がリスク。' },
  { id: 'shuto-rail', name: '首都リンク鉄道', sector: 'rail', price: 420_000_000, weeklyProfit: 1_120_000, risk: 0.22, minReputation: 75,
    description: '架空の小規模鉄道・沿線事業。想定営業利益は週112万円。保守更新、旅客数、規制対応の負担が大きい。実在の鉄道会社の評価額ではない。' },
  { id: 'metropolitan-rail', name: '東都レール＆街づくり', sector: 'rail', price: 980_000_000, weeklyProfit: 2_850_000, risk: 0.29, minReputation: 88,
    description: '架空の鉄道・駅ビル複合企業。想定営業利益は週285万円。大型更新投資と沿線需要の低下に備える。実在企業とは無関係。' },
];
