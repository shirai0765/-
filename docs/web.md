# Shibuya Capital 0.4.3 Web版

このZIPはビルド済みのWeb版です。展開したファイルとフォルダーを、そのままHTTPSの静的ホスティングへ配置できます。`index.html`をダブルクリックして直接開く方法（`file://`）には対応していません。

手元で開く場合は、ZIPを展開し、`index.html`があるフォルダーでローカル静的サーバーを起動します。Python 3がインストール済みなら、次を実行してください。

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Windowsでは、同じ場所で `py -m http.server 8080 --bind 127.0.0.1` を使えます。ChromeまたはEdgeで `http://127.0.0.1:8080/` を開いてください。サーバーを止めるときはターミナルで Ctrl+C を押します。

保存データはブラウザーのオリジン（プロトコル・ホスト・ポート）ごとに保存されます。`localhost`と`127.0.0.1`、異なるポート、HTTPSの公開先は、それぞれ別の保存先です。引っ越す前にゲームの「設定・保存」から「保存ファイルを書き出す」でJSONを持ち出し、移行先の「ファイルから読み込む」で復元してください。ZIPには既存のセーブデータは含まれません。

0.4.3では経営ゲーム内で「ゲーム街」と「実測3D」を切り替えられます。実測データへ対応する地点は4区画です。全32区画は一覧から選択でき、未対応の区画は同じ区画を保ってゲーム街で操作できます。描画切替だけでは経営状態は変わりません。`real-shibuya.html`の単独ビューアも同梱しています。実測ビューアの出典・ライセンスは同画面内および同梱の `licenses/` を参照してください。

ZIP内の `MANIFEST-SHA256.txt` は、配布元の `dist/` に含まれていた全ファイルのSHA-256です。梱包時にZIPのCRCと全ファイルの内容一致を検証しています。

0.4.3の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.3-web.zip`。梱包後のサイズは65,767,786 bytes、SHA-256は `f1ee23855bd761cf849e228f9b44290dff9eb20a0b8992cd2b639105ad70d157`（この検査値はZIP生成後の配布記録です）。SHA-256は同じ場所の `.zip.sha256`、正確なサイズと276配布ファイルの検査結果は `Shibuya-Capital-0.4.3-web-report.json` を参照してください。実測4地点のゲーム内選択、所有状態・地区で絞り込める全32区画一覧、財務から同じ区画への復帰を追加しています。旧版のZIP・保存データは上書きしません。本番CSP検証9項目と0.3.2旧保存の完全復元を確認しています。これはLinux Firefoxでの機能検証で、全ブラウザーやWindows実機の性能保証ではありません。

0.4.2の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.2-web.zip`（65,758,142 bytes）。SHA-256は `e63d2d68e1f30cd3c7a10638c265446b0a14a1b9427aeb3ab5e89cb120ce67f0`。276配布ファイルのSHA一致・ZIP全CRC・梱包中のdist不変を確認しました。店舗の利益・需要・能力・費用の説明、実測ビューアの画像品質切替を追加し、株式の分割売買による端数利益を修正しています。元の建物画像と形状は保持し、原寸も選べます。

0.4.1の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.1-web.zip`。初決算・上場の結果表示、比較情報の展開、投資先と財務の往復、店舗近景を更新しています。財務の編集中メモは画面間では保持しますが、ページ再読込や保存データの復元では初期化します。実際に実行した融資・投資・決算は従来どおり保存対象です。配布物のサイズと検査結果は同じ場所の `Shibuya-Capital-0.4.1-web-report.json`、SHA-256は `.zip.sha256` を参照してください。

0.4.0の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.0-web.zip`。資金調達の比較、最大3案件の買収比較、店舗の状態を考慮する営業提案、駅周辺の共同開発と3D近景への移動を追加しています。旧セーブはそのまま読み込めます。ZIPと同じ場所の `.zip.sha256` が配布物のSHA-256、`Shibuya-Capital-0.4.0-web-report.json` が全ファイルの一致検査・サイズの記録です。既存0.3.xの配布物も保持します。

0.3.1のZIPは `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.3.1-web.zip`（65,727,028 bytes）。SHA-256は `b843c62283ec6ac9e89e75a6887bd36ff5d29bc50c4bc0965989ec7d83effdb4`。276個の配布ファイルの内容一致、全ZIPのCRC、梱包中にdistが変わっていないことを確認しています。再生成は本番ビルド後に `python3 scripts/package-web.py`。0.3.0のZIPは履歴として保持しています。

0.3.2は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.3.2-web.zip`（65,731,841 bytes）、SHA-256 `f5499cce478b1058bac78ea38de07b5e38d3e0d264830d79c737c0924f7101f2`。276配布ファイルのSHA一致・ZIP全CRC・梱包中dist不変を確認済み。出店比較・初決算記録を追加し、0.3.1を保持しています。
