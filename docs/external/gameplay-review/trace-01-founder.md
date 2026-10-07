# G01-01 創業と初決算

対象は0.8.0、source `0f20987d5e9961b8efe16c5f6aa5c6322120ec0b`、seed 1。`createGame('Campaign 1', 1)` の初期1,200万円から、公開 `applyAction/advanceWeek` を実行した。資金注入・state編集・時間変更はない。1本の連続campaignの最初の局面であり、native UIの銀行審査を検証した記録ではない。

操作は桜丘南の住宅小路 `sakuragaoka-09` にstandard店を360万円で出店、価格850円・品質100・人員4・広告0へ設定、システム営業提案を8千円で調査して8万円で契約、1週進める。営業前現金8,312,000円から、実決算の売上907,800円、純利益310,284円、来店1,068人で現金8,622,284円になった。決算内訳はJSONL `actualReport.storeAccounts` に保存され、契約の継続費4,000円も営業利益に反映されている。

同じ営業前の自然saveを無改変で復元し、別分岐で借入100万円・52週の公開 `borrow` を実行した。借入後現金9,312,000円、実決算の利息865円・元本返済19,231円・純利益309,419円・現金増290,188円を確認した。借入は返済を伴う実actionで、主campaignへの資金追加には使っていない。通常UIの銀行審査・説明表示は未検証。

店長比較も同じ第1週・seed・店舗・営業前現金から、managerだけをfalse/trueに変更した独立分岐。両方の実売上907,800円・客数1,068人は一致し、手動の純利益310,284円に対し委任は238,284円。委任費72,000円で差額が説明でき、満足度は99から100になった。この店では設定は価格850円・品質100・人員4のままで、毎回利益が改善することの証明ではない。長期チェーンでの委任効果はこの1週比較だけでは結論にしない。

証拠は [操作・決算JSONL](traces/run-02/trace-01-founder.jsonl)、[局面要約JSON](traces/run-02/trace-01-founder.summary.json)、[初期save](traces/run-02/save-natural-new-company.json)、[初決算save](traces/run-02/save-founder-first-settlement.json)、[店長比較](traces/run-02/manager-comparison.json)、[借入分岐](traces/run-02/founder-loan-branch.json)。`--trace 01` は操作JSONLと2境界saveだけで `createGame` 一致から局面を再生し、2saveの往復を確認できる。店長・借入の比較ファイルは限定再生に必須ではない。元の主campaign全1741遷移replay結果は共用checkoutに保全し、個別PRには不要。人間の操作時間・30時間プレイは未計測。

最小改善候補は、1週比較時に店長費と確定純利益の差を同じ説明に出すこと。単店・既に適切な設定では委任費だけ増える場合があるため、運営負荷の削減と利益の増加を分けて説明すると判断しやすい。runtime変更は行っていない。
