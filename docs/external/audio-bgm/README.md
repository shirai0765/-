# A01 オリジナルBGM 2案

音声統合条件6032142623の24-bit実原盤・AAC・24秒試聴・配布版decode境界・3周数値検査を完了した。追加の現物と実測は [SUPPLEMENT.md](SUPPLEMENT.md)、一曲ずつ型へ渡せる相対pathと秒境界は [カフェのfragment](city-audio-assets-cafe-lounge.json) と [シティポップのfragment](city-audio-assets-shibuya-citypop.json) にある。以下の制作表は初回WAV/OGG/MP3の数値を保持する。

runtime用variantsはAAC→OGG→MP3の圧縮3形式だけに限定した。raw WAVは原稿・試聴用に保持し、previewから選べる。短い試聴案とWAVは容量目安のruntime fallbackへ含めない。

試聴できる16小節のオリジナル音源を制作した。ゲームruntimeへの組込は親が行う。基点は `407236858c287a3060c224967489010e669d1eea`。制作中に正式指示 `0f20987` の `docs/external/teams/news-research-team.md` と最新 `game-source/docs/coordination.md` を読み、WAV/OGG必須と1曲単位のPR提出を反映した。

| 曲 | 用途・編成 | 長さ / テンポ | WAV / OGG / MP3容量 | WAV LUFS / true peak |
|---|---|---|---|---|
| 窓辺の午後 (`cafe-lounge`) | カフェ・ラウンジ。柔らかな電気鍵盤、丸いベース、ブラシ、リム、軽いハイハット、ベル、薄いパッド | 45.714286秒 / 84 BPM | 8,064,044 / 621,745 / 915,374 bytes | −21.61 LUFS / −9.81 dBTP |
| 坂道のネオン (`shibuya-citypop`) | Tokyo city pop。明るいシンセ旋律、短い鍵盤コード、ギター風の倍音プラック、動くベース、バックビート、細かいハイハット | 34.285714秒 / 112 BPM | 6,048,044 / 519,903 / 687,064 bytes | −19.84 LUFS / −9.25 dBTP |

publicの既存WAVは44,100 Hz、ステレオ、16-bit PCM。docs側に追加した実原盤は同じ独自scoreの元float64から直量子化した24-bit PCMである。OGGはVorbis quality 5、MP3は160 kbps、新AAC-LCも160 kbps指定。16小節の各小節に旋律・和声・ベース・打楽器を配置し、後半は別の旋律へ展開する。外部の曲やサンプルをコピーせず、原稿中のノート列と数式から音色も合成した。

## 試聴

repo rootから次のローカルサーバーを起動する。

```sh
python -m http.server 8765 --directory public
```

ブラウザーで `http://127.0.0.1:8765/audio/external-v080/bgm/preview.html` を開く。カフェの補完PRだけなら `cafe-lounge-preview.html`、シティポップの補完PRだけなら `shibuya-citypop-preview.html` を使う。相手曲の新AACを必要とせず、その曲だけでレビューできる。

再生ボタンを押すまで音は出ない。初期の試聴音量は25%。AAC-LC・OGG・MP3・WAVを選び、曲別manifestの配布版decodeで確認した秒のloopStart/loopEndを使って繰り返す。AACのbuffer全長に含まれる末尾paddingはループ外に置く。境界がbufferに収まらない場合は再生を拒否する。別曲・接続試聴・24秒試聴を開始すると先の音源は停止する。24秒試聴と4秒接続音源は単発再生である。ブラウザー間のpadding処理と実音声出力は未確認。

各曲に4秒の `*-boundary-check.wav` がある。末尾2秒と冒頭2秒を連結しており、再生2秒地点でループ境界を聴ける。これはループ全体とは別の確認用音源である。

この担当が確認したのは生成・デコード・波形/数値・静的player検査まで。**人による試聴、実ブラウザーからの音声出力、実機SafariでのOGG対応は未確認**。音楽としての好みと長時間反復の印象は、親の試聴レビューに残す。波形があることを試聴済みとは記録していない。

親からの追加報告では、Nativeで両曲の全4codecとAAC24秒試聴のplayhead進行・停止・再読込、各AACの実3周期が成功した。これは親のブラウザー動作検査であり、作者の再実行ではない。人の聴感、Safari、実speakerから聞けた音は未測定として分ける。

## ループと音量の実測

音符のリリース、打楽器の減衰、室内反射の尾は末尾で切らず、先頭へ周期的に加算した。最後から最初に回るための全体フェードや無音パディングは付けていない。ノートの開始・終了は短い包絡で滑らかにし、DC成分を除いた。RMSに合わせた一定ゲインと−4 dBFSのピーク上限を設定し、クリッピングするリミッターは使わない。

| 曲 | WAV RMS | WAV境界の最大1サンプル差 | OGG境界の最大1サンプル差 | MP3境界の最大1サンプル差 | loop frames |
|---|---|---|---|---|---|
| カフェ | −23.0003 dBFS | −74.7460 dBFS | −58.2678 dBFS | −66.7872 dBFS | `[0, 2016000)` |
| シティポップ | −21.0003 dBFS | −67.3864 dBFS | −56.8670 dBFS | −55.6611 dBFS | `[0, 1512000)` |

