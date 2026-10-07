# 追加ニュース batch-03（28件）

初回24件、batch-02の28件に続く異なる28件。N01の後半新16件とN02の後半新12件。研究基点は `0f20987d5e9961b8efe16c5f6aa5c6322120ec0b`、提出branchの基点は `f1ec518df7dcc8b315c9bcd9327177d84e17c94b`。3batch計80件で有限waveを完了し、初回や関連補助を件数として重複計上しない。

`pilot.json` は原事実・短文・ゲーム名対応・既存保存文脈を組み立てた資料。作者snapshot、N03の編集短文と文脈、ID別独立再読と作者照合は隣接するJSONとauditに保存。原資料主28と補助4の全distinct32URL。全件 `historical-reference` / `runtimeEligible:false` で採用判断待ち。

```sh
python3 scripts/external/news-research/validate-wave.py --batch docs/external/news-research/edited/batch-03 --baseline docs/external/news-research/pilot.json
```

このPR単独では初回24＋この28の52件を機械検査できる。batch-02取り込み後は追加全56との累積80件を検査する。最終catalog PRにcanonical40+40と全batchの同一コピーを収録し、全体検査も単独再現できるようにする。

8不利fixtureの検査器はbatch-02と同じ。必須欄、URL/日付、ID/eventKey、社名置換短文、既存100stockの実名/ゲーム名/市場、実在保存field、編集1対1とhold除外を検査する。構造検証と資料の独立実読・意味重複・独自性は区別する。掲載日/実施日不明や予定をfactsと注記に保持し、実績・因果を補わない。GLPの主体、TENTIAL追加オプション・寮供給、Axesのセグメント利益、KDX/Integralの読取経路等を訂正・明確化済み。merge/公開は開発親が担当する。
