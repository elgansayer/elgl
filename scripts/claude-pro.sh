#!/bin/bash
# claude-pro.sh - Claude Pro CLI integration
#
# Provides run_claude_code() used by the fallback pipeline.
# Returns:
#   0 - success
#   1 - any failure (CLI missing, quota/rate limit, other error).
#       The caller (run_task_with_fallback in scripts/fallback-chain.sh) falls
#       through to the next tool on any non-zero return, so callers here do not
#       need to distinguish failure reasons.

run_claude_code() {
    local message="$1"

    if ! command -v claude &> /dev/null; then
        echo "Claude CLI not found."
        return 1
    fi

    echo "Running Claude CLI..."
    local output
    # -p/--print puts the CLI in one-shot non-interactive mode; without it, a prompt
    # given as a positional argument still starts an interactive session, which has no
    # human to drive it inside the tmux pane and exits immediately with code 1 every
    # time. --dangerously-skip-permissions avoids it blocking on a permission prompt
    # that nothing here can answer.
    output=$(claude -p --dangerously-skip-permissions "$message" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "Claude CLI failed with exit code $exit_code:"
        echo "$output"
        return 1
    fi

    echo "$output"
    return 0
}
