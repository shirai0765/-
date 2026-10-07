# D01 制作状況

更新: 2026-10-07 14:27 JST
基点: game-source 4b13945f88154f579ae8cde1ec1c3fb137445336
制作ブランチ: dot/assets-v080

D00 は PR #1 で開発親が受領し、担当表の確認済みを確認しました。

## 実際の担当

- 交差点商業ビル: gpt-6-astra / xhigh、crossing-retail 専用。
- テラス型商業ビル: gpt-6-astra / xhigh、terraced-retail 専用。
- 道玄坂雑居ビル: gpt-6-astra / xhigh、dogenzaka-mixed 専用。
- 桜丘住宅・小規模オフィス: gpt-6-astra / xhigh、sakura-midrise 専用。
- 独立 Blender 品質確認: gpt-6-astra / xhigh、validation 専用。
- 建築参照調査: 先行 gpt-6-luna / xhigh、references 専用。

上記は起動時に指定し受付されたモデル設定。生成内容・検証結果は個別成果物に記録します。主担当を含め7枠ですが、全員Astraという報告ではありません。常時7体の稼働を保証する値でもありません。

保存クラウド環境の追加作成はサーバーエラーで未確認。GitHubからDot側の仮想環境へのソース取得と、既存Blenderの存在確認は成功しています。品質担当の初回起動は同時枠上限で失敗し、先行調査の子担当終了後に起動しました。

## 提出条件

最初の1棟を、GLB・再現スクリプト・正面/斜め/屋上画像・実測統計・出典・独立検証とともに小さいDraft PRで返します。現段階で完成・読込成功・性能達成は未確認です。

編集は public/models/external-v080/、scripts/external-v080/、docs/external/dot/ の担当別サブディレクトリに限定。既存src、経済、配置、109、PLATEAU、mainには変更しません。全体テスト・本番ビルド・公開は既存開発親の担当です。D02は初棟提出後に行い、既存保存を壊さない隔離環境の確認が必要です。

## 最初の提出: crossing-retail

AXIS Culture House 1棟を先行提出。GLB 506,364 bytes、5,425 triangles、11,494 exported vertices、13 materials/primitives、画像なし。作者と独立担当が実際のBlender再読込・正面/斜め/屋上描画を検証しました。詳細は crossing-retail/README.md と validation/crossing-retail/review.md。既存ゲームへの配置・ブラウザー性能はまだ確認していません。他の建物は制作・検証中で、この最初のPRには含めません。参照調査は完了、制作4担当のうち交差点担当は完了しています。
