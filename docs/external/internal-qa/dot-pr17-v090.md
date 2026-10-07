# PR17 独立レビュー

**結論：素材修正として ACCEPT。緊急度は低〜中。親が別のCSS修正でbuild04を作る今回の機会に、exact headを同じ候補へ取り込む GO を推奨。単独で凍結 QA を中断する必要はない。**

対象 [PR17](https://github.com/shirai0765/-/pull/17)、固定 head `9929d9d317cfae986d516bd6c5b6f97349bfeb83`。GitHub API と通常 HTTPS で22変更ファイルを `/tmp/shibuya-pr17-review/head` に取得し、各ファイルの Git blob SHA を API の値と照合した。資格情報は表示していない。既存リポジトリは読み取りのみ。checkout、merge、src/public/dist 編集、ブラウザー、GPU、Blender、全体テスト、ビルドは行っていない。

## 実バイナリの比較

既存の stdlib-only `inspect_glb.py` を全行確認してから、現在の受入 GLB と PR17 の GLB に再実行した。表の数値は提出文を転記したものではなく、実バイトとアクセサから独立測定した。

| 項目 | 現在の受入版 | PR17 |
| --- | ---: | ---: |
| bytes | 802,896 | 772,808（−30,088） |
| triangles | 10,894 | 10,422（−472） |
| exported vertices | 20,348 | 19,496（−852） |
| meshes / primitives / materials | 1 / 11 / 11 | 同一 |
| textures / embedded images | 1 / 1 | 同一 |
| errors / warnings | 0 / 0 | 0 / 0 |

旧 SHA256：`0af2d0da21b9868e7017a3625eaf152f3c565f43baad1ac84637b597e1078a20`

新 SHA256：`4b0dabe359f0005f91e35192263ea03bca9a820bb32b6270081d4e14770a4835`

完全な外接 bounds はバイナリから同一：min `[-4.170000076293945, 0, -5.427499771118164]`、max `[4.170000076293945, 22.739999771118164, 5.427499771118164]`。幅8.340000153m、高さ22.739999771m、奥行10.854999542m。Y=0、X/Z中央、+Y up・+Z frontage の既存契約を維持。全11材質は OPAQUE / doubleSided=true のまま、外部 URI なし、拡張必須なし。1024×1024 の埋込 PNG は旧新で同じ SHA256 `2a394ba10ba575cbf1a58e194d409084a853bb98a29e2584435dfc1040758284`。

したがって既存 `outer-scenery-242`、位置 `[-386,0,-53]`、yaw0、scale1、予約 X[-394.5,-377.5]/Z[-72,-47]/top33 の統合契約を変更する必要はない。LOD、透明描画、追加テクスチャは増えない。三角形減少を FPS 改善の実測とは扱わない。

## 修正理由と独立確認

生成器の局所差分は A のみ：5つの上階テナント扉を設けて窓帯を調整、最後の屋根向き switchback と midlanding を除去し6階踊り場で停止、背面5台の AC を `front=False` に変更。B の GLB・プレビュー・manifest は変更ファイル一覧に含まれない。他の小模型、LOTS、道路、経済、保存、カメラも変更対象外。

新しく提出された front / three-quarter / roof と3枚の900px接写を `view_image` で実表示し、旧 front / roof と比較した。

- 正面：2〜6階の右側に各階の高さを持つ扉が見える。地上の店・共用入口、看板、狭い外形は保持。
- 接写：テナント扉が circulation balcony に面し、階段上端が6階踊り場で終わる。旧 roof 像で屋根面へ出ていた細い階段手すりも新版にはない。
- 背面：ファン円盤が外側へ向いて見える。屋上設備の配置・外接高さは保持。

さらに提出16点の probe 座標を使い、作者の Blender スクリプトを実行せず、実 GLB 三角形への独立 CPU nearest-ray intersection を新旧に実行した。**修正版16/16、旧版0/16で提出の負の対照と一致**。扉は旧窓と区別できる低い metal panel を検査し、ファンは外側の charcoal face、屋根向き旧 flight の6点は空間が空いていることを検査した。再現コードと結果は `independent_probes.py` / `independent-probes.json`。

これらは実在的な外観の改善で、現在の背景用途でも採用価値がある。ゲーム内の不正な動線、当たり判定、保存や経済に影響するバグではない。屋上への内部経路は引き続き創作上の推定で、室内・通行可能性・全頭上空間・法令適合は未検証。全Blender検査の独立再実行と実ゲーム内表示・性能は今回未実施。

## 記録と採用時の注意

新しい実 GLB SHA に対応する review / byte report / Blender report / probes / 6 images は `validation/revisions/dogenzaka-sakamichi-a-4b0dabe359f0/` に分離される。旧読込数値は保持され、旧 review と Blender report には建築精度の見落としと superseded notice が明示されている。古い三方向画像の一般 PASS を、新修正版の QA と混同しない構成は適切。

凍結解除後の次の素材 checkpoint で優先して採用するのが妥当。採用する場合、GLB の SHA が変わるため現 build の検証はそのまま流用せず、配布ハッシュと統合説明の合計（4棟合計2,067,020bytes / 27,733triangles）を更新し、既存の pinned hash/bounds テストは新しい versioned report に対応させる。配置/helper/lifecycle の変更は不要。最小の実ゲーム内ロードと西側モデル表示は新 SHA で確認する。現 checkpoint を緊急に破るべき証拠はない。

## Astra / D03 / D04 の自己申告確認

PR17 本文は3点修正と再検査結果の説明のみ。issue comments0、review comments0、reviews0。モデル名や担当切替の新報告はない。

関連 PR1・3〜6 の最新本文/コメントと、最新50件要求で取得された PR 一覧も API で確認した。PR1 の05:27の作者受領報告は「Astra制作4＋QA1、先行Luna調査1、主含め7枠で全員Astraではない」。PR3 本文もこの旧構成を述べる。06:03 / 06:22 / 06:32 の全Astra切替・D03/D04着手要求と06:49のD03画像手渡しは親の指示であり、作者の実施自己申告として数えない。**今回取得した公開資料に、全Astra切替完了・実起動人数の新確認、D03/D04の着手/成果提出の新自己申告は見つからない。実際の稼働モデルや私信は未確認。**

PR4 の06:36作者コメントは A 修正版を配置時に優先するよう要望。PR5 の06:36作者コメントには住宅バルコニー接合部の別修正PR予告があるが、これは本PR17の受入判定の対象外。

## Artifact attachment

親の「callableなら1度、約3秒で打切り」の依頼に対し、現在の callable tool catalog に `codex_app.attach_artifact` も `tool_search` も存在しなかった。実呼出し回数0、添付成功やホスト応答は**未確認**。通常HTTPSで資料取得・ローカル保存は成功している。

APIの原文、22ファイルのハッシュ台帳、旧新独立 byte reports、画像、CPU probes は本directoryに保存。取得時点の metadata は `review-summary.json` に記録。

## Build04 同時取り込み提案（親からの追加依頼）

**GO 提案：head `9929d9d317cfae986d516bd6c5b6f97349bfeb83` の22ファイルを、そのまま限定取り込みできる。** 現 source HEAD `7dcfc71d146d94682667ce1de75de7a6e0c68229` と exact head を `/tmp/shibuya-pr17-review/merge-check.git` のみで dry merge した。merge base は `87915c2f09f1889662825e90965ea9def9f627ca`、追加コミットはPR17の1個だけ、`merge-tree --write-tree --name-only` exit0、conflictなし。現在の共有working tree変更とPR17変更22パスの重複も0。共有repoのobject/branch/worktreeへは書き込んでいない。結果は `exact-head-merge-check.json`。

変更 namespace は以下に閉じる（合計22）：

- `public/models/external-v080/dogenzaka-mixed/dogenzaka-sakamichi-a.glb`：1。
- `docs/external/dot/dogenzaka-mixed/`：README、binary audit、A manifest、A三方向PNGの6。
- `docs/external/dot/validation/dogenzaka-sakamichi-a/`：旧Blender reportとreviewへのrevision noticeの2。
- `docs/external/dot/validation/revisions/dogenzaka-sakamichi-a-4b0dabe359f0/`：新検証・負の対照・6画像の11。
- `scripts/external-v080/dogenzaka-mixed/generate.py` と `scripts/external-v080/validation/validate_architectural_revision.py`：2。

権利の差分はない。既存の写真参照リンク・原創架空形状・作者の自己生成看板の契約を維持し、PR17に第三者写真、商標画像、外部依存textureは追加されない。実GLB内部atlasのバイトSHAも同一。全GLB形状の測定bounds、原点、接地、向き、既存配置のreserved envelopeは同一で、CityView/loadedAsset/sceneLayout/LOTS/roads/helperを変更する必要はない。

取り込みに併せて親側の短い追随：`tests/dot-scenery.test.ts` のSakamichi検査report importを新versioned `glb-report.json` に向け、対応するexpected SHAを `4b0dabe…a4835` にする。`docs/external/dot/background-integration-v090.md` の4棟合計bytes/trianglesを2,067,020 / 27,733へ更新。配布manifestはbuild04の新ファイルSHAで作成する。新SHAでの実DEVモデルload/西側表示を既に予定された1回の統合QAに含めればよく、この素材のための重複GPUセッションは不要。親の後続build04テスト/本番QAは必要で、今回のCPU/提出studio画像をゲーム内合格に代用しない。

この追加依頼時点でもレビュー担当は直接merge/editを行っていない。
