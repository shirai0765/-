# 追加Cloud Codexタブの起動と受け渡し

2026-10-07。既存の**外部制作・調査班1タブ**がニュース・BGM・環境音/効果音・プレイ検証を継続して提出する。最初の20〜30ニュースはPRのbatchで、任務全体ではない。第二タブは独立QAの予備とし、親から開始指示があるまで起動しない。親側は管理・設計・統合・QA・公開を担当する。新しい企業シミュレーション、アセット基盤、API、指数を増設しない。

## ユーザーの操作

既存タブを継続し、主担当の指定を **GPT-6.1 Sol / max**、子6担当を **GPT-6.1 Sol / high** とする。主担当含め最大7体、孫agentなし。新環境でrepoを指定できない場合も、[外部班のプロンプト](news-research-team.md)に既存checkout確認と取得手順がある。既に主＋6担当が動いている環境へさらに6体を追加しない。

このホストは新しいタブを自動作成できない。希望モデル・希望人数と、実際のモデル・稼働人数は別に報告する。モデル設定を自己申告で「変更済み」にせず、利用可能な実行情報を使う。確認できない項目は「確認不可」、起動に失敗した担当は「未起動」と書く。

[受領PR #2](https://github.com/shirai0765/-/pull/2)は `game-source` へ取り込み済み。記載は主＋6担当稼働、子Sol/high、主の正確なモデル確認不可。初期の4出典担当・編集・QAの約24件は小PRまで継続し、完了して空いた既存担当から次の6streamへ移す。これは担当の報告で、親が外部telemetryを直接確認したとは扱わない。[追加指示](https://github.com/shirai0765/-/pull/2#issuecomment-6031934250)は親が投稿済みで、同じ指示を再投稿しない。

[QA予備班の指示](qa-reserve-team.md)は保管用。現在の作業を開始するために第二タブを増やす必要はない。

## repoとbranch

- repo：`https://github.com/shirai0765/-.git`
- 開発基点・PR宛先：`game-source`
- `main`：ビルド済みの公開サイト専用。**ソースをpushしない。公開・mergeは親だけ。**
- 外部班branch：`team/news-research/<receiptまたはnews-batch>-<識別子>`、`team/audio-bgm/<batch>-<識別子>`、`team/audio-sfx/<batch>-<識別子>`、`team/gameplay-review/<trace>-<識別子>`
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

受領PRを先に返し、調査・原稿・小PRの準備を続ける。既に受領済みなら同じreceiptを作り直さない。親のレビューを飛ばしてmerge・公開しない。成果物ごとに最新の `game-source` から専用branchを作り、ニュース、BGM、SFX、プレイ記録を別の小PRで返す。単一checkoutの未完了原稿をbranch切替で失わず、隔離が必要な場合だけ理由を記録してworktreeを使う。

有限の初回は**ニュース80件（2stream各40件、初期pilotの採用品を含む）＋オリジナルBGM2曲（30〜60秒loop）＋SFX kit＋公開actionの3 play traces**。小PRを出した後も、独立した割当済みの次の成果物を進める。task境界とPR提出時に最新の `docs/coordination.md` と親のPRコメントを確認する。レビュー待ちを全員の停止理由にしない一方、未依頼の新機能や無限のbatchを増やさない。初回全成果が揃ったら次の割当を親へ返す。

## 実行資源

出典・JSON検証には依存導入不要。音声制作は利用可能な制作tool/ffmpeg等を確認し、実WAV/OGG・制作再現手順・出典/権利manifestを返す。プレイ検証は現在の公開actionと本物の実決算を使う。必要な準備は主担当が既存toolchainとlockfileを確認して行い、`package.json`・lockfile・Vite設定を変更しない。文章だけの成果を音声assetや再現traceの代わりにしない。

全体テスト・本番build・公開は親だけ。focused検証は各環境の主担当が窓口となり、同時最大2 CPU worker、native GPU browserは環境ごとに1本へまとめる。renderer、RAF、audio、TLSを置換した実行をnative検証と呼ばない。テストfixture・静的検査・実ブラウザー・実機の結果は分けて報告する。
