# 次の担当への引き継ぎ：SHIBUYA CAPITAL

最終整理：2026-10-07。会話がプラン終了で途切れたため、ユーザーは「今のゲームを公開し、全方針と進捗をファイルに残す」と依頼した。**次回は単独担当を想定。並列エージェントを自動起動しない。** この文書を過去の並列化・無期限開発・残量リセット指示より優先する。

## 最初に読む順番

1. 本文書：要求・現状・構成・再開手順。
2. [現在版の検証記録](interaction-v090.md)と[公開チェックポイント](release-v090.json)：公開元、検証範囲、公開結果。
3. [承認済みデザインB](design/concepts/city-burst-approved.png)、[UI仕様](design/city-burst-v090.md)、[実装の比較画像](design/reviews/v090-candidate/README.md)。この画像はユーザーが選んだ案で、案の選び直しは不要。
4. 変更する分野だけ、下のコード地図・詳細文書を読む。旧[handoff.md](handoff.md)と[progress.md](progress.md)は経緯の記録で、最新方針と矛盾すれば本文書を優先。

## ゲームの目的とユーザーが決めたこと

- Coffee Inc / Coffee Inc 2 の店舗経営と拡大再生産を、精細な3D渋谷で遊びたい。カフェを起業し、店を増やし、不動産・鉄道・企業買収・上場・増資・配当・株式投資へ進み、巨大グループで街を育て切る。
- 舞台は渋谷。実際の建物、特に109の特徴と明るい東京らしい色味を重視。名称は星コーヒー等のパロディ／架空名称。元のゲームは興味がなく、新しいゲームへ置換済み。
- 当初100〜1000時間という話もあったが、最終目標は**約30時間で上場から全企業・街の成長まで完遂できること**。初期には最短上場2〜3時間という希望もあった。両方とも人の遊び時間で検証する目標であり、週数や自動実行秒数から達成済みとしない。
- 飲食の初期業種はカフェ。業種を無制限に増やさず、不動産・鉄道等は資産と運営への投資として広げる。店舗収益は立地・人通り・客層・価格・品質・人員・宣伝・店長と毎週の環境により変わる。
- 週終了を自分で選ぶ。未来のカフェ利益見込みを表示しない。費用、支払後資金、人通り等は事前表示し、利益・来店者・現金増減は営業後の確定決算で知る。
- 借入がある週に、営業利益から利息を引いた利益が0以下になれば経営終了。単なる「FCFが0」は初期の説明で、最終ルールと混同しない。正式な条件はエンジンと借入警告を参照。
- 店長に委任／自分で細かく調整を選べる。内装は粗い選択で十分。主眼は投資と経営判断。
- 100銘柄は大型有名株だけに偏らず、小型・グロース・低価格銘柄・REIT等も含む。持株比率、増資、配当、価格、他社投資、友好的買収。敵対的買収は不要。
- 良い／悪い営業が来て、システム・不動産等の提案を比較・調査・契約し、後から実際の結果を知る。確定利益を最初から教えない。
- ブラウザー中心、一般的なWindows/Ryzen 5 PROも想定。ログインなし、毎週自動保存。端末間は保存ファイルの書出し・読込。Windows配布形式はElectron portable ZIP。

## ユーザーが試遊で指摘した問題と現在の方針

街の造形は評価されたが、操作の分かりにくさ・情報過多が強く指摘された。常設の横ボード／下ダッシュボードを主役にしない。街を全画面で見せ、押せる建物や施設は明示し、必要時に詳細を開く。

カメラは安定した俯瞰を基本にする。通常スクロールで回転し続ける、物件選択だけで突然近景へ飛ぶ、戻り方が分からない、ちらつく、所有建物を見つけられない、という体験を再導入しない。場所を実際に見る操作と俯瞰へ戻す操作を明示する。

週末は街が裏に透けない全画面。要約で利益・現金・来店者を読み、任意で詳細へ。今週の街・市場・他社ニュースを経て次週へ進む。銀行と証券市場は街の施設からも入れる。融資は希望額と期間→金利／返済の比較→審査→明示契約。

## 決定済みデザインと演出

ユーザーは3案比較後、モンスト系の **B / CITY BURST** を選択した。濃紺・青・シアン、明るい街／カフェ背景、白い情報カード、厚みのある黄色の主ボタン、大きな日本語見出し、金色の実利益。パズドラ案へ戻さない。

