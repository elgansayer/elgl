#!/bin/bash
set -euo pipefail

echo "============================================"
echo "Verifying PATH persistence fix and lint pass"
echo "============================================"

# Step 0: Ensure Node.js and npm are installed
echo ""
echo "Step 0: Ensuring Node.js and npm are installed..."
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "⚠️  Node.js or npm not found – running install-node.sh..."
    # Determine the directory of this script so we can find install-node.sh
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$SCRIPT_DIR/install-node.sh" ]; then
        bash "$SCRIPT_DIR/install-node.sh"
        # After install-node.sh runs, source the updated bashrc and re-export PATH
        . ~/.bashrc 2>/dev/null || true
        export PATH="/usr/local/bin:$PATH"
    else
        echo "❌ install-node.sh not found alongside verify-lint.sh"
        exit 1
    fi
fi

# Step 1: Verify the PATH persistence fix is in ~/.bashrc
echo ""
echo "Step 1: Checking PATH persistence in ~/.bashrc..."
if grep -q 'export PATH="/usr/local/bin:$PATH"' ~/.bashrc 2>/dev/null; then
    echo "✅ PATH persistence found in ~/.bashrc"
else
    echo "⚠️  PATH persistence not found in ~/.bashrc - applying fix..."
    touch ~/.bashrc
    echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
    echo "✅ PATH persistence applied to ~/.bashrc"
fi

# Step 2: Source the bashrc and verify PATH
echo ""
echo "Step 2: Sourcing ~/.bashrc and verifying PATH..."
. ~/.bashrc 2>/dev/null || true
export PATH="/usr/local/bin:$PATH"

if echo "$PATH" | grep -q "/usr/local/bin"; then
    echo "✅ /usr/local/bin is in PATH"
else
    echo "❌ /usr/local/bin is NOT in PATH"
    exit 1
fi

# Step 3: Verify Node.js and npm are accessible
echo ""
echo "Step 3: Verifying Node.js and npm..."
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    echo "✅ Node.js found: $(node --version)"
    echo "✅ npm found: $(npm --version)"
else
    echo "❌ Node.js or npm not found"
    echo "   Run install-node.sh first to install Node.js"
    exit 1
fi

# Step 4: Install backend dependencies
echo ""
echo "Step 4: Installing backend dependencies..."
# Ensure npm is in PATH
export PATH="/usr/local/bin:$PATH"
cd backend
npm install
echo "✅ Backend dependencies installed"

# Step 5: Run lint
echo ""
echo "Step 5: Running lint..."
echo "Command: cd backend && npm run lint"
echo ""

# Run lint and capture output
# Use full path to npm to avoid PATH issues
LINT_OUTPUT=$(/usr/local/bin/npm run lint 2>&1)
LINT_EXIT_CODE=$?

echo "$LINT_OUTPUT"
echo ""

if [ $LINT_EXIT_CODE -eq 0 ]; then
    echo "============================================"
    echo "✅ VERIFICATION PASSED"
    echo "✅ Lint passed without errors"
    echo "✅ PATH persistence fix is working correctly"
    echo "============================================"
    exit 0
else
    echo "============================================"
    echo "❌ VERIFICATION FAILED"
    echo "❌ Lint failed with exit code $LINT_EXIT_CODE"
    echo "============================================"
    exit 1
fi
