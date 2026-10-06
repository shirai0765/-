# 最終本番成果物の検証

## 0.4.7の最終dist：旧保存と資産のCSP検査

`scripts/smoke-immersive.py --production-csp --legacy-only` の2カテゴリが成功しました。desktop/main.cjsと同じCSPを付加した最終distで、旧0.3.2保存の完全import/reload・後付け履歴なし、フォント/資産・通信を確認。エラー・警告・CSP違反・外部要求・HTTP失敗0。証跡は `/workspace/shared/shibuya-artifacts/production-0.4.7/results.json`。index SHA256は `79564699acfae0a8f3ecf4128fe00e9830c7379774336b1a4b029c230f775c97`。

これはlegacy-onlyの対象検査で、0.4.7全導線のCSP検査ではありません。変更導線native5は複数開発run、公開5は単一complete runの別検査です。公開runにはdesktop CSPを付加していません。BGM/独立実測街の広い0.4.6検査を再実行した結果へ数えず、Windows実機・実音声・30時間の人間プレイも未確認です。詳細は [interaction-v047.md](interaction-v047.md)、[公開検証](published-playtest.md)。

## 0.4.6 店舗操作・週末結果の本番確認

最終distを `scripts/smoke-immersive.py --production-csp --legacy-save <旧保存>` で検証しました。desktop/main.cjsと同じCSP、通常sandboxのFirefox/Mesa、製品RAFのまま実描画です。主要9カテゴリが成功し、選択・開業時の視点維持、manual近景、目的別店舗設定、管理画面と同じcanvas、実績・現金・保存再読込、同App実測街と単独viewerを確認しました。

元runnerは旧保存のimport後、旧HUDに会社名があることを要求する検査側assertで停止しました。元 `production-0.4.6/results.json` の `passed:false` は保持しています。成功通知と保存stateを使うassertへ修正し、`--legacy-only` の別実行2カテゴリで旧0.3.2保存の完全import/reload、後付け出店・沿線記録がないこと、フォント・資産とCSP違反/外部要求/HTTP失敗0を確認しました。旧保存SHAは `eec3a7a10708f8d143f8d6b12db2710cd103425b5f3c99ddf28a3e2fe2e8dd8b`。9カテゴリと2カテゴリは別runで、元runnerの全項目成功へ書き換えていません。

index SHA256は `7dcd5a42f396b162fc2edbf6edbb9de4236d8e3b409e2917388192d74bb779a5`、ゲームchunkは `game-DwYDWwyQ.js`。正確な総合記録は `/workspace/shared/shibuya-artifacts/production-0.4.6/verification-summary.json`、再検査は `legacy-focused/results.json` です。最終267テスト／32ファイル、DOM14（描画stub）、開発実GPU11カテゴリは別の検査として成功しました。

BGMはopt-in・音量/消音・会社保存不変を確認しましたが、このクラウドFirefoxではnative audio backendがtrusted click後もsuspendedで、native再生・時計は `--audio-backend-limitation` の明示理由付きskipです。局所の通常Firefox5件は開始待ち・timeout・取消のnative2件とpromise fixture3件で、音の出力や人間の聴感の証拠ではありません。Windows実機・端末性能・人間の30時間プレイも未確認です。公開URLの確認は [公開検証記録](published-playtest.md)、再現条件は [immersive-qa.md](immersive-qa.md) を参照してください。

## 0.4.5 全面街UI・週末実績の本番確認

最終distを `scripts/smoke-immersive.py --production-csp` で検証し、9カテゴリが成功しました。desktop/main.cjsと同じCSP、Firefox/Mesa、製品のRAFを変更しない実描画です。出店・週末実績と現金の整合・保存復元、同App実測街と単体viewer、20建物/72地表/Draco、写真明るさ・idle/resize、旧0.3.2保存の完全一致を確認。エラー・警告・外部要求・CSP違反・HTTP失敗は0件でした。

