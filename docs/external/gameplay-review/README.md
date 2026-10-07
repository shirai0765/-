# G01 公開操作によるプレイ検証

担当開始: 2026-10-07 UTC。正式割当は [PR #2 の追加指示](https://github.com/shirai0765/-/pull/2#issuecomment-6031934250)。編集範囲は本directoryと `scripts/external/gameplay-review/` のみ。コード・保存形式・乱数・依存関係・公開は変更しない。

## 当初の通常UI計画（完遂未確認）

1. 序盤: 通常UIで新会社を作り、道玄坂の既存区画で出店、価格・品質・人員を設定し、銀行で希望額と期間を選び審査・契約。営業後の実決算と支払内訳を記録する。各設定と契約前後の現金は通常exportで確かめる。
2. 店長委任: 別の新会社を通常操作で作った後、最初の営業前の自然exportを保存。その無改変ファイルを通常UIで別の新しいbrowser contextへ読み込み、自主管理・店長委任の2分岐を同じ週・seed・立地・資金で比較する。価格・人員・広告枠と実際の店長調整、店長費、確定利益を区別する。この比較用の自然save再読込は、人工のfixtureや資金注入ではない。
3. 拡大・上場・全取得: さらに別の新会社から開始。出店と運営、上場、増資、設備・企業・地区投資を通常UIで行う。最大週数と資金留保を明示し、未完や停滞も決算・saveに残す。現実の未来株価・hidden quality・sim APIで結果を先読みしない。

自動進行の結果は自動プレイの証拠であり、人が30時間遊んだことや全seedの経営バランスの証明ではない。自分の新会社と自分のexportのみ使用し、ユーザーの個人saveには触れない。

## 公開版の扱い

当初指定URLは `https://shirai0765.github.io/-/?v=0.7.0`。2026-10-07のHTTPS GETで同originの `release.json` は0.8.0、source `88192148884790ddf3325e7c76cc9cabace4f890`、公開日時 `2026-10-07T06:01:30.385737+00:00` を示した。queryは旧版アセットを固定しないため、ブラウザー実行時のreleaseと実際のURLを記録し、旧0.7.0の検証とは呼ばない。実行の前後で版が変わった場合も記録する。

## 実行方法と資源

既存Node Playwrightと既存 `/usr/bin/chromium` を使う。依存導入は不要。親のCPU/browser枠許可後のみ起動する。1本のnative browserを使用し、contextは逐次作成・破棄する。renderer・RAF・audio・crypto・TLSを置換せず、chromiumSandboxを有効にする。起動失敗は証拠を残し、sandbox/TLSを無効にして成功扱いしない。

```bash
node scripts/external/gameplay-review/run-ui.mjs --scenario all --out docs/external/gameplay-review/runs/run-01 --max-weeks 1200
```

結果は操作transcript、通常export、確定決算、UI文章・画像、公開release、失敗・未実行項目を保存する。ブラウザー評価は表示DOMとIndexedDBのread-only読取に限定し、ゲーム内部関数を呼び出して操作を代行しない。

## 更新指示に基づく公開engine trace

最新の `docs/external/teams/news-research-team.md` は公開UIまたは公開 `applyAction/advanceWeek` を許可している。長期進行は `run-api.mjs` で現在のソースの `createGame`（初期1,200万円）から公開actionを順に実行し、3局面のJSONL、確定決算、自然saveと `createEnvelope/decodeEnvelope` の完全一致を記録する。Node24の既存TypeScript除去と専有resolve hookを使い、依存を導入しない。

```bash
node --experimental-transform-types scripts/external/gameplay-review/run-api.mjs --seed 1 --max-weeks 1400 --mid-week 104 --out docs/external/gameplay-review/traces/new-run
node --experimental-transform-types scripts/external/gameplay-review/replay-api.mjs docs/external/gameplay-review/traces/new-run
```

方策は既存 `scripts/campaign-v4.ts` を専有 `policy.ts` に写し、import path、trace hook、選択済み設定の公開action再実行、G01と無関係な不動産売却probeの除外だけを変更した。公開見込み値で選ぶ計算と実行されたactionを分離し、実際のランダム決算で将来結果を先読みしない。JSONLの前後stateは操作・経営値のcompact記録と全stateのSHAで、完全なstateは局面境界と節目のsaveに残す。全actionを初期saveから再生すれば全stateを復元できる。

3traceは創業から最初の決算、中盤の上場・投資、終盤の成長・達成。店長比較は最初の営業前の自然stateを無改変で保存復元し、公開actionで委任設定だけを変える別分岐。分岐の利益・資金は主campaignへ合流させない。実行モードはpublic-engine-actionsで、native UI・人間の操作時間・物理端末の性能の証拠とは区別する。

`runs/probe-01/` は起動したnative Chromiumの原失敗記録。sandbox/TLSを維持して0.8.0の新会社・第1週の3D描画まで確認したが、経営ボタンのPlaywright visible/stable待ちで停止した。画像ではボタンが表示されており、製品不具合は未確定。ページ/console errorは0、GPU ReadPixels stall警告は4件。成功したプレイtraceに数えない。

## 実行結果

`traces/run-02/` は seed 1、新会社の通常初期資金1,200万円からの1本の連続campaignを3局面に分けた記録。独立した3会社の比較ではない。checkout source `0f20987d5e9961b8efe16c5f6aa5c6322120ec0b`、package version 0.8.0を実行し、実行前後のruntime source hashは一致した。公開サイトprobeのsource `8819214`とは証拠の対象を分ける。配信bundle自体の長期UIプレイを完遂したとは扱わない。

| 局面 | 実決算 | 実行action | 終了現金 | 結果 |
| --- | ---: | ---: | ---: | --- |
| [創業](trace-01-founder.md) | 第1週の1回 | 4 | 8,622,284円 | 出店・営業設定・実決算、別分岐の借入と店長比較 |
| [上場・投資](trace-02-ipo-investment.md) | 第2〜103週の102回 | 109 | 108,496,635円 | 第17週IPO、第29週最初の企業取得、第41週市場企業取得 |
| [終盤](trace-03-late-growth.md) | 第104〜1400週の1,297回 | 227 | 15,309,512,260円 | 市場100社取得・稼働、企業7/8、最終達成未到達 |

主campaignは1,400回すべて黒字。1,741遷移の全before/after state SHAと実決算を初期 `createGame` から再実行して照合し、34節目saveの完全な往復一致を確認した。店長・借入の別分岐は同じ自然saveの復元から実行し、各決算後saveの完全一致も確認した。主campaignへ資金や信用を合流させていない。

実行時間はcampaign全体17.061秒、再実行12.248秒。局面別時間と人間の操作時間は計測していない。1,400ゲーム週と人間の30時間を換算しない。方策の `campaign.weeklyProfit`、eventsの `profit`、checkpointsの `weeklyProfit` は予測値であり、確定結果にはJSONLの `actualReport` と `finalActual.report` を使う。

最終未達は信用86.80に対して最後の企業の必要信用88が未充足。第907週以降の信用は86.72〜86.87で、資金留保だけでは進まなかった。[終盤の所見](trace-03-late-growth.md)に、自然進行の停滞・未実行の対策・最小UI改善案を記した。`summary.longestIdleGameWeeks=56` は調査などを含む「公開actionなし」、`campaign.maxIdleWeeks=500` は方策が更新する投資節目なしの長さで、意味が異なる。

`traces/run-01/` はTypeScript parameter propertyをstrip-only modeで読めず、0遷移で終了した原失敗。Node24標準の `--experimental-transform-types` で実行し直した。依存導入やsource変更はない。実行済み証拠は `run-02`、ブラウザー原失敗は `runs/probe-01` に保全する。

## 局面単位の独立PRと限定再生

`replay-api.mjs --trace 01/02/03` は、指定した局面のJSONLと開始・終了saveだけで実行できる。`summary.json`、他局面のJSONL、他の節目saveは必須ではない。局面の `.summary.json` があれば宣言版・source SHAとJSONLのbyte SHAも照合対象へ加える。

| 指定 | JSONL | 開始save | 終了save | 再生範囲 |
| --- | --- | --- | --- | --- |
| `01` | `trace-01-founder.jsonl` | `save-natural-new-company.json` | `save-founder-first-settlement.json` | `createGame` と初期saveの一致から開始 |
| `02` | `trace-02-ipo-investment.jsonl` | `save-founder-first-settlement.json` | `save-middle-boundary.json` | 前局面の自然saveからの限定再生 |
| `03` | `trace-03-late-growth.jsonl.gz` | `save-middle-boundary.json` | `save-final-natural-state.json` | 前局面の自然saveからの限定再生 |

```bash
node --experimental-transform-types scripts/external/gameplay-review/replay-api.mjs docs/external/gameplay-review/traces/run-02 --trace 01
node --experimental-transform-types scripts/external/gameplay-review/replay-api.mjs docs/external/gameplay-review/traces/run-02 --trace 02
node --experimental-transform-types scripts/external/gameplay-review/replay-api.mjs docs/external/gameplay-review/traces/run-02 --trace 03
```

各実行は全stateの前後SHA、実決算の完全一致、開始・終了saveの往復と最終stateの一致を照合し、実際に確認したsave数・action数・決算数を `replay-trace-01/02/03-result.json` に記録する。02/03の限定再生だけでは創業からの到達を再証明しない。元の全1741遷移 `replay-result.json` は上書きしない。新たな全局面再生結果は `replay-full-result.json` へ出す。

readerは標準 `node:zlib` で `.jsonl.gz` を展開し、同名の非圧縮版もある場合はgzipを優先する。終盤の元JSONLは保全し、PRには圧縮版と2境界saveを提出できる。gzipの展開後byte SHAは元原稿のSHAと同じ。今回の補完では新たなcampaign・限定再生・browserを実行していない。限定再生の動作確認は親の独立worktreeで行う。
