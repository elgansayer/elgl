#!/usr/bin/env bash
set -euo pipefail

apply=false
if [[ "${1:-}" == "--apply" ]]; then
  apply=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--apply]" >&2
  exit 2
fi

units=(
  hellotalk-swarm.service
  hellotalk-aider.service
  hellotalk-swarm-watchdog.service
  hellotalk-guardian.service
  hellotalk-resolver.service
  hellotalk-reviewer.service
)
sessions=(swarm aider guardian resolver reviewer)
paths=(
  /var/lib/hellotalk-swarm
  /var/log/hellotalk-swarm
  /etc/hellotalk-swarm
  /opt/hellotalk-swarm
  /var/lib/ai-swarm
  /opt/ai-swarm
)

run_or_print() {
  if $apply; then
    "$@"
  else
    printf 'DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
  fi
}

for unit in "${units[@]}"; do
  if systemctl list-unit-files "$unit" --no-legend 2>/dev/null | grep -q .; then
    run_or_print systemctl disable --now "$unit"
  fi
done

if command -v tmux >/dev/null 2>&1; then
  for session in "${sessions[@]}"; do
    if tmux has-session -t "$session" 2>/dev/null; then
      run_or_print tmux kill-session -t "$session"
    fi
  done
fi

for path in "${paths[@]}"; do
  if [[ -e "$path" ]]; then
    echo "Legacy state found: $path"
    echo "Preserving it read-only; this script never deletes or imports legacy state."
    run_or_print chmod -R a-w "$path"
  fi
done

if $apply; then
  echo "Legacy runtime decommission actions applied. Run 'hellotalk-factory legacy scan' and 'hellotalk-factory doctor --online' next."
else
  echo "Dry run only. Re-run with --apply after reviewing the commands above."
fi
