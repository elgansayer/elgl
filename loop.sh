#!/bin/bash
# loop.sh (5-Stage Waterfall Architecture with Global Rate Limit Watcher)
export OPENAI_MAX_RETRIES=0
export LITELLM_NUM_RETRIES=0
export AIDER_RETRIES=0

echo "Starting 24/7 autonomous 5-stage pipeline with global fallbacks..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
LAST_TASK=""
RETRY_COUNT=0
MAX_RETRIES=3

run_aider_with_fallback() {
    local MESSAGE="$1"
    local FILES_AND_ARGS="$2"

    local MODELS=(
        "openai/claude-opus-4.7 openai/claude-sonnet-4.5 Claude"
        "deepseek/deepseek-v4-pro deepseek/deepseek-coder DeepSeek"
        "openai/gpt-5.5 openai/gpt-4o Copilot-GPT"
        "gemini/gemini-3.1-pro-preview gemini/gemini-3.1-pro-preview Gemini-3-Pro"
        "gemini/gemini-3.5-flash gemini/gemini-3.5-flash Gemini-Flash"
    )

    for config in "${MODELS[@]}"; do
        read -r MODEL EDITOR NAME <<< "$config"
        echo "Attempting: $NAME..."
        > current_aider.log
        
        # Watcher: kills Aider instantly if litellm rate limits or quota is hit
        ( tail -f current_aider.log 2>/dev/null | grep -i -m 1 -E "RateLimitError|quota exceeded|rate limited" && pkill -f "aider.*$MODEL" ) &
        WATCHER_PID=$!

        timeout 12m aider --yes --no-show-model-warnings $FILES_AND_ARGS --model "$MODEL" --editor-model "$EDITOR" --message "$MESSAGE" 2>&1 | tee current_aider.log
        AIDER_EXIT=${PIPESTATUS[0]}
        
        kill -9 $WATCHER_PID 2>/dev/null || true
        
        if [ $AIDER_EXIT -eq 0 ]; then 
            return 0 
        fi
        
        echo "$NAME failed or hit quota limit. Reverting..."
        git reset --hard HEAD
    done

    echo "CRITICAL: All 5 models failed for this step."
    return 1
}

while true; do
    echo "========================================"
    echo "STAGE 1: PRE-MANAGEMENT (Planning)"
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
        echo "## [STUCK] $(date) - $CURRENT_TASK" >> STUCK_LOG.md
        git commit -am "ci: mark task as stuck"
        git push origin "$CURRENT_BRANCH"
        RETRY_COUNT=0
        continue
    fi

    echo "========================================"
    echo "STAGE 2: EXECUTOR (The Waterfall)"
    echo "========================================"
    echo "Executing: $CURRENT_TASK"
    run_aider_with_fallback "Execute task: '$CURRENT_TASK'. Write the code." "--architect --read SPEC.md"

    echo "========================================"
    echo "STAGE 3: CLEAN UP (Lint & Test)"
    echo "========================================"
    run_aider_with_fallback "Run the codebase verifications: 'cd frontend && npm run lint' and 'cd backend && npm run lint'. Then run the test suites: 'cd backend && npm test' and 'cd frontend && npm test -- --watch=false'. If ANY tests fail, you MUST fix the code until all tests pass." ""

    echo "========================================"
    echo "STAGE 4: POST-MANAGEMENT (Verification)"
    echo "========================================"
    run_aider_with_fallback "Review the git diff. Did we successfully complete: '$CURRENT_TASK'? If yes, change [ ] to [x] in TODO.md. If we missed requirements, add a new [ ] task below it." "TODO.md"

    echo "========================================"
    echo "STAGE 5: NEXT (Git Sync & Cooldown)"
    echo "========================================"
    git commit -am "ci: automated pipeline cycle complete" || true
    git push origin "$CURRENT_BRANCH" || true
    
    echo "Cycle complete. Cooling down for 15 seconds..."
    sleep 15
done