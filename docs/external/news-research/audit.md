# pilot 出典・事実・短文 QA

QA担当が作者と独立して、2026-10-07 UTCに原資料をweb-openで再読。検索snippetだけを読んだ資料は合格にしない。以下の行番号はQAのweb抽出であり、PDFは物理ページも併記する。長文引用・記事画像・原資料本文の保存は行っていない。

基点: `12c375a2dab551c1511e00b2304e69027fdb0dc0`。ネットワークはenvironment_statusでunrestricted/enforced/currentを確認し、既存proxy/CA/TLSを保持。編集対象は本監査とvalidate.pyだけ。作者候補と編集JSONの訂正は各所有者へ通知した。

自動検証は必須項目、形式、日付、100銘柄との対応、名前/市場区分、ID/eventKey、正規化した短文、既存fieldの字句とファイル、候補/編集/pilot対応を検査する。既存fieldの意味や完全な型解決は行わない。機械合格は出典実読・事実確認・権利処理の確定ではない。entity名を置換した文字列一致とconfigured phrasing/flagsの検出は限定的で、意味的な重複・別表現の今週断定・事実誤認・著作権の法的判断を確定できない。下の独立読取と親レビューが別途必要。

短文は資料の見出しを社名だけ入れ替えるものではなく、実在企業の過去事例を経営上の選択として1〜2文にまとめた。原資料の一般公開は転載権の付与を意味しない。著作物の長文転載や画像は収集せず、事実抽出と独自表現・必要なURL参照に限定した。この点検は法的クリアランスの保証ではない。

