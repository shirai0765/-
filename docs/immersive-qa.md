# 全面街 UI の再現可能な検証

`smoke-immersive.py` が0.4.6の実App操作を担当します。旧 `smoke-browser.py` / `smoke-production.py` の常設sidebar前提のselectorを、新UIの合格根拠へ転用しません。Firefox/Mesaのsoftware rendering結果であり、Windows/Electron実行や実PC性能、人間の理解度を保証しません。0.4.5以下の結果は後半の履歴として保持します。

## 0.4.6の最終確認

最終267テスト／32ファイルとビルド、DOM14カテゴリ、DEV実GPU11カテゴリが成功しました。DOMは両街stubで1280×960／390×844、実GPUはrenderer・state・RAFを置換しないFirefox/Mesaです。実marker click・44px自社表示、選択と開業の視点維持、manual店舗近景、dialog中の描画停止とresize保留、管理時のpan/zoom・明示回転・俯瞰角度への復帰、決算後の人影、実績と保存一致、実測街と単独viewerを確認しました。エラー・警告0件。native BGM再生・時計は記録付きskipです。

最終distのCSP検査は主要9カテゴリ後、旧HUDへ会社名を要求するassertで停止しました。元 `production-0.4.6/results.json` の `passed:false` は保持し、更新した検査の `--legacy-only` 別実行2カテゴリで0.3.2保存の完全import/reload、後付け履歴なし、CSP違反・外部要求・HTTP失敗0を確認しました。全項目が単一runで通った記録ではありません。総合記録は共有成果物 `production-0.4.6/verification-summary.json`。最終index SHAは `7dcd5a42f396b162fc2edbf6edbb9de4236d8e3b409e2917388192d74bb779a5`。

Pages run `37539018321` の公開と、公開HTTP18/主要16SHA・実Firefox10カテゴリが成功しました。error/warning/CSP/外部要求/HTTP失敗0、native BGM再生/時計はクラウドbackendの制約で明示skipです。公開は施設一覧を入口に実UI・canvas維持・保存を確認し、正確なcamera/marker測定はDEVだけです。結果は [公開検証記録](published-playtest.md) と共有 `deploy-0.4.6/public-playtest/verification-summary.json` を参照してください。

## スクリプト

- `python3 scripts/smoke-immersive-dom.py`: 開発AppのDOM確認。両3D componentを明示stubにし、1280×960/390×844で14カテゴリを検査します。実描画の証拠ではありません。`IMMERSIVE_DOM_URL` / `IMMERSIVE_DOM_OUT` で開発URL/出力先を変更できます。
- `python3 scripts/smoke-immersive.py --dev-diagnostics`: ローカル開発Appの実描画・実施設click。DEV公開オブジェクトは読み取るだけで、カメラ・経済state・RAFを書き換えません。markerの構造と1地点の実クリック、視点維持・manual近景・modal停止、nativeカメラgesture、初週実績・人影・保存を確認します。
- `python3 scripts/smoke-immersive.py --production-csp --legacy-save <旧保存>`: 最終distをdesktop/main.cjsと同じCSPの一時ローカルHTTP serverで配信。通常UIに加え、同App実測街、単独viewer、Draco、写真材質/明るさ/idle/resize、旧保存import/reloadを確認します。DEV hookなしで実行します。
- 公開確認は `--url <公開URL> --out <証拠dir> --expected-version <版> --expected-source <commit> --include-real-city`。`--profile <使い捨てprofile>` は外側runnerが用意する一時profileを再利用する場合のみ。通常は新規/tmp profileを自動削除します。外側runnerは公開originの正規TLSを保つ責務があり、証明書検証を無効化しません。
- `--legacy-only --legacy-save <旧保存>` はimport/reloadとCSP・資産・通信の2カテゴリだけを再実行します。通常UI全体の再実行として数えません。
- `--audio-backend-limitation <実測した制約>` はnative音声backendが使えない環境の再現用です。opt-in・音量/消音と会社保存不変のassertは維持し、native再生・時計だけを理由付きskipへ記録します。通常の検査ではflagを付けず、backendの失敗を確認してから使います。0.4.6のこのクラウドFirefoxはtrusted clickとsupported null-sinkの試行後もsuspendedでした。

実描画scriptは起動済みのprivate XorgとPlaywright Firefoxを使います。この環境で検証した外側runnerは共有成果物へ保存します。GPU利用は他担当と直列にし、永続HOME/NSS、ブラウザsandbox、TLS検証を変更しません。localhostの確認にCA登録は不要です。

