#!/usr/bin/env bash
# pre-compact.sh — 圧縮(手動 /compact・自動)の発生を記録し、ユーザーに注意を表示する。
# 圧縮そのものの内容は変えられない(手動 /compact の指示文は CLAUDE.md のテンプレを使う)。
set -u
input=$(cat)
trig=$(printf '%s' "$input" | jq -r '.trigger // "unknown"')
root=${CLAUDE_PROJECT_DIR:-$(printf '%s' "$input" | jq -r '.cwd // "."')}
mkdir -p "$root/.claude/state"
printf '%s\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$trig" >> "$root/.claude/state/compact.log"
n=$(wc -l < "$root/.claude/state/compact.log")
if [ "$trig" = "auto" ]; then
  jq -cn --arg m "⚠ 自動圧縮が発生しました(このプロジェクトで通算 ${n} 回)。自動圧縮は要約の品質が落ちやすいので、次の区切りでは手動 /clear(+handoff 更新)を優先してください。" '{systemMessage: $m}'
fi
exit 0
