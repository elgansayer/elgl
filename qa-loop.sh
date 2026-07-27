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

run_aider_with_fallback() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"

    # Claude Opus is the primary model, falling back to Gemini and then DeepSeek.
    # This order is based on user preference for model capabilities.
    local MODELS=(
        "openai/claude-opus-4.7 openai/claude-sonnet-4.5 Claude-Opus-4.7"
        "openai/claude-opus-5 openai/claude-sonnet-4.5 Claude-Opus-5"
        "gemini/gemini-3.1-pro-preview gemini/gemini-3.1-pro-preview Gemini-3-Pro"
        "deepseek/deepseek-v4-pro deepseek/deepseek-v4-pro DeepSeek-V4-Pro"
        "gemini/gemini-3.5-flash gemini/gemini-3.5-flash Gemini-Flash"
    )

    # Preflight: drop entries whose model or editor model is not actually callable, so a
    # dead id cannot masquerade as "this model tried the task and failed".
    local USABLE=()
    local VERIFIED=0
    local rc
    for config in "${MODELS[@]}"; do
        read -r MODEL EDITOR NAME <<< "$config"

        model_is_callable "$MODEL"; rc=$?
        if [ $rc -eq 1 ]; then
            echo "Preflight: skipping $NAME, model $MODEL is not callable."
            continue
        fi
        local model_rc=$rc

        model_is_callable "$EDITOR"; rc=$?
        if [ $rc -eq 1 ]; then
            echo "Preflight: skipping $NAME, editor model $EDITOR is not callable."
            continue
        fi

        # rc 3 means unverifiable, so allow it through but do not count it as proof that
        # the credentials work.
        [ $model_rc -eq 0 ] && [ $rc -eq 0 ] && VERIFIED=$((VERIFIED + 1))
        USABLE+=("$config")
    done

    if [ ${#USABLE[@]} -eq 0 ]; then
        echo "CRITICAL: no callable models. This is a credential or configuration fault,"
        echo "not a task failure. Check .env and scripts/preflight-models.sh output."
        return 2
    fi
    echo "Preflight: ${#USABLE[@]} of ${#MODELS[@]} models callable ($VERIFIED verified)."

    for config in "${USABLE[@]}"; do
        read -r MODEL EDITOR NAME <<< "$config"
        echo "Attempting: $NAME..."
        > current_aider.log
        
        # Watcher: kills Aider instantly if litellm rate limits or quota is hit
        ( tail -f current_aider.log 2>/dev/null | grep -i -m 1 -E "RateLimitError|quota exceeded|rate limited" && pkill -f "aider.*$MODEL" ) &
        WATCHER_PID=$!
        disown $WATCHER_PID # Stops Bash from printing "Killed" when we terminate it
        
        timeout 12m aider --yes --no-show-model-warnings --editor-edit-format diff-fenced $FILES_AND_ARGS --model "$MODEL" --editor-model "$EDITOR" --message "$MESSAGE" 2>&1 | tee current_aider.log
        AIDER_EXIT=${PIPESTATUS[0]}

        kill -9 $WATCHER_PID 2>/dev/null || true

        # Guard: some models emit reasoning prose before the filename, which makes
        # Aider create phantom directories such as "Let me produce the block.backend/src/x.ts".
        # Delete them immediately so they never reach a commit.
        purge_phantom_paths

        if [ $AIDER_EXIT -eq 0 ]; then
            return 0
        fi

        # Do NOT reset --hard here. A model timeout or quota error is not a reason to
        # destroy the edits earlier models already landed; the next model builds on them.
        echo "$NAME failed or hit quota limit. Falling through to the next model, work preserved."
    done

    # Everything failed and we could not verify a single model against its provider. That
    # is almost always a dead API key or no network, so report it as infrastructure
    # (exit 2) rather than letting three cycles of it mark a sound task [STUCK].
    if [ $VERIFIED -eq 0 ]; then
        echo "CRITICAL: every model failed and none could be verified. Treating as an"
        echo "infrastructure fault. Check the API keys in .env."
        return 2
    fi

    echo "CRITICAL: all ${#USABLE[@]} callable models failed for this step."
    return 1
}

# Entry point every pipeline stage should call. Tries the Claude Pro subscription first
# (via Claude Code CLI, run_claude_code in scripts/claude-pro.sh) since it is the strongest
# model and costs nothing extra to attempt; only when that tier fails (usage cap hit, CLI
# missing, or an error) does it bail to the Aider waterfall on Copilot/Gemini/DeepSeek.
run_task_with_fallback() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"

    run_claude_code "$MESSAGE"
    if [ $? -eq 0 ]; then
        return 0
    fi

    run_aider_with_fallback "$MESSAGE" "$FILES_AND_ARGS"
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
