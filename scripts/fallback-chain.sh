#!/bin/bash
# fallback-chain.sh - Shared multi-tool CLI fallback chain
#
# Provides run_copilot_cli(), run_antigravity_cli(), run_aider(), run_deepseek_api() and
# run_task_with_fallback() used by loop.sh and qa-loop.sh. Previously each script
# carried its own copy of these functions, which let the two definitions drift.
#
# Fallback contract: each run_* function returns 0 on success, non-zero on any
# failure. run_task_with_fallback treats ANY non-zero exit code as a reason to fall
# through to the next tool (a real quota/rate-limit error is just one instance of a
# non-zero exit; it is not the only one, so it must not be the only thing that
# triggers fallthrough). Only exhausting every tool in the chain is a hard failure.
#
# Advisory tools (Copilot, Antigravity, raw DeepSeek) always return 1 so they never
# stop the chain. They produce debug output but cannot edit files. Only Claude Code
# and Aider can actually write code and return 0 to satisfy the chain.

# Advisory only: always returns 1. Produces text suggestions but cannot edit files.
run_copilot_cli() {
    local MESSAGE="$1"

    if ! command -v gh &> /dev/null; then
        echo "GitHub CLI (gh) not found - advisory skip."
        return 1
    fi

    if ! gh copilot --help &> /dev/null 2>&1; then
        echo "GitHub Copilot CLI not available - advisory skip."
        return 1
    fi

    echo "Running GitHub Copilot CLI (advisory, will fall through)..."
    gh copilot suggest "$MESSAGE" 2>&1 || true
    echo "Copilot advisory run complete. Falling through to next tool."
    return 1
}

# Advisory only: always returns 1. Produces text suggestions but cannot edit files.
run_antigravity_cli() {
    local MESSAGE="$1"

    local AGY_BIN=""
    if command -v agy &> /dev/null; then
        AGY_BIN="agy"
    elif command -v antigravity &> /dev/null; then
        AGY_BIN="antigravity"
    else
        echo "Antigravity CLI (agy/antigravity) not found - advisory skip."
        return 1
    fi

    echo "Running Antigravity CLI ($AGY_BIN) (advisory, will fall through)..."
    timeout --foreground -s KILL 120 "$AGY_BIN" "$MESSAGE" 2>&1 || true
    pkill -9 -f "$AGY_BIN" 2>/dev/null || true
    echo "Antigravity advisory run complete. Falling through to next tool."
    return 1
}

# Returns 0 on success, non-zero on any failure
run_aider() {
    local MESSAGE="$1"

    if ! command -v aider &> /dev/null; then
        echo "Aider not found."
        return 1
    fi

    if [ -z "$DEEPSEEK_API_KEY" ]; then
        echo "DEEPSEEK_API_KEY not set (Aider needs it for deepseek/deepseek-chat)."
        return 1
    fi

    echo "Running Aider (deepseek/deepseek-reasoner, code-editing mode)..."
    local output
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    output=$(aider --message "$MESSAGE" --no-auto-commits --no-git 2>&1)
    local exit_code=$?

    # Verify Aider actually produced changes. Accept partial work even when
    # timeout killed the process. It can also exit 0 while doing nothing.
    if git diff --quiet && git diff --cached --quiet; then
        if [ $exit_code -ne 0 ]; then
            echo "Aider failed with exit code $exit_code and made no file changes:"
            echo "$output"
        else
            echo "Aider exited 0 but made no file changes. Treating as failure."
        fi
        return 1
    fi

    if [ $exit_code -ne 0 ]; then
        echo "Aider was killed (exit $exit_code) but produced file changes. Accepting partial work."
    fi

    echo "$output"
    return 0
}

# Advisory only: always returns 1. Echoes raw API JSON but cannot edit files.
run_deepseek_api() {
    local MESSAGE="$1"

    if [ -z "$DEEPSEEK_API_KEY" ]; then
        echo "DEEPSEEK_API_KEY not set - advisory skip."
        return 1
    fi

    echo "Running DeepSeek API (advisory, will fall through)..."
    timeout 60 curl -sf -X POST "https://api.deepseek.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
        -d "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"user\",\"content\":\"$MESSAGE\"}]}" 2>&1 || true
    echo "DeepSeek API advisory run complete. Falling through to next tool."
    return 1
}

# Entry point every pipeline stage should call.
# Tries tools in order: Claude CLI -> GitHub Copilot CLI -> Antigravity CLI -> DeepSeek API -> Aider (DeepSeek)
# Only Claude Code and Aider can actually write code files. Copilot, Antigravity, and raw
# DeepSeek are advisory-only (always fall through to ensure Aider gets a chance).
# Returns 0 as soon as Claude or Aider succeeds with real code changes, or 2 once every
# tool in the chain has been exhausted.
run_task_with_fallback() {
    local MESSAGE="$1"

    echo "Attempting Claude CLI..."
    run_claude_code "$MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi
    echo "Claude CLI unavailable. Falling through advisory chain."

    echo "--- GitHub Copilot CLI (advisory) ---"
    run_copilot_cli "$MESSAGE"
    echo "--- Antigravity CLI (advisory) ---"
    run_antigravity_cli "$MESSAGE"
    echo "--- DeepSeek API (advisory) ---"
    run_deepseek_api "$MESSAGE"

    echo "All advisory tools complete. Attempting Aider for real code changes..."
    run_aider "$MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi

    echo "All tools in the fallback chain exhausted."
    return 2
}
