#!/usr/bin/env bash
# Regression suite for check-stale-snapshot.py using a throwaway repository.
set -euo pipefail

SCRIPT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/check-stale-snapshot.py"
REPO="$(mktemp -d)"
trap 'rm -rf "$REPO"' EXIT
cd "$REPO"
git init -q -b main
git config user.email ci@example.invalid
git config user.name ci

for f in a b c; do echo "$f v1" > "$f.txt"; done
git add . && git commit -qm v1
git branch stale
for f in a b c; do echo "$f v2" > "$f.txt"; done
git commit -qam v2

expect() {
  local name="$1" want="$2"; shift 2
  set +e; python3 "$SCRIPT" "$@" >/dev/null; local got=$?; set -e
  if [ "$got" -ne "$want" ]; then echo "FAIL $name: exit $got, want $want"; exit 1; fi
  echo "ok $name"
}

# A fresh edit on top of main is ordinary work.
git checkout -qb feature main
echo "a v3" > a.txt && git commit -qam feature
expect "new versions pass" 0 --base main --head feature

# A branch carrying a stale whole-tree snapshot rolls a/b/c back to v1.
git checkout -qb snapshot main
git checkout stale -- a.txt b.txt c.txt && git commit -qm "snapshot of old sandbox"
expect "stale snapshot fails" 1 --base main --head snapshot
expect "intentional revert is allowed" 0 --base main --head snapshot --allow
expect "below threshold is reported only" 0 --base main --head snapshot --threshold 4

# Additions and deletions are PR intent, not rollbacks.
git checkout -qb delete main
git rm -q a.txt b.txt c.txt && git commit -qm "remove files"
expect "deletions pass" 0 --base main --head delete