index SHA256は `21eb92ee9545afeeada2d9270ca992978f17a6060fefda4ea29ad32aa670cb85`。証跡は `/workspace/shared/shibuya-artifacts/production-0.4.5/{results.json,README.md}`。詳細と再現手順は [immersive-qa.md](immersive-qa.md)。この版はnative dialogの施設一覧から操作し、DEV版で別途行ったcanvas上の施設クリックとは区別しています。Windows実機性能の確認ではありません。

## 0.3.0 当時の検証記録

対象はversion 0.3.0の最終distとdesktopです。`scripts/smoke-production.py` がdesktop/main.cjsからCSPを直接読み、Linux Chromiumで外部通信を拒否して検証します。Windows実行検証とは区別します。

- 日本語Noto Sans JP Variable、欧文Manrope Variableが実際に読み込まれたことを確認。
- 本番の新会社を設立し、会社名と経営画面のcanvas表示を確認。
- カフェ開業→1週間営業→自動保存→再読込→続行で状態が完全一致。
- 別画面の実測ビューで建物20タイル、写真テクスチャ20枚、地表写真72枚を読み込み。Draco WASMはapplication/wasmで応答。
- 実測ビューからゲームへ戻って同じ会社・週・資金・店舗を復元。
- 最終実行のJS/consoleエラー、CSP違反、HTTPエラー、外部HTTP要求は0。

初回のCSPではfont-srcがViteの埋込data:フォントを、connect-srcがGLTFLoaderのblob:写真を拒否していました。font-srcはselfとdata:、connect-srcはselfとblob:に限定して修正。unsafe-evalも外部HTTPも追加していません。検証スクリプト自身のevalを使う待機処理もDOM完了待ちへ変更しました。

経営画面のみQA側でRAFへ200ms遅延を入れています。実測ビューのRAFは変更せず、製品にこの制限はありません。ブラウザー結果は性能測定を意味しません。

Windows ZIPは215,224,043バイト、SHA-256 `8479b6e78ca52693d576c8c873ca2cdbdc780c5b4e258219dcdd49364b61506a`。ZIP全件CRC、276件のアプリマニフェスト、現在のdist/desktopの275ファイル、x64 PEヘッダーが一致しています。公式Electron 44.5.1の配布物ハッシュも照合済み。Windows上の起動・保存・描画は未検証です。

機械可読の結果は共有成果物のproduction/result.jsonとwindows/verification-0.3.0.json。対応する画面画像もproductionに保存しています。

## 0.3.1 本番回帰（2026-10-06）

最終ビルドを同じデスクトップCSPで配信し、`PRODUCTION_SMOKE_OUT=/workspace/shared/shibuya-artifacts/production-0.3.1 python3 scripts/smoke-production.py` で7項目すべて合格しました。日本語・欧文フォント、会社作成、premiumカフェ開業、週次自動保存と再読込後の全state一致、Blender仕上げの109/cafe GLB両方のHTTP200、実測ビュー、ゲーム復帰、ブラウザーエラー・CSP違反・失敗HTTP・外部要求ゼロを確認しています。

実測ビューは建物20タイル、写真material map20枚、地理院画像72枚、Draco WASMを読み込み、183,721三角形・62 draw calls・46 texturesでした。109/cafeのHTTP200は取得確認であり、実ゲーム内の共有clone・改装・閉店・再開・品質切替の検証記録は別途 `blender-polish/game/` にあります。

結果と画像は `/workspace/shared/shibuya-artifacts/production-0.3.1/{result.json,game.png,real-shibuya.png}`。dist index SHA-256は `e7708de0e07dfea0f23bfb4c3a17eb89db7a03b321ae8818ec31f7f463aa15d0`。0.3.0の結果は保持しています。

今回もQA側のみ経営画面のRAFを200ms遅延させています。製品コードと実測ビューのRAFは変更しておらず、性能ベンチマーク・Windows実機確認ではありません。Windows0.3.1 ZIPのCRC・マニフェスト・現行dist/desktopとの全hash照合は別途合格し、詳細は `docs/windows.md` に記録しました。

## 0.3.2 本番回帰（2026-10-06）

`PRODUCTION_SMOKE_OUT=/workspace/shared/shibuya-artifacts/production-0.3.2 python3 scripts/smoke-production.py` を最終ビルドに対して実行し、7項目すべて合格しました。今回もCityViewの置換はなく、本番3Dを含む実アプリのCSP検証です。

