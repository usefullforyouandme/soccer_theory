#!/usr/bin/env bash
# session-start.sh — セッション開始(startup / resume / clear / compact)時に、前回の引き継ぎ(.claude/handoff.md)と git の状態を短く注入する。
# stdout は Claude のコンテキストに入るので、40 行程度に抑える。
set -u
input=$(cat)
src=$(printf '%s' "$input" | jq -r '.source // ""')
root=${CLAUDE_PROJECT_DIR:-$(printf '%s' "$input" | jq -r '.cwd // "."')}
hand="$root/.claude/handoff.md"
echo "【トークン運用】セッション開始(source=${src:-unknown})。ルールは CLAUDE.md、詳細は docs/TOKEN_OPERATIONS.md。"
if [ -f "$hand" ]; then
  echo "--- 前回の引き継ぎ(.claude/handoff.md。先頭 40 行) ---"
  head -n 40 "$hand"
else
  echo "--- 引き継ぎファイルなし(.claude/handoff.md)。着手時に作ること ---"
fi
echo "--- git(未コミット / 直近 3 件) ---"
git -C "$root" status --short 2>/dev/null | head -n 15
git -C "$root" log --oneline -3 2>/dev/null
exit 0
