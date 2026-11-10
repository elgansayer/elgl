#!/usr/bin/env bash
set -euo pipefail

echo "================================================================"
echo "🚀 Building and verifying HelloTalk workspace and factory"
echo "================================================================"

npm run verify

echo "================================================================"
echo "✅ All builds and tests passed successfully!"
echo "================================================================"
