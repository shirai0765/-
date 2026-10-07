# Shibuya Capital 0.9.0 Web版

0.9.0は、承認済みCity Burst案の営業結果・出店・銀行・市場画面、ライセンス付きのフォントとアイコン、短い確定演出を追加します。初営業の案内を保ち、外部制作のカフェBGMを手動で開始できます。詳細と検証範囲は [0.9.0の記録](interaction-v090.md)。

0.8.0は取引物件を72件、背景の景観表示候補を349棟へ増やし、物件・店舗名検索、購入価格順、角度とズームを保つ明示的な場所表示を追加します。598テストと本番ビルドが成功しました。保存形式と旧物件の値を保持します。実操作・配布・公開の最新結果は [0.8.0の記録](interaction-v080.md) を参照してください。

0.7.0は、初めての全目標達成の記録と専用画面、実績に基づくIPO、借入契約IDの修正を含みます。仕様と最新の検証範囲は [0.7.0の記録](interaction-v070.md)。

0.6.1は、全画面の週末レビュー・その週の街と企業ニュース・ワンタップのカフェ音・銀行の融資審査を追加します。会社データの形式は維持しています。仕様と検証範囲は [0.6.1の記録](interaction-v061.md) を参照してください。

配布ファイルは `Shibuya-Capital-0.9.0-web.zip`。展開後の使用方法は以下と共通です。

## 0.8.0の確定記録

Web ZIPは65,826,270 bytes、SHA256 `0fb8108c5e5dddc92c2dfdf8be4596417d190d9fab924373addab32841e0f6b6`。同じ検証済み276 distファイルの全SHAとCRCを照合し、再ビルドせず収録しました。Pages `1724d6f`／run `37579278400`、公開HTTP25件と選択23資産SHA、公開WebKitでの開業・一週の実決算・保存再読込が成功しています。保存された証拠とsource archiveの全Git blob照合は [0.8.0の記録](interaction-v080.md) を参照してください。

## 0.7.0の梱包検証

Web ZIPは65,822,338 bytes、SHA256 `0dcc974b8ac151184bd3b4dfd422f9e966395c45c47b72bc1ef9bb0497396a99`。検証済みbuild-01の276ファイル・94,431,503 bytesを再ビルドせず収録し、全CRCと全収録SHAが一致しました。旧3,141成果物はサイズ・更新時刻を照合して保持しています。この段落は梱包後に追記した記録です。

