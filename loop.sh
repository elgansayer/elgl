#!/bin/bash
# loop.sh (Multi-Provider Autonomous Agent Swarm)
export OPENAI_MAX_RETRIES=0
export LITELLM_NUM_RETRIES=0
export AIDER_RETRIES=0

echo "Starting 24/7 Autonomous Multi-Provider Swarm..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
LAST_TASK=""
RETRY_COUNT=0
MAX_RETRIES=3

# Route: Deep Reasoning & Coding (Claude & DeepSeek)
run_heavy_coder() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"
    local MODELS=(
        "openai/claude-opus-4.7 openai/claude-opus-4.7 Claude-Opus"
        "openai/gpt-5.5 openai/gpt-5.5 Copilot-GPT"
        "deepseek/deepseek-v4-pro deepseek/deepseek-v4-pro DeepSeek-v4"
    )
    execute_models "$MESSAGE" "$FILES_AND_ARGS" MODELS[@]
}

# Route: Fast Fixes & Reviews (Gemini Flash & Haiku)
run_fast_fixer() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"
    local MODELS=(
        "gemini/gemini-3.5-flash gemini/gemini-3.5-flash Gemini-Flash"
        "openai/claude-sonnet-4.5 openai/claude-sonnet-4.5 Claude-Sonnet"
    )
    execute_models "$MESSAGE" "$FILES_AND_ARGS" MODELS[@]
}

# Route: Massive Context Audits (Gemini Pro)
run_context_auditor() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"
    local MODELS=(
        "gemini/gemini-3.1-pro-preview gemini/gemini-3.1-pro-preview Gemini-Pro"
        "openai/claude-opus-4.7 openai/claude-opus-4.7 Claude-Opus"
    )
    execute_models "$MESSAGE" "$FILES_AND_ARGS" MODELS[@]
}

execute_models() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"
    declare -a MODELS_REF=("${!3}")

    for config in "${MODELS_REF[@]}"; do
        read -r MODEL EDITOR NAME <<< "$config"
        echo "Attempting with $NAME..."
        > current_aider.log
        
        ( tail -f current_aider.log 2>/dev/null | grep -i -m 1 -E "RateLimitError|quota exceeded|rate limited|insufficient_quota|429|payment required|insufficient balance" && pkill -f "aider.*$MODEL" ) &
        WATCHER_PID=$!
        disown $WATCHER_PID
        
        timeout 12m aider --yes --no-show-model-warnings $FILES_AND_ARGS --model "$MODEL" --editor-model "$EDITOR" --message "$MESSAGE" 2>&1 | tee current_aider.log
        AIDER_EXIT=${PIPESTATUS[0]}
        
        kill -9 $WATCHER_PID 2>/dev/null || true
        
        if [ $AIDER_EXIT -eq 0 ]; then return 0; fi
        echo "$NAME failed. Falling back to next provider in this tier..."
    done

    echo "CRITICAL: All providers in this tier failed."
    return 1
}

