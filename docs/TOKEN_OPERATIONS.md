# トークン運用ルール(soccer_theory 固有)

更新日: 2026-11-15 / **共通ルール(原則・チェックポイント・使用率しきい値・フック・ステータスライン・手動事項)は、この PC の全プロジェクトに適用する `~/.claude/CLAUDE.md`「トークン運用」節と `~/.claude/docs/TOKEN_OPERATIONS.md` に移した。** 本書はこのリポジトリ固有の背景とセッションの型だけを残す。短い版は `CLAUDE.md`。

---

## 1. 背景
- このリポジトリは 2026-11-15 までの数セッションで transcript が 45 MB・11 MB・6 MB に達しており、1 セッションに複数の作業単位(レビュー対応・シナリオ追加・文書更新)を詰め込んでいた。
- 「システム改修」と「シナリオ追加」の両方が続くため、作業単位ごとに区切り、読む量を最小にする。

## 2. 仕組み
フック(SessionStart / UserPromptSubmit / Stop / PreCompact)・ステータスライン・`.claude/handoff.md` の git 除外は **すべてユーザーレベル**(`~/.claude/`、`~/.config/git/ignore`)で動く。このリポジトリには固有の `CLAUDE.md` と本書だけがある。`.claude/handoff.md` はプロジェクト直下に置かれ、SessionStart で先頭 40 行が注入される。

## 3. セッションの型

### 3.1 システム改修(ビューア・検証・スキーマ)
1. 開始:SessionStart の注入(handoff と git)を読む。`docs/BACKLOG.md` の対象行を `grep -n 'BL-xx'` で見る。
2. 調査:対象関数を `grep -n` で特定し、`sed -n` で範囲読み。`src/style.css`(1,445 行)・`src/stage.ts`(694 行)・`src/main.ts`(593 行)は全文を読まない。
3. 実装:Edit で部分編集。`npm run build 2>&1 | tail -15`。
4. 確認:`npm run validate 2>&1 | tail -20`。画面確認が要るものは `docs/TRIAL_PLAN.md` に沿ってユーザーが行う。
5. チェックポイント(~/.claude/CLAUDE.md)→ **/clear を提案**。

### 3.2 シナリオ追加(座標表スクリプト方式。現状 58 本すべてこの方式)
1. 開始:同上。作るテーマを 1 つに決める(2〜3 パターン)。
2. 読む:`tools/scenario-src/README.md` → `groups.mjs` → `lib.mjs` → 同じ型の既存スクリプト 1 本 → `docs/SCENARIO_CATALOG.md` の該当節(`grep -n '^####'` → `sed -n`)。**ここまでで読む量は合計 600 行程度**に収まる。
3. 書く:`groups.mjs` にテーマを追加 → `wN-<theme>.mjs` を新規作成 → `build-all.mjs` の順番に追加。
4. 作る・検証:`npm run scenarios && npm run validate 2>&1 | grep -B1 -A3 '<id>'`。警告が出たらスクリプトを直す(JSON は見ない・直さない)。
5. 文書:`docs/SCENARIO_CATALOG.md`(該当節と 3 章の数)、`README.md` のステータス行、`docs/BACKLOG.md`、`tools/scenario-src/README.md` のファイル表。grep で行を特定して部分編集。
6. チェックポイント → **/clear を提案**。指導者目線のレビューは別セッション(新しいコンテキストで読む方が、本文を読み直す分だけ安い)。

### 3.3 LLM 生成方式(`docs/scenario-prompt.md`)を使う場合
- プロンプトに添付するスキーマ(805 行)とお手本 JSON は **Claude Code の外**(別の LLM セッション)で使う前提。Claude Code の中でこれを読ませると 1 本あたり約 2 万トークンを消費するため、Claude Code では座標表方式を使う。

## 4. 手動で行うこと
共通(`/clear`・`/compact` の実行、ステータスラインの監視、依頼の粒度、貼り付け量、モデル選択、transcript の整理)は `~/.claude/docs/TOKEN_OPERATIONS.md` 5 章。このリポジトリ固有のものは、画面確認(`docs/TRIAL_PLAN.md`)と main への push(公開)の判断。

## 5. ファイル一覧
| ファイル | 役割 | Git |
|---|---|---|
| `CLAUDE.md` | 固有の短いルール(自動読込) | コミット |
| `docs/TOKEN_OPERATIONS.md` | 本書 | コミット |
| `.claude/handoff.md` | セッション間の引き継ぎ(機械ローカル) | 無視(`.gitignore` と `~/.config/git/ignore`) |
