# v0.8.0 音源受入れ・統合監査

公開済みv0.8.0ランタイムの監査と、v0.9.0向けに外部チームのBGM 2案・店内音・効果音を受け取るための技術契約。UI画像の選定とは独立して音を評価する。

## 確認した現状と未確認の音質

- [CityAudioEngine.ts](../../../src/audio/CityAudioEngine.ts) の従来音源は78 BPM、4拍子、8小節（約24.62秒）の固定和音・2音旋律を繰り返す。音色はsine／triangleとローパス、ベース・パッド・旋律のみ。ドラム、フレーズ展開、空間系処理・明示的な定位はない。音源を指定しない既存constructorにはこの従来音源を残し、v090画面の開始は下記の受入済み曲へ置換した。
- 従来の店内音は8秒のモノラル合成ノイズを反復し、両端60 msをゼロまで減衰する。カップ音は毎小節、コーヒー音は3小節ごとに同じ周波数／音素材で鳴る。営業イベントからの発音ではない（同ファイルの`makeRoomBuffer`／`schedule`）。短い反復、似た発音、拍に同期する効果音、狭い音像は単調さの原因候補。聴感による断定はしていない。
- master／music／ambienceの3ゲイン、共通コンプレッサー（threshold −18 dB、ratio 3）、消音・音量の平滑化がある。音源を増やすだけでは混合時のクリッピング防止を証明できない。
- [CityAudioSession.ts](../../../src/audio/CityAudioSession.ts) はユーザー操作内でコンテキスト生成と`resume()`を開始する。開始確認は8秒で打切り、古い非同期結果をrevisionで無効化。非表示・Safariの`interrupted`・再試行・破棄を扱い、毎回の画面読込みは停止から始まる。
- [CityAudioControl.tsx](../../../src/ui/CityAudioControl.tsx) の音量・消音・BGM・店内音は`shibuya-capital-city-audio-v1`のブラウザー設定。会社の保存とは独立。監査時の消音ボタン名は「BGMを消音」だったが、実際には店内音も含むmasterを消音するため、v090変更では「音を消音」に合わせた。効果音も既存の店内音バスに従う。

過去の証拠は[interaction-v061.md](../../interaction-v061.md)と`/workspace/shared/shibuya-artifacts/deploy-0.6.1/public-playtest/results.json`。Linux WebKitの実出力経路から各71,680サンプルのPCMブロックを採取し、BGMのみpeak 0.34556／RMS 0.07924、店内音のみ0.29788／0.06752、消音は両方0だった。再開時の同一コンテキスト、再読込みの自動再生なし、音設定による会社保存不変も確認済み。非連続の測定であり、曲全体のLUFS・true peakやスピーカー試聴の証拠ではない。

旧`interaction-v046/audio/original-city-bgm-30s.wav`は研究用OfflineAudioContextで生成した合成曲の診断。非ゼロ信号と旧ループ境界の数値確認のみ。今回の新音源は独立したファイル測定まで実施。聴感の試聴、物理iPhone Safari、実スピーカー／ヘッドホン、OS割込みの実機確認は未実施。

## 外部チームへの納品条件

以下は今回の推奨値。測定値とファイルを受け取ってから受入れを判断する。

| 対象 | 条件 |
| --- | --- |
| BGM試聴2案 | 各20–30秒、同じ基準音量。導入だけでなく主フレーズと音色・リズムが判断できる範囲。café lounge／city popを別ファイルで納品 |
| 最終BGM | 今回の発注は30–60秒の循環。少なくとも2つのフレーズ／伴奏変化があり、主旋律を常時押し出さない。歌詞・語りなし |
| 原盤 | PCM WAV、44.1又は48 kHz、24-bit。BGMはstereo、短い定位不要の効果音はmono可。ピーク・ノイズ・ループ処理後の原盤を保存 |
| ブラウザー配布 | BGMはAAC-LC `.m4a`、160–192 kbps stereoを第一候補。実ブラウザーの`decodeAudioData`で成功を確認して採用。短いSFXは16-bit WAVで十分。Oggのみの配布は避ける |
| 音量 | BGM −20 ±2 LUFS-I、true peak ≤−1 dBTP。店内床音 −28 ±3 LUFS-Iを目安。短いSFXはsample peak ≤−6 dBFS、素材ごとの聴感差を調整。無音や非常に短いSFXをLUFSだけで正規化しない |
| ループ | 開始／終了は完全な拍・フレーズ位置。残響の尾を次の頭へ自然につなぐ。3周連続でクリック・空白・周期的な音量落ちがない。AACの遅延／paddingを含め、実際にデコードしたbufferの`loopStart`／`loopEnd`秒を確認。原盤sample位置を無検証で流用しない |
| 端点／開始停止 | SFXの不要なDC・途切れを除き、必要な箇所に2–5 ms程度の端点処理。店内床音は必要なら20–50 msの循環クロスフェード。BGM全体を毎周ゼロへfadeする方法は避ける。開始停止のゲイン平滑化も保持 |
| 店内音・FX | 床音45–60秒を目安、聞き取れる会話なし。カップ・注湯／スチーム各2–3変種、0.1–4秒程度。床音に大きな効果音を焼き込まず、別素材で頻度を制御。カップ毎小節という現状の配置を踏襲しない |
| サイズ | BGM各≤1.5 MB、2曲＋店内音＋SFXの配布合計≤8 MBを目安。60秒／192 kbpsは約1.44 MB。稼働曲だけを初期decodeし、decoded buffers合計≤64 MiBを目安（48 kHz stereo Float32の60秒は約22 MiB） |
| 記録 | 作者／配布許諾、SHA256、形式、sample rate／channels、秒数／bytes、LUFS-I・true peakと測定手法、原盤のループsample位置と配布版の検証済み秒位置を添付 |