新しい比較カードでpremium形態を選び、開業直後に実UIから保存した出店記録が1件かつ未決算であることを確認。初週決算の自動保存では同じ記録IDに第1週の実績が追記され、全社利益がlastReportと一致しました。再読込と実測ビューからの復帰後にも、出店記録を含む全stateが一致しています。

同梱フォント、109/cafe GLB両HTTP200、建物20タイル・写真map20枚・地理院画像72枚・WASM、183,721三角形の描画を確認。console/page error、CSP違反、失敗HTTP、外部要求はゼロでした。

記録と画像は `/workspace/shared/shibuya-artifacts/production-0.3.2/{result.json,game.png,real-shibuya.png}`。dist index SHA-256は `4709b37c94bf831ba91af17dd5d3307df3b48848d2ed0ca696829b3445b4990a`。0.3.0と0.3.1の成果物は保持しています。従来同様、経営画面だけQA側で200ms RAF遅延を使用したため、性能ベンチマークではありません。Windows実機動作は未検証です。

## 0.4.0 本番回帰（2026-10-06）

最終ビルド（`game-2zeCc4xh.js` / `game-D4i7rWPz.css`）に対し、次のコマンドで既存7項目と旧保存互換1項目、計8項目すべて合格しました。

```sh
PRODUCTION_SMOKE_OUT=/workspace/shared/shibuya-artifacts/production-0.4.0 \
PRODUCTION_LEGACY_SAVE=/workspace/shared/shibuya-artifacts/opening-0.3.2/legacy-fixture.json \
python3 scripts/smoke-production.py
```

CityViewを置換せず、desktop/main.cjsと同じCSP、外部通信拒否のLinux Chromiumで実行しています。同梱日本語・欧文フォント、実街のcanvas、プレミアムカフェ開業、未決算の出店記録から初決算への追記、週次自動保存、再読込の全state一致を確認しました。109/cafe GLBは両方HTTP200です。

実測ビューでは建物20タイル・写真map20枚・地理院写真72枚、Draco WASM（application/wasm）を読み込み、183,721三角形・62 draw calls・46 texturesを確認しました。ビューからゲームへ戻って全stateが一致し、console/page error、CSP違反、失敗HTTP、外部要求はゼロです。

さらに0.3.2検証時に作成した既存店舗ありの旧保存ファイル（`openingRecords`と`railProjects`なし）を、そのまま実UIから読み込みました。インポート直後と再読込後の全stateが旧ファイルと完全一致し、経営記録に過去の出店予測を捏造しないことを確認しています。`PRODUCTION_LEGACY_SAVE`を指定した場合だけ実施する追加検査で、元ファイルのSHA-256も結果へ記録しています。

結果と画像は `/workspace/shared/shibuya-artifacts/production-0.4.0/{result.json,game.png,real-shibuya.png}`。dist index SHA-256は `288c65d3ad6a80150bc3397193a2f0055e915b74920c8acbe83fceab35ff1db6`。0.3.0・0.3.1・0.3.2の成果物は保持しています。

従来同様、QA側だけ経営画面のRAFに200msの遅延を加えました。実測ビューと製品のRAFは変更しておらず、性能ベンチマークやWindows実機動作の検証ではありません。新しい戦略パネルの詳細操作は `docs/strategy-v4-playtest.md` の別検証を参照してください。

## 0.4.1 本番回帰（2026-10-06）

最終ビルド（`game-DIkUOxEf.js` / `game-BrmulJ6W.css`）を本番デスクトップCSPで配信し、8項目すべてに合格しました。

```sh
PRODUCTION_SMOKE_OUT=/workspace/shared/shibuya-artifacts/production-0.4.1 \
PRODUCTION_LEGACY_SAVE=/workspace/shared/shibuya-artifacts/opening-0.3.2/legacy-fixture.json \
python3 scripts/smoke-production.py
```

