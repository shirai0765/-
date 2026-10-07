# ニュース素材調査 pilot

実際に読めた過去の公開資料を、親の採否レビュー向けにまとめる。基点は `game-source` の `12c375a2dab551c1511e00b2304e69027fdb0dc0`。ゲームへの組込みはこのPRの範囲に含めない。

## 分担と形式

調査4担当は各 `candidates/<category>.json` のみを編集する。category は `food`、`retail-property`、`rail-city`、`capital-ma`。各6件を目標とする。編集担当は `shortforms.json`、`context-tags.json`、QA担当は `audit.md` と `scripts/external/news-research/validate.py` のみを編集する。親が receipt、README、pilot.json、Git/PR操作を所有する。孫agentは使わない。

候補ファイルのrootは `{"schemaVersion":1,"category":"food","candidates":[...]}`。各候補の必須fieldは次のとおり。

| field | 形式・意味 |
|---|---|
| id | `nr-<category>-<entity>-<event>-<YYYYMMDD>` 等。小文字英数字とハイフン、同じ出来事に固定 |
| eventKey | 同一出来事を識別する小文字英数字・ハイフンのkey。categoryをまたぐ重複も束ねる |
| category | 所有ファイルのcategory |
| realEntities | 実在の企業・施設名の文字列配列 |
| eventDate | 資料で確認できる出来事の日付 `YYYY-MM-DD`、不明はnullと `eventDateNote` に理由 |
| eventDateNote | 日付の根拠・予定と実施の区別。nullの日付には理由必須 |
| sourceURL / publisher | 読んだ原資料のhttps URL / 発行主体 |
| publishedDate | `YYYY-MM-DD` またはnull。推測禁止 |
| publishedDateNote | 日付の掲載箇所。不明なら理由 |
| accessedDate | 実読したUTC日付 `YYYY-MM-DD` |
| sourceLocation | 原資料中の章・見出し・PDFページ等。本文転載せず特定できるもの |
| sourceRead | `{"method":"web-open または https-get/pdf-text 等","status":"verified","notes":"実際の読取結果"}`。snippetのみはverified不可 |
| supportingSources | 任意。主資料以外から確認した事実・実施日・親子関係がある場合は `sourceURL, publisher, publishedDate, publishedDateNote, accessedDate, sourceLocation, sourceRead` を各資料に記録する |
| facts | 原資料で確認した事実の文字列配列。発表・予定・実施を区別し、数字を推測しない |
| managementChoice | 出店形態、商品戦略、複合開発、資本政策などこの事例で比較する選択 |
| authorWrittenBrief | 実在企業の過去事例として書いた、自作の日本語1〜2文。見出し転載・社名差替え不可 |
| parodyEntities | `[{"stockId":"jp-3543","gameName":"コモレビ珈琲","realName":"コメダホールディングス","relationship":"direct / subsidiary / parent-group","note":"対応の根拠"}]`。既存STOCKS/market-universeだけ使用。対応なしは空配列 |
| relevantExistingSavedEventContext | `[{"tag":"store-opening等","sourceFile":"src/model.ts等","existingFieldOrEvent":"OpeningRecord.decisionWeek等","rationale":"参考になる場面","limitation":"保存内容が立証する範囲と不足"}]` |
| displayClassification | 全候補は `historical-reference`、未確認・矛盾は `hold` |
| runtimeEligible | false。素材を得たこととruntimeの今週実績が適合したことは別 |
| unverifiedReason | 確認済みはnull、holdは理由 |

sourceLocationとsourceRead.notesには該当箇所を自分の言葉で記す。本文や画像を保存しない。アクセス不能や記憶だけの資料はholdとしてpilotから外す。先の日付を実績にしない。企業別名と事実の主体は分ける。同一開発の別期・施設を複数担当で集める場合はeventKeyで通知し、重複を親が除く。

編集ファイルは `{"schemaVersion":1,"records":[...]}`。shortformsのrecordは `candidateId, authorWrittenBrief, displayClassification, runtimeEligible, editorialNotes`。context-tagsのrecordは `candidateId, relevantExistingSavedEventContext, contextNotes`。候補IDと1対1で対応させ、原候補は変更しない。

文脈の根拠が型定義と実装にまたがる場合、sourceFileはセミコロンで複数pathを列挙できる。検証器は参照した全ファイル内の識別子を字句照合する。型やfieldの意味・記録時点・関連の正しさは編集者とQAがコードを読んで確認する。

