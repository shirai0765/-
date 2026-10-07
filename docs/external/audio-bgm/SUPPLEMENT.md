# 音声統合条件の補完

統合契約は [PR #8 comment 6032142623](https://github.com/shirai0765/-/pull/8#issuecomment-6032142623)。実装型は [b40f2ba / CityAudioAssets.ts](https://github.com/shirai0765/-/blob/b40f2ba/src/audio/CityAudioAssets.ts) を原文で確認した。音源作者側は `src/audio` を編集せず、型に渡せる情報だけを提出する。

## 完了状態

作者に許可された1worker枠で24-bit原盤・AAC・短い試聴案を生成し、配布decode・3周接続の数値と静的player参照を検査した。既存WAV/OGG/MP3は同じbytes/hashを保持した。新旧配布版の現物・hash・測定は曲別manifestと `measurements.json`、focused検査は `delivery-validation.json` にある。**人間の試聴、ブラウザーからの音声出力、実機Safariは未実施**である。

作者自身の確認範囲は上記のまま維持する。親の追加報告では、Nativeで両曲の全4codec・AAC24秒試聴のplayhead進行、停止、再読込と、各AACの実3周期が成功した。親のブラウザー動作検査として区別し、人の聴感・Safari・実speakerは未測定である。

## 制作仕様

両曲とも既存の独自16小節score、和声、旋律、音色、seed、ゲインを維持する。`supplement.py` は `render.py` の `compose` を再実行し、元float64波形から44.1kHz／stereo／24-bit PCMを直接量子化する。既存16-bit WAVの再生成SHA256を照合し、変更していないことを確認してから原盤を出力する。16-bitからの単純拡張を原盤とは呼ばない。

- 原盤：`docs/external/audio-bgm/masters/<id>-master-24bit.wav`。カフェ12,096,044 bytes、シティ9,072,044 bytes。両者とも44.1kHz／stereo／24-bit PCM、低位8-bitにも非ゼロsampleがあり、16-bit拡張ではない。ゲインもscoreも旧WAV再生成SHA一致で確認した。
- 配布追加：`public/audio/external-v080/bgm/<id>.m4a`、AAC-LC／160kbps指定／stereo。ffprobeの実平均bitrateもmanifestにある。MP4 movie timescaleを44,100にし、edit-listのミリ秒丸めで元周期が欠けることを避けた。
- 短い試聴追加：`<id>-audition-24s.m4a`、各24秒／AAC-LC。複数フレーズを含む冒頭24秒に120msの前後フェードを付ける単発の試聴案。BGM全周のフェードには使用しない。raw AAC decodeには末尾paddingがあるが、単発の試聴案を全体ループとして登録していない。
- 既存WAV/OGG/MP3は上書きしない。旧カフェMP3の−22.06 LUFSは新下限−22 LUFSを0.06下回るため、旧互換版の差として明示する。新しい優先AACと原盤は両曲とも−20±2 LUFS／true peak≤−1 dBTPの範囲内。

## 再現と検査

次で再生成できる。ffmpegは `threads=1`、配列数学も1threadに制限する。新たな依存導入は行わない。CPU集中実行は担当枠の割当時に行う。

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/supplement.py
# 一曲だけ補完・検査する場合（相手曲の補完は不要）
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/supplement.py --track cafe-lounge
python scripts/external/audio-bgm/validate-delivery.py --track cafe-lounge
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/supplement.py --track shibuya-citypop
python scripts/external/audio-bgm/validate-delivery.py --track shibuya-citypop
# 両曲の補完が揃った時だけ
python scripts/external/audio-bgm/validate-delivery.py
```

AAC/OGG/MP3/WAVをffmpegでfloat PCMにdecodeし、delay/edit-list処理後の長さ、クリッピング、peak/RMSを記録した。余った末尾framesを明示境界で除き、配布版ごとに `loopStart`／`loopEnd` を秒とframesで確定した。原盤のframe数だけを配布版へ無検査でコピーしていない。切り出したdecoded周期のLUFS-I／true peakも測定した。

各decoded周期を実際に3回連結し、2つの継ぎ目の隣接sample差、前後100msにある20ms窓のRMS、−80dBFS未満の窓数、各周RMS差、clipped sample数を数値化した。両曲の全4配布形式で、2つの継ぎ目の−80dBFS未満20ms窓は0、clippingは0、3周RMS差は0。3周の同じ周期のRMS一致は構成上の数値であり、聴感の根拠にはしない。クリックの有無の人間判定、Safariやブラウザー間のpadding処理は未確認として残す。

| 曲 | 原盤 LUFS-I / dBTP | AAC LUFS-I / dBTP | 明示loop秒 | AAC末尾除外 | AACの各継ぎ目の最大step |
|---|---|---|---|---|---|
| 窓辺の午後 | −21.61 / −9.81 | −21.62 / −9.82 | `[0, 45.714285714285715)` | 256 frames | −61.8377 dBFS |
| 坂道のネオン | −19.84 / −9.25 | −19.85 / −9.24 | `[0, 34.285714285714285)` | 448 frames | −55.8498 dBFS |

OGG/MP3/WAVはdecoded framesが元周期と一致し、同じ秒境界で末尾除外0。AACはカフェ2,016,256frames、シティ1,512,448framesをdecodeし、ループはそれぞれ2,016,000／1,512,000framesへ切り出した。各形式の実測はmanifestの `deliveryVerification` に分離した。

## 型への受渡し

一曲PRの主要fragmentは `city-audio-assets-cafe-lounge.json` / `city-audio-assets-shibuya-citypop.json`。ファイル全体をそのまま `CityAudioAsset` として渡せる。各fragmentは自曲のAAC→OGG→MP3の圧縮3形式だけを含み、相手曲の新AACを参照しない。pathは `public/` を除く `audio/external-v080/bgm/` の相対path、gainは1、全variantに秒の明示境界を付けた。全pathに現物があり、短い試聴案とraw WAVは稼働variantに含めない。WAVは原稿・試聴用として保持し、previewでは選択できる。稼働musicは内部担当が1曲を選択する。

`city-audio-assets.json` は両曲補完が揃った時のaggregate参考資料で、`musicCandidates` の各値を同じ型へ渡せる。一曲PRの検証はこのaggregateを必要とせず、親は一曲PRの差分から除外できる。生成recipeは自曲fragmentとaggregateを出力し、`validate-delivery.py --track` は自曲fragmentのmanifestとの一致・3形式の順番・相手曲のpath混入なしを確認する。

playerは曲別manifestから選んだ配布版の検査済み秒境界を読む。AACのdecoded全長を曲長とは扱わず、末尾paddingをloop外に置く。境界未測定の形式、loopEndに届かないbufferは再生を拒否する。ブラウザーのdecode結果で頭のpadding処理がffmpegと異なる可能性は、内部側の出力QAで別に確認する。

作者はCodex A01 audio-bgm author / Shibuya Capital。新24-bit原盤、AAC配布、短い試聴案も独自作曲・数式合成のCC0-1.0音源に含める。第三者の音楽・録音・サンプルは使用しない。既存の人間試聴・ブラウザー出力は未実施の記録を維持する。

## 容量とPR

正確な容量とhashは `delivery-budget.json` にある。runtime採用候補の圧縮BGM合計は2曲のAAC/OGG/MP3を含み、短い試聴は別集計する。全public音声の集計はBGM/SFXのWAV・boundary-checkも含み、docs側の原盤を含めない。全public音声は8MBを超える。圧縮候補の合計を、全public配布ファイルが8MB以下であるという意味には使わない。全体8MB目安の最終採用範囲は内部担当が選ぶ。

| 集計範囲 | bytes |
|---|---:|
| 全曲のruntime圧縮候補（AAC/OGG/MP3、各曲の全fallback） | 4,426,311 |
| AAC優先版2曲だけ | 1,682,225 |
| 24秒試聴2本 | 1,011,208 |
| BGM圧縮全体（runtime候補＋24秒試聴） | 5,437,519 |
| 測定時のpublic全音声（BGM/SFX、WAV等も含む30files） | 26,407,270 |
| docs側の24-bit原盤2曲（public外） | 21,168,088 |

AACはカフェ959,203bytes、シティ723,022bytesで、各≤1.5MB。短い試聴は503,735／507,473bytes。上記public全音声inventoryはこの補完完了時のスナップショットで、別担当のSFXが更新されると変わる。親側が最終採用版で再集計する。

補完中の最初のAACではMP4の既定movie timescaleによるミリ秒単位のedit-list丸めを検知した。サンプル周期を欠けさせないよう44,100へ変更して再encode・decode・検査を完了した。最終ffprobeのtrack durationは45.714286／34.285714秒。曲のscoreや配布WAV/OGG/MP3は変更していない。

カフェは小節末の譜面の休符により継ぎ目前50msのRMSが約−45.38dBFS、次の小節の開始後50msは約−20.04dBFSだった。これは元WAVにもある編曲の強弱で、無音paddingの除去とは別に残した。音楽としての反復時の印象と聴感上の音量変化は人間の試聴で確認する必要があり、数値検査から「聴感上の落ち込みなし」とは断定していない。

原16-bit/OGG/MP3は親の確認によりPR #9/#10から2026-10-07 06:45 UTCに取り込み済みで、最新基点は `game-source 7dcfc71`。補完commit `011ad97` / `5ccfcd5` はその時点では未取り込みのため、補完は新しい一曲ずつのPRで返す。各PRは自曲の原盤・AAC・24秒試聴・manifest・試聴ページ・曲別型fragmentと必要な共通recipe/検査を含む。相手曲補完が未到着でも `--track` で確認できる。aggregateは両曲到着後の資料として任意に含める。runtime有効化・src編集は担当しない。
