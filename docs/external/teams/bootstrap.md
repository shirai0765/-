# 追加Cloud Codexタブの起動と受け渡し

2026-10-07。まず追加するのは**ニュース素材の調査班1タブ**。第二タブは独立QAの予備とし、親から開始指示があるまで起動しない。親が統合・検証・公開を担当し、外部班は小さなPRで成果を渡す。新しい企業シミュレーション、アセット統合基盤、API、指数、依存関係を増設する計画ではない。

## ユーザーの操作

新しいCloud Codexタブでベース環境を選び、主担当を **GPT-6.1 Sol、選べる最高の推論設定** にする。`ultra` が選べるならそれを使う。repoを環境設定で指定できなくても、[ニュース調査班の起動プロンプト](news-research-team.md)を貼れば、担当が既存checkoutを確認して取得する。主担当から6担当を **GPT-6.1 Sol / high** で起動し、主担当を含め最大7体とする。孫agentは禁止。

このホストは新しいタブを自動作成できない。希望モデル・希望人数と、実際のモデル・稼働人数は別に報告する。モデル設定を自己申告で「変更済み」にせず、利用可能な実行情報を使う。確認できない項目は「確認不可」、起動に失敗した担当は「未起動」と書く。

[QA予備班の指示](qa-reserve-team.md)は保管用。現在の作業を開始するために第二タブを増やす必要はない。

## repoとbranch

- repo：`https://github.com/shirai0765/-.git`
- 開発基点・PR宛先：`game-source`
- `main`：ビルド済みの公開サイト専用。**ソースをpushしない。公開・mergeは親だけ。**
- ニュース班branch：`team/news-research/<receiptまたはpilot>-<識別子>`
- QA予備branch：`team/qa-reserve/<receiptまたはreview>-<識別子>`

まず `/workspace` の既存checkout、`AGENTS.md`、`git status --short` を確認する。既存の正しいcheckoutがcleanなら再利用する。remoteが指定repoを指すことを確認する際、認証値は出力しない。dirtyなファイルは保持し、reset・clean・強制checkout・force pushを使わない。別checkoutが必要なら理由を記録し、別directoryへcloneする。worktreeは隔離が必要な時だけ使う。

空の環境でニュース班を取得する例。既存directoryへ上書きしない。

```bash
TEAM_RUN="$(date -u +%Y%m%dT%H%M%SZ)"
TEAM_DIR="/workspace/shibuya-news-research-$TEAM_RUN"
TEAM_BRANCH="team/news-research/receipt-$TEAM_RUN"
git ls-remote https://github.com/shirai0765/-.git refs/heads/game-source
git clone --single-branch --branch game-source https://github.com/shirai0765/-.git "$TEAM_DIR"
cd "$TEAM_DIR"
git status --short
git switch -c "$TEAM_BRANCH"
git rev-parse HEAD
```

既存のcleanな正しいcheckoutを使う場合は、`git fetch origin game-source` の後、`git switch -c "$TEAM_BRANCH" FETCH_HEAD` で専用branchを作る。branch名が既に存在すれば別の識別子を使い、既存branchを書き換えない。`main` を作業branchにしない。

GitHub認証は環境のHTTPS proxyから提供される場合がある。token変数やCLI loginの有無だけでアクセス不可と判断しない。まず上のread-only Git操作を試し、Git read、専用branchへのpush、PR作成の結果を個別に記録する。秘密値・credential file・環境変数の値を抽出／表示／保存しない。

## 最初の受領PR

主担当だけがGitのbranch切替・stage・commit・push・PR作成を行う。6担当は同じcheckoutの専有ファイルを編集し、勝手にbranchを切り替えない。

最初はニュース班なら `docs/external/news-research/receipt-<識別子>.md`、開始後のQA班なら `docs/external/qa-reserve/receipt-<識別子>.md` の1ファイルだけをPRにする。基点SHA・日時、引受範囲、実際の主モデル／推論設定、6担当それぞれのagent ID・モデル・推論設定・起動結果、実稼働人数、Git read/push/PRの結果、共有可能なタスクURLを書く。親がこのタブを直接監視できると仮定しない。

正確なPR本文を一時ファイルへ書いて渡す。例えばニュース班では、受領ファイルだけをstageし、差分を確認してcommitする。

```bash
git add -- "docs/external/news-research/receipt-$TEAM_RUN.md"
git diff --cached --name-only
git commit -m "docs: receive news research team assignment"
git push -u origin "$TEAM_BRANCH"
cat > /tmp/shibuya-news-receipt-pr.md <<'EOF'
追加ニュース調査班の受領記録です。
基点・実モデル・担当別の起動結果・Gitアクセス結果を受領ファイルに記録しました。
ゲームのコード、保存形式、依存関係は変更していません。
EOF
gh pr create --repo shirai0765/- --base game-source --head "$TEAM_BRANCH" --draft --title "News research: receipt" --body-file /tmp/shibuya-news-receipt-pr.md
```

上の `gh` は利用可能な認証でGitHub APIへ接続できる場合だけ実行する。利用可能なGitHub connectorから同じ宛先へPRを作ってもよい。pushが成功しPR認証が使えない場合は、成功したbranch URL・commitと「PR作成の認証が未接続」を返す。pushも失敗した場合は失敗した操作と、完成した成果物の場所を返す。認証設定や成功を捏造せず、tokenをチャットで求めない。

受領PRを先に返し、調査・原稿・小PRの準備を続ける。親のレビューを飛ばしてmerge・公開しない。次の成果物も最新の `game-source` から別の専用branchで返し、受領PRと大きな変更を一つに混ぜない。

## 実行資源

ニュース班は出典調査・JSON・Python標準libraryの検証で進め、npm依存導入や本番buildは不要。QA予備で必要になった時だけ、主担当が既存toolchainとlockfileを確認して準備する。必要な依存導入はlockfileを維持し、既存checkoutの変更を保つ。`package.json`・lockfile・Vite設定を変更しない。

全体テスト・本番build・公開は親だけ。focused検証は各環境の主担当が窓口となり、同時最大2 CPU worker、native GPU browserは環境ごとに1本へまとめる。renderer、RAF、audio、TLSを置換した実行をnative検証と呼ばない。テストfixture・静的検査・実ブラウザー・実機の結果は分けて報告する。
