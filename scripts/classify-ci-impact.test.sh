#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CLASSIFIER="$SCRIPT_DIR/classify-ci-impact.sh"

assert_case() {
  local name="$1"
  local expected_application="$2"
  local expected_backend="$3"
  local expected_frontend="$4"
  local expected_admin="$5"
  local expected_factory="$6"
  local expected_governance="$7"
  local expected_database="$8"
  shift 8

  local output
  output="$(mktemp)"

  if [ "$#" -eq 0 ]; then
    printf '' | bash "$CLASSIFIER" "$output" >/dev/null
  else
    printf '%s\n' "$@" | bash "$CLASSIFIER" "$output" >/dev/null
  fi

  local actual_application actual_backend actual_frontend actual_admin actual_factory actual_governance actual_database
  actual_application="$(sed -n 's/^run_application=//p' "$output" | tail -1)"
  actual_backend="$(sed -n 's/^run_backend=//p' "$output" | tail -1)"
  actual_frontend="$(sed -n 's/^run_frontend=//p' "$output" | tail -1)"
  actual_admin="$(sed -n 's/^run_admin=//p' "$output" | tail -1)"
  actual_factory="$(sed -n 's/^run_factory=//p' "$output" | tail -1)"
  actual_governance="$(sed -n 's/^run_governance=//p' "$output" | tail -1)"
  actual_database="$(sed -n 's/^run_database=//p' "$output" | tail -1)"
  if [ "$actual_application" != "$expected_application" ] || \
    [ "$actual_backend" != "$expected_backend" ] || \
    [ "$actual_frontend" != "$expected_frontend" ] || \
    [ "$actual_admin" != "$expected_admin" ] || \
    [ "$actual_factory" != "$expected_factory" ] || \
    [ "$actual_governance" != "$expected_governance" ] || \
    [ "$actual_database" != "$expected_database" ]; then
    echo "FAIL: $name produced an unexpected impact classification" >&2
    sed 's/^/  /' "$output" >&2 || true
    rm -f "$output"
    exit 1
  fi
  rm -f "$output"
  echo "PASS: $name"
}

assert_case "factory python" false false false false true false false automation/openhands_factory/router.py
assert_case "factory dashboard" false false false false true false false factory-dashboard/src/server.js factory-dashboard/docker-compose.yml
assert_case "factory configuration" false false false false true false false config/factory/agents.json config/systemd/hellotalk-factory.service
assert_case "factory host scripts" false false false false true false false \
  scripts/decommission-legacy-factory.sh \
  scripts/deploy-and-start-factory.sh \
  scripts/install-factory-env.sh \
  scripts/install-repo-factory-instance.sh \
  scripts/maintain-factory-host-storage.sh \
  scripts/migrate-factory-to-secondary-disk.sh \
  scripts/relocate-home-cache-to-second-disk.sh \
  scripts/repair-factory-host.sh \
  scripts/start-factory.sh
assert_case "factory workflows" false false false false true false false .github/workflows/factory-merge.yml .github/workflows/on-failure.yml .github/workflows/factory-format-evidence.yml .github/workflows/branch-pr-hygiene.yml
assert_case "documentation only" false false false false false false false docs/factory/RESOURCE-POLICY.md docs/README.md
assert_case "frontend source" true false true false false true false frontend/src/app/app.component.ts
assert_case "backend source" true true false false false true false backend/src/main.ts
assert_case "admin source" true false false true false true false admin-portal/src/main.ts
assert_case "database source" true true false false false true true supabase/migrations/20260101000000_example.sql
assert_case "mixed factory and application" true true false false true true false automation/openhands_factory/pipeline.py backend/src/main.ts
assert_case "mixed dashboard and application" true true false false true true false factory-dashboard/src/server.js backend/src/main.ts
assert_case "mixed host script and application" true true false false true true false scripts/repair-factory-host.sh backend/src/main.ts
assert_case "canonical CI self-change" true true true true true true true .github/workflows/ci.yml
assert_case "unknown workflow fails open" true true true true false true false .github/workflows/new-product-gate.yml
assert_case "classifier self-change fails open" true true true true true true true scripts/classify-ci-impact.sh
assert_case "classifier test self-change fails open" true true true true true true true scripts/classify-ci-impact.test.sh
assert_case "unknown script still fails open" true true true true false true false scripts/new-product-maintenance.sh
assert_case "empty diff fails open" true true true true true true true
