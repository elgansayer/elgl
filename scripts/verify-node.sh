#!/bin/bash
set -e

echo "========================================"
echo " Node.js & npm Verification"
echo "========================================"

# Check node
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "[PASS] Node.js version: $NODE_VERSION"
else
    echo "[FAIL] Node.js is not installed or not in PATH"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "[PASS] npm version: $NPM_VERSION"
else
    echo "[FAIL] npm is not installed or not in PATH"
    exit 1
fi

# Optional: Check minimum versions (Node >= 18, npm >= 9)
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "[WARN] Node.js version $NODE_VERSION is below recommended minimum 18.x"
fi

NPM_MAJOR=$(npm -v | cut -d'.' -f1)
if [ "$NPM_MAJOR" -lt 9 ]; then
    echo "[WARN] npm version $NPM_VERSION is below recommended minimum 9.x"
fi

echo ""
echo "========================================"
echo " Verification Complete - All checks passed"
echo "========================================"
exit 0