- 日本語見出し：ローカル Dela Gothic One。金額：Barlow Condensed Black Italic。本文：Noto Sans JP / Manrope。長文や入力まで見出し書体にしない。
- 財布・人・店舗・銀行等：正規Phosphor duotone SVG25点。MIT、フォントOFL、URL・固定commit・SHAを同梱。生成画像の不正確な文字／アイコンを流用しない。
- 営業結果、出店、銀行、市場、グループ経営、提案、街区開発、資金計画、達成画面へ共通意匠を適用。
- 約1.18秒の初回カウントアップ・黒字のみコイン演出。タップ／即表示で飛ばせる。再閲覧とreduced-motionでは即時。赤字・0・経営終了に黒字の祝福を付けない。表示は保存されたその決算時点の金額。
- BGM：オリジナル「窓辺の午後」、84 BPM・約45.714秒、MP3優先／OGG代替、CC0。既存のユーザー操作で開く1つのAudioContextに統合。消音・一時停止・非表示・割込みに従い、再読込で自動再生しない。別案city-popも素材として保持。
- パチンコ／オリパ的な高揚感は演出の参考。ただし経営結果の捏造、架空の上乗せ、スキップ不能にはしない。
- 背景の生成アートはUI装飾。実測3Dの写真や実ゲームのスクリーンショットとして扱わない。

## 実装済みの範囲と完成度

