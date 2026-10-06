# Windows ポータブル版

0.4.7の配布ファイル名は `Shibuya-Capital-0.4.7-win32-x64.zip` です。ZIP全体を展開し、以下の手順で起動してください。SHA・サイズ・梱包検証の実結果は生成後の配布記録へ記載します。0.4.6以下のSHAと検証結果は当時の記録として保持し、今回へ転用しません。変更範囲は [interaction-v047.md](interaction-v047.md) を参照してください。

対象は Windows 10 / 11 の x64（AMD Ryzen / Intel）。ZIP 全体を展開して、フォルダー内の `Shibuya Capital.exe` を開きます。Node.js のインストールは不要です。EXE だけ移動せず、DLL、resources、locales など同梱ファイルを一緒に保管してください。

この開発版はコード署名されていません。Windows 実機での起動・描画・保存復元・性能は未確認です。Linux 上での梱包、ZIP 整合性、同梱ファイル検査と、Windows 上での動作確認は別です。

## 再作成

Node.js / npm と Python 3 を用意し、リポジトリ直下で実行します。

```sh
npm ci
npm run build
python3 scripts/package-windows.py
python3 scripts/verify-windows.py
```

ZIP には `app-files.sha256.json`（同梱アプリの全ファイルの SHA256）と `build-info.json`（Electron のバージョンと取得時の SHA256）も含まれます。

出力は `release/windows/Shibuya-Capital-<version>-win32-x64.zip` と SHA256 ファイルです。別の出力先は `--output /path/to/windows` で指定できます。`--download-only` は Electron の取得・検証だけを行い、アプリのビルドには触れません。Python スクリプトはビルド済み `dist` を使用するので、コード変更後は必ず先にビルドしてください。

Electron は `44.5.1` に固定しています。公式 GitHub Releases の Windows x64 ZIP と `SHASUMS256.txt` を TLS 検証ありで取得し、SHA256 一致後にのみ利用します。初回は github.com とその公式リリース配信先への HTTPS アクセスが必要です。取得物は出力先の `.electron-cache` に保存し、再実行時もチェックサムを検証します。不一致は処理を停止します。通信・証明書検証を無効化しないでください。

配布 ZIP は Electron のランタイム、ライセンス、Chromium 関連ファイルを保持し、`resources/app` に `dist`、`desktop`、最小限の package.json を入れます。ZIP 内の順序とタイムスタンプを固定しており、同じ入力から同じ成果物を作成できます（同じ Python / zlib 環境）。出力 ZIP の再実行による置換は、そのアプリバージョンのファイルに限定されます。

## Windows での確認

展開後に起動し、街の表示、移動、投資、営業イベントを確認します。保存後にアプリを閉じて再起動し、保存データが復元されることも確認してください。画面解像度・GPU ドライバーによる描画性能は実機で確認が必要です。保存は Electron のユーザーデータ領域を使用し、アプリフォルダーの削除だけでは消えません。

