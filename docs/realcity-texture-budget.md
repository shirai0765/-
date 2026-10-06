# 実測渋谷の画像メモリ — 0.4.2

実測ビューアの「建物写真の精細さ」を、軽量1024・高精細2048・原寸から選べます。既定は1024です。URLの `?texture=original` で原寸を直接指定できます。経営セーブや週次計算には保存しない、ビューア専用の表示設定です。

建物20末端タイルと地表72枚、表示範囲、形状、UV、材質の写真割当を維持し、GPU転送前に建物写真の最大辺だけを縮小します。元のb3dm・写真ファイルは変更しません。軽量表示では看板や窓の細部がぼけます。形状が同じでも、見た目の精細さは同じではありません。

| 建物写真設定 | 建物画像のRGBA8基底換算 | ミップマップ込みの概算 | 地表画像 |
| --- | --- | --- | --- |
| 1024・既定 | 76 MiB | 約101.33 MiB | 全72枚・原寸256²を維持 |
| 2048 | 304 MiB | 約405.33 MiB | 同上 |
| 原寸 | 1,024 MiB | 約1,365.33 MiB | 同上 |

地表は別途18 MiB、ミップマップ込み約24 MiBです。これらは画像寸法からの計算であり、GPU/VRAMの測定値ではありません。ドライバーの管理領域、フレームバッファ、形状、ブラウザの復号画像等も別に必要です。元atlasは2048²が4枚、4096²が14枚、2048×4096と4096×2048が各1枚。縦横比を維持するため1024の合計は76 MiBで、64 MiBではありません。

## 読込と解放

[src/realcity/textureBudget.ts](../src/realcity/textureBudget.ts) はGLTF復号後、シーンへ追加する前に画像を縮小します。`createImageBitmap` の縮小指定を使い、未対応/無視される場合はcanvasで縮小します。同じ画像を参照するTextureをまとめて更新し、元のImageBitmapを一度だけcloseします。色空間・向き・UV・サンプラー設定は維持します。縮小前の画像をGPUへ一度アップロードしてから差し替える方式ではありません。

元画像をCPUで復号する一時メモリは依然必要です。1タイルずつ処理し、タイル間でUIへ制御を戻します。写真のメモリ削減を、通信量削減やCPUピーク完全解消と同じ意味では扱いません。地表写真は元の画像と向きを維持し、逐次読込します。

設定の連続変更は進行中のfetchを中断し、Draco/画像の復号中は完了を待って解放してから最新の設定へ進みます。二つの世代を同時に復号しません。部分ロードの失敗時は部分モデルを解放し、再読み込みボタンを表示します。完了API `window.__realCity` は20建物/72地表の全読込後だけ公開します。`__realCityProgress` は途中状態を別に表します。

pagehideでは描画予約、操作、モデル、Texture、Bitmap、rendererを解放します。遅れて完了した復号結果もシーンへ追加せず解放します。bfcacheでページが復帰した場合は、URLに残る品質指定で再起動します。

## モデル書出し

[scripts/export-real-city.py](../scripts/export-real-city.py) は明示的に原寸URLを開き、原寸設定と建物画像の基底合計1 GiBを確認してから書き出します。低解像度が新しい既定になっても、意図せず縮小画像を元データ版GLBへ書き込みません。既存の出力GLBがある場合は上書きを拒否します。新規書出し時は `REAL_CITY_OUT` に別の保存先を指定してください。今回の作業では既存GLBを書き出し直していません。

## 検証

[tests/realcity-texture-budget.test.ts](../tests/realcity-texture-budget.test.ts) では、最大辺と縦横比、共有画像の単一縮小、geometry/UV保持、原寸保持、キャンセル後の画像解放、重複disposeを確認します。実描画は別の [0.4.2検証用ディレクトリ](/workspace/shared/shibuya-artifacts/realcity-v042/runtime-qa.py) へ保存し、旧0.4.1成果物は上書きしません。実ブラウザ検査は9項目通過、pageerror 0件でした。TypeScript検査と単体5テストも通過しました。


実記録は [results.json](/workspace/shared/shibuya-artifacts/realcity-v042/results.json)。1024→2048→原寸→1024の全てで20建物タイル・72地表タイル、112メッシュ、92写真割当、218,943三角形を確認。頂点・index・normal・UV・world matrixのSHA256と建物境界が一致しました。原寸から1024へ戻した後、計測用ラッパーで追跡した生存ImageBitmapの画素量は76 MiBへ戻りました。これは実VRAM値ではありません。

連続した品質変更では最後の設定だけが完了し、503を一度注入した検査では部分モデルを完了扱いせず、再読み込みで全タイルが揃いました。追加の[3番目タイル失敗検査](/workspace/shared/shibuya-artifacts/realcity-v042/partial-failure-results.json)でも、2タイル完了後の失敗で生存Bitmapが0・完了APIなしとなり、再試行で20建物/72地表へ戻りました。読込途中のpagehideでは遅れて返ったBitmapもcloseされ、追跡した生存Bitmapは0、canvasと完了APIは削除されました。

| 同じカメラの実画像 | 1024 | 原寸 |
| --- | --- | --- |
| 109周辺 | [1024](/workspace/shared/shibuya-artifacts/realcity-v042/1024-109-scene.png) | [原寸](/workspace/shared/shibuya-artifacts/realcity-v042/original-109-scene.png) |
| 街全体 | [1024](/workspace/shared/shibuya-artifacts/realcity-v042/1024-overview-scene.png) | [原寸](/workspace/shared/shibuya-artifacts/realcity-v042/original-overview-scene.png) |

画像は実シーンの描画で、後加工・合成はありません。目視では、109周辺の看板文字や屋上の骨組みを写した部分は1024で明確にぼけ、原寸へ戻すと細部が戻ります。俯瞰では差が小さくなります。原寸でも撮影解像度とLOD2の限界は残ります。[390pxの操作画面](/workspace/shared/shibuya-artifacts/realcity-v042/mobile-2048-ui.png)も目視し、選択欄の横はみ出しがないことを確認しました。

[元ファイルの照合](/workspace/shared/shibuya-artifacts/realcity-v042/source-hashes.json)では33 b3dmと72地表画像のSHA256が取得時の記録と一致しました。既存GLBと旧配布HTMLは再生成していません。検証環境はコンテナ内Chromium/SwiftShaderで、Windows実機のフレーム時間やGPUメモリは未測定です。


単一HTMLも別名で[検証用に生成](/workspace/shared/shibuya-artifacts/realcity-v042/real-shibuya-viewer.html)しました（83,241,660 bytes、99内包ファイル）。[オフライン検査4項目](/workspace/shared/shibuya-artifacts/realcity-v042/offline-results.json)では初回HTML以外のHTTPを遮断し、既定1024の全読込と2048への切替を確認。ページエラーは0件でした。管理ブラウザのfile制限は回避せず、検証用HTTP上で通信を遮断しています。
