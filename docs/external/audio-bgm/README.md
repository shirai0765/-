# A01 オリジナルBGM 2案

試聴できる16小節のオリジナル音源を制作した。ゲームruntimeへの組込は親が行う。基点は `407236858c287a3060c224967489010e669d1eea`。制作中に正式指示 `0f20987` の `docs/external/teams/news-research-team.md` と最新 `game-source/docs/coordination.md` を読み、WAV/OGG必須と1曲単位のPR提出を反映した。

| 曲 | 用途・編成 | 長さ / テンポ | WAV / OGG / MP3容量 | WAV LUFS / true peak |
|---|---|---|---|---|
| 窓辺の午後 (`cafe-lounge`) | カフェ・ラウンジ。柔らかな電気鍵盤、丸いベース、ブラシ、リム、軽いハイハット、ベル、薄いパッド | 45.714286秒 / 84 BPM | 8,064,044 / 621,745 / 915,374 bytes | −21.61 LUFS / −9.81 dBTP |
| 坂道のネオン (`shibuya-citypop`) | Tokyo city pop。明るいシンセ旋律、短い鍵盤コード、ギター風の倍音プラック、動くベース、バックビート、細かいハイハット | 34.285714秒 / 112 BPM | 6,048,044 / 519,903 / 687,064 bytes | −19.84 LUFS / −9.25 dBTP |

全WAVは44,100 Hz、ステレオ、16-bit PCM。OGGはVorbis quality 5、MP3は160 kbps。16小節の各小節に旋律・和声・ベース・打楽器を配置し、後半は別の旋律へ展開する。外部の曲やサンプルをコピーせず、原稿中のノート列と数式から音色も合成した。

## 試聴

repo rootから次のローカルサーバーを起動する。

```sh
python -m http.server 8765 --directory public
```

ブラウザーで `http://127.0.0.1:8765/audio/external-v080/bgm/preview.html` を開く。1曲目だけのPRでは `cafe-lounge-preview.html` を使う。2曲目のPRを重ねたら `shibuya-citypop-preview.html` も利用できる。

再生ボタンを押すまで音は出ない。初期の試聴音量は25%。WAV・OGG・MP3を選び、Web Audioのバッファを曲の正確な長さで繰り返す。別曲・接続試聴を開始すると先の音源は停止する。デコード後の長さが期待値から2サンプル以上ずれる形式は再生を拒否し、WAVへの切替を案内する。

各曲に4秒の `*-boundary-check.wav` がある。末尾2秒と冒頭2秒を連結しており、再生2秒地点でループ境界を聴ける。これはループ全体とは別の確認用音源である。

この担当が確認したのは生成・デコード・波形/数値・静的player検査まで。**人による試聴、実ブラウザーからの音声出力、実機SafariでのOGG対応は未確認**。音楽としての好みと長時間反復の印象は、親の試聴レビューに残す。波形があることを試聴済みとは記録していない。

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
# 1曲目だけのPRを検査するとき
python scripts/external/audio-bgm/validate.py --track cafe-lounge
```

処理は1worker、ffmpeg `threads=1` / `filter_threads=1`。各曲の `*.manifest.json` は用途、作者、originalの根拠、制作方法、配布条件URL、sample rate/channels、長さ、容量、SHA256、loop start/end frames、peak/RMS/LUFS、clipping、WAV/OGG/MP3境界、試聴未確認を保持する。全曲の実測は `measurements.json`、検査結果は `validation.json`。

初回実行はmetadata書出しの閉じ括弧不足で生成前に停止。2回目はWAV/MP3生成後、ffmpegのJSONの後ろに出力されたsummaryを含めて解析しようとして停止した。括弧とparserを修正して生成・計測を完了し、WAV/OGG/MP3のheader・hash・frame一致・peak/clipping/境界、HTMLの参照とJavaScript構文を検査した。失敗2回の原因と解消は `developmentFailureHistory` に保持し、初回全成功とは記録しない。

## 配布とPR境界

[LICENSE.md](LICENSE.md)に音源と生成物のCC0-1.0条件を記録した。third-party music/samplesは空配列。使用音色はすべて独自の倍音・包絡・ノイズ合成で、楽器録音やSoundFontを取得していない。

1曲目PRは共通の再生成/検査スクリプト、README/LICENSE、全曲実測、共通player JSとindexに加え、`cafe-lounge*` のみを含める。2曲目PRは初回の共通ファイルへ依存し、`shibuya-citypop*` を追加する。共通manifest中の2曲目情報と再生成recipeは初回に含まれるが、2曲目assetは次PRまで未提出である。既存runtime、src、保存、株価、UI、依存設定は変更しない。