## 0.3.0 の梱包検証

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.3.0-win32-x64.zip` を作成しました。215,224,043バイト、SHA-256は `8479b6e78ca52693d576c8c873ca2cdbdc780c5b4e258219dcdd49364b61506a`。公式Electronのチェックサム、ZIP全件CRC、276項目のマニフェスト、現在のdist/desktopの275ファイルとのSHA-256一致、x64実行形式を検証済みです。記録は同ディレクトリの `verification-0.3.0.json`。

実測ビューアのDraco復号はWebAssemblyを使用します。デスクトップCSPは外部HTTPを許可せず、同梱資産と埋込フォントのdata:、GLTF写真のローカルblob:を許可します。JavaScriptのunsafe-evalは許可せず、wasm-unsafe-evalだけを許可しています。画面移動もゲームと実測ビューアの固定パスに限定しています。


## 本番 CSP によるブラウザー検証

`python3 scripts/smoke-production.py` で、最終distをデスクトップと同じCSPヘッダーで配信し、外部通信を拒否したLinux Chromiumで検証しました。日本語・欧文の実フォント、カフェ開業、週次自動保存、再読込、実測ビューへの移動、ゲームへの復帰と完全一致の保存復元が通過しています。実測建物20タイル、実際に読み込めた建物写真マップ20枚、地理院写真72枚、Draco WASMの読込を確認。JavaScript/consoleエラー、CSP違反、HTTP失敗、外部通信はゼロです。

共有software GPUの負荷を抑えるため、検証側だけで経営画面のrequestAnimationFrameを200ms遅延させました。実測ビューのRAFと製品コードは変更していません。この検証は性能ベンチマークではなく、Windows/Electronの実機動作確認でもありません。初回検査で見つかった埋込フォントとGLTF写真のCSP拒否を修正し、上記ZIPは修正版から再作成・照合しています。

結果と画像：`/workspace/shared/shibuya-artifacts/production/result.json`、`game.png`、`real-shibuya.png`。

## 0.3.1 の梱包検証

Blenderで仕上げた109・カフェを経営画面に読み込む0.3.1を別ZIPとして作成しました。0.3.0のZIPと検証記録は保持しています。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.3.1-win32-x64.zip` は223,760,229バイト、SHA-256は `7e461bb9862c8708f274e196de165e2141d31bb23584ed34aa1e228ec5cb0ecc`。公式Electronのチェックサム、ZIP全件CRC、279項目のマニフェスト、ビルド時のdist/desktop全278ファイルとのSHA-256一致、x64実行形式を検証済みです。記録は同ディレクトリの `verification-0.3.1.json` と `app-files-0.3.1.sha256.json`。

検査は `python3 scripts/verify-windows.py --output /workspace/shared/shibuya-artifacts/windows` で再実行できます。現在のソース・distとZIPを比較するため、別バージョンへ更新後は当該バージョンの保存済み検証記録を参照してください。Windows実機での動作は未検証です。

0.3.1の本番CSP回帰は7項目すべて合格しました。premiumカフェ開業・週次保存復元、109/cafe両GLBのHTTP200、実測建物20・写真map20・地理院画像72・Draco WASM、ゲーム復帰、エラー/CSP違反/外部通信ゼロを確認しています。記録は `/workspace/shared/shibuya-artifacts/production-0.3.1/`。従来と同じQA専用200ms RAF遅延であり、Windows実機・性能検証ではありません。

## 0.3.2 の梱包検証

出店3形態の比較と初決算記録を追加した0.3.2を別ZIPで作成しました。0.3.0・0.3.1のZIPと検証記録は保持しています。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.3.2-win32-x64.zip` は223,764,785バイト、SHA-256は `39bde83741874da3c4e16273ac88ea4e97923de4a4fee4d4ab85a4d861bc27ae`。公式Electronのチェックサム、ZIP全件CRC、279項目のマニフェスト、最終dist/desktop全278ファイルとのSHA-256一致、x64実行形式を検証済みです。記録は同ディレクトリの `verification-0.3.2.json` と `app-files-0.3.2.sha256.json`。

本番CSP回帰7項目に合格。新出店記録が未決算で保存され、最初の週次保存で同じIDに決算が追記されることと、再読込・実測ビュー復帰後の全state一致を確認しました。結果と画像は `/workspace/shared/shibuya-artifacts/production-0.3.2/`。QA専用200ms RAF遅延を使用したLinux Chromium検査であり、Windows実機・性能は未検証です。

## 0.4.0 の梱包検証

資金調達・3社買収比較・駅周辺共同開発と3D表示を加えた0.4.0を、旧版と別のZIPへまとめました。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.4.0-win32-x64.zip` は223,778,561バイト、SHA-256は `5f18bce4699b45a911e6c8b7de0fdcefb70d3b8d34ce3b68bb64afa618108de0`。公式Electron 44.5.1キャッシュを公式チェックサムへ再照合し、ZIP全件CRC、279件のアプリマニフェスト、現在のdist/desktop全278ファイルとのSHA-256一致、x64 PE実行形式を検証しました。梱包前後で0.3.0・0.3.1・0.3.2の既存成果物11ファイルのサイズと更新時刻が不変であることも確認しました。

検証記録は同じディレクトリの `verification-0.4.0.json`、`app-files-0.4.0.sha256.json`、ZIPの `.sha256` ファイルです。

