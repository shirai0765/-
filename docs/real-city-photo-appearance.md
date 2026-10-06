# 実測街の写真表示 — 0.4.4

実測建物の写真にPBR照明を重ねる表示から、撮影済みの陰影をそのまま使う表示へ変更しました。暗い側壁を見やすくするための描画変更です。元写真の色精度や近景解像度を改善したとするものではありません。元の33建物b3dm・72地表画像、経営座標、4地点の屋上位置、カメラは変更していません。

## 比較と初期値

[現在値・写真参照・中性の下半球光の比較](/workspace/shared/shibuya-artifacts/next-color/comparison.html)は6視点・1024画像・同cameraで採取しました。中性の下半球光だけでは差はごく小さく、109全画像の平均絶対RGB差は0.51/255でした。追加照明を外す写真参照は暗い面が明るくなり、既存写真の陰影で円筒や建物の分離が残りました。

[明るさ1.0・1.15・1.35の比較](/workspace/shared/shibuya-artifacts/next-color/gain-comparison.html)から、初期値は控えめな1.15を採用しました。新しい表示モードや追加スライダーは設けず、既存の「建物の明るさ」を使います。[実写真との目視記録](/workspace/shared/shibuya-artifacts/next-color/review.md)・[独立UIレビュー](/workspace/shared/shibuya-artifacts/next-color/ui-review.md)も保存しています。比較画像に後加工はありません。

## 描画・明るさ・資源の契約

[photoAppearance.ts](../src/realcity/photoAppearance.ts) は建物のMeshStandardMaterialをMeshBasicMaterialへ一度だけ変換します。20写真材質と20写真なし材質を比較と同じ条件で扱います。map・画像・sRGB設定・geometry・UV・元linear colorを保持し、toneMapped=falseとします。材質交換時は旧materialのshader資源だけをdisposeし、共有mapやImageBitmapは破棄しません。最後のscene解放は従来のdisposeRealObjectが担います。

- 初期gainは1.15、操作範囲は1〜1.8。毎回保存した元linear color×gainを適用するので、繰返し操作で色が累積しません。
- `setExposure` は既存の呼出契約を維持します。有限値を範囲内へ制限し、非有限値は無視。controller内の最新gainを、読込済みの建物と新たに復号した建物の両方へ適用します。
- 品質切替・連続取消・失敗後再試行でgainを初期値へ戻しません。地表写真と地点文字にはgainを掛けません。
- `renderer.toneMappingExposure` も同値を保持します。読込中の仮のPBR地面にはrenderer露出が作用します。準備完了後の建物40材質には材質gainが作用し、空中写真地表は従来どおりtoneMapped=falseです。写真なし建物もBasicのため、旧PBR露出との二重適用はありません。
- CESIUM_RTCは既存のtile変換で一度だけ適用済みです。GLTFLoaderへその名前を認識する限定pluginを登録しました。plugin内では座標を動かさず、他の警告も抑制しません。

候補地点の文字だけを`#ba852d`から`#7d5717`へ濃くしました。背景`#fffdf1`に対する指定色コントラストは約6.33:1です。点・帯の状態色、他の状態文字、配置は維持しています。実画面の縮小や視力まで保証する数値ではありません。

## GLB書き出し

表示gainをそのままGLTFExporterへ渡すと、baseColorFactorが1を超えるため、既存書出しも最小修正しました。

snapshotの `cloneModelForExport()` は、geometryとtextureを共有するmodel cloneを返し、materialだけ複製して元linear colorへ戻します。画面のgainや元modelは変えません。`disposePhotoExportMaterials()` はclone材質だけを解放し、共有geometry/mapを破棄しません。

[export-real-city.py](../scripts/export-real-city.py) はこのcloneを使います。原寸画像を要求する既存条件を維持し、`KHR_materials_unlit`による撮影済み写真表示、exportPhotoGain=1、displayPhotoGain、元ファイル変更なし・表示gainの画像への焼込みなしをmetadataへ記録します。出力のbaseColorFactorが[0,1]であることも検査します。geometryの構成・座標・UVを変える処理は追加していません。