最終出力はmaster／両チャンネル100%でBGM＋床音＋最大想定FX重なりを測定し、true peak ≤−1 dBTPと目立つポンピングがないことを確認する。素材単体の値や既存コンプレッサーだけで合格としない。モノラル化と小型スピーカー相当の再生でもリズム・中域の楽器が失われないことを聴く。

## 2案の試聴判定

| 案 | 聴く点 | 現在の判定 |
| --- | --- | --- |
| café lounge | 鍵盤の倍音包絡、控えめなベースとリズム、フレーズの呼吸。合成パッドだけの静的な反復になっていないか | PR9受領・数値合格。既定に採用、聴感は未評価 |
| city pop | ベースとドラムのまとまり、コード／伴奏の変化、明るさと落ち着きの両立。短い主旋律・高域が長時間の操作を妨げないか | PR10受領・数値合格。比較previewを保持、聴感は未評価 |

同音量で比較し、「音色の厚み」「フレーズ展開」「操作中の邪魔になりにくさ」「小型スピーカー／mono」「ループ接続」を各短評で記録する。測定だけの評価を試聴済みと呼ばない。20–30秒の案は方向性を選ぶ材料であり、完成曲の長時間疲労やループ受入れを証明しない。

受領版は2曲とも16小節・44.1 kHz stereo／16-bit WAVとMP3／OGG、曲別preview HTML、末尾2秒＋冒頭2秒の4秒boundary WAV。24-bit原盤は今回未提出だが、16-bit配布版のclip 0・接続・音量を確認し、rootのWAV／OGG納品指定の範囲で受け入れた。[音源LICENSE](../audio-bgm/LICENSE.md)は録音・作曲・波形をCC0-1.0とし、作者の第三者曲・録音・SoundFont不使用の声明は制作recipeの数式・ノート列・固定seedノイズと整合する。

受入対象はPR9 head `0ec95b0ec59dcd4d58f3a814b5b1b2c5fbc9e36e`、PR10 head `4e4987d44e4b8844e7440807e825ea64be33daa5`。独立したSHA／容量／header／FFmpeg decodeで全6ファイルを照合し、1周のframesはカフェ2,016,000／シティ1,512,000でmanifestと一致。1threadの3周連結測定は下表。全clip 0、接続差は周辺100 msの通常の隣接差より12 dB以上小さい。AACは提出されていない。

| 配布曲 | 秒／テンポ | 3周MP3 LUFS-I／true peak | MP3接続差／容量 |
| --- | --- | --- | --- |
| 窓辺の午後・café lounge | 45.714286秒／84 BPM | −22.03 LUFS／−10.26 dBTP | −66.69 dBFS／915,374 bytes |
| 坂道のネオン・city pop | 34.285714秒／112 BPM | −20.26 LUFS／−9.70 dBTP | −55.71 dBFS／687,064 bytes |

カフェを長時間の経営向けの既定とした。実recipeは58% swingのhat、brush／rim、丸い3音のbass、小刻みに減衰する鍵盤倍音を配置。シティは112 BPMのkick／snare backbeat、guitar風pluck、1小節6音のbassで密度が高い。両曲の後半は別旋律、円環残響・左右定位を持ち、decoded信号にも非ゼロのside成分がある。従来の8小節・小節ごと2音の旋律・打楽器なしから編成と展開が増えたという事実で選定し、より良い聴感や疲れにくさを測定から断定しない。

独立証拠は`/workspace/shared/shibuya-artifacts/completion-v090/audio/external-bgm-independent-01.json`と`audit-submitted-bgm.py`。既存FFmpeg／NumPyで順次1thread処理し、原盤の再生成は行わなかった。試聴用toolはこの環境に公開されておらず、人の試聴・実ブラウザーのcodec／出力確認は別枠に残る。

## 最小統合計画