|候補ID|原資料・QA箇所/方法|事実・予定実施・短文・重複所見/結果|
|---|---|---|
|nr-retail-property-mitsui-kadoma-hybrid-20230208|[三井不動産](https://www.mitsuifudosan.co.jp/corporate/news/2023/0208/) web-open L244–251,269,279,388–400|153+98=251、階別2業態、発表日と開業予定日が一致。初出店数の訂正注記を認識し候補は当該数値を除外。短文は開業計画と利用目的の構成を独自に表現。MUJI複合用途と類似するが商業2業態と宿泊運営の異なる選択。同一出来事ではない。確認済み。|
|nr-retail-property-muji-ginza-complex-20190228|[良品計画](https://assets.ryohin-keikaku.jp/news/2019_0228.html) web-open L4–7,59–100|4月4日予定、階構成、ホテルのUDS企画/内装/運営が一致。作者原稿『集めた』は実施済みに響くため作者/編集へ予定形の修正依頼、作者が『集める計画だった』へ修正済み。親子対応なしは既存universeに良品計画なしのため妥当。確認済み。|
|nr-capital-ma-basefood-ipo-20221115|[BASE FOOD](https://basefood.co.jp/news/1275) web-open L88–98|当日のグロース上場実施、主食商品の開発販売/事業拡大方針が一致。上場承認と実施を分離。短文に宣伝文句・見出し転載なし。別候補の混合調達と同社だが異なる出来事。確認済み。|
|nr-capital-ma-tsukuruba-ipo-20190731|[ツクルバ](https://tsukuruba.com/news/post-2230) web-open L4–19|7月31日上場実施、当時マザーズ、cowcamoとシェアードワークプレイスの事業説明が一致。現在のGrowth stock区分を当時市場名に書き換えていない。BASE FOOD IPOと資本政策は同じ分類だが主体/事業/日付が異なる。確認済み。|
|nr-retail-property-uniqlo-maebashi-energy-20230419|[ユニクロ](https://www.uniqlo.com/jp/ja/contents/corp/press-release/2023/04/23041913_store.html) web-open L4–23,26–42|発表4月19日と開業4月21日予定、省エネ設備/認証を再読。太陽光の本文15%と設備表約3分の1は母数表現が異なり、候補で比率不採用は妥当。実測省エネ成果の断定はできない。短文は設計選択として独自化。確認済み。|
|nr-retail-property-mec-tokiwabashi-office-20210719|[三菱地所PDF](https://www.mec.co.jp/news/archives/mec210719_tokiwabashitower.pdf) web-open/pdf-text PDF1–4頁 L34–40,54–69,93–131|竣工6月30日実施、9割テナント決定、2共用階が一致。カフェ8月中旬/9月開業予定を竣工と区別。短文は共用空間の配分、occupancyは契約決定比率と同一視不可。門真/MUJIとは物件と選択が異なる。確認済み。|
|nr-capital-ma-basefood-equity-loan-20220223|[BASE FOOD](https://basefood.co.jp/news/940) web-open L85–99|増資10億円/融資契約10億円/計20億円、商品改良・開発・採用目的が一致。本文に締結・入金日なし、eventDate nullは適切。借入と増資を混同せず、短文は資金手段の選択を独自に説明。IPO/商品発売とは別時期・別判断。確認済み。|
|nr-capital-ma-softbank-bond-decision-20240301|[ソフトバンクグループ](https://group.softbank/news/press/20240301) web-open L139–177|発行決定3月1日、5,500億円/年3.04%/7年/主に個人/払込予定3月15日/国内社債償還資金が一致。払込完了・設備投資を断定しない。銀行Loanと社債を同一機能に扱っていない。独自短文の借換目的は原資料に沿う。確認済み。|
|nr-retail-property-nbf-toranomon-land-retention-20240712|[日本ビルファンドPDF](https://www.nbf-m.com/file/news-40d139d382779b83439448be7e4540aa2a81b681.pdf) web-open/pdf-text PDF1–4頁 L15–36,43–79,123–162|建物受益権のみ譲渡決定、土地継続保有、築61年・4案比較、50年借地契約・優先交渉権が一致。譲渡予定2025年1月6日/将来取得を完了実績にしない。短文は築古保有の選択を独自化。REIT区分はSTOCKSと一致。確認済み。|
|nr-retail-property-arealink-storage-expansion-20250304|[エリアリンクPDF](https://www.arealink.co.jp/wp-content/uploads/2025/11/03d312a5ebd19ba5884ac522f5d79e52.pdf) web-open/pdf-text PDF1–2頁 L0–23。[公式リンク元](https://www.arealink.co.jp/news/pr/p14290/) L426–431からPDFリンクclick|直接openの初回Internal Errorを記録。リンク元→PDF clickで正常に本文実読。新規10,545室/2024年末110,442室、地域39.7/19.5/15.2%、種別82.6/11.1/6.3%が一致。2025年1月総111,331室と年末値を混ぜない。年間集計ゆえeventDate null。編集の『増やし』は純増誤読として別担当が指摘し『新規出店』へ修正。確認済み。|
|nr-capital-ma-sony-bungie-completion-20220715|[Sony IR PDF](https://www.sony.com/en/SonyInfo/IR/news/20220715_E.pdf) web-open/pdf-text PDF1頁 L0–22|SIE完全子会社、Bungie100%取得完了、米PDT7月15日、約37億USDは取得価格+約束された従業員インセンティブ込み、前倒し完了で当期費用見通し再評価が一致。1月発表額から代入しない。独自短文は英語原資料の事実を日本語で説明。NLG契約報告と段階・狙いが異なる。確認済み。|
|nr-capital-ma-nintendo-nlg-contract-20210105|[任天堂IR PDF](https://www.nintendo.co.jp/ir/pdf/2021/210105.pdf) web-open/pdf-text PDF1頁 L0–20|全株取得の契約締結報告、ルイージマンション開発経験、安定資源確保/連携の狙い、3月1日実行は当局承認等が条件の予定と一致。正確な契約日不明のnullは妥当。取得完了や承認済みとは書かない独自短文。確認済み。|
|nr-rail-city-setagaya-renewable-operation-20190325|[共同発表PDF](https://www.tokyu.co.jp/image/news/pdf/20190325-1-1.pdf) web-open/pdf-text PDF1–2頁 L0–14,36–46。補助[東急環境ページ](https://www.tokyu.co.jp/railway/company/environment/consumer/) web-open L116–122|水力/地熱による世田谷線通年全列車の運行、3月25日開始発表と後年開始実績が一致。2019年列車と2022/2023年全線・駅舎拡大を分離。全電力網の物理供給や全活動のゼロ排出を断定しない。短文は運営変更の事例。確認済み。|
|nr-rail-city-shinyokohama-line-opening-20230318|[東急決算PDF](https://ir.tokyu.co.jp/ja/ir/news/auto_20230511566472/pdfFile.pdf) web-open/pdf-text PDF1頁 L0、21頁 L690–709。補助[公式路線史](https://www.tokyu.co.jp/railway/train-history/sh/) web-open L638–664|発表資料日5月12日（URL5月11日とは別）、3月18日開業実施、日吉～新横浜5.8km、相鉄との接続実施が一致。輸送/収入見込みを成果として抽出していない。短文はネットワーク接続の判断。確認済み。|
|nr-rail-city-shibuya-saikyo-plan-announcement-20200218|[JR東日本発表PDF](https://www.jreast.co.jp/press/2019/tokyo/20200218_to04.pdf) web-open/pdf-text PDF1頁 L0–16,58–66|2月18日発表、5月29日22時～6月1日4時予定/悪天候7月延期、約350m北へ移設・改札直結、5月30/31日運休計画が一致。eventDateは発表日で実施完了を立証しない。山手線候補と同じ渋谷改良だが別線路・別工事段階。確認済み。|
|nr-rail-city-shibuya-yamanote-platform-unification-20230109|[JR冊子7/16頁](https://www.jreast.co.jp/recruit/ebook/creating/pageindices/index7.html) web-open L5。補助[事前PDF](https://www.jreast.co.jp/press/2022/tokyo/20221018_to02.pdf) PDF1頁 L0–10,45–52、[後年改良事例](https://www.jreast.co.jp/esio/our-works/project02.html) web-open L20,46–48,58|冊子のホーム拡幅2023/1/9と後年第3/4回同一化実績が一致。事前PDFは1月7/8日外回り運休・第4段階予定として区別。公開日nullは妥当。埼京線候補は計画/並列化、こちらは山手線共用化の実施、同一イベントの水増しではない。確認済み。|
|nr-food-doutor-price-revision-20241212|[ドトール発表](https://www.doutor.co.jp/news/newsrelease/detail/20241127100901.html) web-open L15–30。補助[DNH関係会社](https://www.dnh.co.jp/company/group/) L68–70|11月27日発表/12月12日一部改定予定、税込250→280/340→380、原材料・人件費・物流・為替理由が一致。DNH連結子会社対応を再読。短文はコスト増対応の選択で宣伝見出しや値上げ実施報告に変更しない。確認済み。|
|nr-food-doutor-coffee-lineup-20250725|[ドトール発表](https://www.doutor.co.jp/news/newsrelease/detail/20250709171732.html) web-open L15–35。補助DNH上記L68–70|URL日付から推測せず本文7月11日発表/25日予定。深煎りケニア/グアテマラ導入とブラジル/コロンビア在庫終了条件が一致。短文は商品入替と在庫切替、価格改定と別の判断。確認済み。|
|nr-food-basefood-yakisoba-launch-20250116|[BASE FOOD発表](https://basefood.co.jp/news/2120) web-open L88–110,149–154|1月9日発表/国内16日順次/香港23日予定、旧PASTA12月終売、穀物配合・麺形状変更、EC12個→4個が一致。宣伝上の健康効果や喫食評価を追加していない。短文は商品設計/販売単位/地域順序。IPO/調達による成果の因果を創作しない。確認済み。|
|nr-food-komeda-is-higashiginza-20200715|[コメダ発信@Press原稿](https://www.atpress.ne.jp/news/218193) web-open L8–19,41–44。補助[コメダHD会社概要](https://komeda-holdings.co.jp/company-profile/) L114–125|7月9日発信/15日開業予定、植物原料/フード34・デザート8の共同開発/飲料の説明が一致。@Pressはコメダ名義の企業発表で報道記者記事とは区別。HD持株会社対応も実読。短文予定形修正を他担当が依頼し編集版で保持。MUJI銀座は別主体・別用途。確認済み。|
|nr-food-komeda-tokyobay-opening-20251030|[コメダFCサイト](https://fc.komeda.co.jp/information/461/) web-open L12–34。補助コメダHD上記L114–125|10月30日開業実施、入口横/北館1階/船橋市、新規加盟オーナー初出店が一致。HD=個店所有者と断定しない。門真と別施設・別年。短文はFC主体を維持。補助日付表示が作者とQA取得で1日揺れたため公開日null理由を安定した記述へ作者修正済み。確認済み。|
|nr-food-komeda-fy2025-results-20250409|[会社作成短信13頁版](https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20250409/20250408510776.pdf) web-open/pdf-text PDF1頁 L2–19,71、4頁 L119–166。補助[Daiwa配信2頁版](https://www.daiwair.co.jp/td_download.cgi?c=3543&i=2963606) PDF1頁L2–19,71|2024/3/1–2025/2/28の連結実績、47,057百万円+8.8%/営業8,820+1.2%/親会社帰属5,814−2.6%が一致。当期利益全体−2.7%と区別。店頭4月/FC卸9月改定、グループ1,083/直営内数60も一致。年度連結を今週カフェ利益や全店直営にしない。独自短文は指標差を説明。確認済み。|
|nr-rail-city-takanawa-stage-opening-20250327|[JR東日本説明PDF](https://www.jreast.co.jp/investor/guide/pdf/202503guide3.pdf) web-open/pdf-text PDF1頁 L2、66頁 L2462,2496–2501。補助[2024年事前PDF](https://www.jreast.co.jp/press/2024/20241030_ho02.pdf) PDF1頁 L1–16|4月30日資料のTHE LINKPILLAR 1の3月27日まちびらき実施と、商業/ホテル・他棟の段階開業予定を分離。補助資料の車両基地跡地/駅直結も一致。2026年春予定や通常稼働時収益を実績にせず、大規模開発の段階起動を独自表現。確認済み。|
|nr-rail-city-minamimachida-station-service-change-20191001|[東急100年史9-3-1-4](https://www.tokyu.co.jp/history/chapter09_3_1/) web-open L171–176。補助[事前PDF](https://www.tokyu.co.jp/image/news/pdf/20190807-3-1.pdf) PDF1–2頁 L0–9,23–35|2019/10/1駅名改称/田園都市・大井町ダイヤ実施/全日の全急行停車が一致。11/13の街まちびらきへ先行した予定は補助資料で一致。駅舎リニューアル日を改称日と同一化せず、短文は到着経路の先行整備。公開日nullは妥当。確認済み。|

## 実行記録

親へ通知し、軽いPython 1 workerで実行。全体test/build/公開は実施していない。

- `python3 scripts/external/news-research/validate.py --self-test`: PASS。正常fixture受理、出典欠落/未来日/未知stock/同一文の社名差替え/未記録活動の今週断定/snippet verified/未知fieldの7例を実際に拒否。
- 初回 `python3 scripts/external/news-research/validate.py --partial`: 16候補、FAIL 7。4件はsourceFileの複数path表記を検証器が扱わなかったため、`;`分解と全参照ファイルの字句照合へ修正。1件は編集sourceFileとnews field不一致を編集担当へ通知。2件は進行中編集ファイルのID不足。最終版を再実行する。
- 中間partial: 22候補、FAIL 19。うち17はsourceFile/参照名の不整合で作者・編集が定義位置modelと利用位置simを明示して修正、2は編集中のID不足。次回24候補でFAIL 2は編集中22/24のID不足のみ。
- 編集24件完成後 `python3 scripts/external/news-research/validate.py --partial`: PASS 24 candidates / 100 STOCKS。候補・短文・タグ各24件のIDが1対1、ID/eventKey/正規化短文に重複なし。
- 最終検証器版 `python3 scripts/external/news-research/validate.py --self-test`: PASS。正常候補とhold保持fixtureは受理、7不利なfixtureに加えholdをpilotに含める8番目のケースを適格性guardで拒否。editorは全候補1対1を維持し、final pilotはverified/historical-reference/runtimeEligible falseの適格候補集合のみ照合する。

24件すべての主原資料と、候補が列挙する補助原資料をQAが独立再読した。原資料のfactsと日付根拠に未解決の不一致は残っていない。凍結されたshortforms/context-tags各24件をQAが全文再読し、上の事実範囲・予定/実施・主体・独自表現を確認した。Sonyの再評価時制、MUJI/東銀座の予定形、エリアリンク新規出店数の訂正を最終ファイルで確認した。

既存モデルの意味は`src/model.ts`、`src/sim/weeklyNews.ts`に加え、`openingJournal.ts`、`engine.ts`、`railProjects.ts`、`development.ts`、`marketAcquisitions.ts`、`marketBusinessMath.ts`の関連実装をQAが読取照合した。OpeningRecord判断時の値はpreview、resultのみ初回実決算。IPO/増資・売却には専用週次履歴なし。開発/沿線のcompleteWeekと保存headlinesの一致、marketOperationの該当週比較、readyWeekの事業運営開始、傘下収益と配当の二重計上禁止、自社利用区画の追加賃料除外を文脈タグで保持している。素材取得と条件適合を同一視するタグはない。

意味重複は全24件を横断比較した。同社別事例（BASE FOOD IPO/混合調達/焼そば、ドトール価格/豆、コメダ新業態/FC開業/年度連結）と同地域別工事（渋谷埼京線/山手線）は出来事・段階・判断が異なる。2件IPOは同じ政策分類として認識し、異なる資本手段として数えていない。現在の24件に同一出来事の社名差替えや単なる言い換えによる水増しは見つからない。

親の最終組立・検証報告を2026-10-07 UTCに受領した。`python3 /tmp/news-research-assemble-20261007T054410Z.py`で各分類6件・計24件を組み立て、主資料24 URL、補助9 URL、合計33 unique URL、hold 0件、runtimeEligible 0件を確認したとの報告。`python3 scripts/external/news-research/validate.py --self-test`は正常/hold保持の受理と8 adversarialケースの拒否でPASS、`python3 scripts/external/news-research/validate.py`は`PASS: 24 candidates; 100 STOCKS match market-universe; mode=final`、いずれもexit 0。これらの最終コマンドは親が実行し、QA担当の再実行と区別する。

QA担当は完成した`pilot.json`のroot/reviewSummaryと全24件の短文・分類を再読した。runId/baseSha、分類別6件、資料数24+9、独立再読24件、全件historical-reference/runtimeEligible false、候補・編集稿の訂正反映が一致する。公開日/実施日不明の理由付きnull、主補助資料の保持、予定と実施の区別に追加の修正事項はない。候補・編集稿・最終pilotの本QA監査を完了し、本監査と検証器を凍結する。開発親の品質レビュー待ちというpilot statusを維持し、runtime統合、merge、公開、実機動作、法的権利クリアランスはこのQAの確認対象外。

## 開発親による独立レビュー追補（2026-10-07 UTC）

**ACCEPT：24件を過去の参考素材として採用。runtimeの今週活動への組込みはHOLD。** 開発親の別担当が、PR #7 head `b5bd20836400e002881daa73609ebfaffcb15bc9` の全24短文・facts・対応候補・保存文脈を読み、現行100銘柄と関連モデル/週次ニュース実装を照合した。対応22件は13既存銘柄に結び付き、無対応2件を架空IDで埋めていない。IPO2例は同じ政策分類で、同社別事例・渋谷別工事は時点と判断が異なる。値上げ予定/実施、FC/直営、連結指標、融資契約/入金、取得契約/完了の区別に新たな事実誤りは見つからなかった。これは下記4代表資料の独立実読と、外部作者/QAが全24件を再読したという上の記録を区別した結論である。

| 独立取得した代表資料 | 親が本文から確認した点 |
| --- | --- |
| ドトール2024-11-27公式価格改定記事 | 翌12月12日の予定、一部商品、原材料・人件費・物流・為替などの理由。税込数値はHTML本文にはなく、公式価格一覧PDF物理1頁のS列で250→280、340→380を追加確認した。 |
| 三井不動産2023-02-08門真発表 | 4月17日開業予定、階別に2業態を組み合わせる構成、153＋98＝251店。初出店数の訂正注記を確認し、短文へ当該数値を付け足していない。 |
| 東急100年史・南町田 | 2019-10-01改称とダイヤ改正、平日・土休日の全急行停車、11月まちびらきへの先行実施。 |
| Sony 2022-07-15取得完了PDF物理1頁 | SIEのBungie100%取得完了、約37億USDに従業員インセンティブを含むこと、早期完了による当期買収費用見通しの増加と当時継続中の予想影響評価。 |

取得は既存proxy/CA/TLSを保持したstdlib HTTPS GET。HTMLはHTMLParserの可視本文、PDFはpdftotextのメモリ入出力で確認し、本文・画像をファイルへ保存していない。4主資料＋追加価格表はHTTP200。Sonyの追加確認で標準User-Agentの1回が403になったが、同じHTTPS設定の明示review User-Agentでは初回・再確認とも200で取得できた。字句チェックの`re-evaluating`は原文が「継続して影響を評価」の表現なので一致しないが、実際の本文を読んで短文の意味を確認した。検索snippetだけの確認ではない。

価格PDFをfood候補とpilotのsupportingSourcesへ追記し、sourceLocationを公式記事と添付価格表で分けた。PDF自体の掲載日不明は理由付きnullとし、記事日付で補完しない。現在の導出集計は24主資料＋10補助＝34固有URL。上の当初33 URLという作者/QA報告や当時の実行履歴は書き換えていない。短文24件・runtimeEligible false・保存/株価/経済実装を変更していない。

親のサンプル証拠は `coordination/review-20261007-wave1/news-qa/`、別レビューは `/tmp/shibuya-news-pilot-parent-review.md` に保存。出典全34 URLの親による再取得、法的クリアランス、native動作、数百件の均質性を保証するレビューではない。

追補後に開発親の別担当が1 CPUで `python3 scripts/external/news-research/validate.py --self-test`（正常/hold受理、8不利ケース拒否）と通常final検証（24候補・既存100銘柄一致）を実行し、両方PASS。変更4文書のdiff whitespace checkもPASS。原PRとの比較で全24短文・分類・runtime falseの保持を確認した。

## 開発親による80件統合レビューと出典復元（2026-10-07 UTC）

PR #11/#12の新28件ずつとPR #13のcatalog80件を指定headで取得し、親が新56件のfacts・短文・会社対応・保存文脈を全読した。各PRの添付validatorは1回ずつ試行し、11/12はPASS、13は初回ドトール価格改定1件のsourceLocation/supportingSources脱落（canonical/catalogの計4エラー）でHOLDとした。初回24件の親補強は原PRの基点12c375aより後であり、作者の元の監査を誤報へ書き換えない。

親は代表的な新資料5件（アクシーズ決算、コパのTikTok販売提携、ラサール北柏冷凍冷蔵増築、アクセルスペースのシリーズD、JR東日本羽田アクセス線）を普通HTTPSで本文/PDF実読し、数値・主体・予定/実施を確認した。作者班の全80資料再読報告と、親の今回5資料サンプルを区別する。本文・画像は保存せず、URL/応答/SHA/自作所見は別証拠に残す。

統合後、既存pilotから価格PDFのsupportingSourcesとsourceLocationをcompany40/catalog80へ復元した。現在は主80固有URL＋補助19固有URL、両区分間の重複1 URLを除きdistinct98 URL（補助参照箇所は21）。作者提出時の主80＋補助18・distinct97 URLという記録と元検査/hashは履歴として保持し、親補強後の集計/検査を追補として区別する。80件の短文・facts・分類・runtimeEligible false、既存100銘柄・経済・保存・株価は変更していない。

初回判定、独立5資料の実読箇所、修正後の検査結果と最終判定は [news-wave2-v090.md](../internal-qa/news-wave2-v090.md) を参照。原資料全件を親が再取得した、法的権利審査やnative動作を完了した、今週の他社活動へ組み込んだという意味ではない。
