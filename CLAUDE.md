# soccer_theory — Claude Code への指示

小学 4 年生向け 8 人制サッカーのセオリー学習ツール。概要は `README.md`、仕様は `docs/SPEC.md`、課題は `docs/BACKLOG.md`。
本ファイルは毎セッション読み込まれるため **短く保つ**(目安 80 行)。詳しい理由・手順は `docs/TOKEN_OPERATIONS.md`。

## 1. トークン運用の原則(常時適用)
- **1 セッション = 1 作業単位**(BL 番号 1 件、またはシナリオ 1 テーマ分)。終わったら「チェックポイント → /clear の提案」で区切る。
- **読む前に探す**。長いファイルは `grep -n` で場所を特定し、`sed -n 開始,終了p` で範囲だけ読む。全文読み込みは 200 行未満のファイルに限る。
- **読まない**:`scenarios/*.json`(1.1 MB・生成物)、`dist/`、`node_modules/`、`package-lock.json`、`docs/COACH_REVIEW.md` と `docs/SCENARIO_CATALOG.md` の全文。
- **コマンド出力は絞る**:`npm run validate 2>&1 | tail -20`、`npm run build 2>&1 | tail -15`、`git diff --stat`。生成 JSON の diff は見ない(`npm run scenarios:check` で足りる)。
- **同じファイルを 2 回読まない**。編集後の再読込は不要(Edit の失敗はエラーで分かる)。
- サブエージェントはユーザーが明示したときだけ使う。

## 2. チェックポイント(作業単位の終わりに必ず行う)
1. `npm run validate` と(ビューア変更時)`npm run build` を通す。
2. `docs/BACKLOG.md` の該当行を更新し、コミットする(push は従来どおり main への push で公開されるため、ユーザーの指示に従う)。
3. `.claude/handoff.md` を書き直す(30 行以内。書式は下記)。
4. ユーザーに **「ここで `/clear` を推奨」** と明示する。作業が途中で続きが必須なら代わりに `/compact` の指示文(3 章)を提示する。

`.claude/handoff.md` の書式(SessionStart フックが先頭 40 行を自動注入する):
```
# 引き継ぎ(YYYY-MM-DD HH:MM)
## 作業中: <BL 番号/テーマ名>  状態: 完了 | 途中(次の手順: ...)
## 触ったファイル: ...
## 未検証・保留: ...
## 次の一手: <最初に実行するコマンドや確認>
```

## 3. 使用率に応じた行動(フックが自動通知する。通知が無くても自分で意識する)
| 使用率 | 行動 |
|---|---|
| 〜50% | 通常作業 |
| 50〜70% | 次の区切りでチェックポイントを取り、/clear を提案する |
| 70%〜 | 新しいサブタスクに着手しない。最小の区切りまで進めて handoff を更新し、/clear(続きが必要なら /compact)を提案する |

`/compact` を提案する時は、ユーザーがそのまま貼れる指示文を出す:
`/compact 残すこと: 作業中の BL 番号とテーマ、変更済みファイル一覧、未完了の手順、直近の validate/build 結果、ユーザーの決定事項。捨てること: 読み込んだファイル本文、途中の試行錯誤、ツール出力。`

## 4. システム改修のとき
- 入口は `docs/BACKLOG.md` の該当行 → 関係するソース(`src/main.ts` / `stage.ts` / `style.css` / `types.ts` / `scripts/validate.mjs`)の該当関数だけを `grep -n` で特定して読む。
- 仕様の確認は `docs/SPEC.md` の該当章だけ(`grep -n '^## '` で章の行番号を見てから範囲読み)。
- スキーマ変更は `schema/scenario.schema.json` の該当 definition だけを読み、`src/types.ts`・`docs/scenario-prompt.md`・`scripts/validate.mjs` の 3 点を同じセッションで追従させる。

## 5. シナリオ追加のとき(座標表スクリプト方式)
- 読むもの(この順・これだけ):`tools/scenario-src/README.md` → `groups.mjs`(テーマを追加)→ `lib.mjs`(書き方)→ **同じ型のスクリプト 1 本**(例: 攻撃なら `w6-shoot.mjs`)→ `docs/SCENARIO_CATALOG.md` の該当テーマ節(`grep -n '^####'` で行を特定し範囲読み)。
- JSON は読まない・直接直さない。確認は `npm run scenarios && npm run validate 2>&1 | grep -A3 '<id>'` のように新規 id で絞る。
- 1 セッションで作るのは 1 テーマ(2〜3 パターン)まで。文章の推敲はスクリプト内で行い、JSON を見比べない。
- 完了時に更新する文書:`docs/SCENARIO_CATALOG.md`(該当節と数)、`README.md` のステータス行、`docs/BACKLOG.md`、`tools/scenario-src/README.md` のファイル表。いずれも grep で行を特定して部分編集する。
- 指導者目線のレビューは別セッションで行う(作成と同じセッションに混ぜない)。

## 6. 手動で行ってもらうこと(Claude は実行できないので、該当時に必ず伝える)
- `/clear`・`/compact` の実行(Claude は提案まで)。
- ステータスラインの ctx% を見て、🟡(50%)以上なら区切りで /clear。🔴(70%)なら早めに。
- 作業依頼は 1 件ずつ。貼り付けは必要部分だけ(レビュー結果全文などは `docs/` に保存して「n 行目〜」と指示する)。
