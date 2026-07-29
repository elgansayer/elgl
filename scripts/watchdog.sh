#!/bin/bash
# watchdog.sh - Autonomous swarm monitor with auto-recovery and Telegram alerts.
#
# Called from cron every 5 minutes. Detects stalls, diagnoses root cause via
# DeepSeek API, sends Telegram alerts, and performs graduated auto-recovery.
#
# Recovery levels (least -> most aggressive):
#   1. Hung pane        -> send Ctrl-C, restart loop.sh in-pane
#   2. Sudo prompt      -> answer sudo prompt with stored password
#   3. Session dead     -> run kickoff.sh
#   4. Persistent stall -> run kickoff.sh (full restart)
#
# Alert deduplication: each alert type gets ONE Telegram message per occurrence.
# Recovery is reported as a separate follow-up message.
#
# NO heartbeats - only alerts when the swarm is genuinely blocked.

set -a
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
source "$SCRIPT_DIR/../.env" 2>/dev/null || true
set +a

# --- Config ------------------------------------------------------------
STALL_MINUTES="${WATCHDOG_STALL_MINUTES:-15}"
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CHAT_ID="${TELEGRAM_CHAT_ID:-}"
DEEPSEEK_KEY="${DEEPSEEK_API_KEY:-}"
SWARM_PW="${SWARM_SUDO_PW:-}"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# Persistent cache (survives reboots, unlike /tmp)
CACHE_DIR="$HOME/.cache/ai_swarm_watchdog"
mkdir -p "$CACHE_DIR"

PANE_CACHE="$CACHE_DIR/main_pane.txt"
CONSECUTIVE_STALLS="$CACHE_DIR/consecutive_stalls"
LAST_ALERT="$CACHE_DIR/last_alert"         # unix timestamp of last Telegram alert
LAST_RECOVERY="$CACHE_DIR/last_recovery"   # unix timestamp of last recovery attempt
ALERT_COOLDOWN=600                          # seconds between repeat alerts (10 min)
RECOVERY_COOLDOWN=900                       # seconds between recovery attempts (15 min)
HEARTBEAT="/tmp/ai_swarm_watchdog/heartbeat"
RESTART_STAMP="$CACHE_DIR/swarm_restarted"

NOW_TS=$(date +%s)
STALL_SECONDS=$((STALL_MINUTES * 60))

# --- Helpers -----------------------------------------------------------

# Send a Telegram message (the ONLY notification channel).
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

# Rate-limited alert: only send if no alert for this type in ALERT_COOLDOWN seconds.
alert() {
    local stall_type="$1" title="$2" body="$3"
    local stamp_file="$CACHE_DIR/alert_${stall_type}"
    local last_ts=0
    [ -f "$stamp_file" ] && last_ts=$(cat "$stamp_file" 2>/dev/null || echo 0)
    if [ $((NOW_TS - last_ts)) -lt $ALERT_COOLDOWN ]; then
        return 0  # too soon, skip
    fi
    echo "$NOW_TS" > "$stamp_file"

    local tg_body
    tg_body=$(printf "<b>%s</b>\n\n%s" "$title" "$body")
    send_telegram "$tg_body"
}

# Rate-limited recovery: only attempt every RECOVERY_COOLDOWN seconds.
can_recover() {
    if [ -f "$LAST_RECOVERY" ]; then
        local last=$(cat "$LAST_RECOVERY" 2>/dev/null || echo 0)
        [ $((NOW_TS - last)) -lt $RECOVERY_COOLDOWN ] && return 1
    fi
    echo "$NOW_TS" > "$LAST_RECOVERY"
    return 0
}

