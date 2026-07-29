#!/bin/bash
# watchdog.sh - monitors the swarm for stalls and sends alerts.
#
# Call from cron every N minutes. It checks:
# 1. Is the tmux session alive?
# 2. Is the main loop making progress (recent commits)?
# 3. Is any process hung (no output change in the main pane)?
# 4. Are we stuck on a sudo prompt?
#
# If stalled, it logs to STUCK_LOG.md and can optionally send a webhook.

set -a
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
source "$SCRIPT_DIR/../.env" 2>/dev/null || true
set +a

STALL_MINUTES="${WATCHDOG_STALL_MINUTES:-15}"
NOTIFY_URL="${WATCHDOG_NOTIFY_URL:-}"
CACHE_DIR="/tmp/ai_swarm_watchdog"
mkdir -p "$CACHE_DIR"
PANE_CACHE="$CACHE_DIR/main_pane.txt"
TIMESTAMP_CACHE="$CACHE_DIR/last_progress"
CONSECUTIVE_STALLS="$CACHE_DIR/consecutive_stalls"

log_stall() {
    local reason="$1"
    echo "## [STALL] $(date -u) - $reason" >> STUCK_LOG.md
    echo "[WATCHDOG] $reason"

    if [ -n "$NOTIFY_URL" ]; then
        curl -sf -X POST "$NOTIFY_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"⚠️ AI Swarm stalled: $reason at $(date -u)\"}" \
            2>/dev/null || true
    fi
}

# --- Check 1: is tmux session alive? ---
if ! tmux has-session -t ai_swarm 2>/dev/null; then
    log_stall "tmux session ai_swarm is dead"
    exit 1
fi

# --- Check 2: recent git commits? ---
LAST_COMMIT_TS=$(git log -1 --format="%ct" 2>/dev/null || echo 0)
NOW_TS=$(date +%s)
STALL_SECONDS=$((STALL_MINUTES * 60))
if [ $((NOW_TS - LAST_COMMIT_TS)) -gt $STALL_SECONDS ]; then
    log_stall "No git commit in over ${STALL_MINUTES} minutes (last: $(git log -1 --format='%ai %s' 2>/dev/null || echo 'never'))"
fi

# --- Check 3: is main pane hung (content not changing)? ---
CURRENT_PANE=$(tmux capture-pane -t ai_swarm:Main_Swarm -p 2>/dev/null || echo "")
if [ -f "$PANE_CACHE" ]; then
    if [ "$CURRENT_PANE" = "$(cat "$PANE_CACHE")" ]; then
        # pane content unchanged since last check
        STALLS=$(cat "$CONSECUTIVE_STALLS" 2>/dev/null || echo 0)
        STALLS=$((STALLS + 1))
        echo "$STALLS" > "$CONSECUTIVE_STALLS"
        if [ "$STALLS" -ge 3 ]; then
            log_stall "Main swarm pane unchanged for 3+ watchdog cycles — likely hung"
        fi
    else
        echo 0 > "$CONSECUTIVE_STALLS"
    fi
fi
echo "$CURRENT_PANE" > "$PANE_CACHE"

# --- Check 4: sudo password prompt visible? ---
if echo "$CURRENT_PANE" | grep -q "\[sudo\] password"; then
    log_stall "Sudo password prompt visible in main swarm pane — pipeline blocked"
fi

# --- Check 5: Timestamp touch file ---
# The loop.sh should touch "$CACHE_DIR/heartbeat" each cycle.
# If the heartbeat is stale, report.
HEARTBEAT="$CACHE_DIR/heartbeat"
if [ -f "$HEARTBEAT" ]; then
    HEARTBEAT_AGE=$((NOW_TS - $(stat -c %Y "$HEARTBEAT")))
    if [ $HEARTBEAT_AGE -gt $STALL_SECONDS ]; then
        log_stall "Heartbeat file stale (${HEARTBEAT_AGE}s old) — main loop not cycling"
    fi
else
    # First run, create initial heartbeat
    touch "$HEARTBEAT"
fi

# --- Check 6: disk space ---
DISK_PCT=$(df -h . | awk 'NR==2 {gsub(/%/,""); print $5}')
if [ "${DISK_PCT:-100}" -ge 90 ]; then
    log_stall "Disk at ${DISK_PCT}% — write failures imminent"
fi

echo "[WATCHDOG] Check complete at $(date -u)"