[ブラウザー版0.7.0](https://shirai0765.github.io/-/?v=0.7.0) を公開済みです。runtime source `57e90617f841e8be0a452a949f0d2afd758cdf68`、Pages `9bc6137b2802d41cee4ee02479fc8185fee47aa6`、Pages run `37574472075` 成功。公開HTTP25件／選択23資産SHA、releaseの版・source・indexが一致しました。全276公開資産の再取得ではありません。公開WebKitでも、自然進行の達成直前セーブを通常の取込から読み、一週を実際に決算して達成画面を出し、完全一致する書出し・再読込を確認しました（変更した公開導線1カテゴリ）。エラー・警告・失敗要求・観測CSP違反0。記録は `deploy-0.7.0/public-playtest/results.json`。広い銀行・音声・街の検査を公開で繰り返した結果ではありません。 詳細は [interaction-v070.md](interaction-v070.md)。

## 0.6.1の梱包検証

Web ZIPは65,818,519 bytes、SHA256 `98f7a8c9b5c839c392dc523d9e9258717bc38676840a10dcc283c419d14abce7`。検証済みbuild-03の276ファイル・94,413,649 bytesを再ビルドせず収録し、全CRCと全収録SHAが一致しました。旧2,971成果物はサイズ・更新時刻を照合して保持しています。この段落は梱包後に追記した記録です。

[ブラウザー版0.6.1](https://shirai0765.github.io/-/?v=0.6.1) は公開済み。Pages run37570361019と公開HTTP25件／選択23資産SHAの照合が成功しました。詳細は [interaction-v061.md](interaction-v061.md)。

## 以前の0.6.0の配布記録

配布ファイル名は `Shibuya-Capital-0.6.0-web.zip` です。ZIP全体を展開し、以下の「使用方法」で開いてください。

0.6.0では、48か所から人通り・賃料を見て出店を選び、街の銀行・証券市場から資金調達できます。カフェの利益見込み表示を外し、営業後の実績を次の判断につなげます。週末の自動保存と旧会社の読込に対応します。仕様と検証範囲は [interaction-v060.md](interaction-v060.md) を参照してください。

## 0.6.0の配布記録

`/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.6.0-web.zip` は65,805,262 bytes、SHA256 `307077a158c58d70dacb2edc4dda98a8d908f30f0fe70b72e99eac317ff71627`。最終build-04の276ファイル・94,358,262 bytesを再ビルドせず梱包し、CRC・全収録SHAが一致しました。既存2,622成果物はサイズ・更新時刻を照合して保持しました。この段落は梱包後の記録です。

[ブラウザー版0.6.0](https://shirai0765.github.io/-/?v=0.6.0) は公開済み。Pages run37567470986と公開HTTP25件／選択23資産SHAの照合が成功しました。実操作の最新結果は [interaction-v060.md](interaction-v060.md) を参照してください。

## 0.5.0の配布記録

`/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.5.0-web.zip` は65,798,726 bytes、SHA256 `4bc411b697473743d3e8e3930a6dfe5bc6fec45cfa435342b73930a01d7cb8ad`。最終dist276ファイル・94,340,876 bytesを再ビルドせず収録し、CRC・全収録SHA・凍結入力との一致を確認しました。ローカルのPages相対パスと、梱包直前の1,957成果物のサイズ/更新時刻も照合しました。これは梱包後の記録で、ZIP内文書には含まれません。公開検証は [interaction-v050.md](interaction-v050.md) で確認してください。

[ブラウザー版0.5.0](https://shirai0765.github.io/-/?v=0.5.0) は公開済みで、公開HTTP25件/選択23資産SHAと、実Firefoxによる事業計画の比較・開始・26週営業・保存再開の3カテゴリが成功しました。詳しい範囲は [interaction-v050.md](interaction-v050.md) を参照してください。

## 0.4.10の配布記録

`/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.10-web.zip` は65,790,235 bytes、SHA256 `5adf7f3330c84a3ff465570720cca8517f3b7259c472a154683a802af9e32552`。最終dist276ファイル・94,308,196 bytesを再ビルドせず収録し、CRC・全収録SHA・凍結入力との一致を確認しました。ローカルprefixの276 HTTP/257参照も成功。旧1,446成果物のサイズ/更新時刻を照合し、以前のSHA記録を保持しています。旧SHAの再走査は行っていません。証拠は `Shibuya-Capital-0.4.10-web-report.json`、`packaging-0.4.10.json`、`preservation-0.4.10.json`。この段落はZIP作成後の記録です。公開検証は [interaction-v0410.md](interaction-v0410.md) で確認してください。

[ブラウザー版0.4.10](https://shirai0765.github.io/-/?v=0.4.10) は公開済みで、公開HTTP25件/選択23資産SHAと公開実Firefox2導線も成功しました。13週の保存後の通常再読込を含み、範囲は中央記録へ集約しています。

## 0.4.9の配布記録

`/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.9-web.zip` は65,789,515 bytes、SHA256 `99c1d5bc87057dd5d9ee6db338523339f5623a68897577ee7486ad1157909a20`。最終dist276ファイル・94,305,976 bytesを再ビルドせず収録し、CRC・全収録SHA・凍結入力との一致を確認しました。ローカルprefixの276 HTTP/257参照も成功。旧1,360成果物のサイズ/更新時刻を照合し、以前のSHA記録を保持しています。旧SHAの再走査は行っていません。証拠は `Shibuya-Capital-0.4.9-web-report.json`、`packaging-0.4.9.json`、`preservation-0.4.9.json`。この段落はZIP作成後の記録です。[公開版0.4.9](https://shirai0765.github.io/-/?v=0.4.9) のHTTP25件/選択23資産SHAと公開実操作2導線は成功し、範囲は [interaction-v049.md](interaction-v049.md) に記録しています。

## 0.4.8の配布記録

`/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.8-web.zip` は65,788,762 bytes、SHA256 `ddd1475b0fabfeb9491bf0c9a0f0fbd1284e3c047e48c4be793bcac5acc0fab2`。最終dist276ファイル・94,304,852 bytesを再ビルドせず収録し、CRC・全収録SHA・凍結入力との一致を確認しました。旧1,309成果物のサイズ/更新時刻を照合し、以前のSHA記録を保持しています。旧SHAの再走査は行っていません。証拠は `Shibuya-Capital-0.4.8-web-report.json`、`packaging-0.4.8.json`、`preservation-0.4.8.json`。この段落はZIP作成後の記録です。公開検証は [interaction-v048.md](interaction-v048.md) で確認してください。

[ブラウザー版0.4.8](https://shirai0765.github.io/-/?v=0.4.8) は公開済みです。公開HTTP25件・選択23資産SHAと、公開ガイドの実Firefox1カテゴリが成功しました。通常の旧保存取込・ガイド操作の確認で、公開での破損保存注入や全資産の再取得ではありません。

## 0.4.7の配布記録

`/workspace/shared/shibuya-artifacts/Shibuya-Capital-0.4.7-web.zip` は65,786,796 bytes、SHA256 `4ae714be55d349074d99c553439fdb815f57621b74b6e6ad74d2117b5b689df3`。同じ最終dist276ファイル・94,299,609 bytesを再ビルドせず梱包し、全CRC・収録SHA・梱包前後のdist不変を確認しました。ローカルprefixの276 HTTP/SHAと257参照も成功。旧1,103成果物のSHA/サイズ/更新時刻を保持しています。報告は `Shibuya-Capital-0.4.7-web-report.json`、`packaging-0.4.7.json`、`preservation-0.4.7.json`。

ブラウザー版0.4.7は公開済みです。公開HTTP25/選択23SHAと変更導線の実Firefox5カテゴリが成功しました。梱包の検査と公開操作は別の記録で、公開全276資産の再取得や広い0.4.6検査の再実行ではありません。[公開検証記録](published-playtest.md) を参照してください。

## 使用方法

このZIPはビルド済みのWeb版です。展開したファイルとフォルダーを、そのままHTTPSの静的ホスティングへ配置できます。`index.html`をダブルクリックして直接開く方法（`file://`）には対応していません。

手元で開く場合は、ZIPを展開し、`index.html`があるフォルダーでローカル静的サーバーを起動します。Python 3がインストール済みなら、次を実行してください。

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Windowsでは、同じ場所で `py -m http.server 8080 --bind 127.0.0.1` を使えます。ChromeまたはEdgeで `http://127.0.0.1:8080/` を開いてください。サーバーを止めるときはターミナルで Ctrl+C を押します。

保存データはブラウザーのオリジン（プロトコル・ホスト・ポート）ごとに保存されます。`localhost`と`127.0.0.1`、異なるポート、HTTPSの公開先は、それぞれ別の保存先です。引っ越す前にゲームの「設定・保存」から「保存ファイルを書き出す」でJSONを持ち出し、移行先の「ファイルから読み込む」で復元してください。ZIPには既存のセーブデータは含まれません。

経営ゲーム内で「ゲーム街」と「実測3D」を切り替えられます。実測データへ対応する地点は4区画です。全32区画は一覧から選択でき、未対応の区画は同じ区画を保ってゲーム街で操作できます。描画切替だけでは経営状態は変わりません。`real-shibuya.html`の単独ビューアも同梱しています。実測ビューアの出典・ライセンスは同画面内および同梱の `licenses/` を参照してください。

ZIP内の `MANIFEST-SHA256.txt` は、配布元の `dist/` に含まれていた全ファイルのSHA-256です。梱包時にZIPのCRCと全ファイルの内容一致を検証しています。

## 0.4.6以前の配布記録

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