# Ask DeepSeek to diagnose a problem from pane + git context.
deepseek_diagnose() {
    local problem="$1" pane_content="$2"
    if [ -z "$DEEPSEEK_KEY" ]; then
        echo "(no DeepSeek key configured)"
        return
    fi
    local git_log
    git_log=$(cd "$REPO_DIR" && git log --oneline -5 2>/dev/null | head -5)
    local prompt
    prompt=$(jq -nc \
        --arg problem "$problem" \
        --arg pane "$(echo "$pane_content" | tail -40)" \
        --arg git "$git_log" \
        '{
            model: "deepseek-chat",
            messages: [{
                role: "user",
                content: "You are a DevOps diagnostician. Analyze this CI swarm stall.\n\nPROBLEM: \($problem)\n\nRECENT GIT LOG:\n\($git)\n\nLAST 40 LINES OF TMUX PANE:\n\($pane)\n\nGive a 1-3 sentence diagnosis of the root cause and a 1-sentence suggested fix. Be concise."
            }],
            max_tokens: 200
        }')
    local response
    response=$(timeout 30 curl -sf -X POST "https://api.deepseek.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEEPSEEK_KEY" \
        -d "$prompt" 2>/dev/null || true)
    if [ -n "$response" ]; then
        echo "$response" | jq -r '.choices[0].message.content // empty' 2>/dev/null
    fi
}

local_log() {
    local msg="$1"
    echo "## [$(date -u +'%H:%M:%S')] $msg" >> "$REPO_DIR/STUCK_LOG.md"
    echo "[WATCHDOG] $msg"
}

# --- Recovery actions --------------------------------------------------

# Answer a visible sudo prompt in the main pane.
recover_sudo() {
    local window="$1"
    if [ -z "$SWARM_PW" ]; then
        local_log "Cannot answer sudo prompt: SWARM_SUDO_PW not set"
        return 1
    fi
    can_recover || return 1
    send_telegram "🔧 <b>Auto-Recovery: Answering sudo prompt</b>\nSending stored sudo password to <code>$window</code> pane."
    tmux send-keys -t "ai_swarm:$window" "$SWARM_PW" Enter
    sleep 2
    return 0
}

# Send Ctrl-C then restart loop.sh in the given pane.
recover_hung_pane() {
    local window="$1" script="$2"
    can_recover || return 1
    send_telegram "🔧 <b>Auto-Recovery: Restarting hung pane</b>\nKilling and restarting <code>$script</code> in <code>$window</code> pane."
    tmux send-keys -t "ai_swarm:$window" C-c
    sleep 3
    tmux send-keys -t "ai_swarm:$window" "cd $REPO_DIR && bash -c './$script; exec bash'" Enter
    return 0
}

# Restart the entire swarm via kickoff.sh.
recover_full_restart() {
    can_recover || return 1
    send_telegram "🔧 <b>Auto-Recovery: Full swarm restart</b>\nRunning <code>kickoff.sh</code> to restart all 3 swarm agents."
    tmux kill-session -t ai_swarm 2>/dev/null || true
    sleep 3
    pkill -9 -f "loop.sh" 2>/dev/null || true
    pkill -9 -f "qa-loop.sh" 2>/dev/null || true
    pkill -9 -f "pm-loop.sh" 2>/dev/null || true
    pkill -9 -f "aider" 2>/dev/null || true
    sleep 2
    cd "$REPO_DIR" && bash "$REPO_DIR/kickoff.sh" >> /tmp/kickoff_recovery.log 2>&1 &
    sleep 5
    return 0
}

# --- Checks ------------------------------------------------------------

# Get content of main pane (may be empty if session dead).
get_main_pane() {
    tmux capture-pane -t ai_swarm:Main_Swarm -p 2>/dev/null || echo ""
}

# Get content of all swarm panes.
get_all_panes() {
    local content=""
    for w in Main_Swarm QA_Swarm PM_Swarm; do
        content+="=== $w ===\n"
        content+=$(tmux capture-pane -t "ai_swarm:$w" -p 2>/dev/null | tail -20 || echo "(dead)")
        content+="\n"
    done
    echo -e "$content"
}

SESSION_DEAD=false
tmux has-session -t ai_swarm 2>/dev/null || SESSION_DEAD=true

# --- CHECK 1: tmux session alive? -------------------------------------
if $SESSION_DEAD; then
    local_log "tmux session ai_swarm is dead"
    alert "session_dead" \
        "SWARM DOWN - tmux session dead" \
        "The <code>ai_swarm</code> tmux session is not running. All 3 swarm agents (Main, QA, PM) are offline.\n\nAttempting automatic restart via <code>kickoff.sh</code>..."
    recover_full_restart
    exit 0