[公開0.9.0](https://shirai0765.github.io/-/?v=0.9.0)はbuild-04。Pages公開・公開41 HTTP／39資産SHAと390px実開業→決算→保存再開が成功。72取引物件、景観候補349棟、銀行／証券市場、店長と週次経営、借入／返済、IPO／増資、100銘柄と友好的買収、8直接買収対象、グループ運営の26週比較、営業提案、4地区の段階的開発、鉄道、全108事業の達成記録、保存復旧・書出し／読込を実装している。資産すべてを購入しただけでは達成せず、稼働・開発・上場・黒字決算等の条件がある。

小模型4棟（桜丘住宅／オフィス・道玄坂2棟）を既存背景予約領域へ実GLBで配置。道玄坂AはPR17で階段終端・5上階入口・背面ファンを修正済み。交差点商業施設と大型テラスは受領素材だが未配置。新しく自由な道路／地形を編集する都市ビルダーが完成したわけではない。実測PLATEAUビューは別入口で、通常ゲームの創作景観と区別する。

全627テスト／71ファイル成功（build-03）。build-04は4CSSのnight可読性と1GLBの修正のみ、模型／poolの13テストを再確認し型検査・build成功。最終dist356ファイル139,295,575 bytes、index SHA256 `8ae04c80dab206070995550b0fa2451e86745ad02ace148358b811eba96d39ae`。本番CSPのWebKitで通常の開業・黒字／赤字決算・銀行借入返済・株購入・保存復元・音声PCM・各画面を確認。変更箇所だけ段階的に確認した結果で、失敗ログを全成功へ書き換えていない。[詳細](interaction-v090.md)。

**全ゲームの完成、30時間の楽しさ、物理iPhone Safari／Windows／Ryzen性能は未検証。** 人の初見プレイと長時間の理解・分岐・成長テンポが次の中心課題。終盤の自動API記録は人のプレイ時間の証明にならない。

技術基盤はReact19 / TypeScript / Three.js / Viteです。Unreal上で動くゲームではありません。Unreal Agent経由の追加起動は確認されていません。3Dの著作モデルはBlender／手続き生成・GLB、実測はPLATEAU由来です。

## コードの地図

| 領域 | 主な入口／責務 |
| --- | --- |
| 起動・操作連携 | `src/main.tsx`、`src/App.tsx`。会社状態、選択、dialog、週送りを接続 |
| 型・状態 | `src/model.ts`。GameState、report、actionの正本 |
| 経済・週次 | `src/sim/engine.ts`。`createGame` / `applyAction` / `advanceWeek`。UIが独自にcash等を増やさない |
| 初期物件・市場 | `src/data/`。立地、100銘柄、買収対象等。既存idは保存互換性に関わる |
| 金融・投資 | `loanApplication.ts`、`stockTrading.ts`、`capitalPlanning.ts`、`marketAcquisitions.ts`、`marketOperations.ts`。株式金額丸めには既存BigInt規則あり |
| 成長・終盤 | `progression.ts`、`development.ts`、`railProjects.ts`、`campaign.ts`、`campaignAchievement.ts`、`managedWeeks.ts` |
| 週末ニュース・提案 | `weeklyNews.ts`、`deals.ts`。決算時の保存された出来事を使う |
| セーブ | `src/persistence.ts`。IndexedDB、自動保存、checksum付きenvelope、旧保存検証・復旧 |
| 通常3D街 | `src/city/CityView.tsx`、`art.ts`、`sceneLayout.ts`、landmarks、growth・activity・financial visuals |
| カメラ・選択 | `cameraInteraction.ts`、`pointerSelection.ts`、`sitePan.ts`、`storeViewpoints.ts`、`GameSiteMarkers.ts` |
| GLBと破棄 | `loadedAsset.ts`、`dotScenery.ts`、`sceneLifecycle.ts`。pool／private fallback／遅延到着／abortを保つ |
| 実測ビュー | `src/realcity/`、`real-shibuya.html`。PLATEAU・地理院写真・Draco・texture budget。通常景観と別 |
| UI | `src/ui/`。`GameDialog`、`PropertyScenePanel`、`StoreOpeningPanel`、`WeeklyReviewScreen`、`WeeklyResults`、各金融／グループ／提案panel |
| 共通装飾 | `src/ui/city-burst-theme.css`、`GameIcon.tsx`、`public/ui/city-burst/`、`public/fonts/game/`、`public/icons/phosphor/` |
| 音 | `src/audio/`、`CityAudioControl`、`CityAudioAssets`、`CityAudioCues`、`public/audio/external-v080/` |
| 配布 | `desktop/main.cjs`、`scripts/package-web.py`、`package-windows.py`、`verify-windows.py`、`deploy-pages.py` |

銘柄は95株式＋5REIT。価格は日付付きのオフライン参照（多くは2026-10-06）、将来価格・利回り・リスクはゲーム設定です。リアルタイム株価配信と呼ばない。`src/data/stocks.ts`、`docs/market-universe.json`、[経済](economy.md)、[出典](sources.md)を参照。

## 重要なデータと素材

- [小模型の配置契約](external/dot/background-integration-v090.md)：座標・scale1・予約範囲・fallback。大型模型を通常区画へ自動縮小しない。
- `public/models/authored/`：既存カフェと108/109系。`public/models/real-shibuya/` と `real-shibuya-ground/`：実測。`public/models/external-v080/`：Dot素材。原Blender／写真／GLBを勝手に上書きしない。
- [ニュースcatalog](external/news-research/README.md)：80件・98固有出典。全件historical-reference/runtimeEligible=false。実世界の過去資料であり、起きていない今週の他社活動として自動表示しない。原記事を社名だけ置換して転載しない。
- [外部長期検証](external/gameplay-review/README.md)と[親側評価](external/internal-qa/gameplay-wave-v090.md)：通常エンジンAPIでの1seed記録。UIの試遊は途中で失敗。第17週IPO、100市場企業を取得、1400週後に信用条件が不足。単なる待機では信用が頭打ちになるが、通常の店舗調整と6決算の限定分岐で108達成可能と確認。値を無料で与えて直す必要はない。
- [Mario開始面の一次資料](research/mario-onboarding-primary-v090.md)、[一次本文4章](research/primary-ux-lessons-v090.md)、[研究索引](research/game-reward-study.md)。公式本文は6章確認。桜井YouTubeは通常アクセス403で本編／字幕未取得。大量の二次要約を全動画視聴済みとしない。

## 過去の担当構成と外部連携

親は設計・管理・受渡し・統合・QA。内部6担当はcity（3D／物件）、economy（金融／事業）、endgame（共通UI／一次研究）、reliability（唯一のブラウザー／GPU）、rivals（音／長期記録評価）、ux（週末／演出）。後期はユーザー希望でSol6.1/xhighを使った。現在これらのworkerは稼働しておらず、単独再開に引き継ぐ。

外部Dotは別タブの個人エージェントで、こちらから直接起動・モデル変更できない。ユーザーはDot主＋6を全Astraと希望し、GitHubのPRコメントで指示済み。先行Luna調査担当を含めた切替完了・D03見本忠実度／D04一次知識担当の着手は作者の確認がまだ無い。実施済みと報告しない。別Cloud Codex班はSolの主＋6を希望し、ニュース／BGM／SFX／プレイ記録を分担。手渡しは `docs/external/teams/`、[担当表](coordination.md)、GitHub PR履歴。PR3〜17の模型・音楽・資料を受入／評価している。外部SFXと大型施設配置、DotのD03/D04成果は未完了。

残量／リセット券／fast modeをこのコードから操作する機能はない。残量担当を別へ移した過去指示もある。次担当に自動リセットや6体常時稼働を約束させない。最新の単独再開指示を守る。

## 再開・検証・公開手順

リポジトリは **`shirai0765/-`**。開発ソースは **`game-source`**、`main` はビルド済みPages専用。このworkspaceは `/workspace/-`、local branch `work`。`/workspace/.git`は空のplatform placeholder。`main`へのソースpush／force push／初期化をしない。

新環境なら `git clone --branch game-source https://github.com/shirai0765/-.git`。既存環境は先に `git status` と `git log -5 --oneline` を確認し、保存済み変更を消さない。Node24・npm・Python3が必要。

```sh
cd /workspace/-
npm ci --include=dev
npm run dev
# localhost:5173。既存serverが応答する場合は再利用。
npm test -- --maxWorkers=2
npm run build
```

CPU quota4のためVitest最大2worker。GPU／nativeブラウザーは同時1本。変更に合った検査を一度実行し、成功した重い検査を理由なく繰り返さない。保存を消して試すなら新規隔離profileを使用し、ユーザーの既存保存に触らない。

公開は [deployment.md](deployment.md)。build→検証済みWeb manifest→sourceをgame-sourceへ通常push→`python3 scripts/deploy-pages.py --manifest /path/to/web-report.json --publish`→Pages workflowと公開release/資産SHAを確認。これは一般公開する同リポジトリ内の更新としてユーザーが継続許可済み。公開settingsや既存mainを強制変更しない。

Windows最新版の作成手順は [windows.md](windows.md)。0.9.0 Web／Windows ZIPを同じ検証済みdistから梱包済み。CRCと全ファイルSHAを照合、Windows実機・署名は未確認。以前のZIPも保存されている。正確なサイズとSHAはrelease記録を見る。`npm run package:windows`は再buildを含むため、凍結した検証distを再利用するならPythonスクリプトを直接使う。

`/workspace/shared/shibuya-artifacts/` はこの環境の証拠と配布物。`/tmp`の一時ツール・ブラウザー・依存は新環境にあると仮定しない。重要な検証要約と画像はGitのdocsへ複製。実WebKitの追加Debian依存／cacheは旧検証記録の環境依存なので、次環境では通常のPlaywright依存導入を優先。

## 次の仕事：機能を増やす前に

1. 公開版を通常操作で触り、初めての人が「物件→開業→週終了→次の判断」を説明なしに発見できるか確認。既存ボタンがあるだけでは理解の証拠にならない。
2. 借入警告・赤字・現金増減・利益の区別、店長委任と満足度／ブランド評価の関係を明確にする。信用不足で待ち続ける経路は、購入画面の既存条件を起点に理解できるか観察する。
3. 30時間の成長テンポ／中盤の分岐／終盤の作業感を人のプレイで評価する。現状の週数を30時間の達成としない。利回りを保証値として見せない。
4. Windows／物理Safariで音のgesture再生・保存・描画負荷を検証。写真のような精度、フレームレート、人の聴感は自動テストだけでは証明できない。
5. 見本Bとの実画像比較を続ける。大型模型、SFX、出典付き過去ニュースの提示は、元の仕様と上のUX課題に役立つ範囲でのみ追加する。

ユーザーへの次の確認は、試遊の具体的な判断が必要な場合に絞る。今回の引継ぎ作成／現状公開では新機能・新デザインの承認を求めない。

## 引継ぎ時の未レビューPR

[一覧と固定head](open-pullrequests-at-handoff.json)を保存。PR18は住宅バルコニー／屋根の局所修正、PR19はカフェ音源の24bit原盤／AAC補完、PR20はcity-popの同補完です。今回の現状公開には取り込んでいません。次担当は必要性と実バイナリ・寸法・ライセンス・再生を独立確認してから採用してください。タイトルの「native確認」を親の検証済みとは扱わない。既に検証したMP3/OGGは現行で動いています。
