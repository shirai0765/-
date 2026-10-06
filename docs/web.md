# Shibuya Capital 0.4.7 Web版

配布ファイル名は `Shibuya-Capital-0.4.7-web.zip` です。ZIP全体を展開し、以下の方法で開いてください。0.4.7では任意の確定店舗費用、本部費増の説明、店舗近景の再操作と縦長画面の収まりを追加しています。詳細は [interaction-v047.md](interaction-v047.md)。0.4.6以下の検証値は当時の履歴として保持します。

## 0.4.7の配布記録

`/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.7-web.zip` は65,786,796 bytes、SHA256 `4ae714be55d349074d99c553439fdb815f57621b74b6e6ad74d2117b5b689df3`。同じ最終dist276ファイル・94,299,609 bytesを再ビルドせず梱包し、全CRC・収録SHA・梱包前後のdist不変を確認しました。ローカルprefixの276 HTTP/SHAと257参照も成功。旧1,103成果物のSHA/サイズ/更新時刻を保持しています。報告は `Shibuya-Capital-0.4.7-web-report.json`、`packaging-0.4.7.json`、`preservation-0.4.7.json`。

ブラウザー版0.4.7は公開済みです。公開HTTP25/選択23SHAと変更導線の実Firefox5カテゴリが成功しました。梱包の検査と公開操作は別の記録で、公開全276資産の再取得や広い0.4.6検査の再実行ではありません。[公開検証記録](published-playtest.md) を参照してください。

## 使用方法と以前の配布記録

このZIPはビルド済みのWeb版です。展開したファイルとフォルダーを、そのままHTTPSの静的ホスティングへ配置できます。`index.html`をダブルクリックして直接開く方法（`file://`）には対応していません。

手元で開く場合は、ZIPを展開し、`index.html`があるフォルダーでローカル静的サーバーを起動します。Python 3がインストール済みなら、次を実行してください。

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Windowsでは、同じ場所で `py -m http.server 8080 --bind 127.0.0.1` を使えます。ChromeまたはEdgeで `http://127.0.0.1:8080/` を開いてください。サーバーを止めるときはターミナルで Ctrl+C を押します。

保存データはブラウザーのオリジン（プロトコル・ホスト・ポート）ごとに保存されます。`localhost`と`127.0.0.1`、異なるポート、HTTPSの公開先は、それぞれ別の保存先です。引っ越す前にゲームの「設定・保存」から「保存ファイルを書き出す」でJSONを持ち出し、移行先の「ファイルから読み込む」で復元してください。ZIPには既存のセーブデータは含まれません。

経営ゲーム内で「ゲーム街」と「実測3D」を切り替えられます。実測データへ対応する地点は4区画です。全32区画は一覧から選択でき、未対応の区画は同じ区画を保ってゲーム街で操作できます。描画切替だけでは経営状態は変わりません。`real-shibuya.html`の単独ビューアも同梱しています。実測ビューアの出典・ライセンスは同画面内および同梱の `licenses/` を参照してください。

ZIP内の `MANIFEST-SHA256.txt` は、配布元の `dist/` に含まれていた全ファイルのSHA-256です。梱包時にZIPのCRCと全ファイルの内容一致を検証しています。

0.4.6では最初の操作案内を追加し、店舗管理を「商品・価格」「人員・店長」「広告・改装」「営業実績」から選べるようにしました。週末は全社利益・現金増減・来店者数を先に表示し、店舗別の結果や出来事は詳細から開けます。街の音は画面内で切り替えられます。数字の表示演出や音は、決算や保存データの値を変更しません。

0.4.6の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.6-web.zip`。65,784,617 bytes、SHA-256は `147781e40079df0ca8995428b2ea93b681c274e9b6cd87c3eeed96f386930708`（ZIP生成後に追加した配布記録です）。最終distの276ファイル（94,292,963 bytes）を再ビルドせず収録しました。全ZIP CRC・全ファイルのSHA一致・梱包前後のdist不変を確認し、Windows版にも同じ276ファイルが入っています。結果は `Shibuya-Capital-0.4.6-web-report.json` と `packaging-0.4.6.json`、SHAは `.zip.sha256` に記録しています。

ローカルの `/-/` 配下で全276ファイルのHTTP 200と内容一致、257件の資産参照を確認しました。証跡は `integration-v046/pages-prefix/result.json`。旧配布・旧検証成果物962件のSHA・サイズ・更新時刻は不変で、`preservation-0.4.6.json` に記録しています。これは配布内容とローカルHTTPの検査で、公開URLの操作やWindows実機の動作確認ではありません。

0.4.5では街を画面全体に表示し、施設を選んだときだけ詳細を開きます。経営メニュー、全32区画の一覧、実測街の表示設定は必要時に開けます。初開業後は自分のカフェの外観へ戻り、週を終了すると営業結果が届きます。

営業前の収益は幅のある見込みで、週末の実績とは区別します。店舗の客足や運営能力などに週次変動を加え、借入が残る決算の利益0以下・週末現金不足の終了条件は維持しています。過去の保存実績は保持しますが、旧会社も次週から新方式を使うため、旧版と将来の数値が一致するとは保証しません。同じ保存の再読込で営業結果を引き直す仕組みではありません。研究中の新しい株価・企業会計モデルは含みません。

0.4.5の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.5-web.zip`。65,773,832 bytes、SHA-256は `460246caa634ac4b04d0704997057f3e73beb3b0aadbe4352177b348881b8a71`（ZIP生成後の配布記録です）。最終distの276ファイル（94,254,310 bytes）を再ビルドせず収録し、全ZIP CRC・全ファイルのSHA一致・梱包前後のdist不変を確認しました。結果は `Shibuya-Capital-0.4.5-web-report.json`、SHAは同じ場所の `.zip.sha256` に記録しています。0.4.4を含む旧配布・旧検証成果物880件のSHA・サイズ・更新時刻も不変です。これは梱包の検証記録で、公開URLやWindows実機の動作確認とは区別します。

