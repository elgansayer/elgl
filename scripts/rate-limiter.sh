#!/bin/bash
# rate-limiter.sh - Shared token-bucket rate limiter for AI API calls.
#
# Uses a file lock + timestamp cache to ensure only one swarm agent calls
# external AI APIs at a time, preventing concurrent credit burn.
#
# Source this in scripts that call AI APIs, then wrap calls with:
#   acquire_ai_slot && { ... do API call ...; release_ai_slot; }
#
# Configuration via env vars:
#   AI_RATE_COOLDOWN_SECONDS   - minimum seconds between API calls (default 15)
#   AI_RATE_LOCK_TIMEOUT        - max seconds to wait for lock (default 300)
#   AI_RATE_LOCK_STALE_SECONDS  - steal a lock held this long (default 1200)

AI_RATE_DIR="${AI_RATE_DIR:-/tmp/ai_swarm_ratelimit}"
AI_RATE_COOLDOWN="${AI_RATE_COOLDOWN_SECONDS:-15}"
AI_RATE_LOCK_TIMEOUT="${AI_RATE_LOCK_TIMEOUT:-300}"
AI_RATE_LOCK_STALE="${AI_RATE_LOCK_STALE_SECONDS:-1200}"
AI_RATE_LOCK="${AI_RATE_DIR}/api.lock"
AI_RATE_LAST="${AI_RATE_DIR}/last_call_ts"

mkdir -p "$AI_RATE_DIR" 2>/dev/null || true

# Returns 0 if the lock directory appears stale (holder died without releasing).
_is_lock_stale() {
    [ -d "$AI_RATE_LOCK" ] || return 1
    local lock_mtime
    lock_mtime=$(stat -c %Y "$AI_RATE_LOCK" 2>/dev/null || echo 0)
    local now_ts=$(date +%s)
    [ $((now_ts - lock_mtime)) -ge "$AI_RATE_LOCK_STALE" ]
}

# Acquire the global AI API slot. Blocks until the slot is free and
# the cooldown since the last call has elapsed. Returns 0 when ready.
# Stale locks (holder process died) are automatically detected and cleared.
acquire_ai_slot() {
    local waited=0
    local deadline=$(( $(date +%s) + AI_RATE_LOCK_TIMEOUT ))

    while true; do
        # If the lock is stale (previous holder died without releasing),
        # forcibly clear it so the pipeline isn't permanently blocked.
        if _is_lock_stale; then
            local lock_ts
            lock_ts=$(stat -c %Y "$AI_RATE_LOCK" 2>/dev/null || echo 0)
            if [ "$lock_ts" -gt 0 ]; then
                echo "[RATE-LIMIT] Stale lock detected (held since $(date -d "@$lock_ts" '+%H:%M:%S' 2>/dev/null || echo 'unknown')). Clearing."
            else
                echo "[RATE-LIMIT] Stale lock detected. Clearing."
            fi
            rmdir "$AI_RATE_LOCK" 2>/dev/null || rm -rf "$AI_RATE_LOCK"
        fi

        # Try to acquire the lock (non-blocking)
        if mkdir "$AI_RATE_LOCK" 2>/dev/null; then
            # Check cooldown
            local last_ts=0
            [ -f "$AI_RATE_LAST" ] && last_ts=$(cat "$AI_RATE_LAST" 2>/dev/null || echo 0)
            local now_ts=$(date +%s)
            local elapsed=$((now_ts - last_ts))

            if [ "$elapsed" -lt "$AI_RATE_COOLDOWN" ]; then
                # Cooldown hasn't elapsed yet - release and wait
                rmdir "$AI_RATE_LOCK" 2>/dev/null || true
                local remaining=$((AI_RATE_COOLDOWN - elapsed))
                [ "$waited" -ge "$AI_RATE_LOCK_TIMEOUT" ] && return 1
                sleep "$remaining"
                waited=$((waited + remaining))
                continue
            fi

            # Slot acquired, record timestamp and touch the lock dir so
            # its mtime is fresh for stale-lock detection.
            echo "$now_ts" > "$AI_RATE_LAST"
            touch "$AI_RATE_LOCK"
            return 0
        fi

        # Lock held by another agent - wait
        sleep 1
        waited=$((waited + 1))
        if [ "$waited" -ge "$AI_RATE_LOCK_TIMEOUT" ]; then
            echo "[RATE-LIMIT] Timed out waiting for AI API slot after ${AI_RATE_LOCK_TIMEOUT}s."
            return 1
        fi
    done
}

