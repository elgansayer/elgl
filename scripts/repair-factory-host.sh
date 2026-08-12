#!/usr/bin/env bash
set -euo pipefail

TARGET=/etc/hellotalk-factory/factory.env
STATE_DIR=/var/lib/hellotalk-factory
LOG_DIR=/var/log/hellotalk-factory

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this command as root.' >&2
  exit 1
fi
if [ ! -r "$TARGET" ]; then
  echo "Missing $TARGET" >&2
  exit 1
fi

backup="$TARGET.backup.$(date -u +%Y%m%dT%H%M%SZ)"
cp -a "$TARGET" "$backup"
temporary=$(mktemp "${TARGET}.repair.XXXXXX")
trap 'rm -f "$temporary"' EXIT

awk '
  function is_canonical_path(key) {
    return key ~ /^(FACTORY_REPOSITORY|FACTORY_STATE_DIR|FACTORY_LOG_DIR|FACTORY_PROFILE_STORE|FACTORY_WORKTREE_DIR|FACTORY_RECOVERY_DIR|FACTORY_PODMAN_PATH|FACTORY_TASK_IMAGE|FACTORY_MINIMUM_FREE_DISK_GIB|FACTORY_MAX_PARALLEL_JOBS|FACTORY_REQUIRE_READY_LABEL|FACTORY_READY_LABEL)$/
  }
  {
    key = $0
    sub(/^[[:space:]]*/, "", key)
    sub(/[[:space:]]*=.*$/, "", key)
    if (!is_canonical_path(key)) print
  }
' "$TARGET" > "$temporary"

cat >> "$temporary" <<'EOF'
FACTORY_REPOSITORY=/var/lib/hellotalk-factory/repository
FACTORY_BASE_BRANCH=main
FACTORY_STATE_DIR=/var/lib/hellotalk-factory
FACTORY_LOG_DIR=/var/log/hellotalk-factory
FACTORY_PROFILE_STORE=/var/lib/hellotalk-factory/profiles
FACTORY_WORKTREE_DIR=/var/lib/hellotalk-factory/worktrees
FACTORY_RECOVERY_DIR=/var/lib/hellotalk-factory/recovery
FACTORY_PODMAN_PATH=/usr/bin/podman
FACTORY_TASK_IMAGE=localhost/hellotalk-factory-worker:current
FACTORY_MINIMUM_FREE_DISK_GIB=5
FACTORY_MAX_PARALLEL_JOBS=5
FACTORY_REQUIRE_READY_LABEL=false
FACTORY_READY_LABEL=factory-ready
GEMINI_ENABLED=false
EOF

chown root:hellotalk-factory "$temporary"
chmod 0640 "$temporary"
mv -f "$temporary" "$TARGET"
trap - EXIT

install -d -o hellotalk-factory -g hellotalk-factory -m 0750 "$STATE_DIR" "$STATE_DIR/home" "$STATE_DIR/profiles" "$STATE_DIR/worktrees" "$STATE_DIR/recovery" "$LOG_DIR"
chown -R hellotalk-factory:hellotalk-factory "$STATE_DIR/repository" "$STATE_DIR/profiles" "$STATE_DIR/worktrees" "$STATE_DIR/recovery" "$STATE_DIR/home"
chmod 0700 "$STATE_DIR/home"

echo "Factory host repaired. Environment backup: $backup"
echo 'Provider credentials were preserved and were not printed.'
