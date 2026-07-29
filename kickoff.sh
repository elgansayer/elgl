#!/bin/bash
# kickoff.sh - Fully Automated Swarm Launcher
set -a
source .env 2>/dev/null || true
set +a

echo "🧹 Shutting down existing agents and terminals..."

# Kill existing tmux sessions if any
tmux kill-session -t ai_swarm 2>/dev/null || true
sleep 2

# Hard kill any stray background loops, aider, or playwright processes
pkill -9 -f "loop.sh" 2>/dev/null || true
pkill -9 -f "qa-loop.sh" 2>/dev/null || true
pkill -9 -f "pm-loop.sh" 2>/dev/null || true
pkill -9 -f "aider" 2>/dev/null || true
pkill -9 -f "playwright" 2>/dev/null || true
sleep 1

# Pre-install Playwright browsers to prevent Aider/e2e from triggering installs.
# Node.js Playwright (for e2e tests):
echo "📦 Ensuring Playwright browsers are installed (Node.js)..."
(cd e2e && npx playwright install --with-deps chromium 2>&1) || true

# Python Playwright (shipped inside Aider):
echo "📦 Ensuring Playwright browsers are installed (Python/Aider)..."
if command -v aider &> /dev/null; then
    AIDER_PLAYWRIGHT=$(python3 -c "import playwright; print(playwright.__file__)" 2>/dev/null || true)
    if [ -n "$AIDER_PLAYWRIGHT" ]; then
        python3 -m playwright install chromium 2>&1 || true
    fi
fi

# Set up sudo password for non-interactive use.
# Store the password in ~/.swarm_sudo (600 permissions) or read SWARM_SUDO_PW from .env.
SUDO_PW_FILE="${HOME}/.swarm_sudo"
SWARM_SUDO_PW="${SWARM_SUDO_PW:-}"
if [ -n "$SWARM_SUDO_PW" ]; then
    echo "$SWARM_SUDO_PW" > "$SUDO_PW_FILE"
    chmod 600 "$SUDO_PW_FILE"
elif [ -f "$SUDO_PW_FILE" ]; then
    chmod 600 "$SUDO_PW_FILE"
fi

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
echo "📊 Watchdog (check for stalls):"
echo "   ./scripts/watchdog.sh"
echo "   (add to cron: */5 * * * * cd $(pwd) && ./scripts/watchdog.sh)"
echo ""
echo "🔑 Sudo password (optional, prevents apt-install hangs):"
echo "   Store in ~/.swarm_sudo (chmod 600) or set SWARM_SUDO_PW in .env"
echo ""
echo "🛑 To stop everything safely, run:"
echo "   tmux kill-session -t ai_swarm && pkill -f aider"
