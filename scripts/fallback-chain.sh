#!/bin/bash
# fallback-chain.sh - Shared multi-tool CLI fallback chain
#
# Provides run_copilot_cli(), run_antigravity_cli(), run_deepseek_api() and
# run_task_with_fallback() used by loop.sh and qa-loop.sh. Previously each script
# carried its own copy of these functions, which let the two definitions drift.
#
# Fallback contract: each run_* function returns 0 on success, non-zero on any
# failure. run_task_with_fallback treats ANY non-zero exit code as a reason to fall
# through to the next tool (a real quota/rate-limit error is just one instance of a
# non-zero exit; it is not the only one, so it must not be the only thing that
# triggers fallthrough). Only exhausting every tool in the chain is a hard failure.

# Returns 0 on success, non-zero on any failure
run_copilot_cli() {
    local MESSAGE="$1"

    if ! command -v gh &> /dev/null; then
        echo "GitHub CLI (gh) not found."
        return 1
    fi

    if ! gh copilot --help &> /dev/null 2>&1; then
        echo "GitHub Copilot CLI not available."
        return 1
    fi

    echo "Running GitHub Copilot CLI..."
    local output
    output=$(gh copilot suggest "$MESSAGE" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "GitHub Copilot CLI failed with exit code $exit_code:"
        echo "$output"
        return 1
    fi

    echo "$output"
    return 0
}

# Returns 0 on success, non-zero on any failure
run_antigravity_cli() {
    local MESSAGE="$1"

    if ! command -v antigravity &> /dev/null; then
        echo "Antigravity CLI not found."
        return 1
    fi

    echo "Running Antigravity CLI..."
    local output
    output=$(antigravity "$MESSAGE" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "Antigravity CLI failed with exit code $exit_code:"
        echo "$output"
        return 1
    fi

    echo "$output"
    return 0
}

# Returns 0 on success, non-zero on any failure
run_deepseek_api() {
    local MESSAGE="$1"

    if [ -z "$DEEPSEEK_API_KEY" ]; then
        echo "DEEPSEEK_API_KEY not set."
        return 1
    fi

    echo "Running DeepSeek API..."
    local output
    output=$(curl -sf -X POST "https://api.deepseek.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
        -d "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"user\",\"content\":\"$MESSAGE\"}]}" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        echo "DeepSeek API failed with exit code $exit_code:"
        echo "$output"
        return 1
    fi

    echo "$output"
    return 0
}

# Entry point every pipeline stage should call.
# Tries tools in order: Claude CLI -> GitHub Copilot CLI -> Antigravity CLI -> DeepSeek API
# Falls through to the next tool on ANY non-zero exit code from the current tool.
# Returns 0 as soon as one tool succeeds, or 2 once every tool in the chain has failed.
run_task_with_fallback() {
    local MESSAGE="$1"

    echo "Attempting Claude CLI..."
    run_claude_code "$MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi
    echo "Claude CLI failed. Falling through to GitHub Copilot CLI."

    echo "Attempting GitHub Copilot CLI..."
    run_copilot_cli "$MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi
    echo "GitHub Copilot CLI failed. Falling through to Antigravity CLI."

    echo "Attempting Antigravity CLI..."
    run_antigravity_cli "$MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi
    echo "Antigravity CLI failed. Falling through to DeepSeek API."

    echo "Attempting DeepSeek API..."
    run_deepseek_api "$MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi

    echo "All tools in the fallback chain failed."
    return 2
}
