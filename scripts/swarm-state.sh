#!/bin/bash
# swarm-state.sh - Structured state file for observability.
#
# Writes /tmp/ai_swarm_state.json so the watchdog and CLI can query
# what the swarm is doing without parsing raw tmux pane text.
#
# Source this and call swarm_state_set() to update fields.

SWARM_STATE="${SWARM_STATE_FILE:-/tmp/ai_swarm_state.json}"

swarm_state_init() {
    mkdir -p "$(dirname "$SWARM_STATE")" 2>/dev/null || true
    local now
    now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    cat > "$SWARM_STATE" << EOF
{
  "started_at": "$now",
  "pid": $$,
  "current_task": "",
  "current_stage": "init",
  "current_tool": "",
  "attempt": 0,
  "max_attempts": ${SWARM_MAX_RETRIES:-3},
  "last_error": "",
  "tasks_completed": 0,
  "tasks_stuck": 0,
  "last_commit": ""
}
EOF
}

swarm_state_set() {
    local key="$1" value="$2"
    [ -f "$SWARM_STATE" ] || swarm_state_init
    local tmp
    tmp=$(mktemp)
    if [[ "$value" =~ ^-?[0-9]+$ ]]; then
        jq --argjson v "$value" ".$key = \$v" "$SWARM_STATE" > "$tmp" 2>/dev/null && mv "$tmp" "$SWARM_STATE" || rm -f "$tmp"
    else
        jq --arg v "$value" ".$key = \$v" "$SWARM_STATE" > "$tmp" 2>/dev/null && mv "$tmp" "$SWARM_STATE" || rm -f "$tmp"
    fi
}

swarm_state_get() {
    local key="$1"
    [ -f "$SWARM_STATE" ] || { echo ""; return; }
    jq -r ".$key // empty" "$SWARM_STATE" 2>/dev/null || echo ""
}
