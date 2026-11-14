# soccer_theory

小学4年生向けに、8人制サッカーの試合における「セオリーの動き方」を Web ブラウザで楽しく学べる学習ツール。
「◎ おてほん」と「× よくあるミス」を 5 ステップのアニメーションで比べ、1〜2 プレー先の結末(チャンス/ピンチ)まで見せる。

公開ページ: https://usefullforyouandme.github.io/soccer_theory/

## ステータス
v0.4:対象を小学4年生に変更(4年生までに習う漢字で表記)。シナリオ 1 本

## ドキュメント
- [仕様書](docs/SPEC.md)
- [シナリオ生成プロンプト](docs/scenario-prompt.md)
- [シナリオ JSON Schema](schema/scenario.schema.json)
- [レビュー指摘一覧(修正予定)](docs/REVIEW_FINDINGS.md)
- [シナリオカタログ(案)](docs/SCENARIO_CATALOG.md)

## 開発
```bash
npm ci
npm run dev                 # 開発サーバー(http://localhost:5173/)
npm run validate            # scenarios/*.json を全件検証
node scripts/validate.mjs scenarios/<id>.json   # 個別に検証
npm run build               # 型チェック + dist/ へビルド
npm run preview             # ビルド結果の確認
```

main に push すると、GitHub Actions(`deploy.yml`)が検証・ビルドを行い、GitHub Pages に自動で公開します。
