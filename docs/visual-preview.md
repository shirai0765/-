# 画像と3Dの閲覧案内

この作業環境に保存した実ファイルへの入口です。実データの街、写真を参考にした模型、経営ゲームの創作街区を区別して閲覧できます。

| 区分 | 閲覧ファイル | 内容 |
| --- | --- | --- |
| 実データ | [実測渋谷・単一HTML](/workspace/shared/shibuya-artifacts/real-shibuya-viewer.html) | PLATEAU建物と国土地理院の地表写真を内包した独立ビューア。経営マップとは別の座標空間 |
| 実データのBlender描画 | [昼景全景](/workspace/shared/shibuya-artifacts/blender-polish/real-shibuya/daylight-overview.png)・[109周辺](/workspace/shared/shibuya-artifacts/blender-polish/real-shibuya/daylight-109.png) | 取得した形状・元画像を保ち、Blenderで昼景の表示を調整した静止画 |
| 推定再構築 | [109・修正前後の比較HTML](/workspace/shared/shibuya-artifacts/blender-polish/109/109-comparison.html) | 写真を参考に制作した建築スタディ。同じ視点・照明でモデルを切替。実測モデルではない |
| 推定再構築のBlender描画 | [109・修正前](/workspace/shared/shibuya-artifacts/blender-polish/109/comparison/109-before-detail.png)・[修正後](/workspace/shared/shibuya-artifacts/blender-polish/109/comparison/109-after-detail.png) | 実際のメッシュを同条件のBlender Cyclesで描画した比較 |
| ゲーム用架空 | [カフェ・修正前後の比較HTML](/workspace/shared/shibuya-artifacts/blender-polish/cafe/cafe-comparison.html) | 実店舗の部材を参考にした架空カフェ。特定店舗を寸法どおりに復元したものではない |
| 架空カフェのBlender描画 | [カフェ・修正前](/workspace/shared/shibuya-artifacts/blender-polish/cafe/comparison/cafe-before-detail.png)・[修正後](/workspace/shared/shibuya-artifacts/blender-polish/cafe/comparison/cafe-after-detail.png) | 同条件のBlender Cycles比較。展示用の物理ガラスを使用し、ゲームの軽量ガラスとは表示が異なる |
| ゲーム用架空・0.4 | [センター街の沿線近景](/workspace/shared/shibuya-artifacts/rail-focus/clicked-center.png)・[東口の沿線近景](/workspace/shared/shibuya-artifacts/rail-focus/clicked-miyashita.png)・[街全体へ復帰](/workspace/shared/shibuya-artifacts/rail-focus/overview-restored.png) | 実UIのボタンをクリックした後の実シーン。都市描画ループを止めて手動描画し、画像後加工なし |

| ゲーム用架空・0.4.1 | [自分の店の近景](/workspace/shared/shibuya-artifacts/store-focus/clicked-center-01-ui.png)・[390pxと長い店名](/workspace/shared/shibuya-artifacts/store-focus/mobile-long-name-ui.png) | 実UIから既存カフェGLBへ移動。店舗名・外観を確認し、街全体へ戻れる。条件と検証結果は [店舗近景](store-focus.md) |

| 実測街・0.4.2 | [品質を切り替える単一HTML](/workspace/shared/shibuya-artifacts/realcity-v042/real-shibuya-viewer.html)・[軽量の109周辺](/workspace/shared/shibuya-artifacts/realcity-v042/1024-109-scene.png)・[同視点の原寸](/workspace/shared/shibuya-artifacts/realcity-v042/original-109-scene.png) | 同じ形状を1024・2048・原寸で表示。軽量画像は近景でぼけるため、原寸も保持。経営接続は未実装。検証は[画像メモリ](realcity-texture-budget.md) |
| 経営UI・0.4.2 | [今週の店舗診断](/workspace/shared/shibuya-artifacts/store-insight-0.4.2/normal-mobile.png)・[店長の実効設定](/workspace/shared/shibuya-artifacts/store-insight-0.4.2/manager-desktop.png) | 需要・対応上限・利益・満足度。実UIを操作した画像だが、都市描画はstubに置換したDOM検証。検証は[店舗診断](store-insight-playtest.md) |

実データ版でも地面は平面近似で、起伏や全ての窓・店舗内部を再現していません。元画像の解像度・撮影時期による制約も残ります。109の建築スタディの細かさを、そのまま実測渋谷全体の再現度と見なすことはできません。Blender静止画とゲーム内の実時間描画も別の結果です。

管理ブラウザがローカルファイルの閲覧を制限している場合、この場で制限を回避して開きません。静止画リンクで内容を確認するか、HTMLをファイルとして受け取り、閲覧が許可された環境で開いてください。内部HTTPで行った表示検証を、管理ブラウザでの直接ファイル表示やWindows実機での動作確認と同一には扱いません。Windowsの描画速度は未検証です。

取得元と制約は [実測渋谷](real-city.md)、モデル編集と描画条件は [Blender作業記録](blender-workflow.md)、0.4の実UI検証6項目は [駅まち共同開発](rail-visuals.md) に記録しています。上記リンク先の存在は2026-10-06に確認しました。
