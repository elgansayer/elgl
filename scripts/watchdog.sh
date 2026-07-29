#!/bin/bash
# watchdog.sh - Autonomous swarm monitor with auto-recovery and Telegram alerts.
#
# Called from cron/systemd every 5 minutes. Detects stalls, diagnoses root
# cause, sends Telegram alerts, and performs graduated auto-recovery.
#
# Reads /tmp/ai_swarm_state.json for structured swarm status instead of
# fragile tmux pane text comparison.

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
export SWARM_ROOT="$(dirname "$SCRIPT_DIR")"
source "$SWARM_ROOT/scripts/swarm-env.sh"

# --- Config ------------------------------------------------------------
STALL_MINUTES="${WATCHDOG_STALL_MINUTES:-15}"
STALL_SECONDS=$((STALL_MINUTES * 60))
ALERT_COOLDOWN="${WATCHDOG_ALERT_COOLDOWN:-600}"
RECOVERY_COOLDOWN="${WATCHDOG_RECOVERY_COOLDOWN:-900}"

TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
DEEPSEEK_KEY="${DEEPSEEK_API_KEY:-}"
SWARM_PW="${SWARM_SUDO_PW:-}"
REPO_DIR="$SWARM_ROOT"
STATE_FILE="${SWARM_STATE_FILE:-/tmp/ai_swarm_state.json}"

CACHE_DIR="$HOME/.cache/ai_swarm_watchdog"
mkdir -p "$CACHE_DIR"

CONSECUTIVE_STALLS="$CACHE_DIR/consecutive_stalls"
NO_COMMIT_COUNT="$CACHE_DIR/no_commit_count"
STALE_HEARTBEAT="$CACHE_DIR/stale_heartbeat_count"
PANE_LINE_CACHE="$CACHE_DIR/main_pane_lines"
RESTART_STAMP="$CACHE_DIR/swarm_restarted"

HEARTBEAT="/tmp/ai_swarm_watchdog/heartbeat"
NOW_TS=$(date +%s)

# --- Helpers -----------------------------------------------------------

