# soccer_theory

小学生(低学年)向けに、8人制サッカーの試合における「セオリーの動き方」を Web ブラウザで楽しく学べる学習ツール。
「◎ おてほん」と「× よくあるミス」を 5 ステップのアニメーションで比べ、1〜2 プレー先の結末(チャンス/ピンチ)まで見せる。

## ステータス
仕様策定・データ設計フェーズ(ビューアは未実装)

## ドキュメント
- [仕様書](docs/SPEC.md)
- [シナリオ生成プロンプト](docs/scenario-prompt.md)
- [シナリオ JSON Schema](schema/scenario.schema.json)

## シナリオの検証
```bash
npm ci
npm run validate            # scenarios/*.json を全件検証
node scripts/validate.mjs scenarios/<id>.json   # 個別に検証
```
