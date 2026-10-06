# 作業継続のチェックポイント

最新の目的は、実写真に忠実な渋谷の見た目と、約30時間で上場・全企業取得・街区開発を完遂できる経営ゲーム。以前の100〜1000時間目標は置き換え済み。ユーザーはインターネット無制限設定を反映し、実写真の収集と模型への反映を明示的に依頼。旧ゲーム削除と新規制作も承認済み。

## 現在0.4.6：追加試遊から操作と週報を修正（開発中・未公開）

現在の公開版は0.4.5。ユーザーの追加試遊を受け、通常ドラッグで街が回転すること、店を選ぶだけでカメラが寄ること、操作の効果を判断しにくいこと、週報の長さと数字の突然の表示を修正している。Appへ統合済みだが、0.4.6の最終テスト・実App QA・配布・公開検証は未完了。過去の合格数を今回へ転用しない。

通常は `cameraMode=manage` で平行移動・拡大縮小と角度固定。明示的なexploreだけ回転でき、中心と距離を保って経営角度へ戻る。selectLotとopenStoreからの自動近景は廃止。店舗管理・週報のviewStoreだけが近景を要求し、街全体へ戻れる。自社markerは44px相当と「自社」、候補34px相当。native dialogとタブ非表示で両scene・controlsを停止し、ゲーム街の歩行clockから停止時間を除外する。近景の最大8人は直近の決算客数の印象で、現在の行列や新しい予測ではない。

`StoreManagementPanel` は商品・価格／人員・店長／広告・改装／営業実績の4入口。入力の編集中・未反映と確定実績を分け、旧actionを使う。`WeeklyResults` は全社利益・現金増減・決算後資金・来店者を先にし、店別と全社内訳は閉じたdetails。約650msの初回演出、同じ会社/週のセッション内再閲覧とreduced-motionは即時、途中閉鎖でRAF解除。報告週が一致するhistoryだけを決算後資金へ使う。過去の実績へ現在の現金や設定変更の因果を補わない。経営メニューから直近結果を開き、次の出店操作は候補一覧を開く。

初回3段階ガイドはブラウザー読了設定と経営メニューの「遊び方」。BGMは手動開始のWeb Audio・オリジナル8小節。再生状態は保存せず、音量と消音だけ会社保存の外へ記憶し、非表示タブで停止する。HUDは手元資金を明示、ダイアログ中の通知は自動消去しない。成長戦略の見込み幅・危険表示は既存getWeekOutlookへ合わせる表示修正で、経済係数と終了条件は変更しない。

rootはApp統合・最終チェック・公開、interaction_qa_solはCPU/GPUの実App操作、scene_review_solはclock/marker、progression_solは成長戦略の幅と危険、release_solは配布、docs_solはREADME/progress/handoff/interaction文書。ユーザー指定のGPT-6.1 Sol xhighを定型作業に使用し、GPUは一本ずつ調整する。文書の既存履歴と旧成果物を保持する。

現時点の証拠は週報局所型検査、SSR11状態、GPU無効の単体ブラウザー6項目（390/1280、page error0）。`interaction-v046/weekly-results/` のsource SHAに紐付く当時の単体検査で、最終Appの保存・カメラ・実3D・音楽を検証した結果ではない。独立研究 `research-v046/loss-recovery-review.md` は公開actionだけで38決算・18回復経路の保存一致、初期32標準店中12区画の見込み赤字を確認。店長の黒字保証はなく、赤字と回復は既存係数で成立。人間の初回理解・30時間の実測ではない。

最終ソースが固まった後の全体テスト・build・DOM/GPU・配布整合性・公開コミットと公開URL検証の実結果を、[操作と週末結果](interaction-v046.md) と [進捗](progress.md) の0.4.6節へ追記する。現在の公開source/pages/runは下の0.4.5節を参照。

## 0.4.5：試遊を受けた全面街UIと週末実績（公開済み）

ユーザーが公開版を試遊し、常時の左右・下部パネル、施設を選んでも詳細が開いたと分からないこと、可操作建物の不明瞭さ、週前に利益が確定していることを強く指摘した。「Coffee Inc/2を大きくしたもの」が体験の軸。0.4.4までのダッシュボードを小さくする案で済ませず、街をviewport全面に維持し、施設・財務・株式などは選択時だけnative GameDialogへ表示する構成に変更した。0.4.5は公開済み。source a32d92fc2915eb58b67ef670d21c50f07af83788、pages 4138eff953030563e5aad832d2be336cbbe644a1、Pages run37534939396成功。公開HTTP18/主要16SHA、実Firefox8カテゴリも成功した。

rootはApp/全体UI、salesは32区画の常時目印とpointer gesture、capitalはnative dialog/資本と買収の幅表示、immersiveは実測街の開閉メニュー/店舗情報の折畳み/開発営業確認、acquisitionは出店画面の短縮と幅/文書/梱包、railは経済境界・長期検証・配信監査、campaignは公式画面調査と実App検証を分担。完了した担当は次の独立仕事へ移した。Astraの7同時枠（root含む）を使い、GPU browserだけ1本に制限。

