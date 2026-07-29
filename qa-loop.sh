#!/bin/bash
# qa-loop.sh (Adversarial QA Agent)
export PATH="$HOME/.local/bin:$PATH"
set -a
source .env 2>/dev/null || true
set +a
export LITELLM_NUM_RETRIES=0

# shellcheck source=scripts/preflight-models.sh
source "$(dirname "$0")/scripts/preflight-models.sh"
# shellcheck source=scripts/claude-pro.sh
source "$(dirname "$0")/scripts/claude-pro.sh"
# shellcheck source=scripts/fallback-chain.sh
source "$(dirname "$0")/scripts/fallback-chain.sh"

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
            git_locked rm -r -q --cached --ignore-unmatch -- "$entry" 2>/dev/null || true
            rm -rf -- "$entry"
            FOUND=1
        fi
    done < <(ls -1)
    [ $FOUND -eq 1 ] && echo "WARNING: model leaked prose into file paths this cycle."
    return 0
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
    local BACKEND_UP=1
    curl -sf --connect-timeout 5 http://localhost:3000/api/health 2>/dev/null && BACKEND_UP=0 || true
    if [ $BACKEND_UP -ne 0 ]; then
        echo "Backend not reachable on localhost:3000 — skipping E2E Playwright run (no server to test against)." >> qa_errors.log
        echo "Backend not reachable — skipping E2E tests this cycle."
        sleep 300
        continue
    fi
    (cd e2e && timeout --foreground -s KILL 600 npx playwright test) >> qa_errors.log 2>&1
    TEST_EXIT=$?
    
    if [ $TEST_EXIT -ne 0 ]; then
        echo "BUG FOUND! Adding to TODO.md"
        # If the QA agent found a bug, append it to TODO.md for the main loop to fix
        BUG_REPORT=$(grep -E -A 5 "Error:|failed" qa_errors.log | head -n 1)
        TRIAGE_TASK="The QA tests just failed with this error: $BUG_REPORT. Add a new task to the VERY TOP of TODO.md to fix this specific bug."
        run_task_with_fallback "$TRIAGE_TASK" "TODO.md"
        if ! git diff --quiet HEAD; then
            git_locked commit -am "ci: qa agent discovered a bug and added it to TODO.md"
        else
            echo "Triage produced no changes. Skipping commit."
        fi
    else
        echo "App is robust. No bugs found this cycle."
        # Scoped to e2e/, where the QA task's own throwaway test file lives. A bare
        # "git reset --hard HEAD" resets the WHOLE working tree, so it was also
        # destroying any uncommitted work from the concurrently running main loop
        # (or anyone else editing the repo) every time this branch ran, roughly every
        # 5 minutes.
        git_locked checkout -- e2e/ 2>/dev/null || true
        git_locked clean -fd -- e2e/tests/adversarial/ 2>/dev/null || true
    fi
    
    echo "Sleeping before next QA attack..."
    sleep 300
done
