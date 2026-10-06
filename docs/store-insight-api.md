# 店舗運営の読み取りAPI（0.4.2）

`src/sim/engine.ts` の `getStoreOperatingInsight(state, storeId)` は、現在週にその店舗が営業した場合の需要・処理能力・費用を説明する。`StoreOperatingInsight` と `StoreOperatingSettings` も同ファイルからexportする。表示設計は [store-insight.md](design/store-insight.md)、背景の探索範囲は [店舗設定実験](research/store-strategy-study.md) を参照。

表示専用であり、操作・週進行・保存を行わない。存在しないIDや閉店したIDでは `null`。戻り値は読み取り専用の型で、設定・結果・内訳は元stateと参照を共有しない。JavaScript側で戻り値を書き換えてもゲーム状態を変えないが、戻り値自体を実行時freezeする契約ではない。

## フィールド

| フィールド | 意味 |
|---|---|
| `week`, `storeId` | 説明対象の現在週と店舗ID |
| `inputSettings` | 入力済み `price/staff/quality/marketing/manager/style/level` のコピー |
| `effectiveSettings` | `managerPlan` が実際に選ぶ同じ7項目。店長なしでは入力と同値だが別オブジェクト |
| `delegationBudget` | 店長ありの場合、入力人数×基準給与52,000円＋入力広告の配分枠。店長なしでは `null` |
| `flow.demand` | 現在の価格・品質・広告・地区・他店などを反映する未丸めの需要 |
| `flow.capacity` | 実効人数・レベル・店舗形態・運営体制による未丸めの処理能力 |
| `flow.customers` | `round(min(demand, capacity))` による既存reportと同じ予想客数 |
| `flow.unservedDemand` | `max(0, demand - capacity)`。未丸めの需要の取りこぼし |
| `flow.unusedCapacity` | `max(0, capacity - demand)`。未丸めの処理の余力 |
| `result` | 既存reportの `id/revenue/profit/customers/satisfaction` の5項目だけ |
| `costs` | 下記7項目の未丸め費用。元の利益計算に使う値 |
| `roundedCostAdjustment` | 各費用を整数円表示した場合の調整額。新しい経済費用ではない |
| `context.nearbyStores` | 既存計算で近隣に数えた自社他店舗の数 |
| `context.staffCapacityLimit` | そのレベルで処理能力に寄与する人数上限。支払う給与人数の上限ではない |
| `context.founderCapacity` | 全社の自主管理倍率。店長ありの対象店舗は別の店長倍率を使うため、この値だけで対象店の能力低下を断定しない |
| `context.ownsProperty` | 店舗区画の物件を直接保有しているか |
| `context.currentReputation` | 現在の会社信用。将来の信用値や達成週数ではない |

需要・能力・差分は計算上の端数を残す。表示側は「約○人／週」と丸められるが、raw値の大小と表示精度を併せて扱う。表示で同人数になる場合は「上限付近」とし、「0人の取りこぼし」を大きく強調しない。テイクアウトにも使うため「空席」より「処理の余力」が適切。

## 費用・店長・信用の境界

費用キーは `ingredients`（材料）、`fulfilment`（包装・決済・廃棄・配送構成を含む履行費、売上の12%）、`labor`（実効人数の給与）、`rent`（賃借料）、`equipment`（レベルに伴う週費用）、`marketing`（実効広告）、`manager`（店長費）。開業・改装の一時支出はこの週費用に重ねない。

店舗利益は、売上から材料→履行→給与→賃料→設備週費→広告→店長費の順に未丸め値を引き、最後に一度丸める。表示側で費用を個別に丸めた場合は、次式で一致する。

```text
表示費用合計 = Σ Math.round(costs各項目)
店舗利益 = result.revenue − 表示費用合計 − roundedCostAdjustment
```

調整額は負にもなり得る。「表示の丸め調整」として説明し、追加入金や課金とは呼ばない。計算本体は調整額を使わず、既存と同じ引算順を維持している。

店長の配分枠は実際の給与合計と違う。給与には賃金倍率がかかり、店長費も別に発生する。入力値でなく `effectiveSettings` から費用・客数・満足を導く。店長は限られた候補から改善する設定を選ぶ仕組みで、元の設定を保持する場合がある。「必ず満足65以上」「全条件で最善」とは表示しない。

自社物件の場合、店舗の `rent` は0だが物件維持費は全社の計算に残る。本部費・物件維持費・利息・元本返済を店舗利益へ再配賦しない。したがって店舗利益と全社純利益・週末現金は別の指標である。

会社信用は全店舗の満足の単純平均と、全社の利息後利益の正負をもとに週末に変わる。単店満足を信用へ直接加算したり、客数で加重平均したりしない。本APIは現在信用だけを返す。満足上昇の便益を説明しても、将来の信用45到達・IPO・利益増を保証しない。

## 計算と保存を変えない実装

内部 `rawStoreCalculation` が既存式の結果と診断値をまとめて返す。従来の `rawStoreResult` はそのうち **5項目だけの `result`** を返す。`managerPlan` の候補評価、`previewWeek`、`evaluateSite` は同じ計算を使い、公開APIも実効店長設定に同じ計算を適用する。表示側に需要や費用の再計算式を複製しない。

需要・能力・満足の式、乗算・引算の順序、最後の丸めは保持した。`WeeklyReport.storeResults`、`Store`、保存schemaを拡張していない。`flow`・`costs`・入力/実効設定の診断オブジェクトは週報や店舗stateへ流さない。借入中利益0以下の敗北と、週末現金不足の判定も変更していない。

## 確認したこと

実装前の0.4.1から、公開actionだけで作った29状態を `/tmp/store-insight-v041-baseline.json` に捕捉した。4地区×3形態の初店、上限・余力、品質85/100、低満足高利益、店長の調整/元設定保持、上限超の30人、改装、2〜4店、自用物件の購入前後、借入黒字/赤字、店舗なしを含む。自用物件は86週の実営業後の購入で、資金を注入していない。

各状態について、予測report・`advanceWeek`後の全state・店長設定・出店見積・前後の保存envelopeを **0.4.1と完全一致** で確認した。envelopeで比較から除いたのは作成時刻 `savedAt` だけで、payload文字列・checksum・format・schemaは含めた。API結果とreportの一致、reportのキー数、保存復元、入力state不変も確認した。結果と元/新engineのSHA-256は [検証JSON](store-insight-api-verification.json) に保存している。原fixture・比較script・source控えは一時領域にあり、永続配布物ではない。

追加の [単体テスト](../tests/store-insight.test.ts) 14件が成功し、既存engine 22件・persistence 11件も成功した。単体テストは品質の利益/満足トレードオフ、店長の入力と実効差、上限超の人件費、費用丸め、自用物件の全社費用、戻り値の参照分離、保存への診断漏洩、借入赤字敗北を検査する。別担当の会計照合も6状態で一致した。

この確認は代表状態の経済・保存互換検査である。全ゲーム状態の同値性を形式的に証明したものでも、ブラウザ表示、人間の理解、初回15分や30時間プレイを検証したものでもない。UI統合・画面検査は担当側の証拠と分ける。
