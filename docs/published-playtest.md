# GitHub Pages 0.4.10 の公開記録

[ゲーム本体0.4.10](https://shirai0765.github.io/-/?v=0.4.10) は公開・検証済みです。Pages run [37548635040](https://github.com/shirai0765/-/actions/runs/37548635040) はcompleted/success。公開HTTP25/25・選択23資産SHAとrelease version/source/indexが一致しました。完全なsource/pages/index、ローカル検査と梱包記録は [interaction-v0410.md](interaction-v0410.md) に集約しています。

公開実Firefoxの変更2導線は初回の単一実行で成功。適用済み設定/入力途中/店長案と、停止ON1週・OFF13週の保存、revision4→17、履歴第26〜37週、元の13週保存から通常再読込して第37週を復元、次回ONへの復帰を確認しました。エラー・警告・request failures・console error events・外部要求・観測CSP違反0、観測75 HTTPレスポンスはすべて200。証拠は `deploy-0.4.10/http-audit.json` と `public-playtest/results.json`、`verification-summary.json`。検証用ブラウザー等の終了・除去は `cleanup.json` に記録済み。通常操作と実決算から作った自動検査用会社で、現金/黒字週/報告の上書きはなく、人間のキャンペーン進行を証明しません。デスクトップCSPは別のローカル記録です。実音声・Windows実機・端末性能・人間の30時間は未確認です。

## GitHub Pages 0.4.9 当時の公開記録

[ゲーム本体0.4.9](https://shirai0765.github.io/-/?v=0.4.9) は公開・検証済みです。Pages run [37546458918](https://github.com/shirai0765/-/actions/runs/37546458918) はcompleted/success。公開HTTP25/25・選択23資産SHAとrelease version/source/indexが一致しました。完全なsource/pages/index、ローカル検査と梱包記録は [interaction-v049.md](interaction-v049.md) に集約しています。

公開実Firefoxの変更2導線は初回の単一実行で成功。390pxの上場現在値と任意の物件、保存しない上場比較、提案件数一致と明示的な辞退2件→1件を確認しました。エラー・警告・request failures・console error events・外部要求・観測CSP違反0。証拠は `deploy-0.4.9/http-audit.json` と `public-playtest/results.json`、`verification-summary.json`。検査用会社は通常の3店開業/12決算後に現金/累計黒字週を調整した合成データで、自然な経営進行の証拠ではありません。上場アクションは実行せず、デスクトップCSPは別のローカル2導線の記録です。検証用ブラウザー等の終了・除去は `cleanup.json` に記録済み。実音声・Windows実機・端末性能・人間の30時間は未確認です。

## GitHub Pages 0.4.8 当時の公開記録

[ゲーム本体0.4.8](https://shirai0765.github.io/-/?v=0.4.8) は公開・検証済みです。Pages run [37544926892](https://github.com/shirai0765/-/actions/runs/37544926892) はcompleted/success。公開HTTP25/25・選択23資産SHAとrelease version/source/indexが一致しました。完全なsource/pages/indexとローカル検査・梱包記録は [interaction-v048.md](interaction-v048.md) に集約しています。

公開実Firefoxのguide-only 1カテゴリは単一実行で成功。通常の旧保存を正確に取り込み、報告ありのガイドから結果へ移動、global読了設定・再読込・手動Help・会社データ不変を確認しました。エラー・警告・request failures・外部要求・観測CSP違反0。証拠は `deploy-0.4.8/http-audit.json` と `public-playtest/results.json`、`verification-summary.json`。破損保存注入・desktop CSP・DEV目印の精密検査を公開runへ追加していません。実音声・Windows実機・端末性能・人間の30時間は未確認です。

## GitHub Pages 0.4.7 当時の公開記録

[ゲーム本体0.4.7](https://shirai0765.github.io/-/?v=0.4.7)は公開済みです。runtime source `2b7790f7207e6c12fd9c46003c0ce6fb6a8cfff5`、pages `aadd8f43f8c3c494e1d708244279d0ff141fd8ef`、Pages run [37541973393](https://github.com/shirai0765/-/actions/runs/37541973393) は成功。index SHA256は `79564699acfae0a8f3ecf4128fe00e9830c7379774336b1a4b029c230f775c97`。

通常TLS/ホスト名検証の公開HTTP監査は25/25成功、選択23資産のSHAがdistと一致し、releaseの版/source/indexとPages runも一致しました。全276資産を公開URLから再取得した記録ではありません。証跡は `deploy-0.4.7/http-audit.json`。

公開実Firefox/Mesaは、新しい変更導線5カテゴリを単一complete runで成功しました。明示近景/店舗操作、通常入力30人店の390px赤字報告と確定費用、編集後も過去の費用を保つ管理/週報と正確な再読込、別店/対象店の閉店と同区画再出店、旧0.3.2保存と費用未記録表示を確認。エラー・警告・HTTP失敗・外部要求・観測したCSP違反0。結果は `deploy-0.4.7/public-playtest/verification-summary.json` と `results.json`。

実App/UI/actions/renderer/IndexedDBと通常Firefox sandbox/TLSを維持し、renderer/state/RAFを置換していません。pose/UUID/看板projectionの精密測定はDEVだけで、公開bundleへはassertしません。公開runにdesktop CSPは付加せず、最終CSPは別のlegacy-only2カテゴリです。BGM/実測街の広い検査を今回再実行したとは扱いません。owned Firefox/Xorg/一時profileは終了・削除済み。実音声・Windows実機・端末性能・人間の30時間は未確認です。

縦長画面の看板fitはDEVの明示表示後の範囲です。resizeはpose/FOVを保ち、次の明示表示で合わせ直します。外壁/テラス全体・遮蔽・resize直後のfitは保証しません。手順と以前の途中失敗を保持した開発runは [immersive-qa.md](immersive-qa.md)、最終distのCSPは [production-playtest.md](production-playtest.md) を参照してください。

## GitHub Pages 0.4.6 当時の公開記録

2026-10-06 UTC（日本時間10月7日）、[ゲーム本体0.4.6](https://shirai0765.github.io/-/?v=0.4.6)を公開し、公開HTTPSでHTTP監査と実ブラウザー操作を確認しました。

| 項目 | 値 |
| --- | --- |
| runtimeのソースコミット | `69a10ac4ff0815f3255822e22a245144cd751e8f`（game-source） |
| 配布コミット | `5b64d36e0cad4d11a07d848cef07dd6c0cdd0795`（main） |
| Pages実行 | [37539018321](https://github.com/shirai0765/-/actions/runs/37539018321)、completed / success |
| index.html SHA256 | `7dcd5a42f396b162fc2edbf6edbb9de4236d8e3b409e2917388192d74bb779a5` |

最終dist276ファイルに公開用3ファイルを加え、再ビルドせず配信しました。通常TLS・ホスト名検証を有効にしたHTTP監査は18件成功、主要16ファイルのSHAが最終distと一致し、release.jsonの版・source・indexとPages runも一致しました。全276件を公開URLから再取得した結果ではありません。証跡は `/workspace/shared/shibuya-artifacts/deploy-0.4.6/http-audit.json`。

公開Firefox/Mesaの実操作は10カテゴリ成功。初回ガイド、一覧から施設・開業と自動近景なし、4目的の店舗設定とfocused入力の反映、明示店舗近景、管理画面と同じcanvas、週実績・確定資金・正確な自動保存と再読込、同App実測街、単独viewerの20建物/72地表/Draco・写真材質の明るさ・idle/resizeと保存復帰を確認しました。error/warning/CSP違反/外部要求/HTTP失敗は0件。公開は施設一覧を入口とし、camera/44px markerの正確な計測は開発GPUの証拠です。

renderer・state・RAFを差し替えず、通常Firefox sandboxとTLS検証を維持しました。既存の環境CAは使い捨てNSS profileだけへ登録し、一時XorgはTCPを無効にしています。BGMはopt-in・音量/消音を確認しましたが、クラウドFirefoxのnative音声backendでresumeが待機したため、native再生と時計は理由付きskipです。音の出力・人間の聴感、Windows実機、端末性能、人間の30時間プレイは未確認です。

公開結果は `/workspace/shared/shibuya-artifacts/deploy-0.4.6/public-playtest/verification-summary.json` と `results.json`。旧保存互換は公開とは別の本番CSP再検査で確認し、元runnerの検査側assert停止とlegacy-only成功を [production-playtest.md](production-playtest.md) に保持しています。再現手順は [immersive-qa.md](immersive-qa.md)、実装は [interaction-v046.md](interaction-v046.md)。Web/Windows ZIPは同じ最終distから生成・照合し、旧962成果物を保持しました。

## GitHub Pages 0.4.5 当時の公開記録

2026-10-06、[全面街UIのゲーム](https://shirai0765.github.io/-/?v=0.4.5)を公開しました。既存のURL・ブラウザー保存を維持する通常のfast-forward更新です。

| 項目 | 値 |
|---|---|
| ソースコミット | `a32d92fc2915eb58b67ef670d21c50f07af83788`（game-source） |
| 配布コミット | `4138eff953030563e5aad832d2be336cbbe644a1`（main） |
| Pages 実行 | [37534939396](https://github.com/shirai0765/-/actions/runs/37534939396)、completed / success |
| index.html SHA256 | `21eb92ee9545afeeada2d9270ca992978f17a6060fefda4ea29ad32aa670cb85` |

検証済みdist276ファイルに公開用3ファイルを追加。公開HTTP18件はすべて200、主要16ファイルのSHAはdistと一致しました。releaseのversion/source/ファイル数/indexも一致。公開全276件の再取得と混同しません。記録は `/workspace/shared/shibuya-artifacts/deploy-0.4.5/http-audit.json`。

公開HTTPSのFirefox/Mesa実操作は8カテゴリ成功。全面街から物件一覧を開き、施設詳細→カフェ開業→外観→経営画面の開閉→週末の実績→自動保存→再読込を確認しました。施設の入口は本番に存在する一覧を使い、DEV版で別途確認したcanvas上の目印クリックとは区別します。経営画面を閉じても同じcanvasを維持し、実際の決算と現金が整合、IndexedDBのprimary/envelope/payloadは再読込後も完全一致。

同じAppの実測街（20建物/72地表）でcenter-01を選び、ゲーム街へ戻って保存不変を確認。独立viewerのDraco復号、写真材質の明るさ、idle/resize、ゲームへ戻る導線も確認しました。実画像・結果は `/workspace/shared/shibuya-artifacts/deploy-0.4.5/public-playtest/`。エラー・警告・外部要求・HTTP失敗は0件です。

通常TLSとホスト名検証を維持し、既存CAは使い捨てFirefox profileだけで使用。ブラウザーsandboxや永続の証明書設定は変更していません。Windows実機・人間の30時間プレイの検証とは別です。旧会社の過去実績を維持し、次週から新しい客足・運営状況による変動を使います。

再現手順は [immersive-qa.md](immersive-qa.md)、実装範囲は [immersive-playtest.md](immersive-playtest.md)、CSP/旧保存は [production-playtest.md](production-playtest.md) を参照してください。Web/Windows ZIPは別名で保持し、旧880成果物はSHA/size/mtime不変です。

## 0.4.4 の公開記録

source `c1651686076c7ef0d85cab162379758f8cb2c9a6`、pages `db436b50de2e165132d0a2a640e2072eca772456`、Pages run37532392337成功。公開8カテゴリとHTTP18/主要16SHA照合も成功しました。記録は `deploy-0.4.4/`。この版の常設パネルと確定予測のUIは、0.4.5で置き換えました。

## GitHub Pages 0.4.3 の公開記録

2026-10-06、[ゲーム本体](https://shirai0765.github.io/-/) を0.4.3へ更新しました。ユーザーの公開依頼に基づく通常のfast-forward更新です。

| 項目 | 値 |
|---|---|
| ソースコミット | `42005ed91fd7820aefa7130d550880a1305ed9a4`（game-source） |
| 配布コミット | `bc72ca76e195b34b4750062e9abe10c902688301`（main） |
| Pages 実行 | [37528596336](https://github.com/shirai0765/-/actions/runs/37528596336)、completed / success |
| index.html SHA256 | `f5d0e9b639329c5f3e810f2bab0cce3f1ad2ed0afb82b0d5633e0e8e48f48e28` |

検証済みdist276ファイルに公開用3ファイルだけを追加しました。公開後の通常TLS・ホスト名検証を有効にした監査は18件すべてHTTP200、主要16ファイルのSHAはdistと一致。release.jsonの版・ソース・ファイル数・indexも一致しました。全276件を公開URLから再取得したという意味ではありません。記録は `/workspace/shared/shibuya-artifacts/deploy-0.4.3/{deployment.json,http-audit.json}`。

公開HTTPSの実アプリをFirefox/Mesaで操作し、7項目が成功しました。新会社から宇田川の角店へ街角カフェを開業し、価格950円・初週決算・第2週自動保存まで通常操作で進めました。同じAppの実測街で20建物タイル・72地表写真を読み込み、center-01の営業店への移動とゲーム街への帰還、再読込・JSON書出しを確認。IndexedDB primary行・envelope・payload全値は復帰後も一致しました。保存の注入やrendererの差替えはありません。

page/console errorと通信失敗は0件。警告は旧CityViewのtransparent未定義9件とGLTFLoaderのCESIUM_RTC20件で、エラーとは分けて記録しています。実測の配置・形状・UVは別の旧版比較で一致しています。通常TLS検証を有効にし、この環境の既存CAは使い捨てFirefox profileだけへ登録、Xorgも一時起動して終了後に削除しました。既定の証明書ストアやブラウザーsandboxを変更していません。

実行結果、保存書出し、画面画像は `/workspace/shared/shibuya-artifacts/deploy-0.4.3/public-playtest/`。本番CSP・旧保存9項目は [production-playtest.md](production-playtest.md)、Windows/Webの梱包はそれぞれ [windows.md](windows.md)・[web.md](web.md) を参照してください。WindowsのRelease添付はHTTP400で完了せず、今回作った空の下書きだけを削除しました。ブラウザー公開は成功しており、検証済みZIPもローカルに保持しています。

以下は前版の公開記録です。

# 0.4.2 の公開記録

2026-10-06、ユーザーの依頼により [ゲーム本体](https://shirai0765.github.io/-/) と [実測渋谷ビューアー](https://shirai0765.github.io/-/real-shibuya.html) を公開した。

## 配布元と公開先

| 項目 | 値 |
|---|---|
| 版 | 0.4.2 |
| ソースブランチ | `game-source` |
| ソースコミット | `5f48a6b806c509e0505690f5588ef3c2c6d66dc3` |
| 配布ブランチ | `main` |
| 配布コミット | `61002026eaf5d50a80de20d06e5338cf8477ad2d` |
| Pages 実行 | [37522617185](https://github.com/shirai0765/-/actions/runs/37522617185)、completed / success |
| index.html SHA256 | `adf4336fe9d29dd39e0740f6cda83d31429cb5a4c7a028dab41685341ee4d7c9` |

検証済み `dist` の276ファイルを変更せず、`.nojekyll`・公開用README・`release.json`を追加して公開した。`scripts/deploy-pages.py` が元配布レポートのCRC・全ファイルSHA・ファイル集合・ソースコミットを確認し、既存 `main` に通常の fast-forward push を行った。既存のブランチ公開設定を使用しており、ソースブランチへのpushだけでは公開版は変わらない。

公開後の読み取り検査はPython標準TLS・ホスト名検証を有効にして実行した。18件すべてHTTP 200。HTML、全JS/CSS、主要GLB 2件、manifest 3件、ライセンス4件のローカル `dist` 比較16件はすべてSHA一致。`release.json` の版、ソースコミット、276ファイル、indexのSHAも一致した。全276件を公開URLから再取得したという意味ではない。

実行証跡は `/workspace/shared/shibuya-artifacts/deploy-0.4.2/deployment.json` と `http-audit.json`。公開前には212ユニットテスト、ビルド、本番CSP・旧セーブ復元・実3Dを含む8項目を検証済み。詳細は [production-playtest.md](production-playtest.md)。

## 公開サイトでの操作確認

公開HTTPSの本番コードをFirefox 153.0 / Playwright 1.62.0で操作し、6項目が通過した。CityViewの差し替え、ソースの直接import、会社状態の注入は使っていない。

- 新会社の設立、実際の経営マップの描画、初期保存。
- 宇田川の角店に街角カフェを開業、価格950円へ変更、初週の決算、第2週の自動保存。
- 決算から「店の様子を見る」で店舗近景へ移動。
- 再読み込みと続行。IndexedDBのprimary行、保存envelope、会社payload全値が一致。
- UIからJSONを書き出し、payload・checksum・schema・formatが自動保存と一致。書き出し日時だけは新しく生成されるため比較対象外。
- GLBのHTTP 200、ページ例外・console error・通信失敗0件。

検証用会社の第2週現金は8,818,200円、初週店舗利益418,200円、来店者1,120人。この設定と会社における結果で、初期設定や全シードの利益を保証するものではない。Three.jsの `transparent: undefined` に関する非致命warning 6回は記録に残している。

初回のクラウドChromiumは環境CAを信頼せず、公開サイトの読み込み前に停止した。永続NSSへのCA登録は自動承認レビューが拒否したため実施していない。代替としてレビューが承認した、使い捨て `/tmp` Firefoxプロファイルだけへの環境CA登録を使い、通常の証明書検証を維持した。ヘッドレスFirefoxのGL初期化は環境側で失敗したため、一時的な認証付きXorg表示とMesaで実描画を検証。TLS・Firefox sandboxは有効、HOMEと永続信頼設定は不変で、終了時の一時プロファイル・表示ソケット削除を確認した。これは実PCの性能検査ではない。

結果とスクリーンショットは `/workspace/shared/shibuya-artifacts/published-site-firefox/` の `result.json`、`README.md`、`01-new-company-city.png`、`03-first-week-autosaved.png`、`04-owned-store-real-city.png`。保存ファイルはテスト用会社のもので、ユーザーのセーブではない。

実測渋谷の公開ビューアーも同じ一時Firefox方式で8項目が通過した。建物20タイル・地表72タイル、1024→2048への写真精細さ変更、218,943三角形・112メッシュ・92画像と境界の維持、Draco wrapper/WASM読込、`/-/`配下の資産URL、390px幅、俯瞰への復帰、戻るリンクから `/-/index.html` のゲーム入口への遷移を確認。147応答でHTTP 400以上・通信失敗・ページ例外は0件。画像を目視し、終了後の一時プロファイルと表示ソケットの削除を確認した。記録は `/workspace/shared/shibuya-artifacts/deploy-0.4.2/viewer-firefox/results.json`。これは実測ビューアー単体の確認であり、実測街と経営機能の統合を示すものではない。

## 最初の操作

1. 会社名を入力して「新しい会社を設立」。
2. 「宇田川の角店」から「街角カフェ」を選び、「この場所にカフェを開業」。初店のための借入や物件購入は不要。
3. 「週を終了する」で予測を確認し、「営業して週を進める」。決算時に自動保存される。

保存は利用中のブラウザーのIndexedDBにあり、アカウントやクラウド同期はない。保存元の単位はoriginで、GitHub Pagesのリポジトリパスごとではない。別の端末やWindows版への移動には設定のJSON書き出し・読み込みを使う。週の途中の変更を残す場合は手動保存する。

経営マップと実測渋谷はまだ別画面。約30時間の人間による通しプレイ、Windows実機・Ryzen 5 PRO上の性能は未検証。
