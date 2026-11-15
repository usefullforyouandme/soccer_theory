# soccer_theory — Claude Code への指示

小学 4 年生向け 8 人制サッカーのセオリー学習ツール。概要は `README.md`、仕様は `docs/SPEC.md`、課題は `docs/BACKLOG.md`。
トークン運用の共通ルール(作業単位・範囲読み・チェックポイント・使用率しきい値・手動事項)は `~/.claude/CLAUDE.md` にあり、ここには **このプロジェクト固有の部分だけ**を書く(詳細: `docs/TOKEN_OPERATIONS.md`)。

## トークン運用(このプロジェクト固有)
- 作業単位: `docs/BACKLOG.md` の BL 番号 1 件、またはシナリオ 1 テーマ(2〜3 パターン)。
- 検証: `npm run validate 2>&1 | tail -20`。ビューア変更時は `npm run build 2>&1 | tail -15`。スクリプトと JSON の一致は `npm run scenarios:check`。
- 読まない: `scenarios/*.json`(1.1 MB・生成物)、`dist/`、`node_modules/`、`package-lock.json`、`docs/COACH_REVIEW.md` と `docs/SCENARIO_CATALOG.md` の全文。生成 JSON の diff も見ない。
- チェックポイントで更新する課題一覧は `docs/BACKLOG.md`。

### システム改修のとき
- 入口は `docs/BACKLOG.md` の該当行 → 関係するソース(`src/main.ts` / `stage.ts` / `style.css` / `types.ts` / `scripts/validate.mjs`)の該当関数だけを `grep -n` で特定して読む。
- 仕様の確認は `docs/SPEC.md` の該当章だけ(`grep -n '^## '` で章の行番号を見てから範囲読み)。
- スキーマ変更は `schema/scenario.schema.json` の該当 definition だけを読み、`src/types.ts`・`docs/scenario-prompt.md`・`scripts/validate.mjs` の 3 点を同じセッションで追従させる。

### シナリオ追加のとき(座標表スクリプト方式)
- 読むもの(この順・これだけ):`tools/scenario-src/README.md` → `groups.mjs`(テーマを追加)→ `lib.mjs`(書き方)→ **同じ型のスクリプト 1 本**(例: 攻撃なら `w6-shoot.mjs`)→ `docs/SCENARIO_CATALOG.md` の該当テーマ節(`grep -n '^####'` で行を特定し範囲読み)。
- JSON は読まない・直接直さない。確認は `npm run scenarios && npm run validate 2>&1 | grep -B1 -A3 '<id>'` のように新規 id で絞る。
- 1 セッションで作るのは 1 テーマまで。文章の推敲はスクリプト内で行い、JSON を見比べない。
- 完了時に更新する文書:`docs/SCENARIO_CATALOG.md`(該当節と数)、`README.md` のステータス行、`docs/BACKLOG.md`、`tools/scenario-src/README.md` のファイル表。いずれも grep で行を特定して部分編集する。
- 指導者目線のレビューは別セッションで行う(作成と同じセッションに混ぜない)。
- LLM 生成方式(`docs/scenario-prompt.md`)はスキーマ 805 行とお手本 JSON を添付する前提なので Claude Code の外で使う。Claude Code では座標表方式を使う。
