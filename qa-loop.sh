#!/bin/bash
# qa-loop.sh (Adversarial QA Agent)
set -a
source .env 2>/dev/null || true
set +a
export LITELLM_NUM_RETRIES=0

echo "Starting 24/7 Adversarial QA Swarm..."

while true; do
    echo "========================================"
    echo "QA STAGE: BREAK THE APP"
    echo "========================================"
    
    > qa_aider.log
    # Ask the AI to write a playwright script that actively tries to break the app
    aider --yes --no-show-model-warnings --model gemini/gemini-1.5-pro --message "Write a new aggressive Playwright E2E test in frontend/tests/adversarial/ that tries to break the UI or find a bug in the chat/video systems. Run it." 2>&1 | tee qa_aider.log
    
    # Run the tests
    (cd frontend && npx playwright test) >> qa_errors.log 2>&1
    TEST_EXIT=$?
    
    if [ $TEST_EXIT -ne 0 ]; then
        echo "BUG FOUND! Adding to TODO.md"
        # If the QA agent found a bug, append it to TODO.md for the main loop to fix
        BUG_REPORT=$(grep -E -A 5 "Error:|failed" qa_errors.log | head -n 1)
        aider --yes --no-show-model-warnings --model gemini/gemini-1.5-flash --message "The QA tests just failed with this error: $BUG_REPORT. Add a new task to the VERY TOP of TODO.md to fix this specific bug." TODO.md
        git commit -am "ci: qa agent discovered a bug and added it to TODO.md"
    else
        echo "App is robust. No bugs found this cycle."
        git reset --hard HEAD
    fi
    
    echo "Sleeping before next QA attack..."
    sleep 300
done
