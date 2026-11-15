# soccer_theory

小学4年生向けに、8人制サッカーの試合における「セオリーの動き方」を Web ブラウザで楽しく学べる学習ツール。
「◎ おてほん」と「× よくあるミス」を 5 ステップのアニメーションで比べ、1〜2 プレー先の結末(チャンス/ピンチ)まで見せる。

公開ページ: https://usefullforyouandme.github.io/soccer_theory/

## ステータス
v1.1:「反対側から見る」を追加。23 テーマ・シナリオ 50 本(「見た方向」の表示つき)

## ドキュメント
- [仕様書](docs/SPEC.md)
- [シナリオ生成プロンプト](docs/scenario-prompt.md)
- [シナリオ JSON Schema](schema/scenario.schema.json)
- [レビュー指摘一覧(ビューア v0.2。対応済み)](docs/REVIEW_FINDINGS.md)
- [シナリオカタログ](docs/SCENARIO_CATALOG.md)
- [シナリオ作成スクリプト](tools/scenario-src/README.md)
- [指導者目線のレビュー](docs/COACH_REVIEW.md)
- [課題リスト(バックログ)](docs/BACKLOG.md)

## 開発
```bash
npm ci
npm run dev                 # 開発サーバー(http://localhost:5173/)
npm run validate            # scenarios/*.json を全件検証
npm run scenarios           # 座標表のスクリプト(tools/scenario-src)から scenarios/ を作り直す
npm run scenarios:check     # スクリプトと scenarios/ がずれていないか確認
node scripts/validate.mjs scenarios/<id>.json   # 個別に検証
npm run build               # 型チェック + dist/ へビルド
npm run preview             # ビルド結果の確認
```

main に push すると、GitHub Actions(`deploy.yml`)が検証・ビルドを行い、GitHub Pages に自動で公開します。