境界の指標は「最終サンプルから先頭サンプルへの差」の左右チャンネル最大値。自然な音の隣接サンプル差があるので0を要求せず、境界の前後50 msの通常の最大差より小さいかも比較した。両曲のWAVは境界差−60 dBFS未満、圧縮版は−50 dBFS未満で、周辺最大差より12 dB以上小さい。**聴感の確認とは別の数値検査**である。

ffmpegによるOGG/MP3デコード後のフレーム数は、それぞれ元WAVと一致した。全6ファイルでclipped samplesは0。カフェOGGは−21.59 LUFS / −9.82 dBTP、シティOGGは−19.82 LUFS / −9.16 dBTP。MP3はそれぞれ−22.06 / −20.29 LUFS、−10.26 / −9.70 dBTP。LUFS/true peakはffmpeg `loudnorm` のinput統計を使用し、フィルター処理した音を成果物へ置換していない。

## 再生成と検査

既存のPython 3.12、NumPy 2.3.5、ffmpeg 7.1.5、Nodeを使った。pip/npmの依存導入は行っていない。NumPyは波形配列の数学処理にだけ使い、音楽生成サービスや素材ライブラリではない。疑似乱数seedは曲ごとに固定。出力PCMと発音配置を再現できる。圧縮ファイルのhashはエンコーダー/コンテナの実装にも依存するので、再生成した現物のhashをmanifestに記録する。

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/render.py
python scripts/external/audio-bgm/validate.py
# 24-bit原盤・AAC・24秒試聴と配布decode/3周数値を追加
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/supplement.py
python scripts/external/audio-bgm/validate-delivery.py
# 一曲の補完PRだけを検査（相手曲のAAC/fragmentは不要）
python scripts/external/audio-bgm/validate-delivery.py --track cafe-lounge
python scripts/external/audio-bgm/validate-delivery.py --track shibuya-citypop
# 一曲だけ再生成する場合。CPU枠の割当時に実行
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/supplement.py --track cafe-lounge
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python scripts/external/audio-bgm/supplement.py --track shibuya-citypop
```

処理は1worker、ffmpeg `threads=1` / `filter_threads=1`。各曲の `*.manifest.json` は用途、作者、originalの根拠、制作方法、配布条件URL、sample rate/channels、長さ、容量、SHA256、loop start/end frames、peak/RMS/LUFS、clipping、WAV/OGG/MP3境界、試聴未確認を保持する。全曲の実測は `measurements.json`、検査結果は `validation.json`。

追加の実測・hashは同じ曲別manifestへ保存し、補完検査は `delivery-validation.json`、容量は `delivery-budget.json` に保存した。`render.py` を再実行すると初回形式のmanifestへ戻るため、その後は必ず `supplement.py` も実行する。補完単独の再実行は既存WAV/OGG/MP3を上書きせず、旧WAV再生成SHA一致を確認する。

初回実行はmetadata書出しの閉じ括弧不足で生成前に停止。2回目はWAV/MP3生成後、ffmpegのJSONの後ろに出力されたsummaryを含めて解析しようとして停止した。括弧とparserを修正して生成・計測を完了し、WAV/OGG/MP3のheader・hash・frame一致・peak/clipping/境界、HTMLの参照とJavaScript構文を検査した。失敗2回の原因と解消は `developmentFailureHistory` に保持し、初回全成功とは記録しない。

## 配布とPR境界

[LICENSE.md](LICENSE.md)に音源と生成物のCC0-1.0条件を記録した。third-party music/samplesは空配列。使用音色はすべて独自の倍音・包絡・ノイズ合成で、楽器録音やSoundFontを取得していない。

親の確認では、原16-bit WAV/OGG/MP3は[PR #9](https://github.com/shirai0765/-/pull/9)・[PR #10](https://github.com/shirai0765/-/pull/10)から2026-10-07 06:45 UTCに取り込まれ、`game-source` は `7dcfc71` へ進んだ。24-bit/AAC等の補完commit `011ad97` / `5ccfcd5` はその時点では未取り込みで、補完は新しい一曲ずつのPRとして提出する。

各補完PRの主要型fragmentは `city-audio-assets-<track>.json` で、自曲の実在するAAC/OGG/MP3だけを含む。自曲の原盤・AAC・24秒試聴・曲別manifest・試聴ページと、必要な共通recipe/検査スクリプトを提出する。`validate-delivery.py --track <track>` はその曲別fragmentを読み、相手曲の新AACやaggregateを参照しない。共有aggregate `city-audio-assets.json`は両曲の補完が揃った時の参考資料で、一曲PRには不要。親がそのPRから除外できる。既存runtime、src、保存、株価、UI、依存設定は変更しない。

親の追加native確認は [NATIVE-QA.md](NATIVE-QA.md)。作者時点の未試聴記録と分離し、人の聴感・実機Safari・物理出力は未測定のまま。
