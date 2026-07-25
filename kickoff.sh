#!/bin/bash
# kickoff.sh - Fully Automated Swarm Launcher

echo "🧹 Shutting down existing agents and terminals..."
# Kill existing tmux sessions if any
tmux kill-session -t ai_swarm 2>/dev/null || true

# Hard kill any stray background loops or aider processes
pkill -f "loop.sh" || true
pkill -f "qa-loop.sh" || true
pkill -f "aider" || true
pkill -f "playwright" || true

echo "🚀 Spawning new isolated terminals for the swarms..."

# Create a new tmux session detached, running the main loop.sh
tmux new-session -d -s ai_swarm -n "Main_Swarm" "bash -c './loop.sh; exec bash'"

# Create a second window in the same tmux session for the Adversarial QA agent
tmux new-window -t ai_swarm -n "QA_Swarm" "bash -c './qa-loop.sh; exec bash'"

# Create a third window for the Product Manager Agent
tmux new-window -t ai_swarm -n "PM_Swarm" "bash -c './pm-loop.sh; exec bash'"

echo "✅ All agents are now running autonomously in the background!"
echo "   -> The Main Swarm (Coder & Architect) is in Window 0"
echo "   -> The QA Swarm (Adversarial) is in Window 1"
echo "   -> The PM Swarm (GitHub Sync) is in Window 2"
echo ""
echo "👀 To view the active terminals in real-time, run:"
echo "   tmux attach -t ai_swarm"
echo ""
echo "🛑 To stop everything safely, run:"
echo "   tmux kill-session -t ai_swarm && pkill -f aider"
