#!/usr/bin/env bash
# Compatibility entry point for the secure factory bootstrap.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -eq 0 ]; then
  exec "$SCRIPT_DIR/setup-debian.sh"
fi

echo 'The production bootstrap requires root for package and systemd installation.'
echo "Run: sudo $SCRIPT_DIR/setup-debian.sh"
