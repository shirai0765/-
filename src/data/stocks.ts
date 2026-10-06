import type { StockDefinition } from '../model';
/** 95 equities + 5 REITs. Prices are dated offline references; yields and risk are GAME PARAMETERS.
 * Selection provenance and official JPX classifications: docs/market-universe.json, docs/sources.md.
 */
type StockSeed = [code: string, name: string, realName: string, sector: string, market: NonNullable<StockDefinition['market']>, profile: NonNullable<StockDefinition['profile']>];
const universe: StockSeed[] = [
  ['9432', 'NTTOWN', 'ＮＴＴ', '通信・IT', 'Prime', 'cyclical'],
  ['3543', 'コモレビ珈琲', 'コメダホールディングス', '外食', 'Prime', 'cyclical'],
  ['3087', 'ドートル・日食', 'ドトール・日レスホールディングス', '外食', 'Prime', 'cyclical'],
  ['9005', '東都電鉄', '東急', '鉄道', 'Prime', 'defensive'],
  ['9020', '東日本レール', '東日本旅客鉄道', '鉄道', 'Prime', 'defensive'],
  ['8801', '三井の街不動産', '三井不動産', '不動産・建設', 'Prime', 'cyclical'],
  ['8802', '三菱の街地所', '三菱地所', '不動産・建設', 'Prime', 'cyclical'],
  ['7203', 'トヨノ自動車', 'トヨタ自動車', '自動車', 'Prime', 'cyclical'],
  ['8306', '三菱の杜銀行', '三菱ＵＦＪフィナンシャル・グループ', '金融', 'Prime', 'income'],
  ['8316', '三井すみれ銀行', '三井住友フィナンシャルグループ', '金融', 'Prime', 'income'],
  ['8591', 'オリクス投資', 'オリックス', '金融', 'Prime', 'income'],
  ['2502', 'アサヒノ飲料', 'アサヒグループホールディングス', '食品・飲料', 'Prime', 'defensive'],
  ['2802', 'うまみの素', '味の素', '食品・飲料', 'Prime', 'defensive'],
  ['9984', 'ソフトリンク投資', 'ソフトバンクグループ', '通信・IT', 'Prime', 'cyclical'],
  ['6758', 'ソラニー', 'ソニーグループ', '電気機器', 'Prime', 'cyclical'],
  ['7974', '任天島', '任天堂', 'その他製品', 'Prime', 'cyclical'],
  ['9433', 'KDDアイランド', 'ＫＤＤＩ', '通信・IT', 'Prime', 'cyclical'],
  ['9501', '東京ライト', '東京電力ホールディングス', 'エネルギー', 'Prime', 'income'],
  ['5020', 'ENEON', 'ＥＮＥＯＳホールディングス', 'エネルギー', 'Prime', 'income'],
  ['8411', 'みずほし銀行', 'みずほフィナンシャルグループ', '金融', 'Prime', 'income'],
  ['7944', '星風技研44', 'ローランド', 'その他製品', 'Prime', 'cyclical'],
  ['8793', '月丘技研93', 'ＮＥＣキャピタルソリューション', '金融', 'Prime', 'income'],
  ['5331', '青葉技研31', 'ノリタケ', 'ガラス・土石製品', 'Prime', 'cyclical'],
  ['5185', '朝凪技研85', 'フコク', 'ゴム製品', 'Prime', 'cyclical'],
  ['9336', '虹橋技研36', '大栄環境', 'サービス', 'Prime', 'cyclical'],
  ['3880', '空庭技研80', '大王製紙', 'パルプ・紙', 'Prime', 'cyclical'],
  ['3232', '銀河技研32', '三重交通グループホールディングス', '不動産・建設', 'Prime', 'cyclical'],
  ['7388', '若葉技研88', 'ＦＰパートナー', '金融', 'Prime', 'income'],
  ['9319', '陽光技研19', '中央倉庫', '倉庫・運輸関連業', 'Prime', 'cyclical'],
  ['4968', '山桜技研68', '荒川化学工業', '化学', 'Prime', 'cyclical'],
  ['4554', '星風企画54', '富士製薬工業', '医薬品', 'Prime', 'defensive'],
  ['3036', '月丘企画36', 'アルコニックス', '卸売業', 'Prime', 'cyclical'],
  ['3387', '青葉企画87', 'クリエイト・レストランツ・ホールディングス', '小売', 'Prime', 'cyclical'],
  ['1833', '朝凪企画33', '奥村組', '不動産・建設', 'Prime', 'cyclical'],
  ['4481', '虹橋企画81', 'ベース', '通信・IT', 'Prime', 'cyclical'],
  ['6310', '空庭企画10', '井関農機', '機械', 'Prime', 'cyclical'],
  ['1375', '銀河企画75', 'ユキグニファクトリー', '水産・農林業', 'Prime', 'cyclical'],
  ['9119', '若葉企画19', '飯野海運', '海運業', 'Prime', 'cyclical'],
  ['5011', '陽光企画11', 'ニチレキグループ', 'エネルギー', 'Prime', 'income'],
  ['7715', '山桜企画15', '長野計器', '精密機器', 'Prime', 'cyclical'],
  ['6731', '星風開発31', 'ピクセラ', '電気機器', 'Standard', 'speculative'],
  ['6993', '月丘開発93', '大黒屋ホールディングス', '小売', 'Standard', 'speculative'],
  ['8107', '青葉開発07', 'キムラタン', '繊維製品', 'Standard', 'speculative'],
  ['7897', '朝凪開発97', 'ホクシン', 'その他製品', 'Standard', 'cyclical'],
  ['4346', '虹橋開発46', 'ＮＥＸＹＺ．Ｇｒｏｕｐ', '金融', 'Standard', 'income'],
  ['5279', '空庭開発79', '日本興業', 'ガラス・土石製品', 'Standard', 'cyclical'],
  ['5199', '銀河開発99', '不二ラテックス', 'ゴム製品', 'Standard', 'cyclical'],
  ['9639', '若葉開発39', '三協フロンテア', 'サービス', 'Standard', 'cyclical'],
  ['3951', '陽光開発51', '朝日印刷', 'パルプ・紙', 'Standard', 'cyclical'],
  ['8914', '山桜開発14', 'エリアリンク', '不動産・建設', 'Standard', 'cyclical'],
  ['9361', '星風グループ61', '伏木海陸運送', '倉庫・運輸関連業', 'Standard', 'cyclical'],
  ['4360', '月丘グループ60', 'マナック・ケミカル・パートナーズ', '化学', 'Standard', 'cyclical'],
  ['4524', '青葉グループ24', '森下仁丹', '医薬品', 'Standard', 'defensive'],
  ['8076', '朝凪グループ76', 'カノークス', '卸売業', 'Standard', 'cyclical'],
  ['3175', '虹橋グループ75', 'エー・ピーホールディングス', '小売', 'Standard', 'cyclical'],
  ['1921', '空庭グループ21', '巴コーポレーション', '不動産・建設', 'Standard', 'cyclical'],
  ['3933', '銀河グループ33', 'チエル', '通信・IT', 'Standard', 'cyclical'],
  ['6408', '若葉グループ08', '小倉クラッチ', '機械', 'Standard', 'cyclical'],
  ['1381', '陽光グループ81', 'アクシーズ', '水産・農林業', 'Standard', 'cyclical'],
  ['9173', '山桜グループ73', '東海汽船', '海運業', 'Standard', 'cyclical'],
  ['5010', '星風商会10', '日本精蝋', 'エネルギー', 'Standard', 'income'],
  ['9206', '月丘商会06', 'スターフライヤー', '空運業', 'Standard', 'cyclical'],
  ['7713', '青葉商会13', 'シグマ光機', '精密機器', 'Standard', 'cyclical'],
  ['3529', '朝凪商会29', 'アツギ', '繊維製品', 'Standard', 'cyclical'],
  ['8704', '虹橋商会04', 'トレイダーズホールディングス', '金融', 'Standard', 'income'],
  ['7264', '空庭商会64', 'ムロコーポレーション', '自動車', 'Standard', 'cyclical'],
  ['5922', '銀河商会22', '那須電機鉄工', '金属製品', 'Standard', 'cyclical'],
  ['5609', '若葉商会09', '日本鋳造', '鉄鋼', 'Standard', 'cyclical'],
  ['1514', '陽光商会14', '住石ホールディングス', '鉱業', 'Standard', 'cyclical'],
  ['7161', '山桜商会61', 'じもとホールディングス', '金融', 'Standard', 'income'],
  ['4564', '星風産業64', 'オンコセラピー・サイエンス', '医薬品', 'Growth', 'speculative'],
  ['4597', '月丘産業97', 'ソレイジア・ファーマ', '医薬品', 'Growth', 'speculative'],
  ['7806', '青葉産業06', 'ＭＴＧ', 'その他製品', 'Growth', 'growth'],
  ['7320', '朝凪産業20', 'Ｓｏｌｖｖｙ', '金融', 'Growth', 'income'],
  ['9158', '虹橋産業58', 'シーユーシー', 'サービス', 'Growth', 'growth'],
  ['2978', '空庭産業78', 'ツクルバ', '不動産・建設', 'Growth', 'growth'],
  ['7343', '銀河産業43', 'ブロードマインド', '金融', 'Growth', 'income'],
  ['9326', '若葉産業26', '関通ホールディングス', '倉庫・運輸関連業', 'Growth', 'growth'],
  ['247A', '陽光産業7A', 'Ａｉロボティクス', '化学', 'Growth', 'growth'],
  ['4889', '山桜産業89', 'レナサイエンス', '医薬品', 'Growth', 'growth'],
  ['7689', '星風技研89', 'コパ・コーポレーション', '卸売業', 'Growth', 'growth'],
  ['3550', '月丘技研50', 'スタジオアタオ', '小売', 'Growth', 'growth'],
  ['1401', '青葉技研01', 'エムビーエス', '不動産・建設', 'Growth', 'growth'],
  ['5252', '朝凪技研52', '日本ナレッジ', '通信・IT', 'Growth', 'growth'],
  ['6224', '虹橋技研24', 'ＪＲＣ', '機械', 'Growth', 'growth'],
  ['9204', '空庭技研04', 'スカイマーク', '空運業', 'Growth', 'growth'],
  ['218A', '銀河技研8A', 'Ｌｉｂｅｒａｗａｒｅ', '精密機器', 'Growth', 'growth'],
  ['325A', '若葉技研5A', 'ＴＥＮＴＩＡＬ', '繊維製品', 'Growth', 'growth'],
  ['5842', '陽光技研42', 'インテグラル', '金融', 'Growth', 'income'],
  ['402A', '山桜技研2A', 'アクセルスペースホールディングス', '自動車', 'Growth', 'growth'],
  ['523A', '星風企画3A', 'セイワホールディングス', '金属製品', 'Growth', 'growth'],
  ['350A', '月丘企画0A', 'デジタルグリッド', 'エネルギー', 'Growth', 'growth'],
  ['6521', '青葉企画21', 'オキサイド', '電気機器', 'Growth', 'growth'],
  ['5858', '朝凪企画58', 'ＳＴＧ', '非鉄金属', 'Growth', 'growth'],
  ['2936', '虹橋企画36', 'ベースフード', '食品・飲料', 'Growth', 'growth'],
  ['8951', '星都ビル投資', '日本ビルファンド投資法人', '不動産REIT', 'REIT', 'income'],
  ['8952', '虹橋都市投資', 'ジャパンリアルエステイト投資法人', '不動産REIT', 'REIT', 'income'],
  ['3281', '銀河物流投資', 'ＧＬＰ投資法人', '不動産REIT', 'REIT', 'income'],
  ['3466', '月丘倉庫投資', 'ラサールロジポート投資法人', '不動産REIT', 'REIT', 'income'],
  ['8972', '青葉不動産投資', 'ＫＤＸ不動産投資法人', '不動産REIT', 'REIT', 'income'],
];

