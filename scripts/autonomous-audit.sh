#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo " Autonomous Codebase Audit"
echo "========================================"

# Verify no hardcoded strings in .html or .ts sources (placeholders)
echo ""
echo "--- Check for hardcoded literal strings ---"
# This is a best‑effort grep; it flags lines that contain a string literal
# that is not inside a TranslatePipe (`| t`) or i18n("...").
# It will have false positives – manual review is still needed.
grep -rn '"[^"]*"' \
  --include='*.html' \
  --include='*.ts' \
  frontend/src/ \
  backend/src/ \
  2>/dev/null \
  | grep -vE '(TranslatePipe|i18nService|t\(|this\.i18n\.)' \
  | head -20 \
  && echo "Hardcoded strings detected (see above)" \
  || echo "No obvious hardcoded strings found (sample)."

echo ""
echo "--- Running frontend test suite ---"
cd frontend/
npm test -- --watch=false 2>&1 || echo "FRONTEND TESTS FAILED" 1>&2
cd ..

echo ""
echo "--- Running backend test suite ---"
cd backend/
npm test 2>&1 || echo "BACKEND TESTS FAILED" 1>&2
cd ..

echo ""
echo "--- Audit finished ---"
