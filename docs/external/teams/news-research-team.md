# ニュース素材調査班：新しいタブへ貼る指示

この班を先に1タブ追加する。repo設定ができないベース環境にも、以下のプロンプト全体を貼れる。主担当のモデルはタブ設定でGPT-6.1 Sol・最高の推論設定にする。作業は実際の過去ニュースの素材収集と原稿で、ゲーム機能の追加ではない。

````text
あなたはShibuya Capitalの外部ニュース素材調査班の主担当です。ユーザーは元の経営ゲームを早く高品質に完成させたいと考えています。AIが他社の活動実績を捏造する新シミュレーションを作らず、実際の過去ニュースを素材に、出典を確認できる短い独自の文章を揃えてください。まず20〜30件を小PRで提出し、親の品質レビュー後に数百件へ増やします。現在のコード・保存・株価の変更は不要です。

主担当の希望構成はGPT-6.1 Sol／利用可能な最高推論設定（ultraがあればultra）。6担当をGPT-6.1 Sol／highで明示起動し、主担当含め最大7体。孫agentは禁止です。モデルoverrideとfork指定があるAPIでは、6担当にmodel=gpt-6.1-sol、reasoning_effort=high、fork_turns=noneを指定し、この任務・repo・branch・専有範囲をそれぞれ渡してください。実際に使えるtool名・schemaに従い、存在しない起動APIを呼んだふりをしないでください。主モデルを自己変更したふりをせず、実行情報で確認できる設定と実起動人数を報告してください。起動toolがない場合も調査と受領報告は進め、実人数を記録してください。

repo=https://github.com/shirai0765/-.git。開発・PR宛先はgame-source。mainはcompiled公開専用で、ソースpush、merge、公開は禁止です。まず/workspaceの既存checkoutとAGENTS.md、git status --shortを確認。正しいcleanなcheckoutは再利用し、dirtyを保持してください。reset/clean/forcepush、秘密値の抽出は禁止。正しいcheckoutがなければ、別の未使用directoryへ次の取得を行ってください。

TEAM_RUN="$(date -u +%Y%m%dT%H%M%SZ)"
TEAM_DIR="/workspace/shibuya-news-research-$TEAM_RUN"
TEAM_BRANCH="team/news-research/receipt-$TEAM_RUN"
git ls-remote https://github.com/shirai0765/-.git refs/heads/game-source
git clone --single-branch --branch game-source https://github.com/shirai0765/-.git "$TEAM_DIR"
cd "$TEAM_DIR"
git switch -c "$TEAM_BRANCH"

既存clean checkoutではgit fetch origin game-sourceの後、同じ専用branchをFETCH_HEADから作ります。取得後にdocs/external/teams/bootstrap.md、docs/coordination.md、docs/interaction-v070.md、src/data/stocks.ts、docs/market-universe.json、src/sim/weeklyNews.ts、src/model.tsを読み、最新の基点SHAを記録してください。Git read/push/API権限は別々に実確認し、CLI loginやtoken変数の不在だけで環境認証がないと判断しないでください。

専有namespaceはdocs/external/news-research/とscripts/external/news-research/だけです。src、既存news、model、engine、UI、storage、株価、package/lock、Vite、他班資料・GLBは一切変更しません。新API、活動指数、企業AI、random架空ニュース、依存関係は追加しません。

6担当の割当を以下に固定し、同じファイルを複数担当に編集させないでください。

1. 飲食の出典調査：docs/external/news-research/candidates/food.jsonだけ。カフェ・外食の実際の出店、商品、運営、決算の事例を5〜7件。
2. 小売・不動産の出典調査：candidates/retail-property.jsonだけ。商業施設、店舗、賃貸・再開発の実際の事例を5〜7件。
3. 鉄道・街づくりの出典調査：candidates/rail-city.jsonだけ。路線、駅、沿線・街区開発の実際の事例を5〜7件。
4. IPO・資金調達・M&Aの出典調査：candidates/capital-ma.jsonだけ。上場、調達、取得・統合の実際の事例を5〜7件。
5. 短文編集と条件タグ：shortforms.jsonとcontext-tags.jsonだけ。4担当の事実を読み、独自の短文と既存ゲーム内文脈との対応候補を作る。元の調査JSONは編集せず、訂正は作者へ送る。
6. 出典・事実・権利・重複QA：scripts/external/news-research/validate.pyとdocs/external/news-research/audit.mdだけ。Python標準libraryで検証し、出典を実読して内容と独自性を確認する。作者のJSONを直接直さず、訂正を返す。

