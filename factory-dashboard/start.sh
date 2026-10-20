#!/usr/bin/env bash
# start.sh - Start the Factory Dashboard
# Usage: ./start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and fill in values:"
  echo "  cp .env.example .env"
  echo "  nano .env"
  exit 1
fi

echo "Starting Factory Dashboard..."
sg docker -c "docker compose up -d --build"

echo ""
echo "Dashboard running at http://localhost:3100"
echo "Cloudflare tunnel should route factory.elgansayer.com -> http://localhost:3100"
echo ""
echo "Logs: sg docker -c 'docker compose logs -f'"
echo "Stop: sg docker -c 'docker compose down'"