選択→施設の操作、開業→店の外観＋営業アイコン、HUDから再経営、閉じる→同じ街という導線。32候補に青い店舗＋、営業中は緑カップ、保有物件は紫の目印。背景建物に誤った出店案内を出さない。名前はhover/選択時だけ。全32一覧は必要時に開く。ゲーム地図と実測4地点の対応は従来どおりで、実測街へ実カフェGLBを配置したと主張しない。スマホも常設の縦積みinspectorを廃止。native dialogはEscape/背景click/focus復帰/子confirm/送信中guard/最上面通知を共通化した。店舗一覧は各店の設定全展開をやめ、選択して経営する。

`previewWeek`は中立の見込み、`advanceWeek`だけ当週の実現値を使う。店の客足（地区±4%＋地点±4%）と運営状況（自主管理±4%・店長±2%）はseed/週/lot用途キーで一意。再読込・名前/設定の往復で再抽選しない。店長案は実現値を見る前に選ぶ。`getWeekOutlook`/insight.resultRangeは保守的な上下限で、確率区間ではない。未測定の営業提案・市場企業の当週shockも見込みへ漏らさない。固定費・既知の契約成果を無意味に乱数化しない。保存shapeと過去実績は維持するが、旧会社も次の営業から新方式になり、旧版との将来完全一致は今回意図的に保証しない。

単週は危険の可能性を警告し、借入中の実利益0以下/現金不足という既存終了条件を維持。4/13週の委任は見込み下限に危険があれば実行前停止し、実際の決算を保存する。事前数値は主に閉じた詳細、出店時は千円単位の見込み幅、週末は実績を表示。旧出店記録の基準見込みは後から書換えない。

254テスト/29ファイルと最終build成功。dist game-BKBlvv5Y / game-C_zEWnTB / RealCityScene-BQwCb4fu、276ファイル94,254,310 bytes。DEV実App GPU5カテゴリ成功（32markerの実click・開業・同scene/camera復帰・初決算・保存再読込）。3seed×12週の初店は36決算すべて幅内/再現/無破綻。通常campaign原版2seedは1006/894週で完遂、双方IPO21週、終端save往復一致。人間の30時間体験の実測ではない。公式Coffee画像20取得/10目視、YouTube403・動画視聴0を研究資料へ明記。最終DOM9カテゴリ（1280/390・描画stub）、本番CSP9カテゴリ（native RAF・実描画・旧0.3.2保存完全復元）も成功。検証時にJavaScript/console/外部要求/CSP違反は0。旧880成果物を保持してWeb/Windows ZIPを生成、全CRC/SHA一致。公開後の実操作8カテゴリも成功し、同会社の保存・実測街往復を確認した。

証跡：`shared/shibuya-artifacts/immersive-v045`、`weekly-outcomes-v045`、`integration-v045/pages-prefix`。再実行の入口は `scripts/smoke-immersive.py`（Firefox/private Xorg runner、URL指定可、製品RAFを置換しない）。旧 `smoke-production.py` などは旧UI selectorsを含むため、この版の新導線検証と混同しない。GPU実行環境の制限とゲーム不具合を分けて記録する。

## 0.4.4：写真の明るさと設定の手応え（公開済み）

0.4.4はsource c1651686076c7ef0d85cab162379758f8cb2c9a6、pages db436b50de2e165132d0a2a640e2072eca772456、Pages run37532392337成功で公開済み。公開HTTPSの実Firefox8項目とHTTP18/主要16SHA照合も成功した。公開許可は継続。6 Astraで都市・UX/検査・資本/買収/設備の研究を並行した。buildはgame-BNaTI7Wi / RealCityScene-Db72F0XZ / game-xMFJ-JA1、231unit/26filesと本番CSP9が成功。旧0.4.4 ZIPを保持し、0.4.5を別名へ梱包する。

`photoAppearance.ts`で写真の焼込陰影を使うMeshBasicMaterial/toneMapped=falseへ移行。元linear color×gain1.15、slider1〜1.8は非累積。写真なし材質も比較と同じ方式。元105アセット・全品質geometry/index/normal/UV/worldmatrix/boundsは0.4.3と一致。下半球中性化だけの案は差が小さく不採用。元写真の青さと1024のぼけ、平面地表の制約は残る。marker候補文字だけ濃色化。CESIUM_RTCは専用pluginで既存手動変換を認識し二重適用なし、MediaRetailのundefined transparentは既定falseへ。

単体viewer11/controller6 GPU成功。新cloneModelForExportはgeometry/texture共有・materialだけ複製して元colorへ戻し、export後clone材質だけ解放する。これでdisplay gain>1をGLB baseColorFactorへ書く退行を防ぐ。実40mesh/20map cloneと小GLBの実browser roundtripは成功、全原寸GLBの再書出しは未実施。旧成果物を上書きしない。詳細docs/real-city-photo-appearance.md。

