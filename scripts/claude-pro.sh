#!/usr/bin/env bash
# scripts/claude-pro.sh
#
# First tier of every model waterfall in this pipeline: run the task through the Claude
# Code CLI against the Claude Pro subscription (OAuth session from `claude /login`, not
# ANTHROPIC_API_KEY billing). It costs nothing extra beyond the flat subscription fee, so
# every stage tries it before falling back to the Aider waterfall on Copilot/Gemini/DeepSeek.
#
# shellcheck source=scripts/preflight-models.sh
source "$(dirname "${BASH_SOURCE[0]}")/preflight-models.sh"

CLAUDE_CODE_BIN="${CLAUDE_CODE_BIN:-claude}"
CLAUDE_CODE_MODEL="${CLAUDE_CODE_MODEL:-}"          # empty = whatever the Pro plan defaults to
CLAUDE_CODE_LOG="${CLAUDE_CODE_LOG:-current_claude.log}"

# Existence check only, no network call. Actually probing would spend a slice of the Pro
# plan's usage cap just to confirm the tier is there, which defeats the point of trying it
# first: it is only "free" if checking it is also free.
claude_code_is_available() {
    command -v "$CLAUDE_CODE_BIN" >/dev/null 2>&1
}

# Runs one task against Claude Pro via the Claude Code CLI. Returns:
#   0 -> Claude Code completed the task
#   1 -> Claude Code failed (usage cap hit, error, or timeout) - caller should fall back
#   2 -> CLI not installed - caller should fall back
run_claude_code() {
    local MESSAGE="$1"

    if ! claude_code_is_available; then
        echo "Claude Code CLI not found, skipping the Claude Pro tier."
        return 2
    fi

    echo "Attempting: Claude Pro (Claude Code CLI, subscription)..."
    > "$CLAUDE_CODE_LOG"

    local MODEL_ARGS=()
    [ -n "$CLAUDE_CODE_MODEL" ] && MODEL_ARGS=(--model "$CLAUDE_CODE_MODEL")

    # Backgrounded directly (not piped through tee) so $! is the real PID of the claude
    # process, not tee's. That lets the usage-cap watcher below kill by exact PID instead
    # of pattern-matching a process name, which matters here: this box may also be running
    # an interactive `claude` session, and a `pkill -f claude` (the pattern Aider's own
    # watcher uses for itself) could take that down as collateral damage.
    #
    # IS_SANDBOX=1 is required because this pipeline runs as root on the VPS: Claude Code
    # refuses --dangerously-skip-permissions under root unless it can tell it is already in
    # a deliberate sandbox, and exits 1 immediately otherwise ("cannot be used with
    # root/sudo privileges for security reasons"), which would make this tier fail every
    # single cycle.
    IS_SANDBOX=1 timeout 12m "$CLAUDE_CODE_BIN" -p "$MESSAGE" \
        --dangerously-skip-permissions \
        --output-format text \
        "${MODEL_ARGS[@]}" \
        > >(tee "$CLAUDE_CODE_LOG") 2>&1 &
    local CLAUDE_PID=$!

    # Watcher: bail out immediately once the Pro plan's usage cap is hit, rather than
    # waiting out the full 12-minute timeout. Wording below is Anthropic's current copy
    # for a subscription usage limit; adjust the regex if that copy changes.
    ( tail -f "$CLAUDE_CODE_LOG" 2>/dev/null \
        | grep -i -m 1 -E "usage limit reached|usage cap|rate limit|quota exceeded|overloaded_error" \
        && kill -9 "$CLAUDE_PID" 2>/dev/null ) &
    local WATCHER_PID=$!
    disown "$WATCHER_PID" 2>/dev/null || true

    wait "$CLAUDE_PID"
    local CLAUDE_EXIT=$?
    kill -9 "$WATCHER_PID" 2>/dev/null || true

    if [ $CLAUDE_EXIT -eq 0 ] && ! grep -qiE "usage limit reached|usage cap|rate limit|quota exceeded|overloaded_error" "$CLAUDE_CODE_LOG"; then
        echo "Claude Pro completed the task."
        return 0
    fi

    if grep -qiE "usage limit reached|usage cap|rate limit|quota exceeded|overloaded_error" "$CLAUDE_CODE_LOG"; then
        echo "Claude Pro subscription usage cap hit. Falling back to the Aider waterfall (Copilot/Gemini/DeepSeek)."
    else
        echo "Claude Code CLI failed (exit $CLAUDE_EXIT). Falling back to the Aider waterfall."
    fi
    return 1
}
