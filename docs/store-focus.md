# 自分の店を近くで見る — 0.4.1

「店の様子を見る」から、選んだ営業中の店舗の名前・外観を確認する近景へ移ります。「街全体に戻る」で初期の俯瞰に戻り、右側の経営対象は選択した店のままです。経営時間・現金・店舗設定を変更する操作ではありません。

`CityView` の `focusStoreLotId?: string | null` で指定します。優先順位は、営業中の店舗近景、沿線近景、従来の区画選択による平行移動の順です。近景と沿線でカメラ制御のeffectを共有し、品質変更によるシーン再生成でも指定先を維持します。閉店した店舗・存在しない店舗は店舗近景として扱いません。任意の経路を飛行させず即時切替するため、移動の途中で隣棟を通過する演出はありません。

`getStoreViewpoint(lot, style, aspect?)` は `{ position, target, fov }` を返します。店舗の正面は区画のローカル+Zで、回転も考慮します。プレミアム店は既存の幅8.14mのカフェGLBを基準とし、標準・持ち帰りは区画幅に合わせます。正面からの距離・側方位置を候補から選び、隣棟・ランドマーク・線路の保守的な立体範囲と視線を照合します。カメラは地面から4m以上。成立する候補がなければ `null` を返し、内部へ強引に配置しません。

画角は画面幅に応じて40〜74度へ調整し、俯瞰と沿線へ戻る際は従来の36度へ戻します。店舗近景中は建物全体を塗る選択・ホバーの半透明面を抑え、看板やガラスを読めるようにします。区画選択と経営パネルは維持します。GLB・材質・照明を近景だけ別物へ差し替える処理はありません。スマートフォンで実寸の看板文字が小さくなることを補うため、画面の見出しにも現在の店名・地区・営業形態を表示します。

## 店舗前の表示用空間

既存の圧縮ゲーム街区では、一部の背景棟が購入店舗の正面から約3mまで迫っていました。カメラを背景棟の外へ移しても、店舗名が半分隠れることを実際の描画で確認しました。

`src/city/displayLayout.ts` は購入店舗の正面8mの帯に重なる購入不可の背景棟を、静的な表示配置から省きます。対象は次の11棟です。

`city-011`、`city-026`、`city-037`、`city-042`、`city-044`、`city-048`、`city-081`、`city-083`、`city-099`、`city-101`、`city-104`

残る背景棟は99棟。32の購入区画、経済計算の `LOTS`、ランドマーク、PLATEAU実データは変更していません。通常の俯瞰でも近景でも同じ配置です。背景棟を近景の時だけ透明化する方式ではありません。`CityView` の建物生成とカメラの障害物判定は同じ `CITY_DISPLAY_LOTS` を使います。実シーンを元にするモデル書き出しにも、この表示配置が反映されます。

## 検証と実画像

`npx vitest run tests/store-viewpoints.test.ts` の3テストで、購入32区画×3形態の96パターンに安全な候補があること、回転への追従と狭幅の画角、背景調整で購入区画を変えていないことを確認しています。TypeScript検査も通過しました。

4地区・3形態の計12近景を実シーンで描画し、プレミアム店は `waitForLoadedAssets` 後にGLBの `loaded` 状態を確認しました。昼光・看板・外観を目視確認しています。模型の計測再現度やWindows実機性能の検証ではありません。GLBの看板は実寸のため、狭い画面では画面見出しも使って店名を確認します。

| 確認先 | 実ファイル |
| --- | --- |
| センター街・プレミアム | [背景調整前](/workspace/shared/shibuya-artifacts/store-focus/before-clearance/center-01-premium.png)・[調整後](/workspace/shared/shibuya-artifacts/store-focus/center-01-premium.png) |
| センター街・標準 | [背景調整前](/workspace/shared/shibuya-artifacts/store-focus/before-clearance/center-02-standard.png)・[調整後](/workspace/shared/shibuya-artifacts/store-focus/center-02-standard.png) |
| テイクアウト | [神南スタンド](/workspace/shared/shibuya-artifacts/store-focus/center-04-takeaway.png) |
| 実UIからの4地区近景 | [センター街](/workspace/shared/shibuya-artifacts/store-focus/clicked-center-01-ui.png)・[道玄坂](/workspace/shared/shibuya-artifacts/store-focus/clicked-dogenzaka-01-ui.png)・[東口](/workspace/shared/shibuya-artifacts/store-focus/clicked-miyashita-01-ui.png)・[桜丘](/workspace/shared/shibuya-artifacts/store-focus/clicked-sakuragaoka-01-ui.png) |
| 390px | [店舗近景](/workspace/shared/shibuya-artifacts/store-focus/mobile-center-ui.png)・[長い店名](/workspace/shared/shibuya-artifacts/store-focus/mobile-long-name-ui.png) |
| 俯瞰への復帰 | [街全体と選択中の店](/workspace/shared/shibuya-artifacts/store-focus/overview-after-store-ui.png) |

描画記録は [render-results.json](/workspace/shared/shibuya-artifacts/store-focus/render-results.json)、実UI操作記録は [ui-results.json](/workspace/shared/shibuya-artifacts/store-focus/ui-results.json)。実UI検査は13項目を通過し、ページエラーは0件でした。実ボタンをクリックし、カメラ座標・注視方向・画角、品質変更後の保持、390pxの表示、俯瞰復帰時の対象保持を確認しました。近景でポインターを動かした後も、選択面とホバー面が非表示であることを確認しました。390pxの長い店名は2行に収まり、入口や看板を隠していないことを画像で確認しました。最後の保存stateは、初期stateへ品質変更だけを適用した期待値と完全一致しました。長い店名の表示確認後は元の名前に戻しました。

検査中は都市の名前付き `animate` コールバックだけを停止し、UIとカメラの実処理は動かしています。画像は実シーンを手動描画したもので、画像後加工や別モデルの合成はありません。12近景の描画スクリプトは [render-qa.py](/workspace/shared/shibuya-artifacts/store-focus/render-qa.py)、実UI検査は [ui-qa.py](/workspace/shared/shibuya-artifacts/store-focus/ui-qa.py) に保存しています。沿線の既存6項目も `python3 scripts/rail-focus-qa.py` で再確認しました。
