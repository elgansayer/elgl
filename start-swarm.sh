#!/usr/bin/env bash
# start-swarm.sh - Start the python-based AI swarm supervisor
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Checking environment..."
if ! grep -q "DEEPSEEK_API_KEY=" .env 2>/dev/null && [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "Warning: DEEPSEEK_API_KEY not found in .env or environment! Swarm may fail to use DeepSeek."
fi

echo "Killing any existing swarm session..."
tmux kill-session -t ai_swarm 2>/dev/null || true
pkill -9 -f "swarmd.py" 2>/dev/null || true
sleep 1

echo "Starting swarmd.py in tmux session 'ai_swarm'..."
tmux new-session -d -s ai_swarm "python3 $SCRIPT_DIR/swarmd.py"

echo "========================================================"
echo " Swarm started successfully!"
echo "========================================================"
echo "Useful commands:"
echo "  tmux attach -t ai_swarm       # watch the swarm live (Ctrl+B, then D to detach)"
echo "  ./swarmd.py --tasks           # view task queue"
echo "  ./swarmd.py --status          # check current state"
echo "  tmux kill-session -t ai_swarm # stop the swarm"
echo "========================================================"
