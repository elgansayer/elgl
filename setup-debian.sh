#!/usr/bin/env bash
set -eo pipefail

echo "=========================================="
echo " Setting up HelloTalk on Debian instance "
echo "=========================================="

# 1. Update apt repositories and install essential packages
echo "[1/5] Updating apt package lists and installing prerequisites..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git build-essential xz-utils ca-certificates

# 2. Install NVM (Node Version Manager) if not already installed
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    echo "[2/5] Installing NVM (Node Version Manager)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
else
    echo "[2/5] NVM is already installed at $NVM_DIR."
fi

# Load NVM for current session
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    \. "$NVM_DIR/nvm.sh"
fi

# Ensure NVM config is in ~/.bashrc
if ! grep -q 'NVM_DIR' "$HOME/.bashrc" 2>/dev/null; then
    {
        echo ''
        echo 'export NVM_DIR="$HOME/.nvm"'
        echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
        echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"'
    } >> "$HOME/.bashrc"
fi

# 3. Install Node.js 22 LTS via NVM
echo "[3/5] Installing and configuring Node.js 22 LTS..."
nvm install 22
nvm use 22
nvm alias default 22

# Configure symlinks for system-wide availability in non-interactive shells
NODE_BIN="$(which node || true)"
NPM_BIN="$(which npm || true)"
NPX_BIN="$(which npx || true)"

if [ -n "$NODE_BIN" ]; then
    sudo ln -sf "$NODE_BIN" /usr/local/bin/node
fi
if [ -n "$NPM_BIN" ]; then
    sudo ln -sf "$NPM_BIN" /usr/local/bin/npm
fi
if [ -n "$NPX_BIN" ]; then
    sudo ln -sf "$NPX_BIN" /usr/local/bin/npx
fi

# 4. Determine repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 5. Install NPM dependencies across all workspace projects
echo "[4/5] Installing workspace dependencies..."

if [ -f "$SCRIPT_DIR/package.json" ]; then
    echo " -> Installing root dependencies..."
    (cd "$SCRIPT_DIR" && npm install)
fi

if [ -f "$SCRIPT_DIR/backend/package.json" ]; then
    echo " -> Installing backend dependencies..."
    (cd "$SCRIPT_DIR/backend" && npm install)
fi

if [ -f "$SCRIPT_DIR/frontend/package.json" ]; then
    echo " -> Installing frontend dependencies..."
    (cd "$SCRIPT_DIR/frontend" && npm install)
fi

echo "[5/5] Verifying installation..."
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"
echo "NVM version:  $(nvm --version)"

echo "=========================================="
echo " Setup complete for Debian instance! "
echo "=========================================="
