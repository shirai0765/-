# A01 独立試聴ページのnative確認

2026-10-07 UTC、既存Chromium 151.0.7922.173、sandbox有効、1 browser、ローカルHTTP。原試聴ページのtrusted mouse操作で確認した。AudioContext、codec、renderer、RAF、TLSは置換せず、新しい依存を導入していない。原結果・実行したscript・events・所見・hashは [native-audio-20261007T054410Z](native-audio-20261007T054410Z/results.json) に保存した。

両曲それぞれAAC/OGG/MP3/WAVで実decode、明示境界、live source、AudioContext clock進行、停止を確認した。24秒AAC試聴のHTMLAudioElement playheadも進行した。初期と再読込ではcontextなし・media pausedで、ページによる自動再生はなかった。評価API上のuserActivationはtrueも観測しているので、ブラウザーのautoplay policy全体の検査とはしない。

| AAC全曲 | 指定周期 | live sourceとclockの実時間観測 |
| --- | ---: | ---: |
| café-lounge | 45.714285714秒 | 137.148662132秒、3周期以上 |
| shibuya-citypop | 34.285714286秒 | 102.870204082秒、3周期以上 |

native AudioBufferの選択周期を数学的に3回連結した別の数値確認では、両曲全4形式でclip 0、継ぎ目付近の−80dBFS未満20ms窓 0を確認した。これはspeakerの録音や人の聴感ではない。stop後はcontextがrunningのままでもsource null・media pausedを確認した。曲切替はstop→別の原ページ→新gestureの範囲で、ゲーム内selector/crossfade/mute/保存の検査ではない。

原runはSFXを含め30項目中19成功・11失敗であり、総合合格に書き換えていない。BGMの14項目は成功。床音OGGは44.1kHz decodeで1frame短くなって厳格guardが停止し、後続10 cueは同じ床音setupで未実行だった。SFX側で修正・限定再検査を別に扱う。原失敗画像はSFX納品に保存する。preload中のERR_ABORTEDと404 console記録も原結果に維持した。

この証拠は両BGMとSFXを持つ班内の制作checkoutで採ったもの。各曲PRに含む音声のSHAは元runのものと一致し、元run内の他曲/SFXファイルまでこのPR単体に同梱したという意味ではない。技術確認であり、人の聴感、物理出力、Safari実機、ゲームruntime内の混音は未測定。作者時点のmanifestにある未試聴記録は履歴として保持し、この追加観測と分けて読む。