最終pilotのrootは `schemaVersion, runId, baseSha, reviewedAt, status, runtimeIntegration, records, reviewSummary`。親が候補を編集原稿とタグで組み立てる。statusは `awaiting-parent-review`、runtimeIntegrationはfalse。出典の確認はQAの実読所見をaudit.mdに残し、自動schema合格とは区別する。

## 保存済み実績との関係

現行の `OpeningRecord` は自社の開業判断と初回決算、`WeeklyReport` は確定決算を記録する。`GameState.listed` 単独では今週IPOの証拠にならない。`marketAcquisitions.companies` は自社傘下、独立他社の活動ログではない。沿線や街区の素材は既存development/railProjectsとニュースの保存済みheadlinesを読むための参考に限定する。独立他社の新店・新商品・M&Aを株価から推測しない。旧セーブへのニュース補完、将来利益の予測、グループ収益の二重計上は行わない。

## 検証

Python標準libraryだけの `scripts/external/news-research/validate.py` を親の窓口で実行する。全体test/build/公開は開発親が所有する。この班のfocused CPUは同時最大2worker。実行コマンドと結果、出典別の事実・短文・重複レビューはaudit.mdに記録する。

```bash
python3 scripts/external/news-research/validate.py --self-test
python3 scripts/external/news-research/validate.py
```

途中は `--partial` で既存候補と編集の対応を検査できるが、最終件数やpilot完成を保証しない。`hold` は候補・編集に保持できるがpilotには含めない。final検証は20〜30件の適格候補、編集稿・文脈タグ・原資料の対応を確認する。自動検証は出典の実読・意味重複・事実や権利の判断を確定しないため、audit.mdを併読する。

## レビューと引継ぎ

受領は [PR #2](https://github.com/shirai0765/-/pull/2)。6担当をGPT-6.1 Sol/high/fork noneで実起動し、開始時に親を含めrunning 7体を確認した。希望の親モデルと実行情報から確認できる設定は受領記録で区別する。主原資料は調査作者とQAが別に読み、編集原稿・保存文脈は編集担当と各作者が確認した。小売担当は4分野24件を横断して意味重複を確認し、班親が全短文・組立・変更範囲を確認する。

pilotは各分野6件、計24件を対象とする。全件 `historical-reference`、`runtimeEligible:false`。独立他社の今週確定活動として表示できる候補は0件。主資料のうちコメダ決算1件は会社作成PDFの適時開示配信ミラー、KOMEDA is 1件は会社発信の配信サービス資料で、発信主体・配信先を候補内に明記している。日付不明は理由付きnull、具体的な訂正履歴はaudit.mdに残す。

最終pilotは候補をIDでshortforms/context-tagsと結合し、原資料・facts・対応候補・補助出典を保持したうえで編集短文とタグを採用する。各recordのeditorialNotes/contextNotes/qaReviewは判断の追跡用。集計と未確認範囲はreviewSummaryに置く。開発親はまずauditの訂正箇所、原資料との範囲、保存にない活動の扱い、候補間の違いを確認し、採用後の追加batchを指示する。

7体の継続活用に関するユーザーの相談は [開発親（Astra）へのコメント](https://github.com/shirai0765/-/pull/2#issuecomment-6031855487) に送信し、[追加割当](https://github.com/shirai0765/-/pull/2#issuecomment-6031934250) を受領した。本pilot24件を先に提出し、次の有限waveはニュース合計80件（N01飲食・小売40件、N02不動産・鉄道・資本政策40件）、BGM2案、環境音/SFX kit、3プレイ検証。原稿と独立再読を並行し、同じ親1＋Sol 6.1/high子6枠で継続する。音源とプレイ検証は追加割当で指定された別namespaceに分離して別PRで渡す。runtime統合・merge・公開は開発親が担当する。

## 開発親の独立レビュー追補（2026-10-07 UTC）

PR #7を過去の参考素材として採用。開発親の別担当は24件の短文・facts・既存銘柄対応・保存文脈を全読し、4分野の代表的な公式本文4件と、ドトール記事がリンクする公式価格一覧PDFを実際に取得・照合した。価格数値の出典を補助資料として明示したため、現在の集計は主資料24＋補助10＝34固有URL。外部作者/QAによる当初33 URL・全24件再読の報告はaudit.mdの当時の記録として保持する。親の4件サンプルとその全件再読報告は同じ検証ではない。全24件の短文とhistorical-reference/runtimeEligible falseは変更しない。
