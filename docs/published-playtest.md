# GitHub Pages 0.4.2 の公開記録

2026-10-06、ユーザーの依頼により [ゲーム本体](https://shirai0765.github.io/-/) と [実測渋谷ビューアー](https://shirai0765.github.io/-/real-shibuya.html) を公開した。

## 配布元と公開先

| 項目 | 値 |
|---|---|
| 版 | 0.4.2 |
| ソースブランチ | `game-source` |
| ソースコミット | `5f48a6b806c509e0505690f5588ef3c2c6d66dc3` |
| 配布ブランチ | `main` |
| 配布コミット | `61002026eaf5d50a80de20d06e5338cf8477ad2d` |
| Pages 実行 | [37522617185](https://github.com/shirai0765/-/actions/runs/37522617185)、completed / success |
| index.html SHA256 | `adf4336fe9d29dd39e0740f6cda83d31429cb5a4c7a028dab41685341ee4d7c9` |

検証済み `dist` の276ファイルを変更せず、`.nojekyll`・公開用README・`release.json`を追加して公開した。`scripts/deploy-pages.py` が元配布レポートのCRC・全ファイルSHA・ファイル集合・ソースコミットを確認し、既存 `main` に通常の fast-forward push を行った。既存のブランチ公開設定を使用しており、ソースブランチへのpushだけでは公開版は変わらない。

公開後の読み取り検査はPython標準TLS・ホスト名検証を有効にして実行した。18件すべてHTTP 200。HTML、全JS/CSS、主要GLB 2件、manifest 3件、ライセンス4件のローカル `dist` 比較16件はすべてSHA一致。`release.json` の版、ソースコミット、276ファイル、indexのSHAも一致した。全276件を公開URLから再取得したという意味ではない。

実行証跡は `/workspace/shared/shibuya-artifacts/deploy-0.4.2/deployment.json` と `http-audit.json`。公開前には212ユニットテスト、ビルド、本番CSP・旧セーブ復元・実3Dを含む8項目を検証済み。詳細は [production-playtest.md](production-playtest.md)。

## 公開サイトでの操作確認

公開HTTPSの本番コードをFirefox 153.0 / Playwright 1.62.0で操作し、6項目が通過した。CityViewの差し替え、ソースの直接import、会社状態の注入は使っていない。

- 新会社の設立、実際の経営マップの描画、初期保存。
- 宇田川の角店に街角カフェを開業、価格950円へ変更、初週の決算、第2週の自動保存。
- 決算から「店の様子を見る」で店舗近景へ移動。
- 再読み込みと続行。IndexedDBのprimary行、保存envelope、会社payload全値が一致。
- UIからJSONを書き出し、payload・checksum・schema・formatが自動保存と一致。書き出し日時だけは新しく生成されるため比較対象外。
- GLBのHTTP 200、ページ例外・console error・通信失敗0件。

検証用会社の第2週現金は8,818,200円、初週店舗利益418,200円、来店者1,120人。この設定と会社における結果で、初期設定や全シードの利益を保証するものではない。Three.jsの `transparent: undefined` に関する非致命warning 6回は記録に残している。

初回のクラウドChromiumは環境CAを信頼せず、公開サイトの読み込み前に停止した。永続NSSへのCA登録は自動承認レビューが拒否したため実施していない。代替としてレビューが承認した、使い捨て `/tmp` Firefoxプロファイルだけへの環境CA登録を使い、通常の証明書検証を維持した。ヘッドレスFirefoxのGL初期化は環境側で失敗したため、一時的な認証付きXorg表示とMesaで実描画を検証。TLS・Firefox sandboxは有効、HOMEと永続信頼設定は不変で、終了時の一時プロファイル・表示ソケット削除を確認した。これは実PCの性能検査ではない。

結果とスクリーンショットは `/workspace/shared/shibuya-artifacts/published-site-firefox/` の `result.json`、`README.md`、`01-new-company-city.png`、`03-first-week-autosaved.png`、`04-owned-store-real-city.png`。保存ファイルはテスト用会社のもので、ユーザーのセーブではない。

実測渋谷の公開ビューアーも同じ一時Firefox方式で8項目が通過した。建物20タイル・地表72タイル、1024→2048への写真精細さ変更、218,943三角形・112メッシュ・92画像と境界の維持、Draco wrapper/WASM読込、`/-/`配下の資産URL、390px幅、俯瞰への復帰、戻るリンクから `/-/index.html` のゲーム入口への遷移を確認。147応答でHTTP 400以上・通信失敗・ページ例外は0件。画像を目視し、終了後の一時プロファイルと表示ソケットの削除を確認した。記録は `/workspace/shared/shibuya-artifacts/deploy-0.4.2/viewer-firefox/results.json`。これは実測ビューアー単体の確認であり、実測街と経営機能の統合を示すものではない。

## 最初の操作

1. 会社名を入力して「新しい会社を設立」。
2. 「宇田川の角店」から「街角カフェ」を選び、「この場所にカフェを開業」。初店のための借入や物件購入は不要。
3. 「週を終了する」で予測を確認し、「営業して週を進める」。決算時に自動保存される。

保存は利用中のブラウザーのIndexedDBにあり、アカウントやクラウド同期はない。保存元の単位はoriginで、GitHub Pagesのリポジトリパスごとではない。別の端末やWindows版への移動には設定のJSON書き出し・読み込みを使う。週の途中の変更を残す場合は手動保存する。

経営マップと実測渋谷はまだ別画面。約30時間の人間による通しプレイ、Windows実機・Ryzen 5 PRO上の性能は未検証。
