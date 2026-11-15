#!/usr/bin/env bash
# context-check.sh — コンテキスト使用率を調べ、しきい値を超えたら知らせる。
#   UserPromptSubmit: stdout が Claude のコンテキストに入る → Claude に「区切り・引き継ぎ・/clear 提案」を指示
#   Stop            : systemMessage でユーザーに表示 → /clear・/compact の判断材料
# 使用率の出どころ(優先順):
#   1) statusline(~/.claude/hooks/statusline.sh)が書く ~/.claude/state/context-<session>.json(ハーネス公式の used_percentage)
#   2) transcript の最後の assistant メッセージの usage(input+cache_creation+cache_read)÷ CTX_WINDOW(既定 200000)
# しきい値は環境変数 CTX_WARN_PCT(既定 50)/ CTX_STOP_PCT(既定 70)で変更できる。
set -u
input=$(cat)
event=$(printf '%s' "$input" | jq -r '.hook_event_name // ""')
sid=$(printf '%s' "$input" | jq -r '.session_id // ""')
tp=$(printf '%s' "$input" | jq -r '.transcript_path // ""')
WARN=${CTX_WARN_PCT:-50}
STOP=${CTX_STOP_PCT:-70}

pct=""; src=""
state="$HOME/.claude/state/context-$sid.json"
if [ -n "$sid" ] && [ -f "$state" ]; then
  age=$(( $(date +%s) - $(stat -c %Y "$state" 2>/dev/null || echo 0) ))
  if [ "$age" -lt 900 ]; then
    pct=$(jq -r '.used_percentage // empty' "$state" 2>/dev/null)
    [ -n "$pct" ] && src="statusline"
  fi
fi
if [ -z "$pct" ] && [ -n "$tp" ] && [ -f "$tp" ]; then
  used=$(tac "$tp" | grep -a -m1 '"type":"assistant".*"isSidechain":false\|"isSidechain":false.*"type":"assistant"' \
    | jq -r '.message.usage | ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))' 2>/dev/null)
  win=${CTX_WINDOW:-200000}
  if [ -n "$used" ] && [ "$used" != "null" ] && [ "$used" -gt 0 ] 2>/dev/null; then
    pct=$(( used * 100 / win )); src="transcript(推定・窓 ${win})"
  fi
fi
[ -z "$pct" ] && exit 0
p=${pct%.*}
[ "$p" -ge "$WARN" ] 2>/dev/null || exit 0

case "$event" in
  UserPromptSubmit)
    if [ "$p" -ge "$STOP" ]; then
      cat <<MSG
【トークン運用・自動通知】コンテキスト使用率 約 ${p}%(${src})。CLAUDE.md の「${STOP}% 以上」ルールを適用:新しいサブタスクに着手しない。作業中の項目を最小の区切りまで進め、検証→コミット→ .claude/handoff.md 更新→ユーザーへ /clear(作業の続きが必要なら /compact)を明示的に提案すること。
MSG
    else
      cat <<MSG
【トークン運用・自動通知】コンテキスト使用率 約 ${p}%(${src})。次の区切り(検証・コミット)でチェックポイントを取り、/clear を提案すること。長いファイルの全文読み込みは避ける。
MSG
    fi
    ;;
  Stop)
    if [ "$p" -ge "$STOP" ]; then
      msg="🔴 コンテキスト使用率 約 ${p}%(${src})。区切りで /clear を推奨(続きがあるなら /compact)。handoff の更新を Claude に求めてください。"
    else
      msg="🟡 コンテキスト使用率 約 ${p}%(${src})。次の区切りで /clear を検討してください。"
    fi
    jq -cn --arg m "$msg" '{systemMessage: $m}'
    ;;
esac
exit 0
