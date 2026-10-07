# ニュース追加PR11–13 親側独立レビュー

2026-10-07 UTC。指定headのGitHub API差分とraw実データを取得し、現在のgame-sourceのpilot24件と比較した。公開freeze中のsrc/public/dist/docsは編集・checkout・mergeしていない。資格情報の表示、TLS/proxy設定変更、ブラウザ/GPU/広範囲テストは行っていない。

## 採否

| PR / exact head | 判断 | 根拠と必要な対応 |
|---|---|---|
| [11](https://github.com/shirai0765/-/pull/11) / `91c5a8410c1cb40fdbe5b4c5c5d8df42b3279947` | **ACCEPT：歴史資料** | 新28件、作者snapshot→編集短文→保存文脈が一致。添付validatorを現pilot24/100stockに対し1回実行しPASS。 |
| [12](https://github.com/shirai0765/-/pull/12) / `e6ab82a9b9e864c0f9599f1fdfc22b103e619a80` | **ACCEPT：歴史資料** | 別の新28件。予定、契約、開業、連結/部門業績と主体を分離。添付validator1回でPASS。 |
| [13](https://github.com/shirai0765/-/pull/13) / `336655294e89c7ce06e107a322621470c104a742` | **HOLD：統合時の1件出典補強脱落** | `nr-food-doutor-price-revision-20241212` の `sourceLocation` と `supportingSources` が、親が既に補強した現pilotと異なる。canonical company-news-wave1.jsonとcatalog.jsonに公式価格PDF `https://www.doutor.co.jp/news/2024priceDCS.pdf` と現pilotの箇所説明を復元する必要がある。添付validator1回はこの2欄×canonical/catalog＝4エラーでFAIL。他23初回レコードは完全一致。修正・集計再生成・再検査は親統合作業。 |

全80件を**今週の独立他社活動・株価因果として自動発生させる採用はHOLD**。現在の分類は全件 `historical-reference`、`runtimeEligible:false`、root `runtimeIntegration:false` であり、そのまま維持する。作者の「全80資料を独立再読済み」は作者班の監査報告であって、親側が80資料を再取得したという意味ではない。

## 構造・内容の照合

- 初回24＋新28＋新28＝80。ID80/80、eventKey80/80、短文67–130文字。food25、retail-property27、rail-city10、capital-ma18。正式canonicalはcompany40＋property/rail/capital40。PR13に含む両batch14ファイルはPR11/12とbyte一致し、ニュースを二重計上していない。
- 78件が現在の100stockのうち31銘柄へ対応する。MUJI/UNIQLO2件は対象銘柄が無いため無理に対応させていない。旧社名「雪国まいたけ」→現在のユキグニファクトリー、APのFC運営者FOOLISH、KRフードサービス、東急電鉄、JRC C&M等は直接会社/親/子会社/第三者の区別を保持。対応は資料索引であり、現ゲームの買収/利益を変更しない。
- 新56件すべてのfacts・短文・経営判断・会社対応・保存文脈を親側で読取。値上げ、閉店跡地FC転換、既存店メニュー転換、限定催事、EC統合/旧ポイント廃止、卸先portal、ライブ販売、法人納入、系列整理、設備費分担、持分段階譲渡、TOB終了/未決済、合併効力、借入枠、列車増結、休止線再利用等の違いがある。同種IPO4件は別企業/別日の事例であり、4種類の資本手段とは数えない。BASEFOOD9件/TENTIAL6件など集中はあるため、表示時は同銘柄・同テーマの連続を避ける編集が適切。
- 文面は会社名だけを置換した記事転載ではなく、原事実から作った短い要約。商品説明の健康/快眠効果や予想利回りを確定利益にしていない。実文章から見た独自性判断であり、全原資料との法的な権利審査を完了した保証ではない。原記事・画像は同梱されていない。
- ISO日付とsource/publisher/read/location/schemaを機械確認。不明の掲載日・実施日には理由付きnullがあり、HTML更新日や「7月上旬」を架空の特定日にしていない。将来の発売終了/2031年度開業は発表時の計画として明記。`GameAction`を保存履歴、現在listedをIPO発生週、現在所有を取得週、開発完成を実際の旅客線開業とみなさない限界が各contextにある。
- 現PR13の由来集計は主80＋補助18、distinct97 URL。既存価格PDFを復元すると主80＋補助19、distinct98 URLになる。作者による当時の97 URL読取報告は日付付き履歴として保持し、親補強後の派生集計を別途追加すべき。

## 親側の今回の一次資料sample（5件）

普通HTTPS GET、環境のproxy/CA/TLSを保持。HTML可視本文/PDF stdin→pdftotextを実読し、本文はメモリのみ。保存物はURL・応答・SHA・自作所見。初回取得の出力回収漏れにより同5URLを再取得し、ラサール/JRは日付・契約・認可の1頁確認を追加した。別経路によるアクセス制限回避は行っていない。全応答200。

| 新業種/資料 | 実読箇所と確認した事実 | 判断 |
|---|---|---|
| 食品製造/外食：アクシーズ [2025年6月期決算](https://www2.jpx.co.jp/disc/13810/140120250807535495.pdf) | 19頁PDFの物理1頁（2025-08-08、連結264億26百万円/営業21億21百万円/純17億20百万円）と4頁（食品部門利益+62.3%、外食は増収でも人件費等で利益−16.5%）。連結とセグメントを混同しない。 | 短文/facts一致 |
| 実演販売/小売：コパ [TikTok Shop提携](https://www.copa.co.jp/news/370/) | 2026-04-17本文・提携内容。生活雑貨に限定、コパ実演士が配信、ライブコマース社がショップ運用/制作/管理等を支援。共同事業の開始方針と将来の目的を実績増益にしない。 | 一致 |
| 物流REIT：ラサール [北柏冷凍冷蔵増築](https://lasalle-logiport.com/file/news-77f7de0ea0fd99f0dccf9b22ee4d2ed49988b026.pdf) | 8頁PDFの物理1–2頁。2023-03-29決定/工事契約、発表時未着工、2024年4月下旬引渡予定。冷凍冷蔵設備は賃借人、断熱設備は投資法人。 | 一致 |
| 小型衛星/資本：アクセルスペース [シリーズD](https://www.axelspace.com/ja/news/seriesd/) | 2023-12-21本文。HDが第三者割当約62.4億円、累計equity約143億円。100%子会社の衛星増強/開発・運用サービスは資金使途の今後の方針。 | 一致 |
| 鉄道/設備再利用：JR東日本 [羽田アクセス線](https://www.jreast.co.jp/press/2023/20230404_ho03.pdf) | 4頁PDFの物理1/3頁。2023-04-04発表、1/31施設変更認可・3/24工事施行認可は取得済み、6月着工/2031年度開業は目標。休止中大汐線の既存橋等を調査し改修する計画。 | 一致 |

## 検査の範囲と採用後

添付ツール `validate-wave.py` は静的に読取専用/stdlibと確認し、3PRとも**各1回だけ**試行。無応答なし。共通script SHA256 `95d17c743422ea4f839713202bae29ebda93030bddf5352f34348c4b208f494a`。実コマンド・exit/stdout/stderrは `validator-attempts.json`。追加self-testや広範囲テストは実行していない。

最小の次作業はPR13の2出典欄復元と派生集計更新。現在の実ニュースと混同しない「過去の経営事例」素材として、出典リンクと現実日付を保持したcatalogを利用できる。ゲームへ表示する際は保存済み自社行為/決算に関連する参考例として選び、SKU/FC/TOB/融資枠など未実装の活動を起こした扱いにしない。既存100stock/株価RNG/経済/セーブを変更する必要はない。新機能・指数・依存の追加をこの資料採用条件にしない。

## 統合後の修正と最終判定（2026-10-07 UTC）

**PR11・12・13：歴史資料としてACCEPT。PR13の出典脱落HOLDは解消。今週の独立他社活動へのruntime転用は引き続きHOLD。**

親が指定headを統合した後、既存pilotのドトール価格改定レコードから `sourceLocation` と `supportingSources` をcompany40/catalog80へそのまま復元した。公式価格一覧PDFの掲載日は理由付きnull、物理1頁の根拠と実読方法を保持する。80件の短文・facts・event/stock対応・runtimeEligible falseは一切変更していない。補助出典は参照21箇所・固有19 URLであり、主80固有URLとの重複1 URLを除いた現在の派生集計はdistinct98 URL。元作者の80＋18/97 URLの監査・checks/hashesと、本レビュー当初の4errorsは履歴として保存している。

修正後、既存pilotと両batchを含む統合catalogの添付validatorを**1回だけ**実行し `PASS: 28 batch/80 cumulative candidates; 100 STOCKS match market-universe; mode=final`（exit0）。scriptは不変更、追加self-test・fullsuite・nativeは実行していない。成功証拠は `/tmp/shibuya-news-wave2-review/repair-validation.json`、旧失敗は同ディレクトリの `validator-attempts.json`、正確なURL/参照数は `repair-source-counts.json`。repoの `validation-wave.json` に親の追補を追加し、作者の元検査記録を保持した。

README/catalog集計と監査追補を更新した。src/public/dist、株価RNG・経済・保存・runtimeは変更していない。次の利用は出典・現実の日付付きの過去経営事例として、実際に保存された自社決算/判断に関連する素材を選ぶ範囲に限定する。未保存のFC/SKU/TOB/未実行融資枠を今週の活動へ補完しない。commit/pushは開発親が行う。
