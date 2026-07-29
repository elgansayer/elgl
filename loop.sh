#!/bin/bash
# loop.sh (5-Stage Waterfall Architecture with Liveness-Aware Execution)
#
# Task source: .tasks/pending/ directory (atomic file ops, no TODO.md races).
# State tracking: /tmp/ai_swarm_state.json (structured, watchdog-readable).
# STUCK handling: commits WIP before marking stuck (preserves partial work).

export PATH="$HOME/.local/bin:$PATH"

source "$(dirname "$(realpath "$0")")/scripts/swarm-env.sh" --validate
source "$SWARM_SCRIPTS/claude-pro.sh"
source "$SWARM_SCRIPTS/fallback-chain.sh"
source "$SWARM_SCRIPTS/swarm-state.sh"
source "$SWARM_SCRIPTS/swarm-tasks.sh"

export OPENAI_MAX_RETRIES=0
export LITELLM_NUM_RETRIES=0
export AIDER_RETRIES=0

swarm_state_init
swarm_state_set "current_stage" "startup"

echo "Starting 24/7 autonomous 5-stage pipeline..."
echo "State file: $SWARM_STATE"
echo "Task root:  $TASKS_ROOT"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
LAST_TASK=""
RETRY_COUNT=0

purge_phantom_paths() {
    local ALLOWED_DIRS="^(backend|frontend|config|docs|e2e|scratch|scripts|specs|supabase|node_modules|original-hello-talk-screenshots|\.tasks)$"
    local FOUND=0
    while IFS= read -r entry; do
        [ -z "$entry" ] && continue
        case "$entry" in .*) continue ;; esac
        local phantom=0
        if [[ ! "$entry" =~ ^[A-Za-z0-9._-]+$ ]]; then
            phantom=1
        elif [ -d "$entry" ] && [[ ! "$entry" =~ $ALLOWED_DIRS ]]; then
            phantom=1
        fi
        if [ $phantom -eq 1 ]; then
            echo "PHANTOM PATH removed: $entry"
            git_locked rm -r -q --cached --ignore-unmatch -- "$entry" 2>/dev/null || true
            rm -rf -- "$entry"
            FOUND=1
        fi
    done < <(ls -1)
    [ $FOUND -eq 1 ] && echo "WARNING: model leaked prose into file paths this cycle."
    return 0
}

has_substantive_changes() {
    local changed
    changed=$(git status --porcelain -- . \
        ':(exclude)*.log' \
        ':(exclude)TODO.md' \
        ':(exclude)STUCK_LOG.md' \
        ':(exclude).aider*' \
        ':(exclude).tasks/*')
    [ -n "$changed" ]
}