0.4.4の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.4-web.zip`。梱包後のサイズは65,769,325 bytes、SHA-256は `1a3a5d4ba65fd69ad327f0c9c1ac240ecbbdc71a6ea4099769703edb0c3c9adc`（この検査値はZIP生成後の配布記録です）。SHA-256は同じ場所の `.zip.sha256`、収録ファイルの一致検査とサイズは `Shibuya-Capital-0.4.4-web-report.json` を参照してください。最終ビルドは231テストと本番CSP検証9項目を通過しています。経営画面と実測表示の往復・保存復元・0.3.2旧保存の完全復元を確認し、同じ276ファイルを再ビルドせず梱包しました。検証はLinuxブラウザーで行ったもので、Windows実機の動作・性能を保証するものではありません。

0.4.3の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.3-web.zip`。梱包後のサイズは65,767,786 bytes、SHA-256は `f1ee23855bd761cf849e228f9b44290dff9eb20a0b8992cd2b639105ad70d157`（この検査値はZIP生成後の配布記録です）。SHA-256は同じ場所の `.zip.sha256`、正確なサイズと276配布ファイルの検査結果は `Shibuya-Capital-0.4.3-web-report.json` を参照してください。実測4地点のゲーム内選択、所有状態・地区で絞り込める全32区画一覧、財務から同じ区画への復帰を追加しています。旧版のZIP・保存データは上書きしません。本番CSP検証9項目と0.3.2旧保存の完全復元を確認しています。これはLinux Firefoxでの機能検証で、全ブラウザーやWindows実機の性能保証ではありません。

0.4.2の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.2-web.zip`（65,758,142 bytes）。SHA-256は `e63d2d68e1f30cd3c7a10638c265446b0a14a1b9427aeb3ab5e89cb120ce67f0`。276配布ファイルのSHA一致・ZIP全CRC・梱包中のdist不変を確認しました。店舗の利益・需要・能力・費用の説明、実測ビューアの画像品質切替を追加し、株式の分割売買による端数利益を修正しています。元の建物画像と形状は保持し、原寸も選べます。

0.4.1の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.1-web.zip`。初決算・上場の結果表示、比較情報の展開、投資先と財務の往復、店舗近景を更新しています。財務の編集中メモは画面間では保持しますが、ページ再読込や保存データの復元では初期化します。実際に実行した融資・投資・決算は従来どおり保存対象です。配布物のサイズと検査結果は同じ場所の `Shibuya-Capital-0.4.1-web-report.json`、SHA-256は `.zip.sha256` を参照してください。

0.4.0の配布先は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.0-web.zip`。資金調達の比較、最大3案件の買収比較、店舗の状態を考慮する営業提案、駅周辺の共同開発と3D近景への移動を追加しています。旧セーブはそのまま読み込めます。ZIPと同じ場所の `.zip.sha256` が配布物のSHA-256、`Shibuya-Capital-0.4.0-web-report.json` が全ファイルの一致検査・サイズの記録です。既存0.3.xの配布物も保持します。

0.3.1のZIPは `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.3.1-web.zip`（65,727,028 bytes）。SHA-256は `b843c62283ec6ac9e89e75a6887bd36ff5d29bc50c4bc0965989ec7d83effdb4`。276個の配布ファイルの内容一致、全ZIPのCRC、梱包中にdistが変わっていないことを確認しています。再生成は本番ビルド後に `python3 scripts/package-web.py`。0.3.0のZIPは履歴として保持しています。

0.3.2は `/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.3.2-web.zip`（65,731,841 bytes）、SHA-256 `f5499cce478b1058bac78ea38de07b5e38d3e0d264830d79c737c0924f7101f2`。276配布ファイルのSHA一致・ZIP全CRC・梱包中dist不変を確認済み。出店比較・初決算記録を追加し、0.3.1を保持しています。