StorePlanFeedbackは価格/人員、品質/広告/店長の入力付近2か所に既存insight利益と理由buttonを表示。staff過剰を入力付近と既存detailsに説明。pointerdownではfocusを維持、click時の既存blurで確定してからdetailsへ移動し、警告出現によるclick喪失を修正。28位置/390touch/1280mouse/理由focus/保存一致、週危険→改善・危険確定・4/13週開始前停止の3経路も成功。単週の確定ボタンには経営終了を明記、batchは事前停止と区別。src/sim・data・model・persistence18ファイル完全不変。

次期株式の研究はshared/research-next/ledger/valuation.mdほか。3社元帳・EV/cash/debt/share分離・配当落ち・取得後の継続を3者独立検算。会計一致だけでは市場の合理性を保証せず、任意10円増資がモデル1.7163円の株主へ価値移転を生むことを検出した。現条件ship不可、0.4.4には未実装。将来は合理的な発行/換金、週次の資金順序、旧save同seedの維持を解決する。

新証拠はverification-0.4.4 / production-0.4.4 / next-color/runtime / store-feedback-v044。正式offline-0.4.4は83,273,567 bytes、99埋込asset一致、追加HTTPなし実ブラウザ9項目成功。都市担当は最後の画像閲覧で入力画像量の上限に達しただけで、rootがJSONと109画像を確認し処理終了を確認した。Web ZIP 65,769,325 bytes、Windows ZIP 223,800,778 bytesを生成し全CRC/SHA一致。dist276ファイルと旧746成果物の不変を確認。各SHAはdocs/web.mdとwindows.md、旧成果物の保全manifestは /tmp/shibuya-preservation-before-0.4.4.json。公開後検証はこれから。WindowsRelease uploadは0.4.3でHTTP400、空draftは削除済み。今回は再試行せずローカルZIPを保持。

## 0.4.3：実測街と同じ会社の経営

0.4.3を既存の公開URLへ公開済み。source 42005ed91fd7820aefa7130d550880a1305ed9a4、pages bc72ca76e195b34b4750062e9abe10c902688301、Pages run37528596336成功。公開HTTPSの実Firefox操作7項目、HTTP18/18と主要16SHA照合も成功。6担当でcontroller・表示対応・React操作・32区画一覧・独立レビュー・QAを分担した。

同じAppに「ゲーム街」「実測の渋谷」の切替を追加。実測対応はcenter-01 / dogenzaka-01 / miyashita-01 / sakuragaoka-01の4地点。元batch/gml/頂点から屋上中心を取得し、6m上にゲーム内目印を表示。注釈の文字だけは読めるよう前面に描き、地点の球と建物は通常の奥行き判定を保つ。入口やカフェGLBを実建物へ設置したわけではない。全32区画を地区・営業・物件保有で選べ、未対応地点を選ぶと同じlotIdのゲーム街へ移る。財務の戻り先・出店形態・入力メモを保つ。

`src/realcity/RealCityScene.ts` は独立viewerとReactの共通controller。`gameSites.ts` は表示だけの4地点対応と所有状態の導出。GameState・経済18ファイル・元105画像/建物ファイルは変更していない。controllerは世代のabort、遅いDraco/image結果の解放、要求時描画、非表示時停止、最後のfocus要求、同期初期化例外時の解放に対応する。`src/city/sceneLifecycle.ts` は両地図の生成から非同期解放終了までを直列化。`LoadedAssetPool.dispose()` は遅いGLB解放まで待つPromiseを返す。CityViewは遅延生成後に最新の会社状態と視点を適用する。

最終ビルドと226テスト/25ファイルが通過。独立viewerのGPU9項目、controllerのGPU6項目、4地点の実クリックと別担当の目視を確認した。0.4.2とgeometry/index/normal/UV/world matrix/bounds一致。DOM検査は描画差替えの範囲を明記し、通常の4社創業・週決算、旧32店舗の未対応28地点、財務帰路、スマホ末尾選択、wrapper失敗時再試行を確認。自然なスマホ操作で見つけた一覧末尾からの詳細スクロールと、地点/出典メニューのクリック遮蔽を修正した。

実App統合GPU5項目とHTTP503/WebGL初期化失敗時の通常開業・週保存2項目がFirefox/Mesaで成功。実App GPUはnative RAF。最終distの本番CSP9項目も成功し、旧0.3.2保存を完全復元、DEV hook不在、地図往復で保存不変、エラー/CSP違反/外部要求0を確認した。本番CSPだけQA側App RAF200ms遅延でありWindows実機・性能の確認ではない。ドキュメントは `docs/real-city-controller.md`、`docs/real-city-ui-playtest.md`、`docs/real-city-integration-lifecycle.md`、`docs/design/real-city-integration-review-v043.md`。保存先は `/workspace/shared/shibuya-artifacts/integration-v043/`、`realcity-v043/`、正式単体HTMLは `offline-0.4.3/`。`realcity-v043/real-shibuya-viewer.html` は途中の仮出力なので正式配布と混同しない。旧0.4.2配布物は保持。正式offlineは追加HTTP0で実描画9項目成功。Web/Windowsは全CRC/SHA照合済み、旧86成果物不変。WindowsRelease添付はHTTP400で失敗し今回の空draftだけ削除、検証済みZIPは保持。公開browserは影響なし。