主担当はreceipt、README、最終pilot.json、PR本文と組立を所有します。主担当だけがGitのbranch/stage/commit/pushを操作し、6担当は共有checkoutの専有ファイルで作業します。編集担当とQAは調査完了を待ち続けず、形式・短文基準・検証器を並行して準備してください。

原資料は企業公式発表・IR、公式の施設/鉄道/自治体資料を優先し、必要なら出典を確認できる報道を使ってください。sourceURL、publisher、publishedDate、accessedDate、実際に確認できたfacts、出典内の該当箇所、authorWrittenBrief、parodyEntities、relevantExistingSavedEventContextを各候補に記録してください。日付不明ならnullと理由を記録し、推測で日付や数値を補いません。アクセスできない資料や記憶だけの話は未確認としてpilotから外します。

factsは原資料の事実、authorWrittenBriefはそれを踏まえた短い自作の日本語（原則1〜2文）です。見出しや本文を転載して社名だけ替える原稿は不可。長い転載や記事・写真画像の収集は不要です。言い換えだけで量を増やさず、違う出来事と、経営上の違う選択が分かる事例を選んでください。複数の出典が同じ出来事なら重複として束ねます。

parodyEntitiesは既存STOCKSのゲーム名への対応候補です。idはjp-3543等の実在する既存100stock idを使い、銘柄区分を勝手に変えません。対応がない事例は対応なしとして記録できます。実在の社名・現実の事実と、架空のゲーム社名への対応を別に保持し、現実の会社の過去実績がゲーム社の今週に発生したと書かないでください。

relevantExistingSavedEventContextは、現行の保存済み決算/イベントを読み、どの場面に関連する素材かを示すタグと根拠です。例は開業、不動産購入、IPO、買収、沿線開発。参照する既存field/eventと、確認できる事実の範囲を記録してください。現在のstateが上場済みというだけでは今週のIPOの証拠になりません。株価変化だけから出店・業績・因果を捏造しません。自社傘下の市場事業と独立他社を区別し、既存グループ収益に二重計上する案は出しません。

現行simが活動を記録していないものはhistorical-reference（過去の事例・参考）またはholdと明示し、今週の確定活動として表示できる候補と分けてください。素材を取得したことと、runtimeで条件適合したことは別です。旧セーブへ過去ニュースを補完せず、未来のカフェ利益予測も作りません。既存モデルに矛盾する短文は採用保留とし、そのためにモデルを拡張しないでください。

検証器は必須項目、URL/日付形式、stable ID、重複ID・同一出来事・短文の重複、元100stockとの対応を確認します。docs/market-universe.jsonのcodeからjp-codeを作って照合でき、依存追加は不要です。自動schema合格を、出典の実読・事実確認済みと混同しません。QAが不利な例（出典欠落、未来日、未知stock、同一ニュースの社名差替え、未記録の活動を今週の実績として主張）を拒否することも検証してください。自動検出で確定できない意味の重複は人の読取所見として記録します。

最初にdocs/external/news-research/receipt-<識別子>.mdの1ファイルPRを返してください。基点SHA・日時、Gitアクセス結果、希望と実際の主モデル設定、6担当のagent ID/モデル/設定/起動結果、実稼働人数、専有範囲、共有可能なタスクURLを書きます。起動7体未確認ならそう書き、人数を装いません。

受領PRはgit push -u origin "$TEAM_BRANCH"の後、認証が使えるghならgh pr create --repo shirai0765/- --base game-source --head "$TEAM_BRANCH" --draft --title "News research: receipt" --body-file=<実際の本文ファイル>で返します。利用可能なGitHub connectorでも可。PR認証がない場合は成功したbranch URL/commitとブロッカーを返し、認証を捏造しません。

調査は続け、次の小PRをteam/news-research/pilot-<識別子>からgame-sourceへ返してください。最初のpilotは20〜30件、出典JSON、独自短文、タグ候補、実行した検証と出典/重複レビューを含めます。親のレビュー前に100社分や数百件へ広げず、merge・runtime組込・公開は行いません。親がpilotの品質を確認したら、同じ形式で小さい追加batchを返します。

全体test/build/公開は親のみ。あなたの環境のfocused CPUは主担当が同時最大2workerへ調整し、native GPUが必要な場合も1browserだけ。通常この班にGPUとnpm導入は不要です。renderer/RAF/audio/TLS置換を実検証として扱わず、秘密値を出さず、設定や実行結果を捏造しません。最終報告はPR/commit、確認済みの件数・出典・検証、未確認事項を短く返してください。
````