1. 現在のsession／音量設定／HUDを保ち、エンジン内の合成BGM・床音・FXの発音部だけを同一AudioContextのbuffer sourcesへ置換。既存music／ambienceバスへ接続し、合成音と新音源を二重に鳴らさない。2案の選定はUI画像の選定と結び付けず、未決定の曲選択UIを先に追加しない。
2. 明示的な開始操作の中で先にcontext生成・`resume()`を呼ぶ。音源のfetch／decodeをその前に`await`しない。音源は同梱・同一origin、Viteの相対base／Pagesサブパスで解決し、WindowsのCSPでも外部通信を増やさない。
3. decode完了・必要なsourceの開始までは`starting`を保つ。現状の`playing`はtimerの有無で確認するため、新方式では「必要なbufferが準備済みでsource開始済み」と実context状態を組み合わせる。8秒のtimeout、取得失敗、decode失敗を既存の可視な再試行へつなぐ。失敗を無音の「再生中」で隠さない。
4. pause／キャンセル／非表示／timeout／dispose／retryで遅いfetch・decode・`onended`が音を再開しないよう、revision＋engine identityと取得中断を管理する。BGM sourceは一度だけ開始し、再開で重複しない。非表示／割込み後の復帰は既存のユーザー意図を尊重し、閉じたcontextの再作成は新しい操作から行う。
5. 初期実装は選定済みの稼働曲だけをdecodeする。効果音の最大同時発音と間隔を制限し、BGMの拍ではなく疎らな独立タイミングに置く。会社の経済・乱数・セーブへ接続しない。設定keyを維持し、曲データ・playback状態を会社保存へ入れない。全source／timer／取得／buffer参照を破棄時に解放する。

音源統合後はQA担当の単独ブラウザー枠で同じ音源のSafari系／Chromiumデコード、実PCM、3周ループ、100%混合、Pages/CSP、再読込み停止、会社export不変を確認する。物理iPhone・スピーカーによる試聴は独立した未完了項目として残す。最初のコード監査はread-onlyで行った。下記v090準備でCPUテストを実施したが、依存追加、ブラウザー／GPU起動、全体test／buildは行っていない。

### v0.9.0の実装とCPU確認（受入済みBGMを有効化）

[CityAudioCues.ts](../../../src/audio/CityAudioCues.ts)に`emitCityAudioCue({ kind: 'button' })`と`emitCityAudioCue({ kind: 'weekly', reportKey: state.id + ':' + report.week, netProfit: report.netProfit, reducedMotion, gameOver })`を実装した。既存のAudioControlが登録したsessionへ通知するだけで、context生成や再生開始を行わない。master／店内音バスの設定を尊重し、再生未開始・非表示・pause・mute・loading中は捨て、後から鳴らすqueueを持たない。

週の音はUIが既存の初回reveal判定を通過した確定値を表示する瞬間に一度だけ要求する。`reportKey`による重複防止は200件までの表示用の記憶とし、消音中の要求も消費済みにする。純利益が正で経営終了でない週だけ短い明るい結果音、負・ゼロ時は控えめな確定音、reduced motion時は結果音を抑制する。数値の桁ごとの連打、赤字での勝利音、reopen／importでの祝音、会社保存の追加を行わない。既存Engine／Sessionのメソッドとconstructorは互換にし、AudioControlだけが任意の新音源設定を渡す。

[CityAudioAssets.ts](../../../src/audio/CityAudioAssets.ts)は実在するローカル配布版の順次codec代替、loop範囲、decoded buffersの64 MiB制限と取消しを扱う。rootが受入済み2PRをmergeした後、実repoの全6hashを再照合して`CITY_AUDIO_ASSETS`を有効化。カフェMP3を先に取得し、decode失敗時だけOGGを試す。loopは0→2,016,000/44,100秒、gain 1。48 kHz等へのresampleで終了時刻が短く丸まる場合は、decodedの1sample以内だけ許容してbuffer.durationへclampする。大きな範囲違反は拒否する。

WAVの自動取得、2曲の一括decode、別originへの通信、新しいcontext、追加channel設定はない。シティの曲と比較previewは保存。録音の床音・SFXは未受領のため有効化せず、従来のroom loopと短い合成のボタン／結果確認音を既存グラフで使う。asset modeでは旧合成BGMを重ねない。pause／OS中断では確認音の声と補助nodeを直ちに破棄して、復帰時に古い結果音の尾を再開しない。公開済みとする判断や新BGMのネイティブ出力確認はroot／QAの次工程。

`/workspace/shared/shibuya-artifacts/completion-v090/audio/focused-04.json`：既存16＋新規14、合計30/30成功、失敗0、maxWorkers 1。前段28／29／30成功の記録も別名で保持。`source-sha256-04.json`に担当8ファイルのSHAと有効なconfigを記録。新規検査はgesture内resume→fetch順、decode待ちの正確な状態、遅い結果の破棄、8秒timeout／新tap retry、loop再利用、cueのmute／ゼロ／非表示／pause／重複／符号／reduced motion／経営終了、OS中断後のcue tail破棄、Pages相対パス・codec代替・loop不正・予算制限、実カフェ周期の44.1→48 kHz丸め受入れ／1sample超え拒否。AudioContext／decodeのmock契約であり、実codec・実OS中断・新しい曲の試聴を証明しない。