次の設計資料はリポジトリ外 `/workspace/shared/shibuya-artifacts/research-next/growth-standard-economics.md`。Basefood・Liberaware・エリアリンクの公式決算3例で成長・利益・資金調達を比較し、現市場の共通価格anchor/driftの限界を記録した。実数をそのままゲーム係数に移さず、capital/rail/acquisitionの3担当が次版の選択肢と旧保存互換を検討し、同directoryの design-capital-growth.md / design-acquisition-growth.md / design-rail-opportunity.md に集約済み。3仮想企業の元帳から検証し新会社opt-inを判断する案で、買収時に開発赤字が消える裁定の解決が採用条件。係数変更はまだない。色調のreadonly調査は `/tmp/realcity-color-preflight.md`。元写真自体の青寄りと照明/トーン処理の影響を分離した比較が次の候補で、色改善を実装済みとは扱わない。

## 公開版0.4.2とブランチの役割

ユーザーがGitHub Pagesでの公開を明示依頼し、`https://shirai0765.github.io/-/` へ公開済み。実測ビューアは同URL配下の `real-shibuya.html`。開発ソースは `game-source`、`main` は検証済みビルドの配布専用で、package.jsonはない。今のローカル `work` はソースのチェックアウト。`main` へ開発ソースを直接push/mergeしない。通常のコード変更・ドキュメント更新は `game-source` へ、次の公開は [deployment.md](deployment.md) の検証と補助スクリプトを使う。

公開元ソース `5f48a6b806c509e0505690f5588ef3c2c6d66dc3`、配布コミット `61002026eaf5d50a80de20d06e5338cf8477ad2d`、Pages run `37522617185` 成功。公開URLの主要16ファイルはdistのSHAと一致。公開本番で新会社・実3D・出店・初決算・自動保存・再読み込み・JSON書き出しの6項目成功。詳細とクラウドブラウザーの一時検証設定は [published-playtest.md](published-playtest.md)。公開サイト自体の証明書不備と、クラウドChromiumの環境CA不足を混同しない。

この節は0.4.2公開当時の記録。次版0.4.3の実装・検証状況は先頭の節を優先する。

## 0.4.2と最新の並列化依頼

ユーザーは追加で「Unreal Agent経由でさらに担当を増やせないか」と依頼した。ツール台帳、実行ファイル、ローカルplugin/skill/MCP設定、環境capabilitiesを確認したが該当接続は見つからない。起動コマンド・導入先・公式URLを非同期で質問済み。返信が来たらその経路を確認する。現在の組込み協働はroot＋6担当が上限。Codex CLI自体はログイン済みだが、通常のread-only/ephemeral起動でも管理領域 `/run/codex-environment/codex-home` のstate SQLiteとinstallation_idへ書けず、モデルの追加担当は起動前に失敗した。診断は `/tmp/shibuya-codex-startup-diagnostic.log` と `shibuya-codex-startup-paths.log`。資格情報やCODEX_HOMEを移動せず、制約を迂回していない。この補助経路の制約で制作全体をブロック扱いにしない。

0.4.2は店舗の理由表示と実測viewerメモリ改善を統合。`getStoreOperatingInsight` は従来のraw店舗計算を共用し、managerの入力/実効設定、需要/能力/来店、費用、丸め調整を返す。WeeklyReport.storeResultsの5fieldsとGameState/save形式は維持。`StoreOperatingInsightPanel` をAppの店舗管理へ接続し、終了済会社では表示しない。表示説明は折りたたみ、利益・制約・3人数・満足を先に見せる。店舗計算は29fixtureの予測/決算/保存、2,178preview＋373advanceが旧版と完全一致。保存日時だけを除外した29例の比較と、除外0のstudy JSON一致を区別する。

市場調査で取引roundによる1円裁定を発見したため、別途 `src/sim/stockTrading.ts` のquote/settleへ統一。株価の10進表現をBigIntの比へ変換し購入ceil/売却floor、cash前後MAX_SAFE上限。株価や配当の係数は不変。旧端数cashの購入時roundと売却時加算は維持。`MarketPanel` は同helperの見積額/実行後現金/拒否理由を表示し、小数2桁の株価と端数規則を明示する。手元資金フィルタも同条件。100全銘柄の分割往復、独立24経路、実UI7カテゴリを検証。店舗の非変更と市場の意図的修正を混同しない。

`src/realcity/textureBudget.ts` はGPU転送前に最大辺1024へ縮小し、2048/原寸も選べる。20建物＋72地表/218,943tris/112meshes/92mapsを保持。建物画像基底76/304/1024MiBで、VRAM実測ではない。逐次ロードと世代キャンセル、Bitmap.close、部分失敗時再試行、pagehide/bfcache、入力時だけ再描画を確認。1024の109近景は原寸よりぼける。原寸exporterは明示originalと画像寸法を検証し、既存GLB上書きを拒否する。元PLATEAU/地表/旧成果物不変。実測経営接続はまだ設計段階。

