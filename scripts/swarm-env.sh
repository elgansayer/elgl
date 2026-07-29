#!/bin/bash
# swarm-env.sh - Unified environment layer for every swarm script.
#
# Source this FIRST in entrypoint scripts (loop.sh, kickoff.sh, watchdogs, etc.).
# It replaces the scattered "set -a; source .env; set +a" patterns.
#
# Responsibilities:
#   1. Detect the repo root (SWARM_ROOT)
#   2. Load .env (if present)
#   3. Set defaults for every tunable
#   4. Export everything so child scripts inherit it
#   5. Validate required vars (when invoked with --validate)
#
# Usage:
#   source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/scripts/swarm-env.sh"
#   source "$SWARM_ROOT/scripts/swarm-env.sh" --validate   # from entrypoints

# ---- 1. Repo root detection ----
# If SWARM_ROOT is already set (e.g. from kickoff.sh) honour it; otherwise
# derive from the location of *this* file.
if [ -z "${SWARM_ROOT:-}" ]; then
    _self="${BASH_SOURCE[0]:-$0}"
    _self_dir="$(dirname "$(realpath "$_self")")"
    export SWARM_ROOT="$(dirname "$_self_dir")"
fi
export SWARM_SCRIPTS="$SWARM_ROOT/scripts"

# ---- 2. Load .env ----
# Silently skip if .env doesn't exist (fresh clone, no keys yet).
if [ -f "$SWARM_ROOT/.env" ]; then
    set -a
    source "$SWARM_ROOT/.env"
    set +a
fi

# ---- 3. Repo identity (portable across forks/VPS instances) ----
export SWARM_REPO_OWNER="${SWARM_REPO_OWNER:-elgansayer}"
export SWARM_REPO_NAME="${SWARM_REPO_NAME:-hellotalk}"
export SWARM_GIT_REMOTE="${SWARM_GIT_REMOTE:-origin}"
export SWARM_GIT_BRANCH="${SWARM_GIT_BRANCH:-main}"
export SWARM_GIT_USER="${SWARM_GIT_USER:-AI Swarm}"
export SWARM_GIT_EMAIL="${SWARM_GIT_EMAIL:-swarm@hellotalk.local}"

# ---- 4. AI tool timeouts (seconds) ----
# Absolute wall-clock cap (liveness safety net).
export AIDER_TIMEOUT="${AIDER_TIMEOUT:-600}"
export ANTIGRAVITY_TIMEOUT="${ANTIGRAVITY_TIMEOUT:-900}"
export CLAUDE_TIMEOUT="${CLAUDE_TIMEOUT:-600}"

# Stuck timeout: killed only if no output AND no file changes for this long.
export AIDER_STUCK_TIMEOUT="${AIDER_STUCK_TIMEOUT:-300}"
export ANTIGRAVITY_STUCK_TIMEOUT="${ANTIGRAVITY_STUCK_TIMEOUT:-300}"
export CLAUDE_STUCK_TIMEOUT="${CLAUDE_STUCK_TIMEOUT:-180}"

# ---- 5. Rate limiter ----
export AI_RATE_COOLDOWN_SECONDS="${AI_RATE_COOLDOWN_SECONDS:-15}"
export AI_RATE_LOCK_TIMEOUT="${AI_RATE_LOCK_TIMEOUT:-300}"
export AI_RATE_LOCK_STALE_SECONDS="${AI_RATE_LOCK_STALE_SECONDS:-600}"

# ---- 6. Loop behaviour ----
export SWARM_MAX_RETRIES="${SWARM_MAX_RETRIES:-3}"
export SWARM_COOLDOWN="${SWARM_COOLDOWN:-15}"
export SWARM_MODEL_PAUSE="${SWARM_MODEL_PAUSE:-300}"

# ---- 7. Watchdog ----
export WATCHDOG_STALL_MINUTES="${WATCHDOG_STALL_MINUTES:-15}"
export WATCHDOG_ALERT_COOLDOWN="${WATCHDOG_ALERT_COOLDOWN:-600}"
export WATCHDOG_RECOVERY_COOLDOWN="${WATCHDOG_RECOVERY_COOLDOWN:-900}"

# ---- 8. PM loop ----
export PM_SYNC_INTERVAL="${PM_SYNC_INTERVAL:-3600}"
export GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# ---- 9. Logging ----
export SWARM_LOG_DIR="${SWARM_LOG_DIR:-$SWARM_ROOT/logs}"
export SWARM_STATE_FILE="${SWARM_STATE_FILE:-/tmp/ai_swarm_state.json}"

# ---- 10. Validation ----
_swarm_validate_env() {
    local missing=""
    local required=(
        DEEPSEEK_API_KEY
    )

    for var in "${required[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing="$missing  $var"
        fi
    done

    if [ -n "$missing" ]; then
        echo "=============================================="
        echo " FATAL: Required env vars not set:"
        echo "$missing"
        echo ""
        echo " Add them to $SWARM_ROOT/.env and restart."
        echo " See $SWARM_ROOT/.env.example for a template."
        echo "=============================================="
        return 1
    fi

    # Warn about absence of optional but important vars
    local warned=""
    for var in TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID; do
        if [ -z "${!var:-}" ]; then
            warned="$warned  $var (Telegram alerts disabled)"
        fi
    done
    [ -n "$warned" ] && echo "[swarm-env] Optional vars not set:$warned"

    return 0
}

if [ "${1:-}" = "--validate" ]; then
    _swarm_validate_env || exit 1
fi
