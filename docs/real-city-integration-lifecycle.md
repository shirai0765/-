# 0.4.3 地図の読み込み・切替の独立レビュー

2026-10-06。対象は共有キュー、ゲーム街、実測街、React接続。ソース読取とCPUテストを行い、レビュー担当から実装ソースは編集していません。実GPUの操作検証と画面確認は下記で分けます。

## 確認した契約

| 対象 | 読取で確認した動作 |
|---|---|
| [sceneLifecycle.ts](../src/city/sceneLifecycle.ts) | 前のteardown Promiseが完了するまで次のstartを呼ばない。開始前に取り消した予約は構築しない。StrictModeのsetup→cleanup→setupでもキャンセル済み予約を飛ばす。重複cleanupは同じretired Promiseを返す。通知側が例外を投げても予約解放を妨げない。 |
| [CityView.tsx](../src/city/CityView.tsx) | quality変更とunmountでRAF・Observer・controls・rendererを停止し、LoadedAssetPoolの解放Promiseをキューへ返す。遅延構築後はsceneRevisionによって最新React renderのstateとfocusを適用する。初期化失敗はrollbackを実行する。コールバックはrefで最新値を使う。 |
| [loadedAsset.ts](../src/city/loadedAsset.ts) | disposeは受付を閉じてfetchをabortし、各読込Promiseのsettleを待つ。中断不能なGLTF parseの遅延結果は再接続せず破棄。共有cloneの資源はtemplateが所有し、個別店舗の閉鎖で他店の資源を解放しない。 |
| [RealCityScene.ts](../src/realcity/RealCityScene.ts) | quality変更は同じrenderer内の直列pumpで世代を更新し、前世代のabortを確認してから新たな内容を接続する。disposeは即時RAF停止・abort・focus破棄・イベント解除・renderer除去を行い、pump完了後にDracoを破棄する。返却Promiseまで共有キューの順番を保持する。 |
| [RealCityView.tsx](../src/ui/RealCityView.tsx) | mount依存は再試行番号のみ。経営更新や新しいonSelectLot関数ごとにrendererを作らない。最新のsitesはrefから渡す。cleanup時active=falseとし古いprogress/focus通知を無視する。選択とfocus要求は別で、全景・選択解除は待機focusも取り消す。 |

Appはcityページだけで一方の地図をmountします。ページ移動中に取り消した地図は再入場時に復活させず、新しい予約として作ります。保存読み込み・復元・新会社は選択と実測focusをクリアします。未対応区画と沿線事業への導線はゲーム街へ移り、古い実測focusを取り消します。

documentがhiddenのとき実測街はRAF自体を取り消し、再表示時に描画を要求します。ゲーム街はRAFのコールバックを維持しつつ描画・アニメーション更新をスキップする既存方式です。どちらもhidden時に描画しませんが、CPU仕事量が完全にゼロという保証ではありません。中断不能な画像・Draco処理は解放まで待つため、切替先の表示開始が遅れる場合があります。

## 指摘と対応

- **0サイズ通知の欠落**：wrapperが幅・高さの正数時だけresizeしており、0への遷移でcontrollerのsized停止が働きませんでした。担当が0も渡すよう修正し、読取で確認しました。
- **wrapperの部分初期化**：controller生成後のupdateSitesやResizeObserverの同期例外でteardownが登録されない経路を指摘。担当が初期化をtry/catchし、即disposeすると同時にその同じPromiseを返すteardownを登録するよう修正しました。
- **factoryの部分初期化**：renderer生成成功後、controller返却前の同期例外でcanvas等が残る経路を3D担当へ指摘しました。factory内rollbackの追加を読取確認済みです。3D担当はcallbackで同期例外を発生させ、canvasが残らず正常再生成できることも確認しました。

## 実行した検証と限界

`npx vitest run tests/scene-lifecycle.test.ts tests/loadedAsset.test.ts` は12件成功。順番待ち中のキャンセル、StrictMode相当、遅延decodeの解放待ち、例外によるキュー停止の防止、clone共有、解放後の遅延結果破棄を含みます。`npx vitest run tests/realcity-texture-budget.test.ts` は5件成功。画像サイズ制限・中断時の画像解放等を確認しました。続けて `npx tsc --noEmit` が成功しました。

この17件は実WebGLでの全quality切替やGPUメモリ測定ではありません。3D担当の[controller実GPU記録](../../shared/shibuya-artifacts/realcity-v043/controller-results.json)は6項目成功・errors空です。元20建物/72地表の読込、最後のqueued focus採用と全景による取消、4地点の実pointerクリック、state更新時のmodel/世代/camera維持、非表示時描画停止、dispose完了後pendingJobs=0と遅延描画なしを確認した記録です。レビュー担当自身はGPUブラウザを起動せず、この記録と画像を読んでいます。

## 4地点の別目視

受け取った[center](../../shared/shibuya-artifacts/realcity-v043/center-01-marker.png)、[道玄坂](../../shared/shibuya-artifacts/realcity-v043/dogenzaka-01-marker.png)、[宮下](../../shared/shibuya-artifacts/realcity-v043/miyashita-01-marker.png)、[桜丘](../../shared/shibuya-artifacts/realcity-v043/sakuragaoka-01-marker.png)の画像で、4つの丸い目印と架空の区画名、「ゲーム内 候補/営業/保有/営業・保有」を確認しました。最初の3点はラベルと目印が周辺モデルに隠れていません。桜丘だけ看板形状がラベル右側に重なりました。西側へのカメラ移動は手前の建物に球が隠れ、他の高め・南寄りの候補でも文字面と看板の交差が残ることを[候補画像・クリック記録](../../shared/shibuya-artifacts/realcity-v043/sakura-camera-candidates.json)で確認しました。カメラは元の `[28.150241919488458,170,391.0843840583583]` に戻し、3D担当が文字注釈SpriteだけをdepthTest=falseに変更しました。球の通常の奥行き表示と、球が実建物に遮られた場合のクリック除外を維持し、文字面は前面の選択用注釈としてクリックできます。文字は架空事業の画面注釈であり、実ビル上の物理看板として扱いません。再撮影された桜丘画像を別目視し、文字欠けの解消と球の可視性を確認しました。元cameraでの実クリック成功と、最終sourceのcontroller6項目成功は3D担当の記録も確認済みです。

元batchのSHA・gml ID・頂点由来屋上位置の照合は[表示データの純粋テスト](../tests/real-city-game-sites.test.ts)で別途確認済みです。画像確認は入口・歩道への接地確認ではなく、遠景用目印の識別と遮蔽の確認です。