最終buildと212unit/23files成功。distはgame-DcDJK267.js、game-ApOuCHWG.css、realCity-DlIfaqGo.js。店舗DOM11、市場DOM7、実測GPU9、単一HTMLオフライン4、本番CSP/旧保存8が成功。各文書は `docs/store-insight-api.md`、`store-insight-playtest.md`、`stock-rounding-playtest.md`、`realcity-texture-budget.md`、`production-playtest.md`。新スクリプト `smoke-store-insight-v042.py` と `smoke-stock-rounding-v042.py` はCityViewをstubに置換したDOM検証。Web0.4.2は65,758,142 bytes、SHA256 e63d2d68e1f30cd3c7a10638c265446b0a14a1b9427aeb3ab5e89cb120ce67f0。Windowsは223,790,507 bytes、SHA256 b2fd401b8c0efd395913c0101d0d70ce6be5946585fc69d27baaf1589d5277e4。CRC/SHA一致・旧成果物43ファイル不変、実機性能は未検証。本番検査のdist indexとWeb梱包のindexもSHA一致。

環境設定下書きは0.4.2手順を保存し、設定ツールの応答はrequires_publish=true。依存導入スクリプトと無制限ネットワーク設定は変更していない。新タスクへのPublish/復元確認は別で、完了済みと扱わない。

次の設計上の残件は、実測街と経営の接続（4つの架空出店markerから始める案）、LOD2画像の暗さ/近景の再構築、株式タイプごとの成長の違い、配当の目的、30時間の体験の密度。現在の成長型20銘柄は高い値動き/無配が中心で、成長率自体は全タイプ共通。`docs/research/market-accessibility.md` の実測と課題を参照。まだ完成・人間の通しプレイ済みと主張しない。

## 進行中の目標と0.4.1

ユーザーは「なぜゴールがブロックなのか」と指摘した。残量/リセット操作不能とYouTube原動画403を理由に制作全体をブロック扱いにした判断は適切でなかったと説明済み。これら補助作業の制約は残るが、ゲーム開発は続けられる。自動継続の目標でAstra6担当を再稼働した。作業可能な実装がある限り、同じ理由で制作全体を終了しない。

0.4.1は研究からのUI改善を統合。`OpeningResults` は実績先頭/内訳details/現存store IDだけ近景ボタン。`CapitalPlanningPanel` は主要5値と警告を常時表示し、内訳展開とApp内の入力draft保持に対応。`MarketAcquisitionComparison` を独立componentへ分け、主要3値と今週の正確な予測、警告、不可逆操作の説明を常時表示する。

`src/ui/investmentPlanning.ts` は出店・沿線・買収の読み取り専用メモ。`InvestmentMemo.id` は会社＋種類＋対象＋方式の安定した値、`InvestmentVisit.id` は一度だけ対象画面を開く通知。同じ投資の再訪で編集を消さず、別対象なら計画支出だけ再設定。AppのfinanceDraft/投資文脈は新会社・import・restoreで初期化、週次セーブへ混ぜない。資金調達と実投資は別操作で、戻り先が現在条件を再確認する。

`GrowthMilestonePanel` はapplyActionのIPO成功直後before/afterを表示する。自動保存は追加していないため「保存済み」と言わない。閉じる・移動は経済操作なし、snapshotを消す。企業取得へ進む場合、MarketPanelのinitialSection=acquisitionsで株式投資画面への誤着地を防ぐ。

CityViewのfocusStoreLotIdは明示店舗近景。通常選択と沿線近景を区別し、品質変更/画面幅/俯瞰復帰を扱う。購入不可背景のうち店舗前面8mに重なる11棟をゲームの表示から静的に省き、描画とカメラ障害判定が同じ `displayLayout.ts` を使う。購入32区画・経済LOTS・PLATEAUを変更しない。実店舗近景と通常俯瞰は同じ街を表示する。

0.4.1のDOMは新成長7カテゴリ、出店8項目、戦略11カテゴリが成功。実3Dは店舗近景13項目、4地区×3形態の描画を確認。最終buildと173unit/20files、本番CSP・旧0.3.2保存互換8項目も成功。最終distはgame-DIkUOxEf.js、game-BrmulJ6W.css。`docs/design/reward-review-v041.md`、`docs/investment-planning.md`、`docs/opening-playtest.md`、`docs/strategy-v4-playtest.md`、`docs/store-focus.md`を参照。

配布物はWeb65,752,825 bytes（SHA256 291cc1c5bd7a842b9f455b5b05e587941cd50780a9b5e9a0302d34ccd26fc0f3）、Windows223,785,184 bytes（9b43cab54cf034d2e99e052d5bc3be130de53ac1b9958db2a7925207691127b6）。CRCと全配布ファイル一致、旧成果物15ファイルの不変を確認。検証JSONとWindows/Web文書に詳細。0.4.0以下を上書きしない。Windows実機と人間の30時間は未検証。

