# 入力近くの店舗利益予測

価格・人数を変更した後、上側の店舗診断が画面外になり、固定ヘッダーの会社全体の利益だけが見える状態を改善します。経済モデル、設定 action、週決算、保存形式は変更しません。

## 表示と導線

[App の storeControls](../src/App.tsx)で店舗診断を1回取得し、既存の診断と新しい [StorePlanFeedback](../src/ui/StorePlanFeedback.tsx)へ同じ値を渡します。表示位置は価格・従業員数の直後と、品質・広告・店長委任の直後の2か所です。通常の文書フローに置き、入力を覆う固定表示は追加していません。

表示する金額は `insight.result.profit` です。「この店の今週利益予測」と表記して全社利益と区別し、店長委任中は「調整後の店長案による予測です」と添えます。変更前後の差分や利益改善の保証は表示しません。価格・人数・広告の反映タイミングは従来の `onBlur`、品質と店長委任は従来の `onChange` のままです。

「利益と客数の理由を見る」は、同じ店舗の既存 details を開き、その summary にフォーカスしてスクロールします。診断全体や費用表は複製していません。2か所の金額更新を重複して読み上げないよう `aria-live` は付けていません。各ボタンの `aria-controls` は対象店舗の details を示します。

入力中にそのまま理由ボタンを押した場合も、既存の blur 処理で設定を反映してから詳細へ移ります。人数上限の説明が出現するとボタンの位置が変わるため、pointerdown では入力のフォーカスを維持し、click を受けた時点で blur します。これは従業員4→7の編集中に1回押しても詳細が開かない問題を修正するものです。予測を独自に再計算したり、新しい設定 action を追加したりはしていません。

従業員数の近くと展開した details の冒頭には、条件に該当する場合だけ上限超過の短文を表示します。判定は `effectiveSettings.staff > context.staffCapacityLimit` で、店長が調整した場合も実効設定に従います。店長委任時にはこの短文にも「調整後の店長案では」と添え、入力人数がそのまま使われるとは示しません。

営業終了済みの会社は診断を取得せず、`insight` が null の場合も新しい予測行・上限説明を表示しません。閲覧や details の開閉では経営 action を実行しません。

## 検証

修正後の `npm run typecheck` は成功しました。別担当による1280 × 960px・390 × 844pxの[実 DOM 結果](../../shared/shibuya-artifacts/store-feedback-v044/results.json)では、価格580→950→580、人数7→4、品質65→70→65、広告費による黒字・0円・−1円、店長委任 on/off、両方の理由ボタンと summary のフォーカス、設定 action の期待値と保存全体の一致が成功しています。品質は通常の slider の左右キーで操作しました。計28か所の位置確認で、対象が画面内にあり他要素に覆われていないことを確認しています。描画2種類だけを null stub にし、会社作成・出店・設定・保存は実物を使用。予期しない page error は0です。

さらに、入力中に blur を明示せず理由ボタンを押すケースも再確認しました。1280pxの価格変更・人数4→7からの直接 mouse click と、390pxの touch 有効 context で人数4→7からの tap が、1操作で details を開いて summary にフォーカスしました。修正前の不成立は[失敗記録](../../shared/shibuya-artifacts/store-feedback-v044/direct-click-failure.json)に区別して保持しています。実スマートフォンのソフトウェアキーボードでの検査ではありません。

本担当も[390pxの人数7入力後](../../shared/shibuya-artifacts/store-feedback-v044/390-staff7.png)、[390pxの展開先](../../shared/shibuya-artifacts/store-feedback-v044/390-operations-reason.png)、[1280pxの店長委任](../../shared/shibuya-artifacts/store-feedback-v044/1280-manager.png)を目視し、入力近くの店舗利益・理由入口と、店長案の適用範囲を確認しました。店舗一覧での操作と、ゲーム終了時・診断 null の非表示は、この DOM 結果には含めません。非表示のコード分岐と、地図・店舗一覧が同じ storeControls を使うことは読取で確認しました。[検査担当の記録](../../shared/shibuya-artifacts/store-feedback-v044/README.md)にも範囲を明記しています。

発端の画面は[従業員7人の操作後](../../shared/shibuya-artifacts/research-next/opening-experience-v044/overstaff-warning.png)。これは変更前の実 App に描画 stub を組み合わせた画像であり、新しい導線の成功を示す画像ではありません。
