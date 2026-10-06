# Blenderでの建築仕上げ — 0.3.1

クラウドのBlender 4.3.2をPythonスクリプトで操作し、元のThree.jsモデルを実際に編集しています。表示用の照明だけを変えたものではありません。元の0.3.0モデル・配布物は保持し、追加成果物は `/workspace/shared/shibuya-artifacts/blender-polish/` に保存します。

## 109とゲーム用108

`scripts/polish-109.py` は、重複頂点の整理、平面の不要な対角線の整理、窓枠・入口トラス・石材・外壁角の面取り、法線の調整を行います。アルミの粗さと浅いパネル目地を画像にし、GLB標準のPBR材質へ含めています。Blender内だけで有効な未適用モディファイアには依存しません。

窓枠の面取り2.5mm、トラス2mm、石材12mm、外壁角18mm、目地深さ1.2mmは模型の調整値です。写真から実測した寸法ではありません。既存の建物比率・原点を保持し、外接寸法の差は最大約1mm。元の写真に見えない構造を追加したものではありません。

展示109は48,785三角形、ゲーム用108は49,449三角形。各20メッシュ・18材質です。3桁の数字はBlender内で個別に編集できます。108は最初から架空名の別入力を同じ工程で処理し、入口の表示も108になります。

```sh
python3 scripts/export-architecture.py --asset 109 --fictional --output /workspace/shared/shibuya-artifacts/blender-polish/inputs
blender -b -t 2 --python scripts/polish-109.py -- --variant both
```

最初の書出しにはViteの起動が必要です。元の展示109は `architecture/109.glb` を使用します。出力は `blender-polish/109/` の `109.blend/.glb` と `108-polished.blend/.glb`。品質・ハッシュ・寸法・材質チャンネルは同じ場所のJSONへ記録します。

## カフェ

`scripts/polish-cafe.py` は、金属や木部の小さな面取り、ガラス6枚の6mm厚、カウンター天板の約1.08mへの調整、椅子座面の幅約42cm、布庇の端部を編集します。家具寸法は実用的な模型の調整であり、銀座店の実測値ではありません。全体の幅8.14×高さ4.04×奥行4.31mは維持しています。

展示用 `cafe.glb` と `cafe-polished.blend` は屈折するガラスを使います。ゲーム用 `cafe-polished.glb` は透明度による軽いガラスへ置き換え、繰り返し配置しても屈折用の追加描画を増やさない設計です。静的な横書き店名も除き、ゲームのプレイヤー名を別の看板へ描きます。ゲーム用は23,362三角形・16メッシュ・16材質、展示用は23,364三角形・17材質。

```sh
blender -b -t 2 --python scripts/polish-cafe.py
```

出力は `blender-polish/cafe/`。元の `architecture/cafe.glb` を保持します。実写真と具体的な部材の根拠は [cafe-photo-study.md](cafe-photo-study.md)。実店舗の完全な復元ではなく、架空のカフェに観察した部材を反映しています。

## 比較とゲームへの反映

`scripts/render-polished-assets.py` は修正前の外接寸法からカメラを固定し、両モデルに同じ照明・露出・サンプル数を適用します。条件は `comparison-rig.json` に保存します。Blenderでの写真風レンダーと、ゲーム内の実時間描画は別の成果物です。

```sh
blender -b -t 4 --python scripts/render-polished-assets.py -- --asset cafe --views detail --samples 96
blender -b -t 4 --python scripts/render-polished-assets.py -- --asset 109 --views detail --samples 96
```

単体HTMLには修正前後のGLBを同梱し、同じカメラ・照明で切り替えます。`scripts/package-model-viewer.mjs` の設定JSONに `beforeModelPath` を指定すると比較ボタンが現れます。参照写真は実写真のまま、撮影者と出典を表示します。

カフェ比較HTMLは `clearCafeGlass` を明示的に有効にし、窓だけゲームと同じ軽量な透明表現を使います。Three.jsの屈折表示で内装がぼけるための表示上の近似です。元の展示GLBとBlenderマスターには物理ガラスを保持し、Blender比較レンダーではそのガラスを使用します。写真やレンダー画像の後加工で内装を描き替えるものではありません。

ゲーム用GLBは `public/models/authored/`。配備する際は仕上げ出力とバイト一致を確認し、`manifest.json` のハッシュを更新してからビルドします。元の生成モデルが読込中の表示を担い、成功後にGLBへ置き換わります。店名・所有状態・経営値・保存形式は変えません。共有・破棄・遅延応答の仕様は [loaded-assets.md](loaded-assets.md)。

## 実測渋谷のBlenderシーン

`scripts/render-real-shibuya.py` と `blender-polish/real-shibuya/daylight.blend` は、既存の写真に焼き込まれた陰影を照明で重ねて暗くしすぎないよう調整します。112メッシュ・92画像の元形状・画素は保持し、変更前後のハッシュを検証しています。地表は引き続き平面近似です。元画像の解像度は増えておらず、近景の109建築スタディとは別のモデルです。
