# 渋谷 CAPITAL — デザイン方針と参照記録

調査日: 2026-10-06（UTC）。提案ボード: `/workspace/shared/shibuya-artifacts/design/design-proposals.png`。これは今回制作したオリジナルの比較モックであり、既存サービスや完成ゲームのスクリーンショットではありません。

## 3つの提案

| 案 | 配色 | 書体・情報設計 | 適性 |
| --- | --- | --- | --- |
| **01 Tokyo Daylight（推奨）** | 白 `#ffffff`、紺 `#17253c`、青 `#2864e8`、淡い空色 `#e6eef3` | 英数字 Manrope、日本語 Noto Sans JP（両方を同梱）。見出し24–32px、本文14–16px、金額は等幅数字。街の横に明快な経営パネル | 明るい渋谷と事業経営を同時に理解できる標準テーマ |
| **02 Metro Editorial** | 白 `#ffffff`、墨 `#202124`、朱橙 `#e44b16` | 太めの地区番号、駅の案内に着想した簡潔なラベル、直線と細い罫線 | 都市の回遊性や地区ごとの特徴を強調する別案 |
| **03 After Hours** | 炭色 `#18212a`、銀白 `#e9f1f6`、シアン `#54d9e7` | 同じ情報階層を暗色面に展開。発光は選択中の対象に限定 | 任意の夜間テーマ。昼の読みやすさを損なわない独立した選択肢 |

提案色は当プロジェクトの判断です。参照サービスの色を採取したものではありません。3テーマはゲーム画面の「デザイン」から即時切替できます。冒頭の比較モックとは別に、実装後の画面を同ディレクトリの daylight.png / metro.png / night.png に記録しています。

## 実際に取得・読解した一次資料

商用サービスの公開トップページを閲覧できなかったため、許可されたGitHub上の公式ソースを読解しました。3件とも**コードに基づく参照**であり、現行本番画面の目視レビューではありません。

1. **Mapbox GL JS** — [公式CSS](https://github.com/mapbox/mapbox-gl-js/blob/main/src/css/mapbox-gl.css)。取得成功。`.mapboxgl-map` は12px/20pxのHelvetica Neue系スタック。コントロールは白背景、4px角丸、軽いアウトライン、32px角ボタン、区切り線を持ち、地図の四隅へ配置されます。採用する原則: 街を主役にして操作群を端にまとめ、白い操作面で背景から分離する。日本語UIでは本文をより大きくし、タッチ操作は44px程度を確保します。Mapboxのロゴ、アイコン、CSS本体はゲームに複製しません。
2. **GitHub Primer** — [公式タイポグラフィ変数](https://github.com/primer/css/blob/main/src/support/variables/typography.scss)、[README](https://github.com/primer/css/blob/main/README.md)。取得成功。14px基準、行高1.5、OS標準サンセリフ、400/500/600のウェイト、デスクトップ見出し32/24/20pxを確認。採用する原則: 装飾用フォントより情報の階層を優先し、経営数値と操作を一定のリズムで配置する。READMEはCSSリポジトリがKTLOであり、新しいコンポーネントにはprimer/reactを案内しています。本作は依存追加せず原則のみ参照します。
3. **GOV.UK Frontend v5.9.0** — [公式配色](https://github.com/alphagov/govuk-frontend/blob/v5.9.0/packages/govuk-frontend/src/govuk/settings/_colours-palette.scss)、[公式書体定義](https://github.com/alphagov/govuk-frontend/blob/v5.9.0/packages/govuk-frontend/src/govuk/settings/_typography-font.scss)。取得成功。白、ほぼ黒 `#0b0c0c`、青 `#1d70b8`、淡灰 `#f3f2f1`、橙 `#f47738`等の明示的なパレット、通常400/太字700を確認。採用する原則: 操作色と本文のコントラストを分け、色だけで損益・警告を伝えない。GDS Transportや政府の意匠は使用せず、日本語に適した標準書体と独自色を使用します。

取得した資料のコピーとURL・HTTP結果: `/workspace/shared/shibuya-artifacts/design/source-retrieval.json` および同ディレクトリの `*.txt`。`main`参照は将来変わるため、調査時点のコピーを残しています。

## 閲覧できなかった候補

[Linear](https://linear.app)、[Apple Maps](https://www.apple.com/maps/)、[Mapbox](https://www.mapbox.com)、[Mercury](https://mercury.com)、[Ramp](https://ramp.com)はすべて環境プロキシの `Tunnel connection failed: 403 Forbidden`。これらを今回の閲覧済み資料として扱いません。Linearの公式READMEは取得できましたが、API開発資料なので画面設計の根拠には使用していません。失敗記録は `retrieval.json` に保存しました。

## 昼の渋谷のアート方針

[Wikimedia Commonsの渋谷交差点カテゴリ](https://commons.wikimedia.org/wiki/Category:Shibuya_Crossing)も同じ403で取得できず、ライセンスを確認済みの写真素材は今回追加していません。写真の色を測定したという主張もしません。都市の形状・地理に関する根拠は既存の `real-city.md` / `sources.md` を参照してください。

以下はオリジナルのアート方針です。

- 大部分を明るいコンクリート、生成り外壁、青灰の窓、濃すぎないアスファルトで構成する。横断歩道の白線を明快に読む。
- 建物の基壇部に店舗のリズム、上層部に窓と控えめな看板、屋上に設備を置き、単なる色付き直方体から分化させる。
- 昼の空と環境光を明るくし、直射光と陰影で立体感を出す。赤・青・橙は看板や選択表示に限定し、ネオンで全面を染めない。
- 写真・企業ロゴ・実在ブランドの看板を転用しない。ゲーム独自の架空店舗名で都市の密度を表現する。

選択時は青い輪郭とラベル、損失はマイナス記号と文言、警告はアイコンと説明を併用します。ボタンには動詞、金額には期間・単位を添え、街の美しさと経営判断の明快さを両立させます。
