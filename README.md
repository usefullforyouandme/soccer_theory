# soccer_theory

小学生(低学年)向けに、8人制サッカーの試合における「セオリーの動き方」を Web ブラウザで楽しく学べる学習ツール。
「◎ おてほん」と「× よくあるミス」を 5 ステップのアニメーションで比べ、1〜2 プレー先の結末(チャンス/ピンチ)まで見せる。

公開ページ: https://usefullforyouandme.github.io/soccer_theory/

## ステータス
ビューア初版(シナリオ 1 本)

## ドキュメント
- [仕様書](docs/SPEC.md)
- [シナリオ生成プロンプト](docs/scenario-prompt.md)
- [シナリオ JSON Schema](schema/scenario.schema.json)

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