実際のCityViewを使い、同梱日本語・欧文フォント、プレミアムカフェ開業、未決算の出店記録から初決算への追記、週次保存、再読込後の全state一致を確認しました。109/cafe GLBの両HTTP200も確認しています。

実測ビューは建物20タイル・写真map20枚・地理院写真72枚・Draco WASMを読み込み、183,721三角形、62 draw calls、46 texturesでした。ゲームへ戻って保存を完全復元し、さらに0.3.2で作成した旧保存ファイルを実UIから読み込み、再読込後も全stateが旧ファイルと一致しました。過去の出店予測や沿線プロジェクトの追加はありません。console/page error、CSP違反、失敗HTTP、外部要求はすべて0件です。

結果と画像は `/workspace/shared/shibuya-artifacts/production-0.4.1/{result.json,game.png,real-shibuya.png}`。dist index SHA-256は `f953254e0577b49acc48166cc8f4da97eb2121e3b0e5d4ebc1b70bd73c262c79`。0.4.0以前の本番検証結果は保持しました。

この検査はLinux Chromiumによる本番資産・CSP・保存互換の確認です。QA側だけ経営画面のRAFに200ms遅延を入れ、実測ビューと製品コードのRAFは変更していません。Windows実機や描画性能の検証ではありません。0.4.1の段階表示・財務往復・実行結果の詳細は `docs/strategy-v4-playtest.md` の11カテゴリ回帰を参照してください。

## 0.4.2 本番回帰（2026-10-06）

最終ビルド（`game-DcDJK267.js` / `game-ApOuCHWG.css`）で8項目すべて合格しました。

```sh
PRODUCTION_SMOKE_OUT=/workspace/shared/shibuya-artifacts/production-0.4.2 \
PRODUCTION_LEGACY_SAVE=/workspace/shared/shibuya-artifacts/opening-0.3.2/legacy-fixture.json \
python3 scripts/smoke-production.py
```

CityViewを置換せず、desktop/main.cjsと同じCSP・外部要求拒否のLinux Chromiumで確認しました。同梱日本語/欧文フォント、実都市、プレミアムカフェ開業、未決算記録から初週実績への追記、週次保存、再読込の全state一致、109/cafe GLBのHTTP200が通過しています。

実測ビューでは既定の「軽量・1024」を実UIで確認し、20建物タイル・20写真map・72地表画像・Draco WASMをすべて読み込みました。建物画像の長辺はすべて1024以下、RGBA基礎画像量は79,691,776バイト（76MiB）、地表は18,874,368バイト（18MiB）。これは画像寸法から算出した基礎量であり、ミップマップやデコード中の一時領域を含む実GPU/プロセスメモリ測定ではありません。描画は183,721三角形、62 draw calls、46 texturesです。

新しい必要時描画は、待機中750msでframeが24のまま増えず、明るさをキーボード操作すると25へ、1000×760へリサイズすると26へ進むことで確認しました。camera.aspectも1000/760に一致しています。実測ビューのRAFは置換せず、これらの操作前後で保存した会社stateが完全一致しました。元の1280×900へ戻して画像を取得し、ゲームへ復帰した後も同じ保存を再開できています。2048/原寸の切替・単一HTMLの検査は別担当の `/workspace/shared/shibuya-artifacts/realcity-v042/` にあり、この本番回帰で繰り返したとは数えていません。

0.3.2検証時の旧保存ファイルを実UIからインポートし、再読込後も全stateが完全一致しました。過去の出店記録・沿線プロジェクトを後付けしていません。JS/consoleエラー、CSP違反、失敗HTTP、外部要求はすべて0件です。

結果と画像は `/workspace/shared/shibuya-artifacts/production-0.4.2/{result.json,game.png,real-shibuya.png}`。dist index SHA-256は `adf4336fe9d29dd39e0740f6cda83d31429cb5a4c7a028dab41685341ee4d7c9` で、Windows梱包後にも不変でした。旧Windows/本番検証成果物43ファイルのSHA-256・サイズ・更新時刻も保持されています。

従来通り経営画面だけQA側で200msのRAF遅延を入れています。実測ビューと製品コードには加えていません。Windows実機や性能ベンチマークではありません。店舗診断の操作と旧版経済一致は [店舗診断DOM検証](store-insight-playtest.md) を参照してください。

