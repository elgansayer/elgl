#!/usr/bin/env bash
set -euo pipefail

echo "================================================================"
echo "🚀 Building and verifying HelloTalk workspace and factory"
echo "================================================================"

npm run verify

if [ -d "automation" ]; then
  echo "================================================================"
  echo "🤖 Running factory automation verification"
  echo "================================================================"
  (cd automation && uv run ruff format --check . && uv run ruff check openhands_factory tests && uv run mypy openhands_factory && uv run pytest)
fi

echo "================================================================"
echo "✅ All builds and tests passed successfully!"
echo "================================================================"
