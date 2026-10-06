# GitHub Pages の公開

このリポジトリでは、`game-source` を開発用、`main` をビルド済みサイトの公開用として分けます。公開URLは `https://shirai0765.github.io/-/` です。GitHub Pages は既存の「Deploy from a branch」設定を使い、`main` のルートを配信します。

| ブランチ | 内容 |
|---|---|
| `game-source` | `src`、テスト、設定、ロックファイル、ドキュメントなどの開発ソース |
| `main` | 検証済み `dist` の全ファイル、`.nojekyll`、`release.json`、公開用 `README.md` |

通常の修正・レビューは `game-source` で行います。公開用 `main` でソースを編集したり、そこからビルドしたりしません。Vite の `base: './'` は維持し、リポジトリ配下のURLでもゲームと実測ビューの同梱資産を相対パスで読み込みます。

## 公開手順

1. `game-source` の変更を確認し、公開するソースコミットを確定する。
2. Node.js 24 とリポジトリの `package-lock.json` を使い、`npm ci --include=dev`、`npm test`、`npm run build` を実行する。
3. 生成した `dist` に対して本番CSP・保存復元・資産読込など必要な検証を行う。検査後にソースや `dist` を変更した場合は、その変更に必要な検証をやり直す。
4. ソースコミットIDと配布ファイルの対応を記録し、`dist` の内容を変更せず公開treeへまとめる。追加するのは `.nojekyll`、ソースID・版・HTMLハッシュを持つ `release.json`、公開用 `README.md` のみ。`dist` ディレクトリ自体ではなく、その中身を公開ルートへ配置する。
5. リモート `main` の現在の先端を親とする新しい公開コミットを作成し、通常の fast-forward push で更新する。別の公開が先に進んだ場合は停止して再確認し、force push で上書きしない。
6. Pages のビルドと公開URLを確認し、HTML・主要資産が対象の配布ファイルと一致することを検査する。公開コミットID・ソースコミットID・検証結果を残す。

公開自動化は `scripts/deploy-pages.py` が担当します。ソースと配布物の対応を検証してから公開treeを作るための補助であり、未検証のローカル変更をそのまま公開する運用にはしません。ソースを `game-source` へpushした後、次を実行します。最初は検証結果の表示だけで、`--publish` を付けた場合だけ公開コミットをpushします。

```sh
python3 scripts/package-web.py
python3 scripts/deploy-pages.py --manifest /workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.2-web-report.json
python3 scripts/deploy-pages.py --manifest /workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.2-web-report.json --publish
```

版と保存場所が異なる場合は、検証した当該版のreportを指定します。作業ツリーが未commit、ソースのremote先端が異なる、配布ファイルがreportと異なる場合は停止します。

## Actions ワークフローを使わない理由

2026-10-06、利用中のintegration tokenでPages設定を `build_type: workflow` に変更するAPIはHTTP 403でした。Pages/Actionsの読取は可能ですが、この設定変更に必要なPages書込権限がありません。既存の `main` ルート公開設定は利用できるため、その設定を維持して公開します。別トークンへの移動や権限の迂回は行いません。

将来、管理者がPagesをGitHub Actions方式へ切り替える場合の例を [pages-workflow.example.yml](deployment/pages-workflow.example.yml) に保存しています。これは `.github/workflows` の外にあり、現在は実行されません。将来の例は `game-source` のpushまたは手動実行を起点に、Node.js 24、ロックされた依存導入、テスト、ビルド、Pages artifactのupload/deployを行います。

実際に有効化する前にPages設定の変更権限を用意し、公開方式の切替と `github-pages` environmentの許可ブランチを確認してください。設定を変えずにサンプルだけを有効化しても、現在のブランチ公開手順の代わりにはなりません。
