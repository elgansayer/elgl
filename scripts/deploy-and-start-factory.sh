#!/usr/bin/env bash
set -euo pipefail

REPOSITORY=${FACTORY_SOURCE_REPOSITORY:-/home/dev/hellotalk}
BRANCH=factory/update-dynamic-tasks
WORKTREE=''
USE_EXISTING_CREDENTIALS=false
SOURCE_REF=HEAD

usage() {
  cat <<'EOF'
Usage: deploy-and-start-factory.sh --use-existing-credentials

Deploys the current OpenHands factory, repairs canonical host paths, runs the
online doctor, and starts the daemon. It never prints provider credentials.

The flag is intentionally required because credentials already present on the
host may have been exposed and should normally be rotated first.
EOF
}

for argument in "$@"; do
  case "$argument" in
    --use-existing-credentials) USE_EXISTING_CREDENTIALS=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $argument" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$USE_EXISTING_CREDENTIALS" != true ]; then
  echo 'Refusing to use existing factory credentials without explicit confirmation.' >&2
  usage >&2
  exit 3
fi
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this command with sudo.' >&2
  exit 1
fi
if [ ! -d "$REPOSITORY/.git" ]; then
  echo "Not a Git repository: $REPOSITORY" >&2
  exit 1
fi

cleanup() {
  if [ -n "$WORKTREE" ] && [ -d "$WORKTREE" ]; then
    git -C "$REPOSITORY" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if git -C "$REPOSITORY" fetch origin "$BRANCH" >/dev/null 2>&1; then
  SOURCE_REF="origin/$BRANCH"
else
  echo 'Remote fetch unavailable. Using the current checked-out factory commit.' >&2
fi
WORKTREE=$(mktemp -d /tmp/hellotalk-factory-deploy.XXXXXX)
git -C "$REPOSITORY" worktree add --detach "$WORKTREE" "$SOURCE_REF" >/dev/null

"$WORKTREE/scripts/repair-factory-host.sh"

if [ ! -x /opt/hellotalk-factory/venv/bin/pip ]; then
  echo 'Missing factory virtual environment.' >&2
  exit 1
fi
/opt/hellotalk-factory/venv/bin/pip install --no-deps "$WORKTREE/automation" >/dev/null

if [ ! -r /etc/hellotalk-factory/factory.env ]; then
  echo 'Missing /etc/hellotalk-factory/factory.env.' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. /etc/hellotalk-factory/factory.env
set +a
export HOME=/var/lib/hellotalk-factory/home
cd /tmp
runuser -u hellotalk-factory --preserve-environment -- \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online

"$WORKTREE/scripts/start-factory.sh"

echo 'Factory deployment and startup completed.'
systemctl is-active hellotalk-factory.service
systemctl is-active hellotalk-factory-health.timer
systemctl --no-pager --full status hellotalk-factory.service
