# 外部制作・調査班：継続して成果物を渡す指示

既存の1タブを継続する。初期ニュース原稿を保持して小PRにし、完了した担当から下の制作・検証へ進む。新しいタブを重ねて起動する指示ではない。repo未設定の新環境で再開する場合も、以下に取得手順が含まれる。

````text
あなたはShibuya Capitalの外部制作・調査班の主担当です。親側は管理・設計・統合・QAへ集中します。実際の過去ニュース素材、実音声asset、公開actionによるプレイ再現を継続して小PRで渡してください。最初の20〜30件はニュースPRのbatchで、任務全体でも停止点でもありません。初期4出典担当＋編集＋QAによる約24件を破棄せず、小PRまで完了。完成して空いた既存担当から次のstreamへ移し、レビュー待ちでも独立した割当済み作業を進めます。新simulation、API、指数、汎用asset基盤は実装しません。PR2の受領コミット4072368は取り込み済み、追加指示はhttps://github.com/shirai0765/-/pull/2#issuecomment-6031934250に投稿済みです。

主担当の指定はGPT-6.1 Sol/max、子6担当はGPT-6.1 Sol/high、主担当含め最大7体、孫agentなし。既存6担当を再利用し、さらに6体を追加しません。新環境で起動する場合は、対応するAPIにmodel=gpt-6.1-sol、reasoning_effort=high、fork_turns=noneと任務・repo・branch・専有範囲を渡します。実際のtool/schemaに従い、設定・起動を捏造しません。PR2の受領書は主＋6稼働・子Sol/high・主の正確なモデル確認不可と報告済みです。確認できた設定、実起動人数、未確認事項を更新してください。

repo=https://github.com/shirai0765/-.git。開発・PR宛先はgame-source。mainはcompiled公開専用で、ソースpush、merge、公開は禁止です。まず/workspaceの既存checkoutとAGENTS.md、git status --shortを確認。正しいcleanなcheckoutは再利用し、dirtyを保持してください。reset/clean/forcepush、秘密値の抽出は禁止。正しいcheckoutがなければ、別の未使用directoryへ次の取得を行ってください。

TEAM_RUN="$(date -u +%Y%m%dT%H%M%SZ)"
TEAM_DIR="/workspace/shibuya-news-research-$TEAM_RUN"
TEAM_BRANCH="team/news-research/receipt-$TEAM_RUN"
git ls-remote https://github.com/shirai0765/-.git refs/heads/game-source
git clone --single-branch --branch game-source https://github.com/shirai0765/-.git "$TEAM_DIR"
cd "$TEAM_DIR"
git switch -c "$TEAM_BRANCH"

既存clean checkoutではgit fetch origin game-sourceの後、同じ専用branchをFETCH_HEADから作ります。取得後にdocs/external/teams/bootstrap.md、docs/coordination.md、docs/interaction-v070.md、src/data/stocks.ts、docs/market-universe.json、src/sim/weeklyNews.ts、src/model.tsを読み、最新の基点SHAを記録してください。Git read/push/API権限は別々に実確認し、CLI loginやtoken変数の不在だけで環境認証がないと判断しないでください。

専有namespaceは下の6streamに記載した場所だけです。src全体、App、音声runtime、engine、model、UI、storage、株価、package/lock、Vite、他班資料・GLBは、親が明示的に専有ファイルを委譲するまで変更しません。ユーザーはUI案B（モンスト系）を選択し実装を許可しましたが、その改修は親側で別途担当を割り当てます。この6streamの外部班は無断でUIを改修しません。

初期原稿を保存・引継ぎした後、完了して空いた担当から次の6streamへ割り当てます。同じ狭いファイルを複数担当に編集させず、移行途中の元作者の原稿を上書きしません。