```sh
python3 scripts/package-windows.py --output /workspace/shared/shibuya-artifacts/windows
python3 scripts/verify-windows.py --output /workspace/shared/shibuya-artifacts/windows
```

梱包した最終ビルドは、本番CSPでのLinux Chromium検査8項目に合格しています。実3D、同梱フォントとGLB、カフェ開業と初決算の保存、再読込、実測ビューの20建物タイル・72地表写真・WASM、旧保存の実インポートと完全一致の復元を確認しました。エラー・CSP違反・失敗HTTP・外部要求はゼロです。記録は `/workspace/shared/shibuya-artifacts/production-0.4.0/`、詳細は `docs/production-playtest.md` を参照してください。

これはLinux上での梱包整合性とブラウザ検証です。Windows実機での起動・保存・GPU性能は未検証で、コード署名も行っていません。新しいバージョンへ更新した後は、ZIPとの現行ビルド比較ではなく当該バージョンの保存済み検証記録を参照してください。

## 0.4.1 の梱包検証

比較画面の段階表示、投資先と財務の往復、上場結果画面、店舗近景を含む0.4.1を別ZIPへ梱包しました。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.4.1-win32-x64.zip` は223,785,184バイト、SHA-256は `9b43cab54cf034d2e99e052d5bc3be130de53ac1b9958db2a7925207691127b6`。公式Electron 44.5.1のキャッシュを公式SHA-256へ再照合し、ZIP全件CRC、アプリマニフェスト279件、梱包時のdist/desktop全278ファイルのSHA-256一致、x64 PE実行形式を確認しています。

結果は同ディレクトリの `verification-0.4.1.json` と `app-files-0.4.1.sha256.json`、ZIPの `.sha256` ファイルです。0.3.0・0.3.1・0.3.2・0.4.0の旧成果物15ファイルは、梱包前後のSHA-256・サイズ・更新時刻がすべて一致しました。旧版を上書きしていない検査結果は `preservation-0.4.1.json` に記録しました。

同じ最終distに対する本番CSP回帰8項目も合格しています。同梱フォント・実3D・カフェ開業と初決算保存・全state再読込、109/cafe GLB、実測ビュー、0.3.2旧保存の実インポートと完全復元を確認し、JS/consoleエラー・CSP違反・失敗HTTP・外部要求は0件です。記録と画像は `/workspace/shared/shibuya-artifacts/production-0.4.1/`。梱包後も本番検証時のdist index SHA-256が不変であることを確認しました。

Windows実機の起動・保存・GPU性能は未検証で、コード署名はしていません。上記はLinuxでの梱包整合性検査と、本番CSPを適用したChromiumでの機能確認です。

## 0.4.2 の梱包検証

店舗の運営診断、株式注文の実行前比較、実測ビューの画像精細さ選択を含む0.4.2を、旧版とは別のZIPに梱包しました。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.4.2-win32-x64.zip` は223,790,507バイト、SHA-256は `b2fd401b8c0efd395913c0101d0d70ce6be5946585fc69d27baaf1589d5277e4`。公式Electron 44.5.1キャッシュのSHA-256を再照合し、ZIP全件CRC、アプリマニフェスト279件、最終dist/desktop全278ファイルとのSHA-256一致、x64 PE実行形式を確認しました。

```sh
python3 scripts/package-windows.py --output /workspace/shared/shibuya-artifacts/windows
python3 scripts/verify-windows.py --output /workspace/shared/shibuya-artifacts/windows
```

結果は同じディレクトリの `verification-0.4.2.json`、`app-files-0.4.2.sha256.json`、ZIPの `.sha256`。梱包前後で旧Windows/本番検証成果物43ファイルのSHA-256・サイズ・更新時刻が一致し、`preservation-0.4.2.json` に記録しました。旧0.4.1を含めて上書きしていません。

同じdistは本番CSP回帰8項目にも合格しました。実CityView、開業と初決算保存、再読込、0.3.2旧保存の完全復元に加え、実測ビューの20建物タイル/20写真map/72地表画像、既定1024の縮小寸法、待機時停止と明るさ/リサイズ時の再描画、ゲーム往復の保存不変を確認。JS/consoleエラー・CSP違反・失敗HTTP・外部要求は0件です。結果は `/workspace/shared/shibuya-artifacts/production-0.4.2/`、詳しくは [本番検証記録](production-playtest.md) を参照してください。