# Release the global AI API slot so the next agent can proceed.
release_ai_slot() {
    rmdir "$AI_RATE_LOCK" 2>/dev/null || true
}

# Convenience: run a command under the rate limiter.
# Usage: rate_limited_ai some-command --with args
rate_limited_ai() {
    if acquire_ai_slot; then
        "$@"
        local rc=$?
        release_ai_slot
        return $rc
    fi
    return 1
}

# --------------------------------------------------------------------------
# Liveness-aware command runner.
#
# Unlike a blind `timeout --foreground -s KILL $n`, this only kills a
# command when it has genuinely stopped making progress.  It monitors two
# liveness signals simultaneously:
#   1. Output growth  (stdout/stderr file size increasing)
#   2. Repo changes    (git status --porcelain differing from snapshot)
#
# If *neither* signal changes for <stuck_secs> seconds the command is
# considered stuck and killed (exit 127).  There is also an absolute
# wall-clock timeout (exit 124) as a safety net.
#
# Usage: run_with_liveness <abs_timeout_secs> <stuck_timeout_secs> <command...>
# Returns: command's own exit code, 127 if stuck, or 124 if absolute timeout.
# --------------------------------------------------------------------------
run_with_liveness() {
    local abs_timeout="$1"
    local stuck_secs="$2"
    shift 2

    local outfile pidfile stuckfile
    outfile=$(mktemp)
    pidfile=$(mktemp)
    stuckfile=$(mktemp)

    local start_ts
    start_ts=$(date +%s)

    # Snapshot repo state once before the command starts.
    local prev_porcelain
    prev_porcelain=$(git status --porcelain 2>/dev/null || true)

    # Launch the real command, capturing stdout+stderr into a temp file.
    ("$@" > "$outfile" 2>&1) &
    local cmd_pid=$!
    echo "$cmd_pid" > "$pidfile"

    # Background watcher: polls every 10 s for output growth or file diffs.
    (
        local last_progress_ts
        last_progress_ts=$(date +%s)
        local prev_size=0
        local prev_porc="$prev_porcelain"

        while kill -0 "$cmd_pid" 2>/dev/null; do
            sleep 10
            local now_ts
            now_ts=$(date +%s)

            # Signal 1: stdout/stderr file grew?
            local cur_size=0
            [ -f "$outfile" ] && cur_size=$(stat -c %s "$outfile" 2>/dev/null || echo 0)

            # Signal 2: working tree changed?
            local cur_porc
            cur_porc=$(git status --porcelain 2>/dev/null || true)

            if [ "$cur_size" -gt "$prev_size" ] || [ "$cur_porc" != "$prev_porc" ]; then
                last_progress_ts="$now_ts"
                prev_size="$cur_size"
                prev_porc="$cur_porc"
            fi

            # --- Stuck check ---
            local stuck_dur=$((now_ts - last_progress_ts))
            if [ "$stuck_dur" -ge "$stuck_secs" ]; then
                echo "STUCK" > "$stuckfile"
                kill -KILL "$cmd_pid" 2>/dev/null
                exit 0
            fi

            # --- Absolute timeout check ---
            local total_elapsed=$((now_ts - start_ts))
            if [ "$total_elapsed" -ge "$abs_timeout" ]; then
                echo "TIMEOUT" > "$stuckfile"
                kill -KILL "$cmd_pid" 2>/dev/null
                exit 0
            fi
        done
    ) &
    local watcher_pid=$!

    # Wait for the real command to finish (or be killed by the watcher).
    wait "$cmd_pid" 2>/dev/null
    local cmd_rc=$?

    # Tear down the watcher.
    kill "$watcher_pid" 2>/dev/null
    wait "$watcher_pid" 2>/dev/null

    # Emit captured output so the caller's $(...) still captures everything.
    cat "$outfile"

    local stuck_reason=""
    [ -f "$stuckfile" ] && stuck_reason=$(cat "$stuckfile")

    rm -f "$outfile" "$pidfile" "$stuckfile"

    if [ "$stuck_reason" = "STUCK" ]; then
        echo "[LIVENESS] Killed: no output or file changes for ${stuck_secs}s"
        return 127
    elif [ "$stuck_reason" = "TIMEOUT" ]; then
        echo "[LIVENESS] Killed: absolute timeout (${abs_timeout}s)"
        return 124
    fi

    return "$cmd_rc"
}