fi

MAIN_PANE=$(get_main_pane)
ALL_PANES=$(get_all_panes)

# --- CHECK 2: Recent git commits? --------------------------------------
LAST_COMMIT_TS=$(cd "$REPO_DIR" && git log -1 --format="%ct" 2>/dev/null || echo 0)
if [ $((NOW_TS - LAST_COMMIT_TS)) -gt $STALL_SECONDS ]; then
    # Grace period: if swarm was just restarted, skip this check.
    if [ -f "$RESTART_STAMP" ]; then
        RESTART_TS=$(cat "$RESTART_STAMP" 2>/dev/null || echo 0)
        if [ $((NOW_TS - RESTART_TS)) -lt $STALL_SECONDS ]; then
            echo "[WATCHDOG] Swarm restarted $(((NOW_TS - RESTART_TS) / 60)) min ago - skipping commit stall check"
        else
            LAST_COMMIT_INFO=$(cd "$REPO_DIR" && git log -1 --format='%ai %s' 2>/dev/null || echo 'never')
            local_log "No git commit in over ${STALL_MINUTES} min (last: $LAST_COMMIT_INFO)"
            DIAGNOSIS=$(deepseek_diagnose "No git commits for ${STALL_MINUTES}+ minutes. Swarm may be hung or all models exhausted." "$ALL_PANES")
            BODY="Last commit: ${LAST_COMMIT_INFO}\nStalled: $(( (NOW_TS - LAST_COMMIT_TS) / 60 )) mins\n\nDiagnosis: ${DIAGNOSIS}"
            alert "no_commits" "SWARM STALLED - No commits" "$BODY"
            NCC=$(cat "$CACHE_DIR/no_commit_count" 2>/dev/null || echo 0)
            NCC=$((NCC + 1))
            echo "$NCC" > "$CACHE_DIR/no_commit_count"
            if [ "$NCC" -ge 6 ]; then
                local_log "No commits for $((NCC * 5)) mins. Triggering full restart."
                recover_full_restart
                echo 0 > "$CACHE_DIR/no_commit_count"
            fi
        fi
    else
        LAST_COMMIT_INFO=$(cd "$REPO_DIR" && git log -1 --format='%ai %s' 2>/dev/null || echo 'never')
        local_log "No git commit in over ${STALL_MINUTES} min (last: $LAST_COMMIT_INFO)"
        DIAGNOSIS=$(deepseek_diagnose "No git commits for ${STALL_MINUTES}+ minutes. Swarm may be hung or all models exhausted." "$ALL_PANES")
        BODY="Last commit: ${LAST_COMMIT_INFO}\nStalled: $(( (NOW_TS - LAST_COMMIT_TS) / 60 )) mins\n\nDiagnosis: ${DIAGNOSIS}"
        alert "no_commits" "SWARM STALLED - No commits" "$BODY"
        NCC=$(cat "$CACHE_DIR/no_commit_count" 2>/dev/null || echo 0)
        NCC=$((NCC + 1))
        echo "$NCC" > "$CACHE_DIR/no_commit_count"
        if [ "$NCC" -ge 6 ]; then
            local_log "No commits for $((NCC * 5)) mins. Triggering full restart."
            recover_full_restart
            echo 0 > "$CACHE_DIR/no_commit_count"
        fi
    fi
else
    echo 0 > "$CACHE_DIR/no_commit_count"
fi

# --- CHECK 3: Main pane hung (content unchanged)? ---------------------
if [ -f "$PANE_CACHE" ] && [ -n "$MAIN_PANE" ]; then
    if [ "$MAIN_PANE" = "$(cat "$PANE_CACHE")" ]; then
        STALLS=$(cat "$CONSECUTIVE_STALLS" 2>/dev/null || echo 0)
        STALLS=$((STALLS + 1))
        echo "$STALLS" > "$CONSECUTIVE_STALLS"
        if [ "$STALLS" -ge 3 ]; then
            local_log "Main swarm pane unchanged for 3+ cycles - likely hung"
            DIAGNOSIS=$(deepseek_diagnose "Tmux pane content has not changed for 3+ watchdog cycles (15+ minutes)." "$MAIN_PANE")
            alert "pane_hung" \
                "Main pane appears hung" \
                "Pane content unchanged for ${STALLS} cycles ($((STALLS * 5)) mins).\n\nDiagnosis: ${DIAGNOSIS}\n\nAttempting pane restart..."
            recover_hung_pane "Main_Swarm" "loop.sh"
            echo 0 > "$CONSECUTIVE_STALLS"
        fi
    else
        echo 0 > "$CONSECUTIVE_STALLS"
    fi
