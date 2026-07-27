#!/bin/bash
# claude-pro.sh - Claude Pro CLI integration
#
# Provides run_claude_code() used by the fallback pipeline.
# Returns:
#   0 - success
#   1 - non-quota failure (CLI missing, other error)
#   2 - quota / rate limit hit (caller should fall through to next tool)

run_claude_code() {
    local message="$1"

    if ! command -v claude &> /dev/null; then
        echo "Claude CLI not found."
        return 1
    fi

    echo "Running Claude CLI..."
    local output
    output=$(claude "$message" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        # Check for quota / rate limit errors
        if echo "$output" | grep -qiE "quota|rate.limit|429|too.many.requests"; then
            echo "Claude CLI hit quota/rate limit."
            return 2
        fi
        echo "Claude CLI failed with exit code $exit_code"
        return 1
    fi

    echo "$output"
    return 0
}
