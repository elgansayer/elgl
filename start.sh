#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure NVM and system Node/NPM PATH are loaded
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
fi
export PATH="/usr/local/bin:$PATH"

echo "=========================================="
echo " Starting HelloTalk Backend & Frontend    "
echo "=========================================="

# Trap SIGINT and SIGTERM to kill spawned child background jobs cleanly
cleanup() {
    echo ""
    echo "Shutting down HelloTalk services..."
    trap - SIGINT SIGTERM EXIT
    kill 0 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start backend service
echo "🚀 Starting backend (npm run start:dev)..."
(cd "$SCRIPT_DIR/backend" && npm run start:dev) &
BACKEND_PID=$!

# Start frontend service
echo "🚀 Starting frontend (npm run start)..."
(cd "$SCRIPT_DIR/frontend" && npm run start) &
FRONTEND_PID=$!

echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both services."
echo "=========================================="

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
