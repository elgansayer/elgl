#!/bin/bash
# loop.sh (Dual-Model Architecture)

echo "Starting 24/7 dual-model autonomous coding loop..."

while grep -q "\[ \]" TODO.md; do
    echo "Found incomplete tasks. Launching Gemini Pro (Architect) + DeepSeek (Editor)..."
    
    # Gemini Pro plans, DeepSeek executes
    aider --yes \
      --architect \
      --model gemini/gemini-1.5-pro \
      --editor-model deepseek/deepseek-chat \
      --message "Read TODO.md. Identify the VERY FIRST incomplete task marked with [ ]. Implement the required code for that task only. Ensure you create any necessary files. Finally, edit TODO.md to change that specific [ ] to an [x]. Do not start the next task."
    
    echo "Task attempt complete. Cooling down for 10 seconds..."
    sleep 10
done

echo "Mission accomplished. All tasks in TODO.md are complete."