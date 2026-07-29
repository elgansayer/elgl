#!/bin/bash
# fallback-chain.sh - Shared multi-tool CLI fallback chain
#
# Provides run_claude_code(), run_antigravity_cli(), run_aider_copilot(),
# run_aider() and run_task_with_fallback() used by loop.sh and qa-loop.sh.
# Previously each script carried its own copy of these functions.
#
# Fallback contract: each run_* function returns 0 on success, non-zero on any
# failure. run_task_with_fallback treats ANY non-zero exit code as a reason to fall
# through to the next tool.
#
# Claude, Antigravity (Gemini), Aider/Copilot, and Aider (DeepSeek) can all
# write code. Falls through on rate limit, capacity, or no-changes.

FALLBACK_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

# Shared git lock for coordinating between concurrent swarm agents.
# Without this, loop.sh and qa-loop.sh race on git commit/checkout/reset.
GIT_LOCK="/tmp/ai_swarm_git.lock"
git_locked() {
    flock -w 120 "$GIT_LOCK" git "$@"
}

# AI API rate limiter — prevents all 3 swarm agents from calling external
# AI APIs simultaneously (credit burn). Uses file-lock via mkdir (atomic).
# shellcheck source=scripts/rate-limiter.sh
source "$FALLBACK_DIR/rate-limiter.sh"

# Returns 0 if Antigravity produced real file changes, 1 otherwise.
run_antigravity_cli() {
    local MESSAGE="$1"

    local AGY_BIN=""
    if command -v agy &> /dev/null; then
        AGY_BIN="agy"
    elif command -v antigravity &> /dev/null; then
        AGY_BIN="antigravity"
    else
        echo "Antigravity CLI (agy/antigravity) not found."
        return 1
    fi

    echo "Running Antigravity CLI ($AGY_BIN) with Gemini (code-editing mode)..."
    local output
    local exit_code

    # Rate-limit shared across all agents
    acquire_ai_slot || { echo "Antigravity: rate limiter timed out."; return 1; }
    output=$(timeout --foreground -s KILL 300 "$AGY_BIN" -p --dangerously-skip-permissions "$MESSAGE" 2>&1)
    exit_code=$?
    release_ai_slot

    pkill -9 -f "$AGY_BIN" 2>/dev/null || true

    # Verify Antigravity actually produced file changes.
    if git diff --quiet && git diff --cached --quiet; then
        if [ $exit_code -ne 0 ]; then
            echo "Antigravity failed (exit $exit_code) and made no file changes."
        else
            echo "Antigravity exited 0 but made no file changes. Treating as failure."
        fi
        return 1
    fi

    if [ $exit_code -ne 0 ]; then
        echo "Antigravity was killed (exit $exit_code) but produced file changes. Accepting partial work."
    fi

    echo "$output"
    return 0
}