fi
echo "$MAIN_PANE" > "$PANE_CACHE"

# --- CHECK 4: Sudo password prompt anywhere? --------------------------
for window in Main_Swarm QA_Swarm PM_Swarm; do
    PANE_CONTENT=$(tmux capture-pane -t "ai_swarm:$window" -p 2>/dev/null || echo "")
    if echo "$PANE_CONTENT" | grep -q "\[sudo\] password"; then
        local_log "Sudo password prompt visible in $window pane"
        alert "sudo_prompt" \
            "Sudo prompt blocking pipeline" \
            "A <code>[sudo] password</code> prompt is visible in <code>$window</code>. Pipeline is blocked.\n\nAttempting auto-answer..."
        recover_sudo "$window"
    fi
done

# --- CHECK 5: Heartbeat file stale? (recovery only, no notification) ---
if [ -f "$HEARTBEAT" ]; then
    HEARTBEAT_AGE=$((NOW_TS - $(stat -c %Y "$HEARTBEAT" 2>/dev/null || echo 0)))
    if [ $HEARTBEAT_AGE -gt $STALL_SECONDS ]; then
        local_log "Heartbeat file stale (${HEARTBEAT_AGE}s old) - main loop not cycling"

        SHC=$(cat "$CACHE_DIR/stale_heartbeat_count" 2>/dev/null || echo 0)
        SHC=$((SHC + 1))
        echo "$SHC" > "$CACHE_DIR/stale_heartbeat_count"
        if [ "$SHC" -ge 3 ]; then
            local_log "Heartbeat stale for $((SHC * 5)) mins. Triggering full restart."
            alert "swarm_blocked" \
                "SWARM BLOCKED - Heartbeat stale" \
                "Main loop heartbeat has been stale for $((SHC * 5)) minutes. The swarm is blocked.\n\nTriggering full restart via kickoff.sh..."
            recover_full_restart
            echo 0 > "$CACHE_DIR/stale_heartbeat_count"
        fi
    else
        echo 0 > "$CACHE_DIR/stale_heartbeat_count"
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
        local_log "Memory pressure: ${MEM_PCT}% used (${MEM_AVAIL}KB available) - cleaning up leaked processes"

        # Kill leaked Playwright/Chromium browsers (biggest offenders)
        pkill -9 -f "playwright" 2>/dev/null || true
        pkill -9 -f "chromium" 2>/dev/null || true
        pkill -9 -f "chrome" 2>/dev/null || true

        if [ "$MEM_PCT" -ge 90 ]; then
            # Aggressive: kill stale Antigravity, Aider, and dev servers
            pkill -9 -f "agy" 2>/dev/null || true
            pkill -9 -f "antigravity" 2>/dev/null || true
            pkill -9 -f "aider" 2>/dev/null || true
            # Kill stale node build watches (ng serve, nest start --watch)
            pkill -f "ng serve" 2>/dev/null || true
            pkill -f "nest start.*watch" 2>/dev/null || true
            # Drop filesystem caches (safe, kernel reclaims as needed)
            echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true
            # Rotate and truncate large log files that may be filling disk
            find /tmp -name "*.log" -size +100M -exec truncate -s 0 {} \; 2>/dev/null || true
        fi

        if [ "$MEM_PCT" -ge 95 ]; then
            # Critical: Telegram alert
            alert "memory_critical" \
                "CRITICAL: Memory at ${MEM_PCT}%" \
                "Only ${MEM_AVAIL}KB available. Killed all non-essential processes.\nSwap: $(free -h | grep Swap | awk '{print $3"/"$2}')."
        fi
    fi
fi

echo "[WATCHDOG] Check complete at $(date -u)"