独立研究として、カフェIR、REIT公開決算、鉄道セグメント資料、店舗設定2,160通りの比較を `docs/research/cafe-economics.md`、`property-economics.md`、`rail-economics.md`、`store-strategy-study.md` に記録。0.4.1の経済係数は変更していない。次0.4.2は `docs/design/store-insight.md` に沿った需要・能力・費用の可視化と、`docs/design/real-city-integration.md` を踏まえた実測モデルの表示メモリ削減。実測全atlasのRGBA基底は約1GiBであり、ファイルサイズだけで軽いと判断しない。実測街との経営接続はまだ設計段階。

配当3案は `docs/design/dividends-options.md` と2レビュー。現版は現状の正確な説明、個人資産は任意の将来案、配当設定だけで株価を増幅させる案は増資との抜け道を検討してから。個人資産を欲しいかという質問をユーザーに非同期で提示済み。返答がないまま配当を強制したり必須目標を増やしたりしない。

## 最新0.4.0：6担当の統合と公開資料研究

6名のGPT-6 Astraを資本・沿線経済・営業・買収・街表示・検証/研究へ分けた。最新の依頼はCoffee Inc/2・ほしの島のにゃんこ・桃鉄の楽しさの調査と、桜井政博さんの『ゲーム作るには』を活用すること。研究の入口は `docs/research/game-reward-study.md`。公式説明、本人の公開発言、ユーザーレビュー、第三者要約を分けた。最終台帳は300 URL、254個別テーマ独自要約、39総集編対応、7特別回の限定概要。別の3担当で設計/UI74・技術42・映像/音63、計179テーマを校閲済み。YouTube通常HTTPSはプロキシ403、動画視聴0・字幕0。迂回せず、第三者要約を動画全件確認と呼ばない。

- `src/sim/capitalPlanning.ts` / `CapitalPlanningPanel.tsx`：現状・借入・IPO/10%増資を実際のapplyActionで比較。任意支出/留保メモから不足現金を計算するが、投資自体は実行せず投資後収益も推測しない。配当0%が成長資金を最大化する現行課題は残る。
- `src/sim/acquisitionComparison.ts` / `AcquisitionComparisonPanel.tsx`：最大3候補、方式・費用・準備期間・利益幅を比較。未調査の品質は漏らさない。自動/一括取得はない。
- `src/sim/railProjects.ts` / `RailProjectsPanel.tsx`：上場・信用45・地区内直接保有物件で任意の駅周辺共同開発。商業600万円/4週/週6千円/需要12%、賃貸800万円/6週/週4千円/外部賃料16%。工事中から維持費、地区全物件売却で休止、再取得で再開。既存開発との合算上限40%/50%。鉄道会社所有や最終必須項目は増やさない。
- `src/city/RailProjectVisuals.ts`：工事・稼働・休止と用途を3Dへ反映。4地区で16バッチ程度。App→CityViewのfocusRailDistrict、画質変更でも視点維持、街全体へ復帰。`docs/visual-preview.md` に実データ/再構築/架空を分けた閲覧案内。
- `src/sim/deals.ts`：v3提案IDに観測店舗数/客数/赤字店舗/観測週を固定、効果幅と実現効果を状態適性へ接続。旧v1/v2全84通りは0.3.2保存ソースとの完全一致を確認。保存はID厳格検証と提案/契約整合性を確認。
- `src/sim/campaign.ts` のgetCampaignCompletionを画面と検証で共用。直近決算と今週予測の双方が黒字。以前の画面だけ予測黒字で達成できた不一致を修正。沿線開発は必須にしない。

最終distは `game-2zeCc4xh.js` / `game-D4i7rWPz.css`。build・166unit/18files通過。DOMは戦略9項目・営業7項目、実3D近景移動6項目が成功。`docs/strategy-v4-playtest.md` / `sales-context-playtest.md` / `rail-visuals.md`。DOMのCityView stubを実描画や性能検証と混同しない。

通常操作の2seed×沿線なし/商業/賃貸の全6経路で完遂、922〜1,010週、保存往復一致。`docs/campaign-v4.md` / `campaign-v4-results.jsonl` が最新。大資金fixtureの二択比較と獲得資金だけの通常戦略を混同しない。最新の本番CSP・旧セーブ検証とWindows/Web ZIPの正確な結果は `docs/production-playtest.md` / `docs/windows.md` / `docs/web.md` を確認する。旧0.3.x配布物は保持。

最終本番CSP8項目成功、旧保存完全一致、エラー/外部通信0件。Web ZIP 65,745,987 bytes、SHA256 `1c482d964939f867c4c9ed5a0d8b1cf2f8719eb446e9a3fc6adeae7d26622cfc`。Windows ZIP 223,778,561 bytes、SHA256 `5f18bce4699b45a911e6c8b7de0fdcefb70d3b8d34ce3b68bb64afa618108de0`。すべてのCRCとdistファイルSHA一致を確認。Windows実機未検証。環境設定start_skillへ0.4.0再開手順を追加して保存成功、requires_publish=true。無制限通信と既存install設定を維持。

