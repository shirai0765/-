# GitHub Pages の公開

このリポジトリでは、`game-source` を開発用、`main` をビルド済みサイトの公開用として分けます。公開URLは `https://shirai0765.github.io/-/` です。GitHub Pages は既存の「Deploy from a branch」設定を使い、`main` のルートを配信します。

0.4.7は公開済みです。公開元runtimeソースは `2b7790f7207e6c12fd9c46003c0ce6fb6a8cfff5`、公開コミットは `aadd8f43f8c3c494e1d708244279d0ff141fd8ef`。Pages run `37541973393` 成功、通常TLSの公開HTTP25/25・選択23資産SHA一致、公開実Firefoxの変更導線5カテゴリの単一complete run成功を確認しました。記録は `/workspace/shared/shibuya-artifacts/deploy-0.4.7/{deployment.json,http-audit.json,public-playtest/verification-summary.json}`。全276資産の公開再取得や広いCSP/BGM再検査ではありません。実操作と範囲は [published-playtest.md](published-playtest.md) を参照してください。

0.4.6当時の公開元ソースは `69a10ac4ff0815f3255822e22a245144cd751e8f`、公開コミットは `5b64d36e0cad4d11a07d848cef07dd6c0cdd0795`。Pages run `37539018321` 成功、公開HTTP18/主要16SHA一致の記録は `deploy-0.4.6/` に保持しています。

| ブランチ | 内容 |
|---|---|
| `game-source` | `src`、テスト、設定、ロックファイル、ドキュメントなどの開発ソース |
| `main` | 検証済み `dist` の全ファイル、`.nojekyll`、`release.json`、公開用 `README.md` |

通常の修正・レビューは `game-source` で行います。公開用 `main` でソースを編集したり、そこからビルドしたりしません。Vite の `base: './'` は維持し、リポジトリ配下のURLでもゲームと実測ビューの同梱資産を相対パスで読み込みます。

最新の0.5.0も同じmanifest方式で公開済みです。Pages run37563180731、公開HTTP25件/選択23資産SHA、公開実Firefox3カテゴリが成功しました。最新の配布・公開検証は [interaction-v050.md](interaction-v050.md) に集約し、過去の公開記録を保持します。

0.6.0も同じmanifest方式で公開済みです。runtime source `1eef6b2a41f00bad459e624b02e0e73a3abe939b`、Pages `0ec51bf8d19285e984405cbbcbd0e735bac61725`、run37567470986成功。公開HTTP25件／選択23資産SHAが一致し、公開実Firefoxの9カテゴリも成功しました。最新の証拠は [interaction-v060.md](interaction-v060.md) に集約します。

## 公開手順

1. `game-source` の変更を確認し、公開するソースコミットを確定する。
2. Node.js 24 とリポジトリの `package-lock.json` を使い、`npm ci --include=dev`、`npm test -- --maxWorkers=2`、`npm run build` を実行する。
3. 生成した `dist` に対して本番CSP・保存復元・資産読込など必要な検証を行う。検査後にソースや `dist` を変更した場合は、その変更に必要な検証をやり直す。
4. ソースコミットIDと配布ファイルの対応を記録し、`dist` の内容を変更せず公開treeへまとめる。追加するのは `.nojekyll`、ソースID・版・HTMLハッシュを持つ `release.json`、公開用 `README.md` のみ。`dist` ディレクトリ自体ではなく、その中身を公開ルートへ配置する。
5. リモート `main` の現在の先端を親とする新しい公開コミットを作成し、通常の fast-forward push で更新する。別の公開が先に進んだ場合は停止して再確認し、force push で上書きしない。
6. Pages のビルドと公開URLを確認し、HTML・主要資産が対象の配布ファイルと一致することを検査する。公開コミットID・ソースコミットID・検証結果を残す。

公開自動化は `scripts/deploy-pages.py` が担当します。ソースと配布物の対応を検証してから公開treeを作るための補助であり、未検証のローカル変更をそのまま公開する運用にはしません。ソースを `game-source` へpushした後、次を実行します。最初は検証結果の表示だけで、`--publish` を付けた場合だけ公開コミットをpushします。

```sh
python3 scripts/package-web.py
python3 scripts/deploy-pages.py --manifest /workspace/shared/shibuya-artifacts/Shibuya-Capital-0.5.0-web-report.json
python3 scripts/deploy-pages.py --manifest /workspace/shared/shibuya-artifacts/Shibuya-Capital-0.5.0-web-report.json --publish
```

版と保存場所が異なる場合は、検証した当該版のreportを指定します。作業ツリーが未commit、ソースのremote先端が異なる、配布ファイルがreportと異なる場合は停止します。

0.4.6のWeb/Windows ZIPは同じ最終distから再ビルドせず生成済みです。全276配布ファイルのSHA一致・全ZIP CRC・梱包後のdist不変と、ローカル `/-/` 配下の全ファイルHTTP監査を確認しました。記録は `/workspace/shared/shibuya-artifacts/packaging-0.4.6.json` と `integration-v046/pages-prefix/result.json`。旧成果物962件の保全結果は `preservation-0.4.6.json` にあります。このローカル検査は、公開後のサイト確認やWindows実機の動作確認を代替しません。

## Actions ワークフローを使わない理由

2026-10-06、利用中のintegration tokenでPages設定を `build_type: workflow` に変更するAPIはHTTP 403でした。Pages/Actionsの読取は可能ですが、この設定変更に必要なPages書込権限がありません。既存の `main` ルート公開設定は利用できるため、その設定を維持して公開します。別トークンへの移動や権限の迂回は行いません。

将来、管理者がPagesをGitHub Actions方式へ切り替える場合の例を [pages-workflow.example.yml](deployment/pages-workflow.example.yml) に保存しています。これは `.github/workflows` の外にあり、現在は実行されません。将来の例は `game-source` のpushまたは手動実行を起点に、Node.js 24、ロックされた依存導入、テスト、ビルド、Pages artifactのupload/deployを行います。

実際に有効化する前にPages設定の変更権限を用意し、公開方式の切替と `github-pages` environmentの許可ブランチを確認してください。設定を変えずにサンプルだけを有効化しても、現在のブランチ公開手順の代わりにはなりません。
