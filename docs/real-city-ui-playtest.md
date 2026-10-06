# 実測街の操作確認 — 0.4.3

2026-10-06。対象は [RealCityView](../src/ui/RealCityView.tsx) と App への接続です。本担当のブラウザ操作は GPU を無効にし、描画 controller だけを stub にしています。別担当の実 GPU 統合結果と、本担当による受領画像の目視は末尾に分けます。会社の初期状態から検査し、元の `/tmp` 証拠を残して共有フォルダへコピーしました。

## プレイヤーの入口

1. 街の画面で「実測の渋谷」に切り替える。
2. 「地点を選ぶ」から対応する4地点を選ぶ。全32区画は既存の区画一覧から選べる。
3. 同じ区画の出店・運営画面で設定し、「週を終了する」で決算を見る。

実測の街に架空の経営を重ねた表示です。地点・賃料・売買価格・人流はゲーム設定で、実際の募集物件ではありません。読み込み中や失敗中も経営操作を続けられ、「ゲーム街で続ける」から戻れます。

## wrapper の7項目

実 App、実 wrapper、実保存処理を使い、`CityView` は空表示、`RealCityScene` は明示的な controller stub に置換しました。Chromium の `--disable-gpu`、390 × 844 px。最終 CSS 修正後にも再実行し、7項目成功、予期しない page error は0でした。

| 項目 | 確認した結果 |
| --- | --- |
| 同期初期化失敗 | 失敗表示から「再試行」で新たな読み込みを開始する。 |
| 読み込み中の A → B 選択 | センター街に続けて道玄坂を選び、最後の道玄坂だけを focus する。 |
| 全景 | inspector の選択区画を保持し、focus を解除する。 |
| 品質変更 | 全景に戻した後の2048への切替で、以前の focus が復活しない。 |
| 0サイズ | host 高さを0にした通知と復帰が controller へ届く。 |
| ゲーム街への復帰 | wrapper を unmount し、stub の dispose と遅延処理完了を待つ。 |
| 保存 | 一連の地図操作前後で、読み出した保存 JSON 全体が同一。 |

証拠は [結果 JSON](../../shared/shibuya-artifacts/integration-v043/wrapper/result.json)、[実行スクリプトのコピー](../../shared/shibuya-artifacts/integration-v043/wrapper/realcity-wrapper-smoke.py)。dispose の確認は stub の契約確認であり、実際の texture・decoder・GPU 資源の解放測定ではありません。

補助の [SSR 検査](../../shared/shibuya-artifacts/integration-v043/wrapper/realcity-wrapper-markup.mjs) と [静的 HTML](../../shared/shibuya-artifacts/integration-v043/wrapper/realcity-wrapper-markup.html) は、4地点のマークアップと経営状態不変を確認したものです。[高さ250pxの静的画面](../../shared/shibuya-artifacts/integration-v043/wrapper/realcity-wrapper-250px.png)と[地点メニュー](../../shared/shibuya-artifacts/integration-v043/wrapper/realcity-wrapper-picker.png)は初期確認時の記録で、下記の実 App による最終モバイル確認とは区別します。

## 高さ約250pxの実 App 確認

390 × 620 pxで、実測ビュー本体は342 × 253.6 px、共通の地図切替バーは高さ44pxでした。App と wrapper は実物、controller のみ stub、GPU は無効です。

地点メニューと出典を同時に開くと、下部の品質・全景ボタンが宮下・桜丘の地点ボタンを覆う問題を再現しました。[専用 CSS](../src/ui/real-city-view.css)で、地点メニューを開いている間だけ上部の重なり順を上げて修正しました。メニューは選択すると閉じます。

修正後、4地点すべてを通常のクリックで選べ、実 inspector の区画 ID がそれぞれ一致しました。出典は下端の公式リンクまで内部スクロールでき、リンク位置が他要素に覆われていないことを確認しました。合成の読み込み失敗から再試行して ready に復帰し、共通バーの「ゲーム街」でも戻れました。横方向のページはみ出しはありません。

