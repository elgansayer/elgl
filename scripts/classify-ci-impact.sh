#!/usr/bin/env bash
set -euo pipefail

output_file="${1:-}"
run_application=false
run_factory=false
saw_path=false

while IFS= read -r path; do
  [ -z "$path" ] && continue
  saw_path=true

  case "$path" in
    automation/*|config/factory/*|config/systemd/*)
      run_factory=true
      ;;
    .github/workflows/ci.yml)
      # Changing the canonical classifier/gate itself must fail open to both
      # verification groups so a broken optimisation cannot silently skip CI.
      run_application=true
      run_factory=true
      ;;
    .github/workflows/factory-merge.yml|.github/workflows/factory-format-evidence.yml|.github/workflows/on-failure.yml|.github/workflows/branch-pr-hygiene.yml)
      # These workflows operate the Factory/control plane rather than product
      # code. Keep Factory verification, but do not install/test all three apps.
      run_factory=true
      ;;
    docs/*|.github/dependabot.yml)
      ;;
    *)
      # Unknown/shared paths deliberately fail open to application verification.
      run_application=true
      ;;
  esac
done

# An empty or unreadable PR diff must fail open rather than accidentally skip
# verification because impact classification itself went wrong.
if [ "$saw_path" = false ]; then
  run_application=true
  run_factory=true
fi

if [ -n "$output_file" ]; then
  {
    echo "run_application=$run_application"
    echo "run_factory=$run_factory"
  } >> "$output_file"
fi

echo "Application verification required: $run_application"
echo "Factory verification required: $run_factory"