## 0.4.3 本番回帰（2026-10-06）

最終dist（`game-DhF3B8Cb.js`、`RealCityScene-CA6uvnDJ.js`、`game-CXGxXcOj.css`）をdesktopと同じCSPで配信し、9項目が成功しました。今回の実行はLinux FirefoxとMesa、一時Xorg画面です。ローカルHTTPのみを使用し、CA・TLS設定は変更していません。Firefoxのsandboxも有効のままです。

既存のフォント、会社作成、premium開業、初週の自動保存・再読込、109/cafe GLB、独立実測ビューと復帰に加え、同じAppの「実測の渋谷」へ切り替え、center-01への移動とゲーム街への帰還を確認しました。地図切替前後の保存stateは完全一致し、本番ではDEV診断hookが存在しません。独立実測ビューは20建物・72地表・Draco WASM、写真map20枚を読み込み、待機時24frameで停止、明るさで25、resizeで26へ進みました。

旧0.3.2保存をUIから読み込み、再読込後も全stateが一致しました。存在しなかった出店記録・沿線開発を後付けしていません。JS/consoleエラー、CSP違反、失敗HTTP、外部要求は0件でした。検証結果・3枚の画面は `/workspace/shared/shibuya-artifacts/production-0.4.3/`。index SHA256は `f5d0e9b639329c5f3e810f2bab0cce3f1ad2ed0afb82b0d5633e0e8e48f48e28` です。

```sh
# Firefoxは呼出元で一時的な画面とPlaywright browser pathを用意する
PRODUCTION_BROWSER=firefox \
PRODUCTION_SMOKE_OUT=/workspace/shared/shibuya-artifacts/production-0.4.3 \
PRODUCTION_LEGACY_SAVE=/workspace/shared/shibuya-artifacts/opening-0.3.2/legacy-fixture.json \
python3 scripts/smoke-production.py
```

QA側だけAppのRAFを200ms遅延させています。独立ビューのRAFは変更しておらず、製品・性能の制限ではありません。実App統合のnative RAF・idle・破棄は別のFirefox検査5項目で確認済みです。Windows実機・30時間の通しプレイを検証したとは扱いません。

## 0.4.4 本番回帰（2026-10-06）

最終dist（`game-BNaTI7Wi.js`、`RealCityScene-Db72F0XZ.js`、`game-xMFJ-JA1.css`）に対し、Linux Firefox/Mesaで9項目が成功しました。desktop/main.cjsのCSPをそのまま適用し、同梱フォント、通常開業・週次保存・復帰、実測街への切替、旧0.3.2保存の実インポートと完全一致を確認しました。JS/console/CSP/失敗HTTP/外部要求は0件です。

写真表示への変更では、20個の写真材質が照明を重ねない表示になり、初期のlinear gainは1.15です。明るさsliderを1段階動かすと、rendererの値だけでなく実際の20材質も1.2へ更新することを確認しました。写真map20・建物20タイル・地表72枚・Draco WASM、idle停止と明るさ/resize後の描画も維持しています。元画像や経済の変更ではありません。

結果と画面は `/workspace/shared/shibuya-artifacts/production-0.4.4/`。index SHA256は `917c98205973ede12ae7961d076888c292df7ba30322cb1fb27753e979034bb6`。全231unit/26filesとbuildも成功しています。単一HTML、書出しcloneの原色維持、geometry/UV保持の個別検査は [写真表示の記録](real-city-photo-appearance.md)、入力導線と危険な週終了の検査は [設定の予測表示](store-plan-feedback.md) と共有 `store-feedback-v044/README.md` を参照してください。

検査のAppだけQA側RAF200ms遅延、独立ビューはnative RAFです。Windows実機性能・人間の30時間体験の確認ではありません。FirefoxはローカルHTTP用の一時Xorg画面で実行し、ブラウザーsandboxやTLS設定は変更していません。再実行は0.4.3節の `PRODUCTION_SMOKE_OUT` を0.4.4へ変更します。