- [結果 JSON](../../shared/shibuya-artifacts/integration-v043/wrapper-mobile/result.json)には実測寸法、クリック対象の `elementFromPoint`、4つの選択 ID を保持しています。
- [通常表示](../../shared/shibuya-artifacts/integration-v043/wrapper-mobile/ready.png)、[両メニュー展開](../../shared/shibuya-artifacts/integration-v043/wrapper-mobile/both-details-open.png)、[出典下端](../../shared/shibuya-artifacts/integration-v043/wrapper-mobile/attribution-scrolled.png)、[失敗と再試行](../../shared/shibuya-artifacts/integration-v043/wrapper-mobile/failed.png)を目視しました。
- [実行スクリプトのコピー](../../shared/shibuya-artifacts/integration-v043/wrapper-mobile/realcity-mobile-review.py)は元の `/tmp/realcity-wrapper-smoke.py` から stub を読み込みます。元ファイルとコピーをともに保持しています。

## 実 GPU 画像の目視と範囲

都市担当から届いた[桜丘の controller 単体画像](../../shared/shibuya-artifacts/realcity-v043/sakuragaoka-01-marker.png)では、架空の区画名と営業・保有の目印を確認しました。初回画像は実看板形状がラベル右端に重なっており、都市・表示データ担当がカメラ調整を担当しています。元の建物形状や目印の位置をこの UI 検査で変更していません。controller の描画検査は[別の記録](real-city-controller.md)を参照してください。

別担当が Firefox + Mesa、通常 UI の軽量設定で採取した[統合 App の実 GPU 画像](../../shared/shibuya-artifacts/integration-v043/gpu/gpu-latest-focus.png)を受領し、本担当は画像ツールで目視しました。renderer の stub はなく、通常の新会社で2店舗を開業した後、実測街を表示した画像です。1000 × 760 px のデスクトップ画像であり、上記390pxのモバイル DOM 画像とは条件が異なります。

画像では次を確認しました。

- 「実測の渋谷」が選択され、「全32区画・実測表示は4地点」と架空の経営である短文が見える。
- 上部の選択名、実測街内の「ゲーム内 営業」目印、右の経営パネルがすべて「道玄坂の小さな一階」を示す。目印の文字と選択リングが建物や UI に隠れていない。
- 「地点を選ぶ」、1024の品質選択、全景、ゲーム街への復帰、出典の入口が見え、画面内で互いを覆っていない。
- 右側の経営情報と下部の「週を終了する」が実測街と同じ画面にある。画面が実測ビューアだけに切り替わって経営の入口を失ってはいない。

目視だけでクリック可否や保存一致を判定していません。それらは別担当の[実 GPU 統合結果 JSON](../../shared/shibuya-artifacts/integration-v043/gpu/results.json)で5項目成功・予期しないエラー0を確認しました。対象は最新 focus の採用、idle と合成 hidden 通知中の描画停止、実 renderer 表示中の通常2店舗の週決算と engine・primary・backup の一致、財務ページ移動による unmount、未完了ロード中の連続切替の取消です。記録上は20建物・72地表の読み込みが完了し、検査前後の対象ソース SHA が一致しています。通信保留と hidden 通知は検査側の合成操作で、OS の実タブ背景化や通信性能測定とは区別します。

既存の `integration-v043/dom/ordinary-*.png` は renderer を stub にした経営操作検査であり、実 GPU の証拠には含めません。追加の統合失敗注入はHTTP503とWebGL初期化失敗の2項目が成功し、それぞれ通常開業・週保存・再読込を確認しました。この5項目や本担当の画像確認とは分けて、統合QA記録に残しています。

この記録は、Windows 実機性能、タッチ実機、長時間プレイ、公開サイトの0.4.3動作、実際の空き物件や店舗権利を確認するものではありません。描画の寿命については[独立レビュー](real-city-integration-lifecycle.md)、32区画と経営・保存の検査については[統合 QA 記録](../../shared/shibuya-artifacts/integration-v043/README.md)を参照してください。
