# 0.4.3 実測街統合の独立レビュー

2026-10-06 UTC。資本担当によるコード読取・独立会計照合と、他担当から受領した DOM 証拠を区別して記録する。この担当は実装ソースを変更していない。設計根拠は [実測街の統合案](real-city-integration.md)。

**経営対象を 4 地点へ縮める変更は見つからず、全 32 区画の選択・所有・資金導線と旧 schema 1 の会計互換を確認した。** 統合 App の DOM 検証では両 3D view を置き換えているため、実測モデルの描画・遮蔽・GPU 寿命はこの結論に含めない。地図の例外処理と描画の残件は [lifecycle レビュー](../real-city-integration-lifecycle.md)と分けて追跡する。

## 確認した経営と表示の境界

| 観点 | 読取・計算による確認 |
|---|---|
| 32 区画と 4 地点 | `SiteBrowser` の正本は既存 `LOTS.filter(available)` の全 32 件。先頭 12 件への制限を撤去。実測対応 4 件は表示上のバッジと目印であり、出店・所有・沿線の条件には加わらない。 |
| 所有四状態 | `getRealCitySites` は同じ lotId の店舗と物件を別々に参照し、空き／店舗のみ／物件のみ／両方を返す。両方は一覧の店舗・物件フィルター双方に入り、物件のみの区画は出店可能に入る。「出店可能」は資金条件を満たす意味ではない旨が一覧に表示される。 |
| 所有の変化 | 店舗と物件を両方持つ地点で、閉店後は物件のみ、物件売却後は店舗のみとなることを公開 action で確認。目印は最新 state の状態と店名に追随する。 |
| 地図切替 | `changeMap` は UI の map/focus state だけを更新し、経済 action・週進行・save を呼ばない。welcome/settings の旧 `openRealCity` は明示保存・別 HTML 遷移の機能として残り、同 App の切替からは使わない。 |
| 未対応 28 区画 | 選択・`viewStore` は元 lotId を維持してゲーム街へ明示的に切り替える。他の対応地点へ置き換えない。`viewStore` は最新 state に店舗が存在するか確認する。 |
| 選択とカメラ | selectedLotId は経営対象、focus は明示カメラ要求。`updateSites` の selected 更新は目印だけを更新する。全景は親の focus を null にし、同 map 内の通常 state/quality 更新やページ往復で古い focus を復活させない。ユーザーが game→real と明示的に再入場する場合は、選択中の対応地点へ新しい focus を要求する仕様。 |
| 資金計画の帰路 | 元の lotId と出店形態を復元して `selectLot` へ戻る。map mode は投資 memo の安定 ID に含めない。任意支出・留保・借入額・借入期間は App 所有の draft に保持し、同じ投資への再訪で上書きしない。戻り先では最新 state の実予測を使う。 |
| 保存・破綻 | 新しい表示情報を GameState/schema へ追加していない。借入残高があり今週純利益が 0 以下の場合と、週末現金不足の場合の既存警告は維持。地図選択から資金補填・投資実行は発生しない。 |
| 現実との区別 | wrapper と選択詳細に架空の経営である説明があり、地点・価格・賃料・人流はゲーム設定と明記する。実測の建物を実際に所有・賃借したとの表示にはしない。 |

## 独立した会計照合

実装前の `/tmp/real-city-capital-baseline.json` に schema 1 envelope、各 lot の期待状態、`previewWeek`、`getSummary`、経済関連 4 ファイルの SHA-256 を保存した。32 区画に四状態を配し、店舗 16 件・物件 16 件、株式保有 1 銘柄・借入 1 件を含めた。

これは開始資金を **90 億円へ置き換えた人工の会計境界 fixture**。その後の出店・物件購入・株式購入・借入は公開 action を使った。通常プレイの資金到達性や成長速度を示すものではない。

`/tmp/real-city-capital-review.ts` を実行し、同名 JSON に以下の 11 項目の成功を記録した。

- 旧 envelope の payload/checksum/schema の無損失往復、週予測・資本 summary 一致、engine/district/model/persistence の SHA 不変。
- 全 32 経営区画の保持、実測 anchor 4 件、全 32 ID を選んだ場合の対応目印と元 ID の一致。
- 四所有状態、閉店時の物件残存、物件売却時の店舗残存。
- selector の座標・view・表示名を変更しても元データに波及しないこと、および元 state と LOTS の非破壊性。

この計算は React DOM・renderer を実行していない。

## 他担当の実 DOM 証拠

買収担当の `/tmp/site-browser-v043/result.json` は単独 SiteBrowser で全 32 native button、状態×地区の ID 集合、390px 幅のキーボード末尾選択、空フィルター解除を確認。開発用 HMR 通信に 3 件の拒否通知があるが、商品 UI の page/console error は 0。App 統合の証拠とは分ける。

続く `/workspace/shared/shibuya-artifacts/integration-v043/site-browser-app/result.json` と同フォルダーの再現 script は、実 App・SiteBrowser・CapitalPlanningPanel による 6 カテゴリ成功、page/console error 0 を記録する。

- 全 32 ID の詳細が店舗・物件の四状態に一致し、一覧選択とフィルターで経済 state/save を変更しない。
- 対応 center-01 の premium と未対応の保有地 sakuragaoka-08 の takeaway で、財務往復後の lot/style と編集済み支出・留保・借入額・期間が一致する。
- map 切替が投資を実行せず、財務の保有物件カードから未対応の元 lot へ戻れる。
- 390px の長い店名が収まり、Enter で同じ lot を選択できる。明示 rename action と reload の結果も一致する。

同じ人工 fixture を使用。**CityView と RealCityView は null stub** であり、この App 検証からモデル読込・カメラ focus・目印クリック・実 GPU の成否を主張しない。

## 指摘と対応、残る確認範囲

レビューで、読み込み中に queued となった地点の位置照合が成立しなかった場合、ready 後も UI が「移動を準備中」に残る経路を指摘した。都市担当は `onFocusChange` に unknown を加え、未知 ID／位置不成立時に queue を解除して通知するよう修正した。wrapper は unknown 時にゲーム街で表示できる旨を案内する。修正のコード読取は完了したが、位置不成立を実 GPU 上で発生させた証拠ではない。

最新 callback/ref と scene lifetime の分離、共有キュー、CityView の遅延構築後の最新 state 適用、LoadedAssetPool の遅延 decode 解放待ちを読取確認した。資本担当から追加の必須会計修正はない。部分初期化例外・0 サイズ・解放順の専門レビューは lifecycle 文書へ集約する。

実測の 4 目印が画像上で読み取れること、カメラが対象を外さないこと、読み込み中の経営操作、実 renderer の連続 map/quality 切替は別の GPU 統合 QA の確認範囲。ここまでの会計・DOM 合格を、その代わりにはしない。