while true; do
    echo "========================================"
    echo "STAGE 1: PLANNER (Gemini Pro)"
    echo "========================================"
    CURRENT_TASK=$(grep -m 1 "\[ \]" TODO.md | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')
    
    if [ -z "$CURRENT_TASK" ]; then
        echo "🎉 All tasks complete!"
        sleep 60
        continue
    fi

    if [ "$CURRENT_TASK" == "$LAST_TASK" ]; then
        RETRY_COUNT=$((RETRY_COUNT + 1))
    else
        LAST_TASK="$CURRENT_TASK"
        RETRY_COUNT=1
    fi

    if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
        echo "❌ Task failed 3 times. Marking [STUCK]..."
        git reset --hard HEAD
        sed -i "0,/\[ \]/s/\[ \]/\[STUCK\]/" TODO.md
        curl -s -X POST -H 'Content-type: application/json' --data "{\"text\":\"🚨 Pipeline STUCK on task: $CURRENT_TASK. Auto-skipping to next task.\"}" ${SLACK_WEBHOOK_URL:-"http://localhost/dummy"} || true
        git commit -am "ci: mark task as stuck and skip"
        git push origin "$CURRENT_BRANCH" || true
        RETRY_COUNT=0
        continue
    fi

    echo "========================================"
    echo "STAGE 2: CODER (Claude / DeepSeek / GPT-4o)"
    echo "========================================"
    echo "Executing: $CURRENT_TASK"
    run_heavy_coder "Execute task: '$CURRENT_TASK'. Write the code. Also write or update 'backend/src/database/seed.ts' to automatically generate mock data for this new feature." "--architect --read SPEC.md"

    echo "========================================"
    echo "STAGE 3: FAST FIXER (Gemini Flash / Haiku)"
    echo "========================================"
    FIX_ATTEMPTS=0
    MAX_FIX_ATTEMPTS=3

    while [ $FIX_ATTEMPTS -le $MAX_FIX_ATTEMPTS ]; do
        > test_errors.log
        (cd frontend && npm run check:control-flow && npm run check:template-bindings && npm run check:rtl-logical) >> test_errors.log 2>&1
        LINT_CONST=$?
        (cd frontend && npm run lint) >> test_errors.log 2>&1
        LINT_FRONT=$?
        (cd backend && npm run lint) >> test_errors.log 2>&1
        LINT_BACK=$?
        (cd backend && npm test) >> test_errors.log 2>&1
        TEST_BACK=$?
        (cd frontend && npm test -- --watch=false) >> test_errors.log 2>&1
        TEST_FRONT=$?
        (cd frontend && npx playwright test) >> test_errors.log 2>&1
        TEST_UI=$?

        if [ $LINT_CONST -eq 0 ] && [ $LINT_FRONT -eq 0 ] && [ $LINT_BACK -eq 0 ] && [ $TEST_BACK -eq 0 ] && [ $TEST_FRONT -eq 0 ] && [ $TEST_UI -eq 0 ]; then
            echo "All tests, linting, and constitution rules passed! Quality Gate cleared."
            break
        fi

        if [ $FIX_ATTEMPTS -eq $MAX_FIX_ATTEMPTS ]; then
            echo "CRITICAL: Tests still failing. Marking STUCK and skipping."
            git reset --hard HEAD
            sed -i "0,/\[ \]/s/\[ \]/\[STUCK\]/" TODO.md
            git commit -am "ci: automated rollback, tests failed to pass"
            continue 2
        fi

        ERROR_CONTEXT=$(grep -E -A 10 -B 2 "FAIL|Error|failed|Use Angular control flow" test_errors.log | head -n 150)
        if [ -z "$ERROR_CONTEXT" ]; then ERROR_CONTEXT=$(tail -n 100 test_errors.log); fi
        
        # Use the ultra-fast models for looping through syntax errors
        run_fast_fixer "The automated test suite failed. Fix the codebase: $ERROR_CONTEXT" ""
        
        FIX_ATTEMPTS=$((FIX_ATTEMPTS+1))
    done

    echo "========================================"
    echo "STAGE 4: VERIFICATION (Gemini Pro / Opus)"
    echo "========================================"
    GIT_DIFF=$(git diff HEAD -- ':!package-lock.json' | cut -c 1-3000)
    
    if [ -z "$GIT_DIFF" ]; then
        run_fast_fixer "No changes were made for task: '$CURRENT_TASK'. Update TODO.md." "TODO.md"
    else
        # Use massive context models to verify the diff against the whole architecture
        run_context_auditor "Review this git diff for task '$CURRENT_TASK': $GIT_DIFF. If fully complete, change [ ] to [x] in TODO.md." "TODO.md"
    fi

    echo "========================================"
    echo "STAGE 4.5: VISION UI AUDIT (Gemini Pro Vision)"
    echo "========================================"
    if [ -f "frontend/tests/screenshot.png" ]; then
        echo "Taking UI snapshot and verifying pixel-perfection..."
        run_context_auditor "Here is a screenshot of the UI you just built. Compare it strictly to the design rules in AGENTS.md (Dark mode #121212, RTL support, neon accents). If it fails to match a premium HelloTalk clone, write the CSS/SCSS to fix it." "frontend/tests/screenshot.png"
    fi

    echo "========================================"
    echo "STAGE 5: DEPLOYMENT & SYNC"
    echo "========================================"
    git commit -am "ci: automated pipeline cycle complete - $CURRENT_TASK" || true
    git push origin "$CURRENT_BRANCH" || true
    
    # Autonomous Deployments
    echo "Deploying to staging..."
    (cd frontend && npx vercel deploy --prod --token $VERCEL_TOKEN --yes) || echo "Vercel deploy skipped"
    (cd backend && npx supabase db push) || echo "Supabase push skipped"

    echo "========================================"
    echo "STAGE 6: META LEARNING (Self-Modification)"
    echo "========================================"
    if [ $FIX_ATTEMPTS -gt 0 ]; then
        echo "Reflecting on mistakes made during this cycle..."
        # Feed the errors back to Gemini Pro to update AGENTS.md so it never makes the same mistake again
        MISTAKE_LOG=$(tail -n 100 test_errors.log)
        run_context_auditor "You made mistakes during this cycle that required $FIX_ATTEMPTS fixes. Here is the final error log: $MISTAKE_LOG. Please update AGENTS.md by adding a new bullet point under the 'Known Issues' or 'Rules' section so you never make this specific mistake again." "AGENTS.md"
        git commit -am "ci: meta-learning, updated constitution with new rules" || true
    fi
    sleep 15
done