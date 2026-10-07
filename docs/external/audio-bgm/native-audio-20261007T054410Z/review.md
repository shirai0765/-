# Native音声検査 2026-10-07

既存Chromium 151.0.7922.173を1本、sandbox有効、headlessで使用。ローカルHTTPのみ127.0.0.1/localhostのproxy bypass、session proxy/TLS保持。Playwright標準のmute-audio flagを除き、renderer/RAF/AudioContext/codecは置換していない。原試聴HTMLのtrusted pointer clicksとread-only観測による検査。browser/context/serverは終了済み。

実行406.724秒、30checks中19pass/11fail。73音声・HTML・metadata fileの前後SHAは同一。原結果はresults.json、events.jsonl、原scriptはexecuted-script.mjs、原失敗は対応PNGに保全した。再試行していない。

| 実時間観測 | AAC loop period | live sourceとAudioContext clockの観測秒 |
| --- | ---: | ---: |
| café lounge | 45.714285714 | 137.148662132 |
| citypop | 34.285714286 | 102.870204082 |
| 新床音 | 44.977 | 134.939863946 |

3周の範囲だけ実時間で待ち、10秒間隔のclock/source観測を保存した。decoded AudioBufferからのsample peak、clip count、周期RMS、2継ぎ目のsample差・周辺20ms RMSは別の数学的検査で、物理出力の録音ではない。音の聴感、物理speaker、実機Safari、ゲームruntime内の混音/crossfadeは未検証。

成功: 両BGMのAAC/OGG/MP3/WAV decode・再生開始・AudioContext進行・明示loop、AAC短試聴のnative HTMLAudioElement playhead進行、停止と初期/再読込時のautostart無し。新床音AAC/MP3のdecode・loop・停止、旧WAV床音と旧WAVボタンSFXも成功した。AudioContextは停止ボタン後もrunningだが、source/cueがnull、media pausedで再生sourceの停止を確認した。

実失敗: 新床音OGGの提出loopEndは45.0秒、native decodeは44.999977324秒（44.1kHzで1frame短い）。original試聴ページはloopEnd>buffer.durationの厳格guardで再生を止めた。OGG自体のdecodeは成功しているため、codec非対応ではない。AACは0.0195〜44.9965秒、MP3は0.012666667〜44.982秒でnative buffer内に収まり成功した。

10新SFXは直前のOGGを選んだまま床音setupを要求する検査scriptだったため、同じguardでcue操作前に止まった。10件はsetupによる未検証で、SFX音源の故障10件と数えない。次の限定検査はAAC床音を明示し、10cueを個別にtriggerしてdecode/開始/停止を確認すること。OGG差への対応は、作者がdecode/境界を再測定するか、runtime側で1frame程度の差を明示的に扱うかを親側で判断する。勝手なtrim・guard無効化・metadata差替えは行っていない。

初期snapshotではcontextなし/media paused/currentTime0を確認した。一方、評価API上のuserActivationはtrueも記録されているため、ブラウザーautoplay-policyの完全な未操作block試験とは主張しない。再生は原UIのtrusted BUTTONクリックを確認した。media preload中のERR_ABORTEDと404 console errorもresults.jsonへ原保存しており、native再生の成功とは区別する。ページ間の曲切替は明示stop→次の原ページ→新gestureであり、ゲーム内music selectorの検証ではない。
