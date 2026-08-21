#!/usr/bin/env bash
set -euo pipefail

if command -v gitleaks >/dev/null 2>&1; then
  exec gitleaks protect --staged --redact
fi

if git diff --cached --unified=0 | grep -E '(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|BEGIN (RSA |OPENSSH )?PRIVATE KEY)' >/dev/null; then
  echo 'Potential secret detected in staged changes.' >&2
  exit 1
fi

echo 'Secret scan passed. Install gitleaks for the complete scanner.'
