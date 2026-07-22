#!/bin/bash
# loop.sh (5-Stage Waterfall Architecture with Global Fallbacks)

echo "Starting 24/7 autonomous 5-stage pipeline with global fallbacks..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
LAST_TASK=""
RETRY_COUNT=0
MAX_RETRIES=3

# Centralised fallback function to ensure no task ever stalls
run_aider_with_fallback() {
    local MESSAGE="$1"
    local EXTRA_ARGS="$2"

    echo "Attempting 1: Claude..."
    timeout 12m aider --yes $EXTRA_ARGS --model openai/claude-fable-5 --editor-model openai/claude-sonnet-5 --message "$MESSAGE"
    if [ $? -eq 0 ]; then return 0; fi
    echo "Claude failed. Reverting and attempting 2: Copilot..."
    git reset --hard HEAD

    timeout 12m aider --yes $EXTRA_ARGS --model openai/gpt-4o --editor-model openai/gpt-4o --message "$MESSAGE"
    if [ $? -eq 0 ]; then return 0; fi
    echo "Copilot failed. Reverting and attempting 3: Gemini 3 Pro..."
    git reset --hard HEAD

    timeout 12m aider --yes $EXTRA_ARGS --model gemini/gemini-3.1-pro-preview --editor-model gemini/gemini-3.1-pro-preview --message "$MESSAGE"
    if [ $? -eq 0 ]; then return 0; fi
    echo "Gemini 3 Pro failed. Reverting and attempting 4: DeepSeek..."
    git reset --hard HEAD

    timeout 12m aider --yes $EXTRA_ARGS --model deepseek/deepseek-chat --editor-model deepseek/deepseek-coder --message "$MESSAGE"
    if [ $? -eq 0 ]; then return 0; fi
    echo "DeepSeek failed. Reverting and attempting 5: Gemini Flash..."
    git reset --hard HEAD

    timeout 12m aider --yes $EXTRA_ARGS --model gemini/gemini-3.5-flash --editor-model gemini/gemini-3.5-flash --message "$MESSAGE"
    if [ $? -eq 0 ]; then return 0; fi

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
    echo "STAGE 3: CLEAN UP (Linting & Formatting)"
    echo "========================================"
    run_aider_with_fallback "Run 'cd frontend && npm run lint' and 'cd backend && npm run lint'. If there are any TypeScript or formatting errors, fix them automatically." ""

    echo "========================================"
    echo "STAGE 4: POST-MANAGEMENT (Verification)"
    echo "========================================"
    run_aider_with_fallback "Review the git diff. Did we successfully complete: '$CURRENT_TASK'? If yes, change [ ] to [x] in TODO.md. If we missed requirements, add a new [ ] task below it." ""

    echo "========================================"
    echo "STAGE 5: NEXT (Git Sync & Cooldown)"
    echo "========================================"
    git commit -am "ci: automated pipeline cycle complete" || true
    git push origin "$CURRENT_BRANCH" || true
    
    echo "Cycle complete. Cooling down for 15 seconds..."
    sleep 15
done