## 0.3.2の設計と実装

ユーザーの追加依頼により、街制作とは別にAstra3担当で成長体験・経営分岐・進行を相互検討。最小実装を新規出店に絞り、3形態の比較と出店記録→初決算→次の運営を接続しました。設計文書は `docs/design/README.md` を入口に3ファイル。IPOの代償・配当ゼロ優位・鉄道沿線効果・100件買収の単純反復など、残る課題も記録済みです。

- `src/sim/storePlanning.ts` は実際のopenStore操作を仮実行して同週を比較。UIは `StoreOpeningPanel.tsx`。借入一体実行は追加していない。
- `src/sim/openingJournal.ts` とGameStateのoptional `openingRecords` は最近40件。初決算を一度だけ接続。`OpeningResults.tsx` が週報・連続営業報告・経営記録に表示。
- 保存側は旧saveと端数現金に互換性を持ち、改竄・重複・未来週・矛盾した状態を拒否。開業後即閉店→同週再出店でも誤結合しない。
- 全114unitと新DOMブラウザー7項目が通過。CityViewを検査側でstubへ置き換えたDOMテストを3D性能検証と呼ばない。`docs/opening-playtest.md`。
- 最終dist: game-CvSXZNLx.js。0.3.2 Web/Windows ZIPは梱包検証済み。本番CSP全7項目も通過。最終結果は `docs/production-playtest.md` / `docs/windows.md` を確認する。

## 0.3.1からの追加事項

Blender 4.3.2で109/108とカフェを実編集し、ゲーム用GLBを `public/models/authored` に配備済み。モデルの共有・遅延読込・破棄を8ユニット＋8ブラウザー項目で確認。本番CSPは7項目通過。Windows/Web ZIPとソースのアーカイブを0.3.1として保持しました。次のゲーム設計変更でこの配布物を上書きしません。

- 109/カフェ比較HTML：`blender-polish/{109,cafe}/`。109は6、カフェは7検証項目通過。カフェHTMLだけ透明度近似、展示GLBとBlenderは物理ガラス。
- 実測都市Blender昼景：`blender-polish/real-shibuya/daylight.blend` と全景・109近景PNG。112メッシュ/92画像の元形状・画素保持。
- 配布：`Shibuya-Capital-0.3.1-web.zip`、`windows/Shibuya-Capital-0.3.1-win32-x64.zip`。詳細 `docs/web.md` と `docs/windows.md`。
- ソース保持：`Shibuya-Capital-0.3.1-source.tar.gz`。設計検討文書を除き、ゲーム設計変更前のsrc/public/tests/依存宣言を保存。
- ユーザーは街制作とは別にゲーム設計を2〜3名で議論するよう追加依頼。Astra3名で成長の気持ちよさ、資金調達等の分岐、30時間の進行を議論。今回の0.3.2では収益係数を変更せず、新規出店の予測→初決算→次の選択を実装。`docs/design/` を参照。

環境設定下書きには起動・検証・Blender手順を保存している。通信無制限と既存install_scriptを維持。下書きの保存と実行環境への反映は別で、環境設定の保存・Publishが必要。新規タスクでの復元は未検証。

## 現在のソース

- `/workspace/-`、バージョン0.4.1。旧0.4.0以下の配布物・ソースは別途保持。既存チェックアウトを使用し、追加worktreeなし。新規ゲームの多数の未追跡ファイルと、旧カードゲームの削除を保持する。
- React/Three/Vite、依存は `npm ci --include=dev`。`npm run dev` は5173。ゲームは `index.html`、独立した実測ビューアは `real-shibuya.html`。Viteは2つの本番entryをビルドする。
- 0.4.0の最終ビルドと全166ユニットテスト（18ファイル）が通過。旧0.3.2は114件。街区開発7シナリオ、市場買収7シナリオも過去に通過。市場DOMテストではCityViewを明示的に差し替える。3D検証とは区別する。
- 0.3.0のdistをdesktopと同じCSPで動かす製品版検査6項目が通過（0.3.1は上記7項目）。埋込写真のblob読込とdataフォント遮断をdesktop/main.cjsで修正。写真マップ20枚、地表72枚、WASM、フォント、週次保存・復元・実測ビュー往復を確認。JS/console/CSP/HTTPエラー・外部通信なし。ゲーム側のRAFをQAだけ200ms間隔にしてソフトウェアGPU負荷を抑えているため、性能ベンチマークではない。
- 完遂目標は上場＋既存8社＋市場100件すべて稼働＋4地区の全工程完成かつ稼働＋継続会社・現金非負・直近決算と予測の黒字。借入ゼロや実時間30時間の強制待機は要求しない。
- 市場100件は調査、独立/統合、準備費、稼働時期、景気・個別リスクとグループ費用を実装。95社・5REIT資産。参考株価とゲーム専用企業価値を混同しない。
- 0.4.0自動戦略2シード×3方針で922〜1,010週、全108件＋全地区を通常アクションと獲得資金で完遂。旧0.3基点は922/1,006週。実プレイ30時間を達成した証拠ではない。
- 週次保存・12世代復旧・JSON持出し・複数タブ保護。4/13週委任進行は毎週保存し、新提案/IPO/地区完成/沿線完成/取得事業稼働/破綻予測で止まる。

