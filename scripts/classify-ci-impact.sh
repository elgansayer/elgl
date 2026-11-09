#!/usr/bin/env bash
set -euo pipefail

output_file="${1:-}"
run_application=false
run_backend=false
run_frontend=false
run_admin=false
run_governance=false
run_database=false
saw_path=false

while IFS= read -r path; do
  [ -z "$path" ] && continue
  saw_path=true

  case "$path" in
    .github/workflows/ci.yml|scripts/classify-ci-impact.sh|scripts/classify-ci-impact.test.sh)
      # Changing the canonical classifier/gate itself must fail open to every
      # verification group so a broken optimisation cannot silently skip CI.
      run_application=true
      run_backend=true
      run_frontend=true
      run_admin=true
      run_governance=true
      run_database=true
      ;;
    docs/*|.github/dependabot.yml)
      ;;
    backend/*)
      run_application=true
      run_backend=true
      run_governance=true
      case "$path" in
        backend/src/supabase/*) run_database=true ;;
      esac
      ;;
    frontend/*|e2e/*)
      run_application=true
      run_frontend=true
      run_governance=true
      ;;
    admin-portal/*)
      run_application=true
      run_admin=true
      run_governance=true
      ;;
    supabase/*|scripts/prepare-supabase-clean-replay.mjs)
      run_application=true
      run_backend=true
      run_governance=true
      run_database=true
      ;;
    *)
      # Unknown/shared paths deliberately fail open to application verification.
      run_application=true
      run_backend=true
      run_frontend=true
      run_admin=true
      run_governance=true
      ;;
  esac
done

# An empty or unreadable PR diff must fail open rather than accidentally skip
# verification because impact classification itself went wrong.
if [ "$saw_path" = false ]; then
  run_application=true
  run_backend=true
  run_frontend=true
  run_admin=true
  run_governance=true
  run_database=true
fi

if [ -n "$output_file" ]; then
  {
    echo "run_application=$run_application"
    echo "run_backend=$run_backend"
    echo "run_frontend=$run_frontend"
    echo "run_admin=$run_admin"
    echo "run_governance=$run_governance"
    echo "run_database=$run_database"
  } >> "$output_file"
fi

echo "Application verification required: $run_application"
echo "Backend verification required: $run_backend"
echo "Frontend verification required: $run_frontend"
echo "Admin verification required: $run_admin"
echo "Governance verification required: $run_governance"
echo "Database verification required: $run_database"