send_telegram() {
    local text="$1"
    if [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT_ID" ]; then
        return 1
    fi
    curl -sf -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "$(jq -nc --arg chat_id "$TG_CHAT_ID" --arg text "$text" --arg parse_mode "HTML" \
            '{chat_id: $chat_id, text: $text, parse_mode: $parse_mode}')" \
        2>/dev/null || true
}

alert() {
    local stall_type="$1" title="$2" body="$3"
    local stamp_file="$CACHE_DIR/alert_${stall_type}"
    local last_ts=0
    [ -f "$stamp_file" ] && last_ts=$(cat "$stamp_file" 2>/dev/null || echo 0)
    if [ $((NOW_TS - last_ts)) -lt $ALERT_COOLDOWN ]; then
        return 0
    fi
    echo "$NOW_TS" > "$stamp_file"
    local tg_body
    tg_body=$(printf "<b>%s</b>\n\n%s" "$title" "$body")
    send_telegram "$tg_body"
}

can_recover() {
    local last_recovery="$CACHE_DIR/last_recovery"
    if [ -f "$last_recovery" ]; then
        local last
        last=$(cat "$last_recovery" 2>/dev/null || echo 0)
        [ $((NOW_TS - last)) -lt $RECOVERY_COOLDOWN ] && return 1
    fi
    echo "$NOW_TS" > "$last_recovery"
    return 0
}

local_log() {
    local msg="$1"
    echo "## [$(date -u +'%H:%M:%S')] $msg" >> "$REPO_DIR/STUCK_LOG.md"
    echo "[WATCHDOG] $msg"
}

# Read structured state from the swarm.
swarm_state_field() {
    local field="$1"
    [ -f "$STATE_FILE" ] || { echo ""; return; }
    jq -r ".$field // empty" "$STATE_FILE" 2>/dev/null || echo ""
}

# --- Recovery actions --------------------------------------------------

recover_sudo() {
    local window="$1"
    if [ -z "$SWARM_PW" ]; then
        local_log "Cannot answer sudo prompt: SWARM_SUDO_PW not set"
        return 1
    fi
    can_recover || return 1
    send_telegram "🔧 <b>Auto-Recovery: Answering sudo prompt</b>\nSending stored sudo password."
    tmux send-keys -t "ai_swarm:$window" "$SWARM_PW" Enter
    sleep 2
    return 0
}

recover_hung_pane() {
    local window="$1" script="$2"
    can_recover || return 1
    send_telegram "🔧 <b>Auto-Recovery: Restarting hung pane</b>\nRestarting <code>$script</code> in <code>$window</code>."
    tmux send-keys -t "ai_swarm:$window" C-c
    sleep 3
    tmux send-keys -t "ai_swarm:$window" "cd $REPO_DIR && bash -c './$script; exec bash'" Enter
    return 0
}

recover_full_restart() {
    can_recover || return 1
    send_telegram "🔧 <b>Auto-Recovery: Full swarm restart</b>\nRunning <code>kickoff.sh</code>."
    tmux kill-session -t ai_swarm 2>/dev/null || true
    sleep 3
    pkill -9 -f "loop.sh" 2>/dev/null || true
    pkill -9 -f "qa-loop.sh" 2>/dev/null || true
    pkill -9 -f "pm-loop.sh" 2>/dev/null || true
    pkill -9 -f "aider" 2>/dev/null || true
    pkill -9 -f "claude" 2>/dev/null || true
    sleep 2
    cd "$REPO_DIR" && bash "$REPO_DIR/kickoff.sh" >> /tmp/kickoff_recovery.log 2>&1 &
    sleep 5
    return 0
}

# --- Checks ------------------------------------------------------------

# Get swarm status summary from state file.
get_swarm_summary() {
    if [ ! -f "$STATE_FILE" ]; then
        echo "(no state file)"
        return
    fi
    local task stage tool attempt completed stuck
    task=$(swarm_state_field "current_task")
    stage=$(swarm_state_field "current_stage")
    tool=$(swarm_state_field "current_tool")
    attempt=$(swarm_state_field "attempt")
    completed=$(swarm_state_field "tasks_completed")
    stuck=$(swarm_state_field "tasks_stuck")
    echo "stage=$stage task='$task' tool=$tool attempt=$attempt completed=$completed stuck=$stuck"
}

# Check if tmux session is alive.
SESSION_DEAD=false
tmux has-session -t ai_swarm 2>/dev/null || SESSION_DEAD=true

# --- CHECK 1: tmux session alive? -------------------------------------
if $SESSION_DEAD; then
    local_log "tmux session ai_swarm is dead"
    alert "session_dead" \
        "SWARM DOWN - tmux session dead" \
        "The <code>ai_swarm</code> tmux session is not running.\n\nAttempting automatic restart via <code>kickoff.sh</code>..."
    recover_full_restart
    exit 0
fi

# --- CHECK 2: Recent git commits? --------------------------------------
LAST_COMMIT_TS=$(cd "$REPO_DIR" && git log -1 --format="%ct" 2>/dev/null || echo 0)
if [ $((NOW_TS - LAST_COMMIT_TS)) -gt $STALL_SECONDS ]; then
    restart_ts=0
    [ -f "$RESTART_STAMP" ] && restart_ts=$(cat "$RESTART_STAMP" 2>/dev/null || echo 0)
    if [ $((NOW_TS - restart_ts)) -lt $STALL_SECONDS ]; then
        echo "[WATCHDOG] Swarm restarted $(((NOW_TS - restart_ts) / 60)) min ago - skipping commit stall check"
    else
        LAST_COMMIT_INFO=$(cd "$REPO_DIR" && git log -1 --format='%ai %s' 2>/dev/null || echo 'never')
        summary=$(get_swarm_summary)
        local_log "No git commit in over ${STALL_MINUTES} min (last: $LAST_COMMIT_INFO). State: $summary"

        BODY="Last commit: ${LAST_COMMIT_INFO}\nStalled: $(( (NOW_TS - LAST_COMMIT_TS) / 60 )) mins\nSwarm state: ${summary}"
        alert "no_commits" "SWARM STALLED - No commits" "$BODY"

        ncc=$(cat "$NO_COMMIT_COUNT" 2>/dev/null || echo 0)
        ncc=$((ncc + 1))
        echo "$ncc" > "$NO_COMMIT_COUNT"
        if [ "$ncc" -ge 6 ]; then
            local_log "No commits for $((ncc * 5)) mins. Triggering full restart."
            recover_full_restart
            echo 0 > "$NO_COMMIT_COUNT"
        fi
    fi
else
    echo 0 > "$NO_COMMIT_COUNT"
fi

# --- CHECK 3: Main pane hung? (uses line count, not string equality) ---
MAIN_PANE_LINES=$(tmux capture-pane -t ai_swarm:Main_Swarm -p 2>/dev/null | wc -l)
if [ -f "$PANE_LINE_CACHE" ] && [ -n "$MAIN_PANE_LINES" ]; then
    prev_lines=$(cat "$PANE_LINE_CACHE" 2>/dev/null || echo 0)
    if [ "$MAIN_PANE_LINES" -eq "$prev_lines" ] && [ "$prev_lines" -gt 0 ]; then
        stalls=$(cat "$CONSECUTIVE_STALLS" 2>/dev/null || echo 0)
        stalls=$((stalls + 1))
        echo "$stalls" > "$CONSECUTIVE_STALLS"
        if [ "$stalls" -ge 4 ]; then
            summary=$(get_swarm_summary)
            local_log "Main pane line count unchanged for 4+ cycles. State: $summary"
            alert "pane_hung" \
                "Main pane appears hung" \
                "Line count unchanged for ${stalls} cycles ($((stalls * 5)) mins).\nState: ${summary}\n\nAttempting pane restart..."
            recover_hung_pane "Main_Swarm" "loop.sh"
            echo 0 > "$CONSECUTIVE_STALLS"
        fi
    else
        echo 0 > "$CONSECUTIVE_STALLS"
    fi
fi
echo "$MAIN_PANE_LINES" > "$PANE_LINE_CACHE"

# --- CHECK 4: Sudo password prompt? -----------------------------------
for window in Main_Swarm PM_Swarm; do
    pane_content=$(tmux capture-pane -t "ai_swarm:$window" -p 2>/dev/null || echo "")
    if echo "$pane_content" | grep -q "\[sudo\] password"; then
        local_log "Sudo password prompt visible in $window pane"
        alert "sudo_prompt" \
            "Sudo prompt blocking pipeline" \
            "A <code>[sudo] password</code> prompt is visible in <code>$window</code>.\n\nAttempting auto-answer..."
        recover_sudo "$window"
    fi
done

# --- CHECK 5: Heartbeat stale? -----------------------------------------
if [ -f "$HEARTBEAT" ]; then
    HEARTBEAT_AGE=$((NOW_TS - $(stat -c %Y "$HEARTBEAT" 2>/dev/null || echo 0)))
    if [ $HEARTBEAT_AGE -gt $STALL_SECONDS ]; then
        summary=$(get_swarm_summary)
        local_log "Heartbeat file stale (${HEARTBEAT_AGE}s old). State: $summary"

        shc=$(cat "$STALE_HEARTBEAT" 2>/dev/null || echo 0)
        shc=$((shc + 1))
        echo "$shc" > "$STALE_HEARTBEAT"
        if [ "$shc" -ge 3 ]; then
            local_log "Heartbeat stale for $((shc * 5)) mins. Triggering full restart."
            alert "swarm_blocked" \
                "SWARM BLOCKED - Heartbeat stale" \
                "Main loop heartbeat stale for $((shc * 5)) mins.\nState: ${summary}\n\nTriggering full restart via kickoff.sh..."
            recover_full_restart
            echo 0 > "$STALE_HEARTBEAT"
        fi
    else
        echo 0 > "$STALE_HEARTBEAT"
    fi
else
    mkdir -p "$(dirname "$HEARTBEAT")" 2>/dev/null || true
    touch "$HEARTBEAT" 2>/dev/null || true
fi

# --- CHECK 6: Disk space -----------------------------------------------
DISK_PCT=$(df -h "$REPO_DIR" 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}')
if [ "${DISK_PCT:-100}" -ge 85 ]; then
    local_log "Disk at ${DISK_PCT}% - write failures imminent"
    alert "disk_full" \
        "Disk at ${DISK_PCT}%" \
        "Disk usage on the repo partition is ${DISK_PCT}%.\n\nAuto-cleaning temporary files..."
    rm -rf /tmp/aider_* /tmp/tmp.* 2>/dev/null || true
    rm -rf "$REPO_DIR/frontend/.angular" "$REPO_DIR/backend/dist" 2>/dev/null || true
fi

# --- CHECK 7: Memory pressure ------------------------------------------
MEM_TOTAL=$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 1)
MEM_AVAIL=$(awk '/MemAvailable/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
if [ "$MEM_TOTAL" -gt 0 ]; then
    MEM_PCT=$((100 - (MEM_AVAIL * 100 / MEM_TOTAL)))
    if [ "$MEM_PCT" -ge 85 ]; then
        local_log "Memory pressure: ${MEM_PCT}% used (${MEM_AVAIL}KB available)"

        pkill -9 -f "playwright" 2>/dev/null || true
        pkill -9 -f "chromium" 2>/dev/null || true
        pkill -9 -f "chrome" 2>/dev/null || true

        if [ "$MEM_PCT" -ge 90 ]; then
            pkill -9 -f "agy" 2>/dev/null || true
            pkill -9 -f "antigravity" 2>/dev/null || true
            pkill -9 -f "aider" 2>/dev/null || true
            pkill -f "ng serve" 2>/dev/null || true
            pkill -f "nest start.*watch" 2>/dev/null || true
            echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true
            find /tmp -name "*.log" -size +100M -exec truncate -s 0 {} \; 2>/dev/null || true
        fi

        if [ "$MEM_PCT" -ge 95 ]; then
            alert "memory_critical" \
                "CRITICAL: Memory at ${MEM_PCT}%" \
                "Only ${MEM_AVAIL}KB available.\nSwap: $(free -h | grep Swap | awk '{print $3"/"$2}')."
        fi
    fi
fi

echo "[WATCHDOG] Check complete at $(date -u). State: $(get_swarm_summary)"