# --- Main Loop ---
while true; do
    mkdir -p /tmp/ai_swarm_watchdog 2>/dev/null || true
    touch /tmp/ai_swarm_watchdog/heartbeat 2>/dev/null || true

    # ====================================================================
    # STAGE 1: TASK SELECTION
    # ====================================================================
    swarm_state_set "current_stage" "stage1_select"
    echo "========================================"
    echo "STAGE 1: PRE-MANAGEMENT (Planning)"
    echo "========================================"

    # Read from .tasks/ first; fall back to TODO.md grep if no .tasks/ exist.
    CURRENT_TASK=$(swarm_task_next)
    CURRENT_TASK_FILE=""

    if [ -n "$CURRENT_TASK" ]; then
        CURRENT_TASK_FILE=$(swarm_task_next_file)
        # Only move pending->active if this is a new task (not a retry already in active/)
        if [[ "$CURRENT_TASK_FILE" == *"/pending/"* ]]; then
            swarm_task_start
        fi
        echo "Task (from .tasks/): $CURRENT_TASK"
    else
        # Legacy fallback: read from TODO.md
        CURRENT_TASK=$(grep -m 1 "\[ \]" TODO.md | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')
        if [ -n "$CURRENT_TASK" ]; then
            echo "Task (from TODO.md): $CURRENT_TASK"
        fi
    fi

    if [ -z "$CURRENT_TASK" ]; then
        echo "No pending tasks."
        swarm_state_set "current_stage" "idle"
        sleep 60
        continue
    fi

    # Track retries
    if [ "$CURRENT_TASK" == "$LAST_TASK" ]; then
        RETRY_COUNT=$((RETRY_COUNT + 1))
    else
        LAST_TASK="$CURRENT_TASK"
        RETRY_COUNT=1
    fi

    swarm_state_set "current_task" "$CURRENT_TASK"
    swarm_state_set "attempt" "$RETRY_COUNT"

    # --- STUCK detection (preserving partial work) ---
    if [ $RETRY_COUNT -gt $SWARM_MAX_RETRIES ]; then
        echo "Task failed $SWARM_MAX_RETRIES times. Preserving work and marking STUCK..."
        swarm_state_set "current_stage" "stage1_stuck"

        purge_phantom_paths

        # Commit partial work BEFORE stashing so it's never lost.
        if [ -n "$(git status --porcelain)" ]; then
            git_locked add -A
            echo "wip: ${CURRENT_TASK} (before marking stuck)" > /tmp/swarm_commit_msg
            git_locked commit -F /tmp/swarm_commit_msg || true
            rm -f /tmp/swarm_commit_msg
            echo "Partial work committed as WIP before STUCK."
        fi

        # Move to .tasks/stuck/ if using .tasks/
        if [ -n "$CURRENT_TASK_FILE" ] && [ -f "$CURRENT_TASK_FILE" ]; then
            swarm_task_stuck
        else
            sed -i "0,/\[ \]/s/\[ \]/\[STUCK\]/" TODO.md
        fi

        echo "## [STUCK] $(date) - $CURRENT_TASK" >> STUCK_LOG.md
        git_locked add -A
        echo "stuck: ${CURRENT_TASK}" > /tmp/swarm_commit_msg
        git_locked commit -F /tmp/swarm_commit_msg || true
        rm -f /tmp/swarm_commit_msg
        git_locked push "$SWARM_GIT_REMOTE" "$CURRENT_BRANCH" || true

        COMPLETED_TASKS=$(( $(swarm_state_get "tasks_stuck") + 1 ))
        swarm_state_set "tasks_stuck" "$COMPLETED_TASKS"
        RETRY_COUNT=0
        continue
    fi

    # ====================================================================
    # STAGE 2: EXECUTOR (The Waterfall)
    # ====================================================================
    swarm_state_set "current_stage" "stage2_execute"
    echo "========================================"
    echo "STAGE 2: EXECUTOR (The Waterfall)"
    echo "========================================"
    echo "Executing: $CURRENT_TASK (attempt $RETRY_COUNT/$SWARM_MAX_RETRIES)"

    run_task_with_fallback "Execute task: '$CURRENT_TASK'. Write the code. Read SPEC.md for context." "--read SPEC.md"
    EXECUTOR_EXIT=$?

    # Exit 2 = no model callable at all. Infrastructure fault, don't count as retry.
    if [ $EXECUTOR_EXIT -eq 2 ]; then
        echo "Pausing $SWARM_MODEL_PAUSE seconds before re-checking model availability."
        RETRY_COUNT=$((RETRY_COUNT - 1))
        [ $RETRY_COUNT -lt 0 ] && RETRY_COUNT=0
        swarm_state_set "last_error" "No AI model callable"
        sleep "$SWARM_MODEL_PAUSE"
        continue
    fi

    # Any non-zero exit from executor = failure
    if [ $EXECUTOR_EXIT -ne 0 ]; then
        echo "Executor produced no work for this task. Skipping to next cycle."
        swarm_state_set "last_error" "Executor exit $EXECUTOR_EXIT"
        purge_phantom_paths
        sleep "$SWARM_COOLDOWN"
        continue
    fi

    # Verify actual file changes exist
    if ! has_substantive_changes; then
        echo "Executor returned success but no source files changed. Treating as failure."
        swarm_state_set "last_error" "No file changes produced"
        purge_phantom_paths
        sleep "$SWARM_COOLDOWN"
        continue
    fi

    # ====================================================================
    # STAGE 3: CLEAN UP (Lint & Test)
    # ====================================================================
    swarm_state_set "current_stage" "stage3_verify"
    echo "========================================"
    echo "STAGE 3: CLEAN UP (Lint & Test)"
    echo "========================================"
    > test_errors.log

    echo "Linting frontend..."
    (cd frontend && npm run lint) >> test_errors.log 2>&1
    LINT_FRONT=$?

    echo "Linting backend..."
    (cd backend && npm run lint) >> test_errors.log 2>&1
    LINT_BACK=$?

    echo "Testing backend..."
    (cd backend && npm test) >> test_errors.log 2>&1
    TEST_BACK=$?

    echo "Testing frontend..."
    (cd frontend && npm test) >> test_errors.log 2>&1
    TEST_FRONT=$?

    if [ $LINT_FRONT -ne 0 ] || [ $LINT_BACK -ne 0 ] || [ $TEST_BACK -ne 0 ] || [ $TEST_FRONT -ne 0 ]; then
        echo "Tests failed. Passing logs to AI for fixing..."
        swarm_state_set "last_error" "Lint/test failure"
        BROKEN_FILES=$(grep -oE "(frontend|backend)/[A-Za-z0-9_./-]+\.(ts|html|scss)" test_errors.log \
            | sort -u | head -n 25 | tr '\n' ' ')
        echo "Files in scope: $BROKEN_FILES"
        run_task_with_fallback "The automated lint and test suite failed. The full output is in test_errors.log. Fix the codebase so lint and tests pass. Do not invent new features, only fix the errors in that log. Files likely in scope: $BROKEN_FILES" "--read test_errors.log $BROKEN_FILES"
    else
        echo "All tests and linting passed!"
    fi

    # ====================================================================
    # STAGE 4: POST-MANAGEMENT (Verification & Task Completion)
    # ====================================================================
    swarm_state_set "current_stage" "stage4_post"
    echo "========================================"
    echo "STAGE 4: POST-MANAGEMENT (Verification)"
    echo "========================================"
    GIT_DIFF=$(git diff HEAD | head -n 200)

    if [ -z "$GIT_DIFF" ]; then
        echo "No changes detected."
        run_task_with_fallback "No changes were made for the task: '$CURRENT_TASK'. Investigate why and update the task queue if there is a blocker." "TODO.md"
    else
        echo "Changes detected. Marking task complete."

        # Mark as complete in .tasks/ or TODO.md
        if [ -n "$CURRENT_TASK_FILE" ] && [ -f "$TASKS_ROOT/active/"*.task 2>/dev/null ]; then
            swarm_task_done
            echo "Task moved to .tasks/completed/"
        else
            sed -i "0,/\[ \]/s/\[ \]/\[x\]/" TODO.md 2>/dev/null || true
        fi

        COMPLETED_TASKS=$(( $(swarm_state_get "tasks_completed") + 1 ))
        swarm_state_set "tasks_completed" "$COMPLETED_TASKS"
        LAST_TASK=""
        RETRY_COUNT=0
    fi

    # ====================================================================
    # STAGE 5: NEXT (Git Sync & Cooldown)
    # ====================================================================
    swarm_state_set "current_stage" "stage5_sync"
    echo "========================================"
    echo "STAGE 5: NEXT (Git Sync & Cooldown)"
    echo "========================================"
    purge_phantom_paths

    if has_substantive_changes; then
        git_locked add -A
        echo "feat: ${CURRENT_TASK}" > /tmp/swarm_commit_msg
        git_locked commit -F /tmp/swarm_commit_msg || true
        rm -f /tmp/swarm_commit_msg
        git_locked push "$SWARM_GIT_REMOTE" "$CURRENT_BRANCH" || true

        last_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        swarm_state_set "last_commit" "$last_sha"
        swarm_state_set "last_error" ""
    else
        echo "No source changes this cycle, only logs. Nothing to commit."
        git_locked checkout -- '*.log' 2>/dev/null || true
    fi

    echo "Cycle complete. Cooling down for ${SWARM_COOLDOWN} seconds..."
    swarm_state_set "current_stage" "cooldown"
    sleep "$SWARM_COOLDOWN"
done