本番検証後から梱包完了までのdist index SHA-256は `adf4336fe9d29dd39e0740f6cda83d31429cb5a4c7a028dab41685341ee4d7c9` で不変でした。Windows実機の起動・保存・GPU性能は未検証、コード署名はありません。上記はLinuxでの梱包整合性と本番CSP下のブラウザ確認です。

## 0.4.3 の梱包検証

経営画面内の実測3D切替、実測4地点の選択、所有状態と地区で絞り込める全32区画一覧を含む0.4.3を、旧版とは別のZIPに梱包しました。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.4.3-win32-x64.zip` は223,799,688バイト、SHA-256は `4cd33ab2ebce323a67abb4e817778403b1b377ec36590c298de8982330560144`。公式Electron 44.5.1キャッシュのSHA-256を再照合し、ZIP全件CRC、アプリマニフェスト279件、最終dist/desktop全278ファイルとのSHA-256一致、x64 PE実行形式を確認しました。再ビルドせず、本番CSP検証と同じdistを梱包しています。

結果は同ディレクトリの `verification-0.4.3.json`、`app-files-0.4.3.sha256.json`、ZIPの `.sha256`。旧Web/Windows/source配布物、単体実測HTML、検証記録など86ファイルのSHA-256・サイズ・更新時刻は梱包前後で一致しました。保全記録は `/workspace/shared/shibuya-artifacts/preservation-0.4.3.json` です。

同じdistの本番CSP回帰9項目はLinux Firefoxで合格しました。経営画面内の実測切替・地点選択・ゲーム街復帰、単独実測ビューの20建物タイル/20写真map/72地表画像とDraco、既定1024の画像縮小、待機時停止と必要時再描画、開業・決算・再読込、0.3.2旧保存の完全復元を確認しています。JS/consoleエラー、CSP違反、失敗HTTP、外部要求は0件。結果は `/workspace/shared/shibuya-artifacts/production-0.4.3/result.json` です。QA専用の経営画面RAF遅延200msを用いた機能確認で、性能測定ではありません。

本番検証後から梱包完了までのdist index SHA-256は `f5d0e9b639329c5f3e810f2bab0cce3f1ad2ed0afb82b0d5633e0e8e48f48e28` で不変でした。Windows実機での起動・描画・保存復元・GPU性能は未検証で、コード署名もありません。Linuxでの整合性検査とブラウザー検証を、Windows/Electron実機の動作確認とは扱いません。

## 0.4.4 の梱包検証

店舗設定変更後の予測フィードバックと案内文、実測写真の表示、保存/モデル書き出しの回帰修正を含む0.4.4を、旧版と別のZIPへ梱包しました。研究中の経済v2は含まず、経済ルールと旧保存の扱いを維持しています。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.4.4-win32-x64.zip` は223,800,778バイト、SHA-256は `ab63949a33f32941fb5424435d65950166724cbf162426406f70451d47f1a9d5`。公式Electron 44.5.1キャッシュのSHA-256、ZIP全件CRC、アプリマニフェスト279件、最終dist/desktop全278ファイルとのSHA-256一致、x64 PE実行形式を確認しました。最終ビルドの276配布ファイル（94,239,103バイト）を再ビルドせず収録しています。

検証記録は同じディレクトリの `verification-0.4.4.json`、`app-files-0.4.4.sha256.json`、ZIPの `.sha256` です。0.4.3を含む旧配布と旧検証成果物746件のSHA-256・サイズ・更新時刻は不変で、保全記録は `/workspace/shared/shibuya-artifacts/preservation-0.4.4.json` に保存しています。進行中の研究と0.4.4用QA成果物は旧配布とは区別して記録しました。

同じ最終distは231テストと本番CSP回帰9項目を通過しました。本番確認はLinux Firefoxで行い、ゲーム/実測表示の往復・地点選択・開業/週次保存/再読込・0.3.2旧保存の完全復元、20建物タイル/20写真map/72地表画像・Draco・必要時再描画を確認しています。JS/consoleエラー・CSP違反・失敗HTTP・外部要求は0件です。結果は `/workspace/shared/shibuya-artifacts/production-0.4.4/result.json`。CSP検証後から梱包完了までのdist index SHA-256は `917c98205973ede12ae7961d076888c292df7ba30322cb1fb27753e979034bb6` で不変でした。

