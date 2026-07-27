#!/bin/bash
# qa-loop.sh (Adversarial QA Agent)
set -a
source .env 2>/dev/null || true
set +a
export LITELLM_NUM_RETRIES=0

# shellcheck source=scripts/preflight-models.sh
source "$(dirname "$0")/scripts/preflight-models.sh"
# shellcheck source=scripts/claude-pro.sh
source "$(dirname "$0")/scripts/claude-pro.sh"

echo "Starting 24/7 Adversarial QA Swarm..."

purge_phantom_paths() {
    # Aider sometimes leaks reasoning prose into a file path, producing entries such as
    # "Let me produce the block.backend/src/streak/streak.service.ts", or a bare fragment
    # of code as a filename like "});". The old version only tested directories, so every
    # phantom *file* survived and got committed.
    #
    # Legitimate top-level entries only ever use [A-Za-z0-9._-], so anything containing a
    # space, quote or bracket is junk regardless of whether it is a file or a directory.
    local ALLOWED_DIRS="^(backend|frontend|config|docs|e2e|scratch|scripts|specs|supabase|node_modules|original-hello-talk-screenshots)$"
    local FOUND=0
    while IFS= read -r entry; do
        [ -z "$entry" ] && continue
        case "$entry" in .*) continue ;; esac

        local phantom=0
        if [[ ! "$entry" =~ ^[A-Za-z0-9._-]+$ ]]; then
            phantom=1   # prose or code leaked into the name
        elif [ -d "$entry" ] && [[ ! "$entry" =~ $ALLOWED_DIRS ]]; then
            phantom=1   # unexpected top-level directory
        fi

        if [ $phantom -eq 1 ]; then
            echo "PHANTOM PATH removed: $entry"
            git rm -r -q --cached --ignore-unmatch -- "$entry" 2>/dev/null || true
            rm -rf -- "$entry"
            FOUND=1
        fi
    done < <(ls -1)
    [ $FOUND -eq 1 ] && echo "WARNING: model leaked prose into file paths this cycle."
    return 0
}

# Returns 0 on success, 1 on non-quota failure, 2 on quota/rate limit
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
        if echo "$output" | grep -qiE "quota|rate.limit|429|too.many.requests"; then
            echo "GitHub Copilot CLI hit quota/rate limit."
            return 2
        fi
        echo "GitHub Copilot CLI failed with exit code $exit_code"
        return 1
    fi

    echo "$output"
    return 0
}

# Returns 0 on success, 1 on non-quota failure, 2 on quota/rate limit
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
        if echo "$output" | grep -qiE "quota|rate.limit|429|too.many.requests"; then
            echo "Antigravity CLI hit quota/rate limit."
            return 2
        fi
        echo "Antigravity CLI failed with exit code $exit_code"
        return 1
    fi

    echo "$output"
    return 0
}

# Returns 0 on success, 1 on non-quota failure, 2 on quota/rate limit
run_deepseek_api() {
    local MESSAGE="$1"

    if [ -z "$DEEPSEEK_API_KEY" ]; then
        echo "DEEPSEEK_API_KEY not set."
        return 1
    fi

    echo "Running DeepSeek API..."
    local output
    output=$(curl -s -X POST "https://api.deepseek.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
        -d "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"user\",\"content\":\"$MESSAGE\"}]}" 2>&1)
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        if echo "$output" | grep -qiE "quota|rate.limit|429|insufficient_quota"; then
            echo "DeepSeek API hit quota/rate limit."
            return 2
        fi
        echo "DeepSeek API failed with exit code $exit_code"
        return 1
    fi

    echo "$output"
    return 0
}

# Entry point every pipeline stage should call.
# Tries tools in order: Claude CLI -> GitHub Copilot CLI -> Antigravity CLI -> DeepSeek API
# Falls through to next tool only on quota/rate limit errors (exit code 2).
# Any other error stops the chain and returns 1.
run_task_with_fallback() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"

    # Step 1: Claude CLI
    echo "Attempting Claude CLI..."
    run_claude_code "$MESSAGE"
    local rc=$?
    if [ $rc -eq 0 ]; then
        return 0
    elif [ $rc -eq 2 ]; then
        echo "Claude CLI quota/rate limit. Falling through to GitHub Copilot CLI."
    else
        echo "Claude CLI failed with non-quota error. Stopping."
        return 1
    fi

    # Step 2: GitHub Copilot CLI
    echo "Attempting GitHub Copilot CLI..."
    run_copilot_cli "$MESSAGE"
    rc=$?
    if [ $rc -eq 0 ]; then
        return 0
    elif [ $rc -eq 2 ]; then
        echo "GitHub Copilot CLI quota/rate limit. Falling through to Antigravity CLI."
    else
        echo "GitHub Copilot CLI failed with non-quota error. Stopping."
        return 1
    fi

    # Step 3: Antigravity CLI
    echo "Attempting Antigravity CLI..."
    run_antigravity_cli "$MESSAGE"
    rc=$?
    if [ $rc -eq 0 ]; then
        return 0
    elif [ $rc -eq 2 ]; then
        echo "Antigravity CLI quota/rate limit. Falling through to DeepSeek API."
    else
        echo "Antigravity CLI failed with non-quota error. Stopping."
        return 1
    fi

    # Step 4: DeepSeek API
    echo "Attempting DeepSeek API..."
    run_deepseek_api "$MESSAGE"
    rc=$?
    if [ $rc -eq 0 ]; then
        return 0
    elif [ $rc -eq 2 ]; then
        echo "DeepSeek API quota/rate limit. All tools exhausted."
        return 2
    else
        echo "DeepSeek API failed with non-quota error. Stopping."
        return 1
    fi
}

while true; do
    echo "========================================"
    echo "QA STAGE: BREAK THE APP"
    echo "========================================"
    
    > qa_aider.log
    > qa_errors.log
    QA_TASK="Write a new aggressive Playwright E2E test in e2e/tests/adversarial/ that tries to break the UI or find a bug in the chat/video systems. Run it."

    run_task_with_fallback "$QA_TASK" ""
    
    # Run the real Playwright suite. It lives in e2e/ (its own package.json and
    # playwright.config.ts, testDir: './tests'), not in frontend/, which has no
    # Playwright config and no tests/ directory. Running from frontend/ used to fall
    # back to scanning src/, pick up the Vitest unit specs there, and die with
    # "ReferenceError: describe is not defined" on every cycle. That non-zero exit
    # was misreported as "BUG FOUND!" 48 times running; it was never a real bug.
    (cd e2e && npx playwright test) >> qa_errors.log 2>&1
    TEST_EXIT=$?
    
    if [ $TEST_EXIT -ne 0 ]; then
        echo "BUG FOUND! Adding to TODO.md"
        # If the QA agent found a bug, append it to TODO.md for the main loop to fix
        BUG_REPORT=$(grep -E -A 5 "Error:|failed" qa_errors.log | head -n 1)
        TRIAGE_TASK="The QA tests just failed with this error: $BUG_REPORT. Add a new task to the VERY TOP of TODO.md to fix this specific bug."
        run_task_with_fallback "$TRIAGE_TASK" "TODO.md"
        git commit -am "ci: qa agent discovered a bug and added it to TODO.md"
    else
        echo "App is robust. No bugs found this cycle."
        git reset --hard HEAD
    fi
    
    echo "Sleeping before next QA attack..."
    sleep 300
done
