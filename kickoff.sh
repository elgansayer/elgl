#!/bin/bash
# kickoff.sh - Fully Automated Swarm Launcher (self-bootstrapping).
#
# Safe to run on any fresh VPS. It will:
#   - Create required directories and cache files
#   - Install the watchdog cron job if missing
#   - Ensure the sudo askpass helper exists
#   - Pre-install Playwright browsers to prevent pipeline hangs
#   - Kill stale processes, then spawn the 3-agent swarm in tmux

set -a
source .env 2>/dev/null || true
set +a

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$SCRIPT_DIR"

echo "🧹 Shutting down existing agents and terminals..."

# --- Bootstrap: create directories and cache files ---
mkdir -p /tmp/ai_swarm_watchdog
touch /tmp/ai_swarm_watchdog/heartbeat

# --- Bootstrap: sudo askpass helper ---
if [ ! -x "$REPO_DIR/scripts/sudo-askpass.sh" ]; then
    mkdir -p "$REPO_DIR/scripts"
    cat > "$REPO_DIR/scripts/sudo-askpass.sh" << 'ASKPASS_EOF'
#!/bin/bash
PW_FILE="${HOME}/.swarm_sudo"
if [ -f "$PW_FILE" ]; then
    cat "$PW_FILE"
else
    exit 1
fi
ASKPASS_EOF
    chmod +x "$REPO_DIR/scripts/sudo-askpass.sh"
fi
export SUDO_ASKPASS="$REPO_DIR/scripts/sudo-askpass.sh"

# --- Bootstrap: watchdog cron ---
WATCHDOG_CRON="*/5 * * * * cd $REPO_DIR && ./scripts/watchdog.sh >> /tmp/watchdog.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "watchdog.sh"; then
    echo "📊 Installing watchdog cron job..."
    (crontab -l 2>/dev/null; echo "$WATCHDOG_CRON") | crontab -
fi

# --- Bootstrap: sudo password file ---
SUDO_PW_FILE="${HOME}/.swarm_sudo"
SWARM_SUDO_PW="${SWARM_SUDO_PW:-}"
if [ -n "$SWARM_SUDO_PW" ] && [ ! -f "$SUDO_PW_FILE" ]; then
    echo "$SWARM_SUDO_PW" > "$SUDO_PW_FILE"
    chmod 600 "$SUDO_PW_FILE"
fi
[ -f "$SUDO_PW_FILE" ] && chmod 600 "$SUDO_PW_FILE"

# --- Kill stale sessions & processes ---
tmux kill-session -t ai_swarm 2>/dev/null || true
sleep 2

pkill -9 -f "loop.sh" 2>/dev/null || true
pkill -9 -f "qa-loop.sh" 2>/dev/null || true
pkill -9 -f "pm-loop.sh" 2>/dev/null || true
pkill -9 -f "aider" 2>/dev/null || true
pkill -9 -f "playwright" 2>/dev/null || true
sleep 1

# --- Pre-install Playwright browsers (prevents pipeline hangs) ---
echo "📦 Ensuring Playwright browsers are installed (Node.js)..."
(cd "$REPO_DIR/e2e" && npx playwright install chromium 2>&1) || \
    echo "   Playwright install skipped (browser may already exist)"

echo "📦 Ensuring Playwright browsers are installed (Python/Aider)..."
if command -v aider &> /dev/null; then
    python3 -c "import playwright" 2>/dev/null && \
        python3 -m playwright install chromium 2>&1 || true
fi

echo "🚀 Spawning new isolated terminals for the swarms..."

# Watchdog cache stale-check tracking
echo "0" > /tmp/ai_swarm_watchdog/consecutive_stalls 2>/dev/null || true

# Main Swarm: executor, lint/test, commit
tmux new-session -d -s ai_swarm -n "Main_Swarm" \
    "cd $REPO_DIR && bash -c './loop.sh; exec bash'"

# QA Swarm: adversarial E2E testing
tmux new-window -t ai_swarm -n "QA_Swarm" \
    "cd $REPO_DIR && bash -c './qa-loop.sh; exec bash'"

# PM Swarm: GitHub issue sync
tmux new-window -t ai_swarm -n "PM_Swarm" \
    "cd $REPO_DIR && bash -c './pm-loop.sh; exec bash'"

echo ""
echo "✅ All agents are now running autonomously in the background!"
echo "   -> Window 0: Main_Swarm  (executor → lint/test → commit)"
echo "   -> Window 1: QA_Swarm    (adversarial E2E → bug triage)"
echo "   -> Window 2: PM_Swarm    (GitHub issue sync)"
echo ""
echo "👀 View:     tmux attach -t ai_swarm"
echo "📊 Watchdog: ./scripts/watchdog.sh  (cron: */5 min)"
echo "🛑 Stop:     tmux kill-session -t ai_swarm && pkill -f aider"
