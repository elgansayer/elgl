#!/bin/bash
# loop.sh (Bulletproof Unattended Setup with Circuit Breakers)

echo "Starting unattended 24/7 autonomous build engine..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
LAST_TASK=""
RETRY_COUNT=0
MAX_RETRIES=3

while true; do
    # Extract the very first incomplete task from TODO.md
    CURRENT_TASK=$(grep -m 1 "\[ \]" TODO.md | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')

    if [ -z "$CURRENT_TASK" ]; then
        echo "🎉 All tasks in TODO.md are complete!"
        sleep 60
        continue
    fi

    # Check if the agent is stuck on the exact same task
    if [ "$CURRENT_TASK" == "$LAST_TASK" ]; then
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⚠️ Retry $RETRY_COUNT/$MAX_RETRIES for task: '$CURRENT_TASK'"
    else
        LAST_TASK="$CURRENT_TASK"
        RETRY_COUNT=1
    fi

    # CIRCUIT BREAKER: Skip task if stuck 3 times in a row
    if [ $RETRY_COUNT -gt $MAX_RETRIES ]; then
        echo "❌ Task failed $MAX_RETRIES times. Marking as [STUCK] and skipping..."
        
        # Revert any broken uncommitted code
        git reset --hard HEAD
        
        # Replace [ ] with [STUCK] in TODO.md for this specific line
        sed -i "0,/\[ \]/s/\[ \]/\[STUCK\]/" TODO.md
        
        # Append to STUCK_LOG.md for review later
        echo "## [STUCK] $(date)" >> STUCK_LOG.md
        echo "Task: $CURRENT_TASK" >> STUCK_LOG.md
        echo "---" >> STUCK_LOG.md
        
        git commit -am "ci: mark task as stuck after $MAX_RETRIES failed attempts"
        git push origin "$CURRENT_BRANCH"
        
        RETRY_COUNT=0
        continue
    fi

    echo "========================================"
    echo "EXECUTING TASK: $CURRENT_TASK"
    echo "========================================"

    # Run Aider with a 12-minute hard timeout and auto-linting
    timeout 12m aider --yes \
      --architect \
      --model gemini/gemini-3.1-pro-preview \
      --editor-model deepseek/deepseek-chat \
      --lint-cmd "cd frontend && npm run lint" \
      --read SPEC.md \
      --read AGENTS.md \
      --message "Read TODO.md. Execute the task: '$CURRENT_TASK'. Inspect the codebase first. If done, mark [x] in TODO.md. If not, implement the code, verify compilation with lint, and mark [x] in TODO.md."

    AIDER_EXIT=$?

    # Fallback to DeepSeek if Gemini times out or hits quota
    if [ $AIDER_EXIT -ne 0 ]; then
        echo "⚠️ Primary agent failed or timed out. Attempting fallback with DeepSeek..."
        git reset --hard HEAD # Clean up partial broken edits
        
        timeout 12m aider --yes \
          --architect \
          --model deepseek/deepseek-chat \
          --editor-model deepseek/deepseek-chat \
          --lint-cmd "cd frontend && npm run lint" \
          --read SPEC.md \
          --read AGENTS.md \
          --message "Read TODO.md. Execute the task: '$CURRENT_TASK'. Inspect the codebase first. If done, mark [x] in TODO.md. If not, implement the code, verify compilation with lint, and mark [x] in TODO.md."
    fi

    # Cloud sync
    git push origin "$CURRENT_BRANCH" || true

    echo "Iteration complete. Cooling down for 15 seconds..."
    sleep 15
done