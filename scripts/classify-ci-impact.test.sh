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
  local expected_governance="$6"
  local expected_database="$7"
  shift 7

  local output
  output="$(mktemp)"

  if [ "$#" -eq 0 ]; then
    printf '' | bash "$CLASSIFIER" "$output" >/dev/null
  else
    printf '%s\n' "$@" | bash "$CLASSIFIER" "$output" >/dev/null
  fi

  local actual_application actual_backend actual_frontend actual_admin actual_governance actual_database
  actual_application="$(sed -n 's/^run_application=//p' "$output" | tail -1)"
  actual_backend="$(sed -n 's/^run_backend=//p' "$output" | tail -1)"
  actual_frontend="$(sed -n 's/^run_frontend=//p' "$output" | tail -1)"
  actual_admin="$(sed -n 's/^run_admin=//p' "$output" | tail -1)"
  actual_governance="$(sed -n 's/^run_governance=//p' "$output" | tail -1)"
  actual_database="$(sed -n 's/^run_database=//p' "$output" | tail -1)"
  if [ "$actual_application" != "$expected_application" ] || \
    [ "$actual_backend" != "$expected_backend" ] || \
    [ "$actual_frontend" != "$expected_frontend" ] || \
    [ "$actual_admin" != "$expected_admin" ] || \
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

assert_case 'documentation only' false false false false false false docs/README.md
assert_case 'frontend source' true false true false true false frontend/src/app/app.component.ts
assert_case 'backend source' true true false false true false backend/src/main.ts
assert_case 'admin source' true false false true true false admin-portal/src/main.ts
assert_case 'database source' true true false false true true supabase/migrations/20260101000000_example.sql
assert_case 'backend application' true true false false true false backend/src/main.ts
assert_case 'canonical CI self-change' true true true true true true .github/workflows/ci.yml
assert_case 'unknown workflow fails open' true true true true true false .github/workflows/new-product-gate.yml
assert_case 'classifier self-change fails open' true true true true true true scripts/classify-ci-impact.sh
assert_case 'classifier test self-change fails open' true true true true true true scripts/classify-ci-impact.test.sh
assert_case 'unknown script still fails open' true true true true true false scripts/new-product-maintenance.sh
assert_case 'empty diff fails open' true true true true true true
