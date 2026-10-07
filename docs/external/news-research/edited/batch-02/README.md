# 追加ニュース batch-02（28件）

初回24件に続く異なる28件。N01の新16件とN02の新12件を採録した。研究基点は `0f20987d5e9961b8efe16c5f6aa5c6322120ec0b`、提出branchの基点は `f1ec518df7dcc8b315c9bcd9327177d84e17c94b`。初回を二重計上しない。

`pilot.json` はゲーム名対応と独自短文・既存保存文脈を組み立てた資料。`candidates/n01.json` と `n02.json` は原事実・出典のsnapshot、`shortforms.json` は編集文、`context-tags.json` は実在保存fieldに対する限定付き文脈、`audit.md` はN03の主資料・補助の独立再読と作者照合のID別所見。全件 `historical-reference` / `runtimeEligible:false`、runtimeへ未組込。

```sh
python3 scripts/external/news-research/validate-wave.py --self-test
python3 scripts/external/news-research/validate-wave.py --batch docs/external/news-research/edited/batch-02 --baseline docs/external/news-research/pilot.json
```

28件の主URLと5補助URL（全distinct32）を確認。8不利fixtureの拒否、100 STOCKSとの照合、必須欄/日付/ID/eventKey/短文重複/編集1対1が検査対象。意味重複・原資料の事実・独自性は監査の読取所見でありschema合格だけで証明しない。予定を実施済みにせず、日付不明は理由付きnull。初回の未知保存field10エラーを実コード再読で訂正した履歴も残した。

追加56件は本batch28＋batch-03の28。最終catalogは初回24を保持した80件の索引として別PRで提出する。開発親の採用判断待ちで、merge/公開は行わない。