1. 実際のカフェ・小売ニュース40件：docs/external/news-research/candidates/company-news-wave1.json。出店/撤退、商品、費用、決算、運営を異なる事例で集める。初期の採用候補も含めて40件、単なる言い換えを件数にしない。
2. 不動産・鉄道・資金調達/M&Aニュース40件：docs/external/news-research/candidates/property-rail-capital-wave1.json。小型株・REITも含む多様な企業と局面を選び、大手だけに偏らせない。既存100stockの区分と実際の出典を保持する。
3. 独自短文編集・source factcheck・100stock対応・dedupe：docs/external/news-research/edited/とscripts/external/news-research/。原資料を実読し、元100stock対応、既存保存イベントの文脈、事実/原稿/適用条件を分離し、検証器と整形原稿を返す。元作者のJSONは直接編集せず訂正を返す。主担当が最終catalogを組み立てる。
4. オリジナルBGM2曲：public/audio/external-v080/bgm/、scripts/external/audio-bgm/、docs/external/audio-bgm/。café-loungeとTokyo-city-popを各30〜60秒loopで制作し、実WAVとOGG、試聴用file、manifest、再現手順、loop接続と容量/音量の実測を渡す。
5. カフェ環境音/UI/週次利益SFX kit：public/audio/external-v080/sfx/、scripts/external/audio-sfx/、docs/external/audio-sfx/。原作または再配布可能な素材から実音声を作り、環境loop、UI操作音、黒字/赤字結果に使える短い音を用途別manifest付きで渡す。runtimeは変更しない。
6. 初一時間/30時間の進行・判断・balance検証：docs/external/gameplay-review/、scripts/external/gameplay-review/。現在の公開actionで創業、中盤、終盤の3traceを再現し、所要時間、判断・待ち・資金/実利益/店舗/評判/到達週、保存と問題の根拠を記録する。最小の修正提案に絞り、新機能を発明しない。

主担当はreceipt、README、pilotと最終catalog.json、PR本文、全体の組立・検証調整を所有します。Gitのbranch/stage/commit/pushは主担当だけが操作します。6担当は専有ファイルで並行作業し、依存待ちは形式確認・既存原稿の編集・音声・別traceなど割当済みの独立作業へ移します。最終成果は文章だけでなく、使えるcatalog、WAV/OGG、manifest、repro scriptと実traceです。

有限の初回は80の異なるニュース＋BGM2曲＋SFX kit＋3 play traces。初期pilotの採用品を80件へ含め、二重計上しません。ニュースは20〜30件単位、音声は1曲/1kit単位、traceは1本単位の小PRで返し、レビュー待ちで全員を停止させません。親の採用判断・merge・公開は待ちますが、独立した未完了queueの制作は継続してください。

原資料は企業公式発表・IR、公式の施設/鉄道/自治体資料を優先し、必要なら出典を確認できる報道を使ってください。sourceURL、publisher、publishedDate、accessedDate、実際に確認できたfacts、出典内の該当箇所、authorWrittenBrief、parodyEntities、relevantExistingSavedEventContextを各候補に記録してください。日付不明ならnullと理由を記録し、推測で日付や数値を補いません。アクセスできない資料や記憶だけの話は未確認としてpilotから外します。

factsは原資料の事実、authorWrittenBriefはそれを踏まえた短い自作の日本語（原則1〜2文）です。見出しや本文を転載して社名だけ替える原稿は不可。長い転載や記事・写真画像の収集は不要です。言い換えだけで量を増やさず、違う出来事と、経営上の違う選択が分かる事例を選んでください。複数の出典が同じ出来事なら重複として束ねます。

parodyEntitiesは既存STOCKSのゲーム名への対応候補です。idはjp-3543等の実在する既存100stock idを使い、銘柄区分を勝手に変えません。対応がない事例は対応なしとして記録できます。実在の社名・現実の事実と、架空のゲーム社名への対応を別に保持し、現実の会社の過去実績がゲーム社の今週に発生したと書かないでください。

relevantExistingSavedEventContextは、現行の保存済み決算/イベントを読み、どの場面に関連する素材かを示すタグと根拠です。例は開業、不動産購入、IPO、買収、沿線開発。参照する既存field/eventと、確認できる事実の範囲を記録してください。現在のstateが上場済みというだけでは今週のIPOの証拠になりません。株価変化だけから出店・業績・因果を捏造しません。自社傘下の市場事業と独立他社を区別し、既存グループ収益に二重計上する案は出しません。

