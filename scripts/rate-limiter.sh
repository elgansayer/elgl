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
#   AI_RATE_COOLDOWN_SECONDS  - minimum seconds between API calls (default 15)
#   AI_RATE_LOCK_TIMEOUT       - max seconds to wait for lock (default 300)

AI_RATE_DIR="${AI_RATE_DIR:-/tmp/ai_swarm_ratelimit}"
AI_RATE_COOLDOWN="${AI_RATE_COOLDOWN_SECONDS:-15}"
AI_RATE_LOCK_TIMEOUT="${AI_RATE_LOCK_TIMEOUT:-300}"
AI_RATE_LOCK="${AI_RATE_DIR}/api.lock"
AI_RATE_LAST="${AI_RATE_DIR}/last_call_ts"

mkdir -p "$AI_RATE_DIR" 2>/dev/null || true

# Acquire the global AI API slot. Blocks until the slot is free and
# the cooldown since the last call has elapsed. Returns 0 when ready.
acquire_ai_slot() {
    local waited=0
    local deadline=$(( $(date +%s) + AI_RATE_LOCK_TIMEOUT ))

    while true; do
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

            # Slot acquired, record timestamp
            echo "$now_ts" > "$AI_RATE_LAST"
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