今回、全量原寸GLBの再書出しは行っていません。既存の全量GLB・原寸データ・旧単体HTMLは未変更です。将来全量を書き出す場合も新しい `REAL_CITY_OUT` を指定し、既存成果物を上書きしない保護を維持してください。新GLBの材質はunlitになるため、旧PBR GLBとの材質同一は主張しません。

## 検証範囲と証拠

- [単独viewerの実GPU回帰11項目](/workspace/shared/shibuya-artifacts/next-color/runtime/results.json)：初期1.15・1/1.8/繰返し操作、原寸を含む全3品質、20建物・72地表・92map、最新gainの世代保持、503再試行、390px、途中pagehideのbitmap解放。警告のCESIUM_RTCは消え、全警告の置換はしていません。
- [0.4.3との形状照合](/workspace/shared/shibuya-artifacts/next-color/runtime/v043-geometry-comparison.json)：geometry/index/normal/UV/world matrix hash・boundsは全品質で一致。112mesh、218,943三角形。
- [元105assetのSHA照合](/workspace/shared/shibuya-artifacts/next-color/runtime/source-assets-check.json)：取得receiptと全件一致。
- [controller6項目](/workspace/shared/shibuya-artifacts/next-color/runtime/controller-results.json)：4地点実クリック、同期例外rollback、最新focus、更新でmodel/camera/世代不変、idle/非表示停止、dispose drainとpendingJobs=0。
- [GLB実ブラウザ往復](/workspace/shared/shibuya-artifacts/next-color/runtime/photo-export-results.json)：全実モデル40mesh/20mapのexport cloneを確認後、小さい4×4画像fixtureをGLTFExporter+実FileReaderで保存しGLTFLoaderで再読込。factor[0,1]・unlit・geometry/UV/index/world matrix・復号画素が一致。clone解放で共有map/geometryのdisposeは0、元画面の色も不変。[新fixtureのみ](/workspace/shared/shibuya-artifacts/next-color/runtime/photo-export-fixture.glb)を保存しました。
- TypeScript検査、photoAppearance5件・画像寿命6件・地点モデル9件、計20対象テストが通過。

実描画はChromium + SwiftShaderです。製品RAFは置き換えず、静止画採取時だけrenderer.renderを明示実行しています。Windows実機速度や実GPU VRAMは測っていません。RGBA bytesは画像寸法からの推計です。4地点画像は表示用状態を与えたcontroller検査であり、App経営UIの統合操作とは区別します。

| 画像 | 内容 |
|---|---|
| [109・標準1.15](/workspace/shared/shibuya-artifacts/next-color/runtime/default-109-scene.png) | 実装後の初期値を目視 |
| [センター街](/workspace/shared/shibuya-artifacts/next-color/runtime/center-01-marker.png) | 濃くした候補文字を目視 |
| [道玄坂](/workspace/shared/shibuya-artifacts/next-color/runtime/dogenzaka-01-marker.png) | 営業の表示と実クリック |
| [宮下・東口](/workspace/shared/shibuya-artifacts/next-color/runtime/miyashita-01-marker.png) | 保有の表示と実クリック |
| [桜丘](/workspace/shared/shibuya-artifacts/next-color/runtime/sakuragaoka-01-marker.png) | 営業・保有の表示と実クリック |

## 正式な単体HTML

[0.4.4の単体HTML](/workspace/shared/shibuya-artifacts/offline-0.4.4/real-shibuya-viewer.html) は83,273,567 bytes、SHA256 `6142e4207b99d7b27a6a4f3b656a51cfc8933f72e63ce07805075fce3e9bc818`。[埋込99ファイルの照合](/workspace/shared/shibuya-artifacts/offline-0.4.4/embedded-assets-check.json)は元ファイルと一致しました。

[実ブラウザ検証9項目](/workspace/shared/shibuya-artifacts/offline-0.4.4/real-shibuya-offline-qa.json)が成功。20建物・72地表、3視点、明るさ1.15→1.65、ホイール操作、埋込manifestを確認しました。最初のHTML以外のHTTPを禁止した状態で追加通信・console/page errorは0件です。確認担当は最後の画像閲覧で入力画像量の上限に達しましたが、検証処理は完了済み。統合担当がJSONと[109画像](/workspace/shared/shibuya-artifacts/offline-0.4.4/real-shibuya-offline-109.png)を確認し、ブラウザ処理の終了も確認しました。旧単体HTMLは保持しています。
