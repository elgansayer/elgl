#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLASSIFIER="$SCRIPT_DIR/classify-ci-impact.sh"

assert_case() {
  local name="$1"
  local expected_application="$2"
  local expected_factory="$3"
  shift 3

  local output
  output="$(mktemp)"

  if [ "$#" -eq 0 ]; then
    printf '' | bash "$CLASSIFIER" "$output" >/dev/null
  else
    printf '%s\n' "$@" | bash "$CLASSIFIER" "$output" >/dev/null
  fi

  local actual_application actual_factory
  actual_application="$(sed -n 's/^run_application=//p' "$output" | tail -1)"
  actual_factory="$(sed -n 's/^run_factory=//p' "$output" | tail -1)"
  rm -f "$output"

  if [ "$actual_application" != "$expected_application" ] || [ "$actual_factory" != "$expected_factory" ]; then
    echo "FAIL: $name expected application=$expected_application factory=$expected_factory; got application=$actual_application factory=$actual_factory" >&2
    exit 1
  fi
  echo "PASS: $name"
}

assert_case "factory python" false true automation/openhands_factory/router.py
assert_case "factory dashboard" false true factory-dashboard/src/server.js factory-dashboard/docker-compose.yml
assert_case "factory configuration" false true config/factory/agents.json config/systemd/hellotalk-factory.service
assert_case "factory host scripts" false true \
  scripts/decommission-legacy-factory.sh \
  scripts/deploy-and-start-factory.sh \
  scripts/install-factory-env.sh \
  scripts/install-repo-factory-instance.sh \
  scripts/maintain-factory-host-storage.sh \
  scripts/migrate-factory-to-secondary-disk.sh \
  scripts/relocate-home-cache-to-second-disk.sh \
  scripts/repair-factory-host.sh \
  scripts/start-factory.sh
assert_case "factory workflows" false true .github/workflows/factory-merge.yml .github/workflows/on-failure.yml .github/workflows/factory-format-evidence.yml .github/workflows/branch-pr-hygiene.yml
assert_case "documentation only" false false docs/factory/RESOURCE-POLICY.md docs/README.md
assert_case "application source" true false frontend/src/app/app.component.ts
assert_case "mixed factory and application" true true automation/openhands_factory/pipeline.py backend/src/main.ts
assert_case "mixed dashboard and application" true true factory-dashboard/src/server.js backend/src/main.ts
assert_case "mixed host script and application" true true scripts/repair-factory-host.sh backend/src/main.ts
assert_case "canonical CI self-change" true true .github/workflows/ci.yml
assert_case "unknown workflow fails open" true false .github/workflows/new-product-gate.yml
assert_case "classifier self-change fails open" true true scripts/classify-ci-impact.sh
assert_case "classifier test self-change fails open" true true scripts/classify-ci-impact.test.sh
assert_case "unknown script still fails open" true false scripts/new-product-maintenance.sh
assert_case "empty diff fails open" true true
