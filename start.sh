#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure NVM and system Node/NPM PATH are loaded
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090,SC1091
    \. "$NVM_DIR/nvm.sh" 2>/dev/null || true
fi
export PATH="$PATH:/usr/local/bin"

echo "=========================================="
echo " Starting HelloTalk Backend & Frontend    "
echo "=========================================="

# Ensure dependencies are up to date before starting either service
echo "📦 Installing backend dependencies..."
(cd "$SCRIPT_DIR/backend" && npm install)
echo "📦 Installing frontend dependencies..."
(cd "$SCRIPT_DIR/frontend" && npm install)

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

FRONTEND_URL="http://localhost:4200"

echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Frontend URL: $FRONTEND_URL"
echo "Press Ctrl+C to stop both services."
echo "=========================================="

# Wait a few seconds for the frontend to start, then open the browser
(
    sleep 8
    echo "🌐 Opening $FRONTEND_URL in your browser..."
    if command -v xdg-open > /dev/null; then
        xdg-open "$FRONTEND_URL" > /dev/null 2>&1
    elif command -v open > /dev/null; then
        open "$FRONTEND_URL" > /dev/null 2>&1
    elif command -v start > /dev/null; then
        start "$FRONTEND_URL" > /dev/null 2>&1
    elif command -v python3 > /dev/null; then
        python3 -m webbrowser "$FRONTEND_URL" > /dev/null 2>&1
    fi
) &

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
