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

QA_MODEL="${QA_MODEL:-gemini/gemini-3.1-pro-preview}"
QA_TRIAGE_MODEL="${QA_TRIAGE_MODEL:-gemini/gemini-3.5-flash}"

echo "Starting 24/7 Adversarial QA Swarm..."

while true; do
    echo "========================================"
    echo "QA STAGE: BREAK THE APP"
    echo "========================================"
    
    > qa_aider.log
    > qa_errors.log
    QA_TASK="Write a new aggressive Playwright E2E test in e2e/tests/adversarial/ that tries to break the UI or find a bug in the chat/video systems. Run it."

    # Claude Pro (Claude Code CLI, subscription) is tried first: free beyond the flat
    # subscription fee, so it costs nothing to attempt before falling back to Aider.
    run_claude_code "$QA_TASK"
    if [ $? -ne 0 ]; then
        # Ask the AI to write a playwright script that actively tries to break the app.
        # gemini-1.5-pro/flash were retired and returned 404 NOT_FOUND on every cycle, so the
        # QA agent never wrote a single test. Preflight the model before spending a cycle.
        # Only a definitive "dead" (exit 1) skips the cycle; an unverifiable model (exit 3,
        # catalogue unreachable) still gets a go so a network blip does not idle the swarm.
        model_is_callable "$QA_MODEL"
        if [ $? -eq 1 ]; then
            echo "QA model $QA_MODEL is not callable. Skipping cycle."
            sleep 300
            continue
        fi
        aider --yes --no-show-model-warnings --model "$QA_MODEL" --message "$QA_TASK" 2>&1 | tee qa_aider.log
    fi
    
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
        run_claude_code "$TRIAGE_TASK"
        if [ $? -ne 0 ]; then
            aider --yes --no-show-model-warnings --model "$QA_TRIAGE_MODEL" --message "$TRIAGE_TASK" TODO.md
        fi
        git commit -am "ci: qa agent discovered a bug and added it to TODO.md"
    else
        echo "App is robust. No bugs found this cycle."
        git reset --hard HEAD
    fi
    
    echo "Sleeping before next QA attack..."
    sleep 300
done