0.4.6の入口は初回guideの「街で始める」、施設一覧の「出店場所を探す」／「物件を探す」、店舗の `.store-management-purposes` です。週報は `.weekly-results-profit > strong` の確定値と `data-profit-complete`、閉じた `.weekly-stores` / `.weekly-results-detail` を確認します。店舗の近景は「街でこの店を見る」からのみ進みます。`.hud-company` は手元資金なので会社名のassertへ使わず、旧保存importは成功通知と正確な保存state、再読込後の続行で判定します。

BGM局所検査 `interaction-v046/audio/start-status-results.json` の5件は、native開始待ち/timeout/取消の2件と明示promise fixtureの3件です。native出力やfixtureの音楽聴感を証明しません。音声backendが動く端末での再生確認、人間の聴感、Windows実機、モバイル実GPU、人間の30時間プレイは未確認です。

## 0.4.5当時の開発確認

共有成果物 `/workspace/shared/shibuya-artifacts/immersive-v045/` に保存。

DOM: 1280/390のfullscreen host、常設sidebar/footerなし、32区画一覧→native施設詳細→財務比較→同区画/形態、開業後閉じ/外観focus props、任意の経営overlay、店舗一覧から同店管理、子注文Escape→親市場維持、通常週は見込みdetails閉じ/借入リスク時は展開、手動保存/reloadを確認。9カテゴリ、pageerror/未解決issues 0。stubのinstance保持は実カメラ保持と区別します。

実GPU: 1000×760、実ゲーム街、32markerのreadonly構造確認とcenter-01の画面座標への実mouseclick、開業で緑の営業状態、外観へ移動、finance/stores/stocksの開閉で同scene/cameraを保持、初週actualと手元資金の照合、見込み範囲への包含、reload時primary全体一致。5カテゴリ、console/page error/warning 0。採取した例は利益448,615円、見込み範囲387,094〜449,306円で、開業前の中立見込みとactualの一致を要求していません。

担当は実GPUの `01-fullscreen-real-city.png` / `03-opening-store-focus.png` を開いて目視しました。全32markerそれぞれの実クリック、モバイル実GPU、すべてのseedの安全、長期バランスをこの結果から保証しません。最初のGPU採取後の小さなレイアウト変更は最終DOMと本番確認へ分けます。

## 不具合と検証の区別

初期の子注文画面はEscapeで閉じず、親native dialogもcancelを抑えていました。子をnative GameDialogへ統一した後、両幅の実App DOMで子だけを閉じて親を維持することを再確認しています。旧失敗画像は共有 `dom/child-escape-before-fix.png` に保持。

テストharnessのReact named export参照、旧設定画面タイトル、旧toast位置を新UIへ合わせた修正もありました。これらを製品runtime不具合に数えず、最終成功runのみを合格根拠にしています。

本番CSP・旧保存・公開後の最終結果は、それぞれの実行が完了した成果物とリリース記録を参照してください。開発GPU成功だけで公開済みと扱いません。

## 0.4.5最終distの確認結果

本番CSP確認は9カテゴリ成功。共有 `/workspace/shared/shibuya-artifacts/production-0.4.5/README.md` / `results.json` に最終dist SHA、CSP、同App実測と単独viewer、旧0.3.2保存の完全一致、通信/エラー記録を保存しています。ブラウザでの会社開始から初週actual・保存・再読込を通し、公開と同じ施設一覧の入口を使用しました。公開Pagesへの反映と公開URLでの操作は別の確認です。

## 公開0.4.5の確認結果

2026-10-06、Pages run37534939396の成功後、公開URLで8カテゴリを確認しました。release version0.4.5 / source `a32d92fc2915eb58b67ef670d21c50f07af83788` を照合。全面街から施設一覧・開業・外観、管理overlay、初週actual・保存/reload、同App実測街、単独viewerと復帰まで成功。error/warning/外部request/HTTP失敗0。一時Firefox profileとXorgを削除しGPUを解放しています。

公開の施設入口はHUDの32区画一覧を使い、DEVの実markerclick検証とは分けます。公開の実績例は利益433,408円、来店1,142人、週2現金8,833,408円。未来の中立見込みとの一致を要求せず、保存されたactual reportで現金を照合しています。証拠は共有 `deploy-0.4.5/public-playtest/README.md` / `results.json`。旧保存は本番CSPで確認、公開でのJSON書出しは今回未実行です。
