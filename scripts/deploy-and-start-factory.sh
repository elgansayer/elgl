#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY=${FACTORY_SOURCE_REPOSITORY:-"$(cd -- "$SCRIPT_DIRECTORY/.." && pwd)"}
DEPLOY_REF=${FACTORY_DEPLOY_REF:-main}
WORKTREE=''
USE_EXISTING_CREDENTIALS=false
SOURCE_REF=HEAD

usage() {
  cat <<'EOF'
Usage: deploy-and-start-factory.sh --use-existing-credentials

Deploys the OpenHands factory from the configured repository ref, repairs
canonical host paths, installs the current systemd/watchdog configuration,
starts recovery supervision, and then runs online diagnostics. It never prints
provider credentials.

The repository defaults to the checkout containing this script and the ref
defaults to main. Override them with FACTORY_SOURCE_REPOSITORY and
FACTORY_DEPLOY_REF when required.

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

if git -C "$REPOSITORY" fetch origin "$DEPLOY_REF" >/dev/null 2>&1; then
  SOURCE_REF="origin/$DEPLOY_REF"
else
  echo "Remote ref unavailable: $DEPLOY_REF. Using the current checked-out commit." >&2
fi
WORKTREE=$(mktemp -d /tmp/hellotalk-factory-deploy.XXXXXX)
git -C "$REPOSITORY" worktree add --detach "$WORKTREE" "$SOURCE_REF" >/dev/null

"$WORKTREE/scripts/repair-factory-host.sh"

install -o root -g root -m 0644 \
  "$WORKTREE/config/systemd/hellotalk-factory.service" \
  /etc/systemd/system/hellotalk-factory.service
install -o root -g root -m 0644 \
  "$WORKTREE/config/systemd/hellotalk-factory-health.service" \
  /etc/systemd/system/hellotalk-factory-health.service
install -o root -g root -m 0644 \
  "$WORKTREE/config/systemd/hellotalk-factory-health.timer" \
  /etc/systemd/system/hellotalk-factory-health.timer
install -o root -g root -m 0755 \
  "$WORKTREE/config/systemd/hellotalk-factory-watchdog.sh" \
  /opt/hellotalk-factory/hellotalk-factory-watchdog.sh
systemctl daemon-reload

if [ ! -x /opt/hellotalk-factory/venv/bin/pip ]; then
  echo 'Missing factory virtual environment.' >&2
  exit 1
fi
/opt/hellotalk-factory/venv/bin/pip install --no-deps "$WORKTREE/automation" >/dev/null

if [ ! -r /etc/hellotalk-factory/factory.env ]; then
  echo 'Missing /etc/hellotalk-factory/factory.env.' >&2
  exit 1
fi

# start-factory owns the start-before-doctor ordering. In particular, do not run
# doctor here while the daemon may still be stopped: daemon-heartbeat is one of
# the diagnostics and would otherwise block recovery before it can start.
"$WORKTREE/scripts/start-factory.sh"

echo 'Factory deployment and startup completed.'
systemctl is-active hellotalk-factory.service
systemctl is-active hellotalk-factory-health.timer
systemctl --no-pager --full status hellotalk-factory.service
