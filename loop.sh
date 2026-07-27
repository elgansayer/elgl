#!/bin/bash
# loop.sh (5-Stage Waterfall Architecture with Global Rate Limit Watcher & Bash Context)

# Load credentials. Without this the whole waterfall fails on auth and the pipeline
# happily commits the resulting log churn as if it were progress.
set -a
source .env 2>/dev/null || true
set +a

export OPENAI_MAX_RETRIES=0
export LITELLM_NUM_RETRIES=0
export AIDER_RETRIES=0

# shellcheck source=scripts/preflight-models.sh
source "$(dirname "$0")/scripts/preflight-models.sh"
# shellcheck source=scripts/claude-pro.sh
source "$(dirname "$0")/scripts/claude-pro.sh"
# shellcheck source=scripts/fallback-chain.sh
source "$(dirname "$0")/scripts/fallback-chain.sh"

echo "Starting 24/7 autonomous 5-stage pipeline with global fallbacks..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
LAST_TASK=""
RETRY_COUNT=0
MAX_RETRIES=3

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

# Returns 0 if anything outside the pipeline's own bookkeeping files changed. The loop
# used to commit unconditionally, so a cycle where every model was dead still produced a
# "ci: automated pipeline cycle complete" commit containing nothing but log churn.
has_substantive_changes() {
    local changed
    changed=$(git status --porcelain -- . \
        ':(exclude)*.log' \
        ':(exclude)TODO.md' \
        ':(exclude)STUCK_LOG.md' \
        ':(exclude).aider*')
    [ -n "$changed" ]
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
        # Park the incomplete attempt on a stash instead of destroying it with
        # "reset --hard". Three failed retries used to bin every edit the models made.
        purge_phantom_paths
        if [ -n "$(git status --porcelain)" ]; then
            git stash push -u -m "stuck: $CURRENT_TASK" && \
                echo "Incomplete work parked in stash, recover with: git stash list"
        fi
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
    run_task_with_fallback "Execute task: '$CURRENT_TASK'. Write the code. Read SPEC.md for context." "--read SPEC.md"
    EXECUTOR_EXIT=$?

    # Exit 2 means no model was callable at all. That is an infrastructure fault, and
    # burning three retries on it would mark a perfectly good task [STUCK] for reasons
    # that have nothing to do with the task. Back off and retry without penalty.
    if [ $EXECUTOR_EXIT -eq 2 ]; then
        echo "Pausing 5 minutes before re-checking model availability."
        RETRY_COUNT=$((RETRY_COUNT - 1))
        sleep 300
        continue
    fi

    # Every callable model failed on this task. Do not lint, do not test, and above all
    # do not commit: there is nothing to commit but logs.
    if [ $EXECUTOR_EXIT -ne 0 ]; then
        echo "Executor produced no work for this task. Skipping to the next cycle."
        purge_phantom_paths
        sleep 15
        continue
    fi

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
        # Give Aider the whole log as a read-only file rather than a truncated tail, and
        # add the offending source files to the chat so it can actually edit them.
        BROKEN_FILES=$(grep -oE "(frontend|backend)/[A-Za-z0-9_./-]+\.(ts|html|scss)" test_errors.log \
            | sort -u | head -n 25 | tr '\n' ' ')
        echo "Files in scope: $BROKEN_FILES"
        run_task_with_fallback "The automated lint and test suite failed. The full output is in test_errors.log. Fix the codebase so lint and tests pass. Do not invent new features, only fix the errors in that log. Files likely in scope: $BROKEN_FILES" "--read test_errors.log $BROKEN_FILES"
    else
        echo "All tests and linting passed!"
    fi

    echo "========================================"
    echo "STAGE 4: POST-MANAGEMENT (Verification)"
    echo "========================================"
    # Grab the first 200 lines of the diff to avoid token overflow
    GIT_DIFF=$(git diff HEAD | head -n 200)
    
    if [ -z "$GIT_DIFF" ]; then
        echo "No changes detected."
        run_task_with_fallback "No changes were made for the task: '$CURRENT_TASK'. Investigate why and update TODO.md if there is a blocker." "TODO.md"
    else
        echo "Changes detected. Passing diff to AI for TODO.md updates."
        run_task_with_fallback "Review this git diff for task '$CURRENT_TASK': $GIT_DIFF. If the task is fully complete, change [ ] to [x] in TODO.md. If incomplete, add a new [ ] task below it." "TODO.md"
    fi

    echo "========================================"
    echo "STAGE 5: NEXT (Git Sync & Cooldown)"
    echo "========================================"
    # "commit -am" only stages tracked files, so brand new components were silently
    # left untracked and never pushed. Stage additions too.
    purge_phantom_paths

    # Only claim a completed cycle when source actually moved. Committing log churn made
    # 40+ consecutive cycles look productive while no code was written at all.
    if has_substantive_changes; then
        git add -A
        git commit -m "ci: automated pipeline cycle complete" || true
        git push origin "$CURRENT_BRANCH" || true
    else
        echo "No source changes this cycle, only logs. Nothing to commit."
        git checkout -- '*.log' 2>/dev/null || true
    fi
    
    echo "Cycle complete. Cooling down for 15 seconds..."
    sleep 15
done