## 3Dと実写真

- 実測データは取得済み。以前のPLATEAU/公式109/Commons接続403は古い通信設定時の履歴。新設定で実際に取得できた。CKAN個別データセットページの403は別で継続。
- `public/models/real-shibuya` にPLATEAU渋谷区2025年度LOD2建物。20末端タイル、写真テクスチャ付き。`public/models/real-shibuya-ground` に国土地理院空中写真ズーム18・72タイル。
- `src/realcity` は独立ビューア。実際の建物配置を表示するが、地面は平面近似。経営マップの圧縮座標にはまだ統合していない。
- 109は2020年の高解像度接写・公式写真・2024年街路写真に基づき、細い円筒、深い吹き抜け、ガラス昇降塔、入口トラス、開放冠部を修正。現実の109表記は単体模型、ゲームでは108。
- QFRONT型ビルは実写真で曲面・斜材・透明店舗・鉄骨看板を修正。実在看板画像はゲームの素材に使わず、HOSHIなどの架空名。
- カフェは25枚収集・16枚を目視確認した研究を反映。灰色の控えめな看板帯、木製の軒裏、黒い庇、細い金属枠、透明な内装。実店舗そのものの実測復元とは呼ばない。
- `src/assets/fashion-campaign.png` はオリジナルの生成広告画像で、建物写真の証拠ではない。実写真とは別の素材。
- 出典、ライセンス、撮影日、ハッシュ：`docs/photo-references.md`、`docs/qfront-reference.md`、`docs/cafe-photo-study.md` と共有成果物の `references/`。

## 制作物と再生成

`/workspace/shared/shibuya-artifacts/` が成果物の置き場。

- `real-shibuya-viewer.html` 約83.2MB。20建物タイル・72地表写真・Dracoを同梱、3視点・明るさ。初回HTML以外のHTTPゼロを9項目で検証。
- `real-shibuya.glb` 65.7MB、`real-shibuya.blend` 48.8MB。92画像埋込、全画素の同一性と再読込座標を検証済み。
- `architecture/{109,cafe,qfront}` のGLB・Blender・近景PNG・単体HTML。`shibuya-city-viewer.html` は経営用の創作街区。
- 最新Windows ZIPは `windows/Shibuya-Capital-0.4.0-win32-x64.zip`（旧0.3.xも保持）。梱包結果は `docs/windows.md` と実際の検証JSONを確認。Linuxでの梱包検証はWindows実機確認ではない。

実行コマンド：

```sh
npm run build
npm test
python3 scripts/smoke-production.py
python3 scripts/smoke-development.py
python3 scripts/smoke-market-acquisitions.py
python3 scripts/smoke-architecture.py
python3 scripts/smoke-model-viewers.py
python3 scripts/smoke-real-city-offline.py
python3 scripts/export-architecture.py --asset all
npm run model:export
npm run model:viewer
npm run model:real-viewer
python3 scripts/export-real-city.py
blender -b -t 4 --python scripts/prepare-real-blender.py
python3 scripts/package-windows.py --output /workspace/shared/shibuya-artifacts/windows
```

GLB書出しでWebPがPNGへ変換されると450MB程度になる。`scripts/compress-real-glb.py` は元WebP画像と復号RGBAを照合して同一画像を再利用し、その他画像も画素同一の圧縮を行う。元写真を生成画像で置き換えない。

GPUを多用するSwiftShaderブラウザー検証は担当間で順番を調整。Blenderの多数並列レンダーも同じCPUを消費する。実際のモデル画像を目視確認し、画面起動だけで成功としない。管理ブラウザーのfile://制限は解除せず、単体HTMLの検証は同一ファイルを内部HTTPで行う。ユーザー向けlocalhostリンクは作らない。

## 残る中心課題

1. 人によるプレイで約30時間の楽しさ、難易度、IPO2〜3時間という中間目標を校正。自動戦略の操作回数を人間のプレイ時間に読み替えない。
2. 実測マップと経営区画・建設・所有モデルの統合。現状の別ビューアを統合済みと呼ばない。
3. 自由な道路/建設/鉄道敷設、実地形、海外都市。今は既存32区画＋4地区開発＋鉄道会社取得＋任意の駅周辺共同投資。
4. 実際の開示資料に基づく業種の収益校正。企業価値・利回り・品質はゲーム専用係数。
5. Windows実機起動、保存復元、Ryzen 5 PROでの描画性能。
6. 調査からの次の実装は、投資先を覚えたまま資金調達へ往復する導線、主要指標から詳細へ進める表示、配当の意味、取得100件の判断を保った反復削減。`docs/design/reward-review-v4.md` の既実装と提案を区別する。

環境の再利用手順は設定下書きにも保存済み。設定を反映するには環境設定の保存・Publishが必要で、新規タスクの復元が検証済みと称さない。
