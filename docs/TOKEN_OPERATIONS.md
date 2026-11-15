# トークン運用ルール(Claude Code)

更新日: 2026-11-15 / 対象: Claude Code 2.1.x でこのリポジトリを改修・シナリオ追加するときの運用。
**日々の判断に使う短い版は `CLAUDE.md`(毎セッション自動読込)。本書はその理由・仕組み・手動手順をまとめたもの**で、必要なときだけ読む。

---

## 1. 目的と背景

- Claude Code のコストは「コンテキストに積み上がった量 × ターン数」で決まる。長いセッションほど 1 ターンあたりのトークンが増え、同じ作業でも高くつく。
- 本リポジトリは 2026-11-15 までの数セッションで transcript が 45 MB・11 MB・6 MB に達しており、1 セッションに複数の作業単位(レビュー対応・シナリオ追加・文書更新)を詰め込んでいた。
- 今後は「システム改修」と「シナリオ追加」の両方が続くため、**作業単位ごとに区切る運用**と、**読み込む量を最小にする読み方**を標準にする。

## 2. 仕組みの全体像(自動 / 半自動 / 手動)

| 区分 | 仕組み | 場所 | 何をするか |
|---|---|---|---|
| 自動 | `CLAUDE.md` | リポジトリ直下 | 毎セッション読み込まれ、Claude に読み方・区切り方・提案の義務を課す |
| 自動 | SessionStart フック | `.claude/hooks/session-start.sh` | 起動・再開・`/clear`・圧縮の直後に、`.claude/handoff.md`(先頭 40 行)と git の状態を注入。/clear しても作業の続きが分かる |
| 自動 | UserPromptSubmit フック | `.claude/hooks/context-check.sh` | 毎プロンプト時に使用率を調べ、50% 以上で「区切りで /clear を提案」、70% 以上で「新規着手禁止・handoff 更新・/clear 提案」を Claude に指示 |
| 自動 | Stop フック | 同上 | Claude の応答終了時、使用率 50% 以上なら 🟡/🔴 の注意をユーザーに表示 |
| 自動 | PreCompact フック | `.claude/hooks/pre-compact.sh` | 圧縮の発生を `.claude/state/compact.log` に記録。自動圧縮なら注意を表示 |
| 自動 | ステータスライン | `~/.claude/hooks/statusline.sh`(ユーザー設定) | 画面下にモデル・`ctx NN%`・コスト・ブランチを常時表示。使用率を `~/.claude/state/context-<session>.json` に書き、上のフックの正確な情報源になる |
| 半自動 | チェックポイント | Claude が実行 | 検証 → BACKLOG 更新 → コミット → handoff 更新 → **/clear の提案** |
| 手動 | `/clear` `/compact` | ユーザー | Claude は実行できない(6 章) |

使用率の情報源は 2 段構え。ステータスラインが書く値(ハーネス公式の `used_percentage`)があればそれを使い、無ければ transcript の最後の usage(input + cache_creation + cache_read)を 200k 窓で割った推定値を使う。推定値のときは通知に「推定」と出る。窓の大きさが違うモデルを使うときは、`.claude/settings.json` の `env` に `CTX_WINDOW` を足すか、ステータスラインを有効にしておく。

## 3. セッションの型

### 3.1 システム改修(ビューア・検証・スキーマ)
1. 開始:SessionStart の注入(handoff と git)を読む。`docs/BACKLOG.md` の対象行を `grep -n 'BL-xx'` で見る。
2. 調査:対象関数を `grep -n` で特定し、`sed -n` で範囲読み。`src/style.css`(1,445 行)・`src/stage.ts`(694 行)・`src/main.ts`(593 行)は全文を読まない。
3. 実装:Edit で部分編集。`npm run build 2>&1 | tail -15`。
4. 確認:`npm run validate 2>&1 | tail -20`。画面確認が要るものは `docs/TRIAL_PLAN.md` に沿ってユーザーが行う。
5. チェックポイント(CLAUDE.md 2 章)→ **/clear を提案**。

### 3.2 シナリオ追加(座標表スクリプト方式。現状 58 本すべてこの方式)
1. 開始:同上。作るテーマを 1 つに決める(2〜3 パターン)。
2. 読む:`tools/scenario-src/README.md` → `groups.mjs` → `lib.mjs` → 同じ型の既存スクリプト 1 本 → `docs/SCENARIO_CATALOG.md` の該当節(`grep -n '^####'` → `sed -n`)。**ここまでで読む量は合計 600 行程度**に収まる。
3. 書く:`groups.mjs` にテーマを追加 → `wN-<theme>.mjs` を新規作成 → `build-all.mjs` の順番に追加。
4. 作る・検証:`npm run scenarios && npm run validate 2>&1 | grep -B1 -A3 '<id>'`。警告が出たらスクリプトを直す(JSON は見ない・直さない)。
5. 文書:`docs/SCENARIO_CATALOG.md`(該当節と 3 章の数)、`README.md` のステータス行、`docs/BACKLOG.md`、`tools/scenario-src/README.md` のファイル表。grep で行を特定して部分編集。
6. チェックポイント → **/clear を提案**。指導者目線のレビューは別セッション(新しいコンテキストで読む方が、本文を読み直す分だけ安い)。