Windows実機での起動・描画・保存復元・性能は未検証で、コード署名はありません。Linuxブラウザーの検査をWindows/Electronの動作保証とは扱いません。Windows版は上記ローカルZIPとして保持し、GitHubへの配布添付は成功済みとは記載しません。

## 0.4.5 の梱包検証

全画面の街から施設を選ぶ操作、必要時に開く経営ダイアログ、初開業後の店舗外観への移動、営業前の見込みと週末実績の分離を含む0.4.5を、旧版と別のZIPへ梱包しました。週次変動を加えており、旧会社の過去実績は保持しますが、次週以降の数値が旧版と一致するとは保証しません。借入中の利益0以下・週末現金不足の終了条件は維持しています。研究中の株価・企業会計モデルは含みません。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.4.5-win32-x64.zip` は223,805,014バイト、SHA-256は `69665b39a1451a9d36cc91e972301d692a5928a448af874f5d0beacd87709293`。公式Electron 44.5.1のSHA-256、ZIP全件CRC、アプリマニフェスト279件、最終dist/desktop全278ファイルとのSHA-256一致、x64 PE実行形式を確認しました。ビルド完了後の276配布ファイル（94,254,310バイト）を再ビルドせず収録しています。

検証記録は同ディレクトリの `verification-0.4.5.json`、`app-files-0.4.5.sha256.json`、ZIPの `.sha256` です。0.4.4を含む旧配布・旧検証成果物880件のSHA-256・サイズ・更新時刻は不変でした。保全記録は `/workspace/shared/shibuya-artifacts/preservation-0.4.5.json`。進行中の研究・0.4.5検証資料122件は活動中の資料として区別しています。梱包前後のdist index SHA-256は `21eb92ee9545afeeada2d9270ca992978f17a6060fefda4ea29ad32aa670cb85` で一致しました。

Windows実機での起動・描画・保存復元・性能は未検証で、コード署名はありません。これはLinuxでの梱包・内容照合の記録であり、公開URLやWindows/Electronの実動作確認ではありません。Windows版は上記ローカルZIPとして保持し、GitHub Releaseへの添付は再試行していません。

## 0.4.6 の梱包検証

最初の操作案内、目的別の店舗管理、短い週末結果、街の音と表示の応答を含む0.4.6を、旧版と別のZIPへ梱包しました。演出は確定済み決算の表示に使い、保存値や経済計算は変更しません。

`/workspace/shared/shibuya-artifacts/windows/Shibuya-Capital-0.4.6-win32-x64.zip` は223,815,380バイト、SHA-256は `3b980a1d5fd37974b85af9c01c54a5780aa4cbf9e58ef4517b6f0e879afe2396`。公式Electron 44.5.1のキャッシュを公式チェックサムへ再照合し、ZIP全件CRC、アプリマニフェスト279件、最終dist/desktop全278ファイルとのSHA-256一致、x64 PE実行形式を確認しました。追加ダウンロードや再ビルドは行っていません。

Web版と同じ最終distの276ファイル（94,292,963バイト）が入っていることを、ローカル `/-/` 配下のHTTP監査と梱包後のSHA比較で確認しました。梱包前後のindex SHA-256は `7dcd5a42f396b162fc2edbf6edbb9de4236d8e3b409e2917388192d74bb779a5` で不変です。旧配布・旧検証成果物962件のSHA-256・サイズ・更新時刻も不変でした。

検証記録は同ディレクトリの `verification-0.4.6.json`、`app-files-0.4.6.sha256.json`、ZIPの `.sha256` です。Web/Windowsと最終distの相互照合は `/workspace/shared/shibuya-artifacts/packaging-0.4.6.json`、旧成果物の保全は `preservation-0.4.6.json` に記録しています。

Windows実機での起動・描画・保存復元・性能は未検証で、コード署名はありません。上記はLinuxでの梱包・内容照合の結果です。Windows版はローカルZIPとして保持し、GitHub Releaseへの添付は再試行していません。
