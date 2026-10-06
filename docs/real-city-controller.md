# 実測街の共通controller — 0.4.3

`src/realcity/RealCityScene.ts` を、App内の実測街と独立した `real-shibuya.html` で共有します。元の建物・写真を変えず、4地点のゲーム内目印から同じ経営区画IDを選ぶための描画層です。controllerはGameStateや取引actionを受け取らず、表示用siteと選択callbackだけを受け取ります。経営操作はAppが担当します。

## APIと寿命

`createRealCityScene(host, options)` は同期でcontrollerを返し、読み込みは非同期です。optionsは `textureQuality`、`onSelectLot`、`onProgress`、`onError`、`onFocusChange`。WebGLを作れない等の同期例外は所有側が捕捉し、生成途中の例外はfactoryがrenderer/canvas等を解放してから伝えます。

- `updateSites(sites)` は目印の名前・状態・選択枠を更新。全景・モデル・読込世代を作り直さず、カメラも動かしません。
- `focusLot(id)` は `unknown / queued / focused` を返します。ロード中は最新要求を一つだけ保持し、`onFocusChange` で実移動の完了を通知します。未対応IDや元建物の照合失敗は `unknown` で通知し、他の地点へ置き換えません。
- `overview()` は予約を破棄して実測街全体へ戻します。対象siteの削除とdisposeも古いfocus予約を破棄します。独立ビューア用には `setPreset(crossing / 109 / overhead)` も提供します。
- `setQuality(1024 / 2048 / original)` は同時decodeを作らず世代を切替。readyで同品質は何もしません。failedなら同品質指定で再試行します。
- `setExposure`、`resize`、`setVisible` は表示操作です。実効可視は明示設定・host寸法・documentの可視状態から決まります。非表示中はRAF予約を取り消し、再表示で一度描画します。
- `dispose(): Promise<void>` は即座に描画・操作・現在のrenderer/sceneを解放し、abort後の復号結果が返った場合も破棄します。Promiseは最後のdecodeとDraco解放まで待機します。同じPromiseを再利用するため、重複cleanupでも次のsceneを早く起動しません。

React側はroot所有のscene lifecycle coordinatorへdispose Promiseを渡します。controller自身が同じqueueへ再入すると待合せが循環するため、controller内に共有queueは持たせていません。`getDiagnostics()` は単一の読取用オブジェクトを返し、古いcontrollerの終端状態も確認できます。instanceId・status・disposed・renderCount・実効visible・focus/queue・読込数・pendingJobs・4地点の復元位置を含みます。値はコピーで、経営状態を書き換えるhookはありません。

## 元建物と目印

[gameSites](../src/realcity/gameSites.ts) が持つtileUri・batchId・gmlIdをb3dmのbatch tableと照合します。復号したPOSITIONと_BATCHIDから対象建物だけのworld boundsを求め、屋上maxY+6m・平面中心に目印を置きます。記録済み元頂点由来位置との距離が0.1mを超えた場合も表示しません。建物の入口や空室を推測する処理ではありません。

[RealCityMarkers](../src/realcity/RealCityMarkers.ts) は「ゲーム内 候補 / 営業 / 保有 / 営業・保有」を文字と色で示します。実ビルを所有したと示す全面塗り替えや、架空カフェGLBの埋め込みは行いません。名前と状態の変更時だけ小さいmarker群を作り直し、選択枠だけの変更では材質・文字画像も維持します。Spriteの画像も通常のMeshと同様に解放します。文字注釈はゲーム用UIとして実景の前に描画し、実看板による文字欠けを防ぎます。位置を示す球は通常の奥行き判定を維持します。注釈クリックはUIとして受け、球クリックは手前の建物との交差距離を比較して遮蔽を判定します。

4地点の座標算出は元Draco頂点・GLTF node変換・RTC・祖先transform・ENUを使い、元経済LOTSの座標は変更していません。桜丘で複数のカメラ方位を実描画比較し、幅40mの文字注釈面と元看板が交差することを確認しました。カメラは実クリック可能な当初の位置に維持し、文字注釈だけを前面表示へ変更しました。marker位置と実モデルには変更ありません。

## 検証記録

