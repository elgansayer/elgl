#!/bin/bash
# loop.sh (Two-Node Self-Healing Architecture with Quota Fallback)

echo "Starting 24/7 continuous build & maintenance loop..."

# We use an infinite loop so the agent never stops evaluating and improving
while true; do
    echo "========================================"
    echo "NODE 1: THE PROJECT MANAGER"
    echo "========================================"
    
    # We use Gemini here because it needs massive context to read the whole repo
    aider --yes \
      --model gemini/gemini-2.5-pro \
      --message "You are the Project Manager. Execute these three directives: 1. Inspect the codebase. If any uncompleted tasks in TODO.md actually exist in the code already, mark them [x]. 2. Audit the Angular UI and NestJS backend against the standards in SPEC.md and modern social media apps (X, HelloTalk). 3. If you find missing features, poor UI layouts, missing animations, or architectural gaps, append them as specific, granular new [ ] tasks to the bottom of TODO.md. Keep the focus 100% on language learning. We do not need stories. Keep the project moving forward."
    
    MANAGER_EXIT=$?

    # Fallback if Gemini hits quota or fails
    if [ $MANAGER_EXIT -ne 0 ]; then
        echo "⚠️ Gemini Project Manager failed (Quota/Error). Falling back to DeepSeek..."
        aider --yes \
          --model deepseek/deepseek-chat \
          --message "You are the Project Manager. Execute these three directives: 1. Inspect the codebase. If any uncompleted tasks in TODO.md actually exist in the code already, mark them [x]. 2. Audit the Angular UI and NestJS backend against the standards in SPEC.md and modern social media apps (X, HelloTalk). 3. If you find missing features, poor UI layouts, missing animations, or architectural gaps, append them as specific, granular new [ ] tasks to the bottom of TODO.md. Keep the focus 100% on language learning. We do not need stories. Keep the project moving forward."
    fi
    
    echo "Iteration complete. Cooling down for 15 seconds to avoid API rate limits..."
    sleep 15

    echo "========================================"
    echo "NODE 2: THE EXECUTOR"
    echo "========================================"
    
    # Attempt with Gemini Architect + DeepSeek Editor
    aider --yes \
      --architect \
      --model gemini/gemini-3.1-pro-preview \
      --editor-model deepseek/deepseek-chat \
      --read SPEC.md \
      --read AGENTS.md \
      --message "Read TODO.md. Identify the VERY FIRST incomplete task marked with [ ]. First, inspect the actual codebase to see if this task is already partially or fully completed (e.g., if it says to install Angular, check if package.json exists). If it is already done, simply edit TODO.md to mark it [x] and stop. If it is NOT done, write the required code, verify it compiles, and then mark it [x] in TODO.md."
    
    EXECUTOR_EXIT=$?

    # Fallback to pure DeepSeek if Gemini Architect hits quota
    if [ $EXECUTOR_EXIT -ne 0 ]; then
        echo "⚠️ Gemini Architect failed (Quota/Error). Falling back to pure DeepSeek..."
        aider --yes \
          --architect \
          --model deepseek/deepseek-chat \
          --editor-model deepseek/deepseek-chat \
          --read SPEC.md \
          --read AGENTS.md \
          --message "Read TODO.md. Identify the VERY FIRST incomplete task marked with [ ]. First, inspect the actual codebase to see if this task is already partially or fully completed (e.g., if it says to install Angular, check if package.json exists). If it is already done, simply edit TODO.md to mark it [x] and stop. If it is NOT done, write the required code, verify it compiles, and then mark it [x] in TODO.md."
    fi
    
    echo "Node 2 complete. Loop restarting..."
done