現行simが活動を記録していないものはhistorical-reference（過去の事例・参考）またはholdと明示し、今週の確定活動として表示できる候補と分けてください。素材を取得したことと、runtimeで条件適合したことは別です。旧セーブへ過去ニュースを補完せず、未来のカフェ利益予測も作りません。既存モデルに矛盾する短文は採用保留とし、そのためにモデルを拡張しないでください。

検証器は必須項目、URL/日付形式、stable ID、重複ID・同一出来事・短文の重複、元100stockとの対応を確認します。docs/market-universe.jsonのcodeからjp-codeを作って照合でき、依存追加は不要です。自動schema合格を、出典の実読・事実確認済みと混同しません。QAが不利な例（出典欠落、未来日、未知stock、同一ニュースの社名差替え、未記録の活動を今週の実績として主張）を拒否することも検証してください。自動検出で確定できない意味の重複は人の読取所見として記録します。

BGMは既存曲の録音・メロディを流用しない独自作曲。音声のsource/作者/制作method、利用・再配布条件と確認URL（完全自作はoriginalと根拠）、sample rate/channels/duration/bytes、WAV/OGG hash、peak/clipping、loop start/end frameと境界の測定をmanifestへ記録します。利用可能な制作tool/ffmpeg等を確認して再現可能にし、重いframeworkやpackage/lock変更を導入しません。BGMは雰囲気の異なる2試聴、SFXはcoffee ambience loop・UI confirm/cancel・週次黒字/赤字等の小kit。実際に音を聴けた範囲を記録し、波形や生成fileがあるだけで試聴済みとしません。音声制作toolが使えない場合は具体的な不足を返し、他の割当済み成果を進めます。

play tracesは実際の公開操作または公開applyAction/advanceWeekを使い、seed・版/source SHA・選択policy・action列・前後state・実決算・保存復元を機械可読JSON/JSONLで返します。通常資金の経路とsynthetic fixtureを区別し、資金注入を自然到達の証拠にしません。人の操作時間、スクリプト所要時間、ゲーム内週数、30時間の推定を分け、速い自動週進行を人間30時間の面白さ検証とは呼びません。判断・待ち時間・不利/有利な選択を数え、再現できた問題に最小修正案を添えます。初回3本は創業〜初決算、中盤IPO/投資、終盤成長/達成の別局面。全30時間を実プレイしていない場合は未実測と明記し、未確認を埋めるために新機能を増やしません。

初回はreceiptの1ファイルPR。PR2が既にある現在は同じreceiptを作り直さず、現在の担当・モデル/設定の確認状況・agent ID・実人数・専有範囲と進捗を更新してください。起動7体未確認ならそう書き、人数を装いません。

受領PRはgit push -u origin "$TEAM_BRANCH"の後、認証が使えるghならgh pr create --repo shirai0765/- --base game-source --head "$TEAM_BRANCH" --draft --title "News research: receipt" --body-file=<実際の本文ファイル>で返します。利用可能なGitHub connectorでも可。PR認証がない場合は成功したbranch URL/commitとブロッカーを返し、認証を捏造しません。

調査・制作・再現は継続します。ニュースはteam/news-research/news-batch-<識別子>、BGMはteam/audio-bgm/<batch>-<識別子>、SFXはteam/audio-sfx/<batch>-<識別子>、プレイtraceはteam/gameplay-review/<trace>-<識別子>からgame-sourceへ小PRを返します。task境界・PR提出時に最新game-sourceのdocs/coordination.mdと親のPRコメントを確認し、出された品質指摘を次batchへ適用。dirty原稿を保持したままgit show等で最新指示を読み、無理なcheckout/resetはしません。親レビュー前にmerge・runtime組込・公開はしません。初回80news/2BGM/kit/3tracesが揃ったら、完了と次の割当を親へ返し、未依頼の機能や無限batchを作りません。

全体test/build/公開は親のみ。focused CPUは主担当が同時最大2workerへ調整。native GPU browserは環境1本、主担当が担当6へまとめ、調査/音声の別担当が追加browserを重複起動しません。renderer/RAF/audio/TLS置換を実検証として扱わず、秘密値や実行結果を捏造しません。PRごとにusable成果物のpath、source/asset hash、実確認した内容、未確認を短く報告してください。
````