### 3.3 LLM 生成方式(`docs/scenario-prompt.md`)を使う場合
- プロンプトに添付するスキーマ(805 行)とお手本 JSON は **Claude Code の外**(別の LLM セッション)で使う前提。Claude Code の中でこれを読ませると 1 本あたり約 2 万トークンを消費するため、Claude Code では座標表方式を使う。

## 4. 使用率のしきい値と行動

| 使用率 | ステータスライン | Claude の行動 | ユーザーの行動 |
|---|---|---|---|
| 〜50% | 🟢 | 通常 | 通常 |
| 50〜70% | 🟡 | 次の区切りでチェックポイント → /clear 提案 | 提案を受けたら `/clear` |
| 70%〜 | 🔴 | 新規着手を止め、最小の区切りで handoff を更新 → /clear(または /compact)提案 | 速やかに `/clear`。続きが必須なら `/compact` |
| 約 95% | — | ハーネスの自動圧縮が走る(避けたい状態) | PreCompact の注意が出たら、次は早めに区切る |

しきい値は `.claude/settings.json` の `env` に `CTX_WARN_PCT` / `CTX_STOP_PCT` を置けば変えられる。

## 5. /clear と /compact の使い分け

- **/clear が既定**。作業単位の終わりで使う。handoff と git があるので、次のセッションで失うものは無い。コストは最小。
- **/compact は「途中で続きが必須」のときだけ**。要約そのものにトークンがかかり、細部も落ちる。使うときは Claude が出す指示文(CLAUDE.md 3 章)をそのまま貼る。
- 自動圧縮は最後の安全網。頻発するなら作業単位が大きすぎるので、分割する。
- `/clear` 後に迷ったら、`.claude/handoff.md` の「次の一手」を読む(SessionStart が自動で出す)。

## 6. 手動で行うこと(ルール化できない事項)

Claude Code の仕組み上、次は Claude からは実行できない。該当する場面で Claude が明示的に伝えるので、ユーザーが行う。

1. **`/clear` と `/compact` の実行**。Claude は提案と指示文の提示まで。
2. **ステータスラインの監視**。🟡 以上を見たら区切りを意識する。表示が出ないときは `~/.claude/settings.json` の `statusLine` を確認する。
3. **依頼の粒度**。1 プロンプトに 1 作業単位。複数の BL をまとめて頼むと、1 セッションで終わらせようとして長くなる。
4. **貼り付ける量**。レビュー結果・ログの全文は `docs/` や `.claude/state/` に保存し、「ファイル名 + 行範囲」で指示する。
5. **モデル・推論量の選択**(`/model`、`/fast`、effort)。座標の微調整・文書の部分更新のような定型作業は軽いモデルで足りる。
6. **自動圧縮のしきい値**。必要なら環境変数 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` で下げられる(ハーネス側の設定。既定のままで、/clear 運用を優先する)。
7. **古い transcript の整理**。`~/.claude/projects/-home-claude-claude-soccer-theory/*.jsonl` は数十 MB になる。`--resume` で戻る必要が無いものは削除してよい(コストには影響しないがディスクと `/resume` 一覧が軽くなる)。

## 7. ファイル一覧と Git 方針

| ファイル | 役割 | Git |
|---|---|---|
| `CLAUDE.md` | 短い運用ルール(自動読込) | コミット |
| `docs/TOKEN_OPERATIONS.md` | 本書 | コミット |
| `.claude/settings.json` | フック定義 | コミット |
| `.claude/hooks/*.sh` | フック本体 | コミット |
| `.claude/handoff.md` | セッション間の引き継ぎ(機械ローカルの作業状態) | 無視 |
| `.claude/state/` | 圧縮ログなど | 無視 |
| `~/.claude/hooks/statusline.sh`・`~/.claude/settings.json` | ステータスライン(全プロジェクト共通) | リポジトリ外 |

## 8. 動作確認の方法

```bash
# フックの単体テスト(JSON を stdin に渡す)
echo '{"source":"clear","cwd":"'$PWD'"}' | CLAUDE_PROJECT_DIR=$PWD bash .claude/hooks/session-start.sh
echo '{"hook_event_name":"UserPromptSubmit","session_id":"test","transcript_path":"'$(ls -t ~/.claude/projects/-home-claude-claude-soccer-theory/*.jsonl | head -1)'"}' | bash .claude/hooks/context-check.sh
echo '{"trigger":"auto","cwd":"'$PWD'"}' | CLAUDE_PROJECT_DIR=$PWD bash .claude/hooks/pre-compact.sh
# ステータスライン
echo '{"model":{"display_name":"Test"},"session_id":"test","workspace":{"current_dir":"'$PWD'"},"context_window":{"used_percentage":55,"context_window_size":200000},"cost":{"total_cost_usd":1.2}}' | bash ~/.claude/hooks/statusline.sh
```
設定はセッション起動時に読まれるため、`.claude/settings.json` を変えたら新しいセッションで確認する(`/hooks` で登録状況を見られる)。