- TypeScript検査、画像メモリ/解放6テスト、4地点純粋モデル9テストが通過。
- [独立ビューア回帰9項目](/workspace/shared/shibuya-artifacts/realcity-v043/results.json)：1024・2048・原寸・1024復帰、20建物/72地表、112メッシュ/92写真割当/218,943三角形、geometry/index/normal/UV/world matrix hash・bounds一致、連続切替、部分失敗と再試行、pagehide中の遅い画像解放。
- [0.4.2との形状比較](/workspace/shared/shibuya-artifacts/realcity-v043/v042-geometry-comparison.json)でも各品質のgeometry hash・boundsは完全一致。[元ファイル照合](/workspace/shared/shibuya-artifacts/realcity-v043/source-hashes.json)は33建物b3dm・72地表画像の変更なしを記録。
- [controller実描画6項目](/workspace/shared/shibuya-artifacts/realcity-v043/controller-results.json)：同期生成失敗のrollback、最新focus予約、4目印の実pointerクリック、表示更新でmodel/camera/世代不変、idle/非表示時の描画停止、dispose完了後pendingJobs=0と描画停止。製品RAFを置き換えず測定。

| 地点 | controller単体の実画像 |
| --- | --- |
| センター街 | [候補](/workspace/shared/shibuya-artifacts/realcity-v043/center-01-marker.png) |
| 道玄坂 | [営業](/workspace/shared/shibuya-artifacts/realcity-v043/dogenzaka-01-marker.png) |
| 宮下・東口 | [物件保有](/workspace/shared/shibuya-artifacts/realcity-v043/miyashita-01-marker.png) |
| 桜丘 | [営業と物件保有](/workspace/shared/shibuya-artifacts/realcity-v043/sakuragaoka-01-marker.png) |

この4画像は専用controller検査からの実描画で、Appの経営UI統合検査とは別です。画像加工・合成はありません。App内の実操作・同じ保存状態の往復・失敗中の週次決算は統合担当が別途確認します。地表の平面近似、LOD2の近景解像度、元写真の撮影時期の制約は引き続き残ります。Windows実機性能は未検証です。

## 正式な単体HTML

最終sourceから [0.4.3単体HTML](/workspace/shared/shibuya-artifacts/offline-0.4.3/real-shibuya-viewer.html) を別出力として生成しました。旧版と暫定版は維持しています。[生成記録](/workspace/shared/shibuya-artifacts/offline-0.4.3/package-report.json) と [埋込データ照合](/workspace/shared/shibuya-artifacts/offline-0.4.3/embedded-assets-check.json) に、99ファイル・20建物leaf tile・72地表画像を記録しています。全埋込データを復元し、publicの元ファイルとbyte単位で一致しました。

- HTML: 83,272,262 bytes（約83.3 MB）。
- SHA-256: `533a5eef0ffcb01c253ac1e93ca06f455a8eda584b500af4356e287f5addab54`。
- 元assetの合計: 61,954,843 bytes。HTMLではbase64展開とプログラム分が加わります。

[正式単体HTMLの実ブラウザ検査9項目](/workspace/shared/shibuya-artifacts/offline-0.4.3/real-shibuya-offline-qa.json)も通過しました。既定1024で20建物・72地表を読み込み、3視点・明るさ・ホイール・取得記録blobを確認。初回HTML以外のHTTPはすべて遮断し、追加通信0・console/page error 0でした。Chromium + SwiftShaderでの検査であり、Windows実機性能の証拠ではありません。記録中のdraw calls・triangles・texturesは初期視点での描画値で、全sceneの形状・画像数とは異なります。

[交差点](/workspace/shared/shibuya-artifacts/offline-0.4.3/real-shibuya-offline-crossing.png)・[109周辺](/workspace/shared/shibuya-artifacts/offline-0.4.3/real-shibuya-offline-109.png)・[街区全体](/workspace/shared/shibuya-artifacts/offline-0.4.3/real-shibuya-offline-overhead.png)を画像加工せず保存し、目視しました。HTMLの検査後SHA-256も上記値と一致します。管理ブラウザのfileアクセス制限を回避せず、localhostでHTMLを提供して検証しています。