# Runs Aider with GitHub Copilot Pro API (OpenAI-compatible endpoint).
# Returns 0 on success (file changes produced), 1 on failure.
run_aider_copilot() {
    local MESSAGE="$1"

    if ! command -v aider &> /dev/null; then
        echo "Aider not found."
        return 1
    fi

    if [ -z "$OPENAI_API_KEY" ]; then
        echo "OPENAI_API_KEY not set (needed for Copilot API)."
        return 1
    fi

    local COPILOT_BASE="${OPENAI_API_BASE:-https://api.githubcopilot.com}"

    local aid_stub_dir
    aid_stub_dir=$(mktemp -d)
    cat > "$aid_stub_dir/playwright" << 'PLAYWRIGHT_STUB'
#!/bin/bash
exit 0
PLAYWRIGHT_STUB
    chmod +x "$aid_stub_dir/playwright"

    echo "Running Aider (GitHub Copilot Pro, code-editing mode)..."
    local output
    local exit_code
    local aider_timeout=600

    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    export PLAYWRIGHT_SKIP_BROWSER_GC=1
    export SUDO_ASKPASS="${FALLBACK_DIR}/sudo-askpass.sh"
    export DEBIAN_FRONTEND=noninteractive

    acquire_ai_slot || { echo "Aider/Copilot: rate limiter timed out."; rm -rf "$aid_stub_dir"; return 1; }
    output=$(PATH="$aid_stub_dir:$PATH" timeout --foreground -s KILL "$aider_timeout" \
        aider --model openai/gpt-4o --openai-api-base "$COPILOT_BASE" \
              --message "$MESSAGE" --no-auto-commits --no-git 2>&1)
    exit_code=$?
    release_ai_slot
    rm -rf "$aid_stub_dir"

    if git diff --quiet && git diff --cached --quiet; then
        if [ $exit_code -ne 0 ]; then
            echo "Aider/Copilot failed (exit $exit_code) and made no file changes."
        else
            echo "Aider/Copilot exited 0 but made no file changes. Treating as failure."
        fi
        return 1
    fi

    if [ $exit_code -ne 0 ]; then
        echo "Aider/Copilot was killed (exit $exit_code) but produced file changes. Accepting partial work."
    fi

    echo "$output"
    return 0
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

    # Create a stub playwright binary that silently exits 0.
    # Aider (Python) ships its own playwright and may call
    #   python -m playwright install --with-deps chromium
    # regardless of PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD (a Node.js-only env var).
    # The --with-deps flag runs 'sudo apt-get install' which hangs the entire
    # pipeline on a password prompt. Replacing playwright with a no-op binary
    # before the Aider call prevents this permanently.
    local aid_stub_dir
    aid_stub_dir=$(mktemp -d)
    cat > "$aid_stub_dir/playwright" << 'PLAYWRIGHT_STUB'
#!/bin/bash
# Stub: blocks Aider's playwright install from running and hanging on sudo.
exit 0
PLAYWRIGHT_STUB
    chmod +x "$aid_stub_dir/playwright"

    echo "Running Aider (deepseek/deepseek-reasoner, code-editing mode)..."
    local output
    local exit_code
    local aider_timeout=600

    # Block every path Aider might use to launch playwright.
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    export PLAYWRIGHT_SKIP_BROWSER_GC=1
    export SUDO_ASKPASS="${FALLBACK_DIR}/sudo-askpass.sh"
    export DEBIAN_FRONTEND=noninteractive

    # Rate-limit: only one AI API call across all swarm agents at a time.
    acquire_ai_slot || { echo "Aider: rate limiter timed out."; rm -rf "$aid_stub_dir"; return 1; }
    output=$(PATH="$aid_stub_dir:$PATH" timeout --foreground -s KILL "$aider_timeout" aider --message "$MESSAGE" --no-auto-commits --no-git 2>&1)
    exit_code=$?
    release_ai_slot
    rm -rf "$aid_stub_dir"

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

# Entry point every pipeline stage should call.
# Usage: run_task_with_fallback "message" ["additional context or files"]
# Tries tools in order:
#   Claude CLI -> Antigravity (Gemini) -> Aider/Copilot -> Aider (DeepSeek)
# All four can write code; falls through on rate limit/failure.
# Returns 0 as soon as any tool succeeds, or 2 if all exhausted.
run_task_with_fallback() {
    local MESSAGE="$1"
    local EXTRA_CONTEXT="${2:-}"
    local FULL_MESSAGE="$MESSAGE"
    [ -n "$EXTRA_CONTEXT" ] && FULL_MESSAGE="$MESSAGE -- context files: $EXTRA_CONTEXT"

    echo "Attempting Claude CLI..."
    run_claude_code "$FULL_MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi
    echo "Claude CLI unavailable. Trying Antigravity (Gemini)..."

    echo "--- Antigravity CLI (Gemini, code-editing) ---"
    run_antigravity_cli "$FULL_MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi
    echo "Antigravity unavailable. Trying Aider/Copilot..."

    echo "--- Aider (GitHub Copilot Pro) ---"
    run_aider_copilot "$FULL_MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi
    echo "Copilot unavailable. Falling through to Aider/DeepSeek."

    echo "Attempting Aider (DeepSeek)..."
    run_aider "$FULL_MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi

    echo "All tools in the fallback chain exhausted."
    return 2
}
