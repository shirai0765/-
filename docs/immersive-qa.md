# 全面街 UI の再現可能な検証

`smoke-immersive.py` が0.4.5の実App操作を担当します。旧 `smoke-browser.py` / `smoke-production.py` の常設sidebar前提のselectorを、新UIの合格根拠へ転用しません。Firefox/Mesaのsoftware rendering結果であり、Windows/Electron実行や実PC性能、人間の理解度を保証しません。

## スクリプト

- `python3 scripts/smoke-immersive-dom.py`: 開発AppのDOM確認。両3D componentを明示stubにし、1280×960/390×844で9カテゴリを検査します。実描画の証拠ではありません。`IMMERSIVE_DOM_URL` / `IMMERSIVE_DOM_OUT` で開発URL/出力先を変更できます。
- `python3 scripts/smoke-immersive.py --dev-diagnostics`: ローカル開発Appの実描画・実施設click。DEV公開オブジェクトは読み取るだけで、カメラ・経済state・RAFを書き換えません。32markerの構造と1地点のクリック、開業・外観・管理overlay復帰・初週実績・保存を確認します。
- `python3 scripts/smoke-immersive.py --production-csp --legacy-save <旧保存>`: 最終distをdesktop/main.cjsと同じCSPの一時ローカルHTTP serverで配信。通常UIに加え、同App実測街、単独viewer、Draco、写真材質/明るさ/idle/resize、旧保存import/reloadを確認します。DEV hookなしで実行します。
- 公開確認は `--url <公開URL> --out <証拠dir> --expected-version <版> --expected-source <commit> --include-real-city`。`--profile <使い捨てprofile>` は外側runnerが用意する一時profileを再利用する場合のみ。通常は新規/tmp profileを自動削除します。外側runnerは公開originの正規TLSを保つ責務があり、証明書検証を無効化しません。

実描画scriptは起動済みのprivate XorgとPlaywright Firefoxを使います。この環境で検証した外側runnerは共有成果物へ保存します。GPU利用は他担当と直列にし、永続HOME/NSS、ブラウザsandbox、TLS検証を変更しません。localhostの確認にCA登録は不要です。

## 実施した開発確認

共有成果物 `/workspace/shared/shibuya-artifacts/immersive-v045/` に保存。

DOM: 1280/390のfullscreen host、常設sidebar/footerなし、32区画一覧→native施設詳細→財務比較→同区画/形態、開業後閉じ/外観focus props、任意の経営overlay、店舗一覧から同店管理、子注文Escape→親市場維持、通常週は見込みdetails閉じ/借入リスク時は展開、手動保存/reloadを確認。9カテゴリ、pageerror/未解決issues 0。stubのinstance保持は実カメラ保持と区別します。

実GPU: 1000×760、実ゲーム街、32markerのreadonly構造確認とcenter-01の画面座標への実mouseclick、開業で緑の営業状態、外観へ移動、finance/stores/stocksの開閉で同scene/cameraを保持、初週actualと手元資金の照合、見込み範囲への包含、reload時primary全体一致。5カテゴリ、console/page error/warning 0。採取した例は利益448,615円、見込み範囲387,094〜449,306円で、開業前の中立見込みとactualの一致を要求していません。

担当は実GPUの `01-fullscreen-real-city.png` / `03-opening-store-focus.png` を開いて目視しました。全32markerそれぞれの実クリック、モバイル実GPU、すべてのseedの安全、長期バランスをこの結果から保証しません。最初のGPU採取後の小さなレイアウト変更は最終DOMと本番確認へ分けます。

## 不具合と検証の区別

初期の子注文画面はEscapeで閉じず、親native dialogもcancelを抑えていました。子をnative GameDialogへ統一した後、両幅の実App DOMで子だけを閉じて親を維持することを再確認しています。旧失敗画像は共有 `dom/child-escape-before-fix.png` に保持。

テストharnessのReact named export参照、旧設定画面タイトル、旧toast位置を新UIへ合わせた修正もありました。これらを製品runtime不具合に数えず、最終成功runのみを合格根拠にしています。

本番CSP・旧保存・公開後の最終結果は、それぞれの実行が完了した成果物とリリース記録を参照してください。開発GPU成功だけで公開済みと扱いません。

## 最終distの確認結果

本番CSP確認は9カテゴリ成功。共有 `/workspace/shared/shibuya-artifacts/production-0.4.5/README.md` / `results.json` に最終dist SHA、CSP、同App実測と単独viewer、旧0.3.2保存の完全一致、通信/エラー記録を保存しています。ブラウザでの会社開始から初週actual・保存・再読込を通し、公開と同じ施設一覧の入口を使用しました。公開Pagesへの反映と公開URLでの操作は別の確認です。