const profiles = {
 defensive: {yield:0.022,volatility:0.020},
 income: {yield:0.042,volatility:0.026},
 growth: {yield:0,volatility:0.060},
 cyclical: {yield:0.018,volatility:0.039},
 speculative: {yield:0,volatility:0.100},
};

// MARKET_SNAPSHOTS_START
const marketSnapshots: Partial<Record<string, Pick<StockDefinition, 'basePrice' | 'priceDate' | 'sourceUrl' | 'priceKind'>>> = {
  "1375": {
    "basePrice": 1143.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/1375.T?interval=1d&range=5d"
  },
  "1381": {
    "basePrice": 3555.0,
    "priceDate": "2026-10-06T15:23:45+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/1381.T?interval=1d&range=5d"
  },
  "1401": {
    "basePrice": 1460.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/1401.T?interval=1d&range=5d"
  },
  "1514": {
    "basePrice": 624.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/1514.T?interval=1d&range=5d"
  },
  "1833": {
    "basePrice": 5330.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/1833.T?interval=1d&range=5d"
  },
  "1921": {
    "basePrice": 2038.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/1921.T?interval=1d&range=5d"
  },
  "218A": {
    "basePrice": 1054.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/218A.T?interval=1d&range=5d"
  },
  "247A": {
    "basePrice": 925.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/247A.T?interval=1d&range=5d"
  },
  "2502": {
    "basePrice": 1592.5,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/2502.T?interval=1d&range=5d"
  },
  "2802": {
    "basePrice": 5372.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/2802.T?interval=1d&range=5d"
  },
  "2936": {
    "basePrice": 277.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/2936.T?interval=1d&range=5d"
  },
  "2978": {
    "basePrice": 315.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/2978.T?interval=1d&range=5d"
  },
  "3036": {
    "basePrice": 3365.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3036.T?interval=1d&range=5d"
  },
  "3087": {
    "basePrice": 3170.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3087.T?interval=1d&range=5d"
  },
  "3175": {
    "basePrice": 935.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3175.T?interval=1d&range=5d"
  },
  "3232": {
    "basePrice": 559.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3232.T?interval=1d&range=5d"
  },
  "325A": {
    "basePrice": 2055.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/325A.T?interval=1d&range=5d"
  },
  "3281": {
    "basePrice": 128400.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3281.T?interval=1d&range=5d"
  },
  "3387": {
    "basePrice": 777.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3387.T?interval=1d&range=5d"
  },
  "3466": {
    "basePrice": 143500.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3466.T?interval=1d&range=5d"
  },
  "350A": {
    "basePrice": 688.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/350A.T?interval=1d&range=5d"
  },
  "3529": {
    "basePrice": 1031.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3529.T?interval=1d&range=5d"
  },
  "3543": {
    "basePrice": 2797.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3543.T?interval=1d&range=5d"
  },
  "3550": {
    "basePrice": 220.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3550.T?interval=1d&range=5d"
  },
  "3880": {
    "basePrice": 948.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3880.T?interval=1d&range=5d"
  },
  "3933": {
    "basePrice": 530.0,
    "priceDate": "2026-10-06T15:10:44+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3933.T?interval=1d&range=5d"
  },
  "3951": {
    "basePrice": 894.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/3951.T?interval=1d&range=5d"
  },
  "402A": {
    "basePrice": 320.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/402A.T?interval=1d&range=5d"
  },
  "4346": {
    "basePrice": 890.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4346.T?interval=1d&range=5d"
  },
  "4360": {
    "basePrice": 1029.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4360.T?interval=1d&range=5d"
  },
  "4481": {
    "basePrice": 3150.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4481.T?interval=1d&range=5d"
  },
  "4524": {
    "basePrice": 2222.0,
    "priceDate": "2026-10-06T14:43:56+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4524.T?interval=1d&range=5d"
  },
  "4554": {
    "basePrice": 1760.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4554.T?interval=1d&range=5d"
  },
  "4564": {
    "basePrice": 21.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4564.T?interval=1d&range=5d"
  },
  "4597": {
    "basePrice": 32.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4597.T?interval=1d&range=5d"
  },
  "4889": {
    "basePrice": 1091.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4889.T?interval=1d&range=5d"
  },
  "4968": {
    "basePrice": 2538.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/4968.T?interval=1d&range=5d"
  },
  "5010": {
    "basePrice": 317.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5010.T?interval=1d&range=5d"
  },
  "5011": {
    "basePrice": 2256.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5011.T?interval=1d&range=5d"
  },
  "5020": {
    "basePrice": 1380.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5020.T?interval=1d&range=5d"
  },
  "5185": {
    "basePrice": 1946.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5185.T?interval=1d&range=5d"
  },
  "5199": {
    "basePrice": 2000.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5199.T?interval=1d&range=5d"
  },
  "523A": {
    "basePrice": 1905.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/523A.T?interval=1d&range=5d"
  },
  "5252": {
    "basePrice": 1003.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5252.T?interval=1d&range=5d"
  },
  "5279": {
    "basePrice": 1193.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5279.T?interval=1d&range=5d"
  },
  "5331": {
    "basePrice": 3810.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5331.T?interval=1d&range=5d"
  },
  "5609": {
    "basePrice": 948.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5609.T?interval=1d&range=5d"
  },
  "5842": {
    "basePrice": 2752.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5842.T?interval=1d&range=5d"
  },
  "5858": {
    "basePrice": 1159.0,
    "priceDate": "2026-10-06T13:05:36+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5858.T?interval=1d&range=5d"
  },
  "5922": {
    "basePrice": 19980.0,
    "priceDate": "2026-10-05T12:48:52+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/5922.T?interval=1d&range=5d"
  },
  "6224": {
    "basePrice": 1137.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/6224.T?interval=1d&range=5d"
  },
  "6310": {
    "basePrice": 1916.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/6310.T?interval=1d&range=5d"
  },
  "6408": {
    "basePrice": 4245.0,
    "priceDate": "2026-10-06T09:00:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/6408.T?interval=1d&range=5d"
  },
  "6521": {
    "basePrice": 3500.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/6521.T?interval=1d&range=5d"
  },
  "6731": {
    "basePrice": 100.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/6731.T?interval=1d&range=5d"
  },
  "6758": {
    "basePrice": 3768.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/6758.T?interval=1d&range=5d"
  },
  "6993": {
    "basePrice": 90.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/6993.T?interval=1d&range=5d"
  },
  "7161": {
    "basePrice": 690.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7161.T?interval=1d&range=5d"
  },
  "7203": {
    "basePrice": 2930.5,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7203.T?interval=1d&range=5d"
  },
  "7264": {
    "basePrice": 1330.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7264.T?interval=1d&range=5d"
  },
  "7320": {
    "basePrice": 1402.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7320.T?interval=1d&range=5d"
  },
  "7343": {
    "basePrice": 1301.0,
    "priceDate": "2026-10-06T14:43:12+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7343.T?interval=1d&range=5d"
  },
  "7388": {
    "basePrice": 2264.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7388.T?interval=1d&range=5d"
  },
  "7689": {
    "basePrice": 373.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7689.T?interval=1d&range=5d"
  },
  "7713": {
    "basePrice": 2700.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7713.T?interval=1d&range=5d"
  },
  "7715": {
    "basePrice": 4490.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7715.T?interval=1d&range=5d"
  },
  "7806": {
    "basePrice": 9380.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7806.T?interval=1d&range=5d"
  },
  "7897": {
    "basePrice": 115.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7897.T?interval=1d&range=5d"
  },
  "7944": {
    "basePrice": 3705.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7944.T?interval=1d&range=5d"
  },
  "7974": {
    "basePrice": 7815.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/7974.T?interval=1d&range=5d"
  },
  "8076": {
    "basePrice": 2045.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8076.T?interval=1d&range=5d"
  },
  "8107": {
    "basePrice": 31.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8107.T?interval=1d&range=5d"
  },
  "8306": {
    "basePrice": 3671.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8306.T?interval=1d&range=5d"
  },
  "8316": {
    "basePrice": 3429.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8316.T?interval=1d&range=5d"
  },
  "8411": {
    "basePrice": 8857.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8411.T?interval=1d&range=5d"
  },
  "8591": {
    "basePrice": 5870.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8591.T?interval=1d&range=5d"
  },
  "8704": {
    "basePrice": 1392.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8704.T?interval=1d&range=5d"
  },
  "8793": {
    "basePrice": 4045.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8793.T?interval=1d&range=5d"
  },
  "8801": {
    "basePrice": 1420.5,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8801.T?interval=1d&range=5d"
  },
  "8802": {
    "basePrice": 3476.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8802.T?interval=1d&range=5d"
  },
  "8914": {
    "basePrice": 822.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8914.T?interval=1d&range=5d"
  },
  "8951": {
    "basePrice": 116600.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8951.T?interval=1d&range=5d"
  },
  "8952": {
    "basePrice": 106500.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8952.T?interval=1d&range=5d"
  },
  "8972": {
    "basePrice": 141600.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/8972.T?interval=1d&range=5d"
  },
  "9005": {
    "basePrice": 1584.5,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9005.T?interval=1d&range=5d"
  },
  "9020": {
    "basePrice": 3295.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9020.T?interval=1d&range=5d"
  },
  "9119": {
    "basePrice": 1656.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9119.T?interval=1d&range=5d"
  },
  "9158": {
    "basePrice": 774.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9158.T?interval=1d&range=5d"
  },
  "9173": {
    "basePrice": 2850.0,
    "priceDate": "2026-10-06T15:00:44+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9173.T?interval=1d&range=5d"
  },
  "9204": {
    "basePrice": 428.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9204.T?interval=1d&range=5d"
  },
  "9206": {
    "basePrice": 1910.0,
    "priceDate": "2026-10-06T15:23:20+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9206.T?interval=1d&range=5d"
  },
  "9319": {
    "basePrice": 1752.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9319.T?interval=1d&range=5d"
  },
  "9326": {
    "basePrice": 476.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9326.T?interval=1d&range=5d"
  },
  "9336": {
    "basePrice": 3685.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9336.T?interval=1d&range=5d"
  },
  "9361": {
    "basePrice": 1990.0,
    "priceDate": "2026-10-02T13:23:26+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9361.T?interval=1d&range=5d"
  },
  "9432": {
    "basePrice": 170.1,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9432.T?interval=1d&range=5d"
  },
  "9433": {
    "basePrice": 2883.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9433.T?interval=1d&range=5d"
  },
  "9501": {
    "basePrice": 518.8,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9501.T?interval=1d&range=5d"
  },
  "9639": {
    "basePrice": 2270.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9639.T?interval=1d&range=5d"
  },
  "9984": {
    "basePrice": 6295.0,
    "priceDate": "2026-10-06T15:30:00+09:00",
    "priceKind": "market-reference",
    "sourceUrl": "https://query1.finance.yahoo.com/v8/finance/chart/9984.T?interval=1d&range=5d"
  }
};
// MARKET_SNAPSHOTS_END

export const STOCKS: StockDefinition[] = universe.map(([code, name, realName, sector, market, profile], index) => ({
  id: `jp-${code}`, code, name, realName, sector, market, profile,
  basePrice: market === 'REIT' ? 100000 : 500 + index * 37,
  dividendYield: Math.round(profiles[profile].yield * (0.8 + (index % 5) * 0.1) * 10000) / 10000,
  volatility: Math.round(profiles[profile].volatility * (0.85 + (index % 4) * 0.1) * 10000) / 10000,
  priceKind: 'simulation',
  ...marketSnapshots[code],
}));
