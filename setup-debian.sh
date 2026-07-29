#!/usr/bin/env bash
# setup-debian.sh - One-shot HelloTalk VPS bootstrap (non-interactive).
#
# What it does:
#   1. Installs system packages (git, curl, tmux, build tools, python3, playwright deps)
#   2. Ensures at least 4 GiB swap
#   3. Installs Node.js 22 LTS via NVM
#   4. Installs npm deps across root/backend/frontend
#   5. Installs Aider (AI coding agent)
#   6. Sets up the watchdog cron job
#   7. Configures sudo askpass for non-interactive apt installs
#
# Usage: ./setup-debian.sh
set -eo pipefail

echo "=========================================="
echo " Setting up HelloTalk on Debian instance "
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- 1. System packages ----
echo "[1/7] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    curl git build-essential xz-utils ca-certificates \
    tmux python3 python3-venv python3-pip \
    libatk-bridge2.0-0 libatspi2.0-0 libcups2 libdrm2 \
    libgbm1 libasound2 libxkbcommon0 libpango-1.0-0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2

# ---- 2. Swap (minimum 4 GiB) ----
echo "[2/7] Ensuring swap file (>= 4 GiB)..."
CURRENT_SWAP_KB=$(awk '/SwapTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
if [ "$CURRENT_SWAP_KB" -lt 4194304 ]; then
    SWAPFILE="/swapfile"
    if [ -f "$SWAPFILE" ]; then
        sudo swapoff "$SWAPFILE" 2>/dev/null || true
        sudo rm -f "$SWAPFILE"
    fi
    echo "   Creating 4 GiB swap file (this may take a minute)..."
    sudo dd if=/dev/zero of="$SWAPFILE" bs=1M count=4096 status=progress
    sudo chmod 600 "$SWAPFILE"
    sudo mkswap "$SWAPFILE"
    sudo swapon "$SWAPFILE"
    if ! grep -q "$SWAPFILE" /etc/fstab; then
        echo "$SWAPFILE none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
    fi
    echo "   Swap active: $(free -h | grep Swap)"
else
    echo "   Swap already sufficient ($(free -h | grep Swap | awk '{print $2}'))."
fi

# ---- 3. Node.js 22 LTS via NVM ----
echo "[3/7] Installing Node.js 22 LTS..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
nvm alias default 22

NODE_BIN="$(which node || true)"
NPM_BIN="$(which npm || true)"
[ -n "$NODE_BIN" ] && sudo ln -sf "$NODE_BIN" /usr/local/bin/node
[ -n "$NPM_BIN" ] && sudo ln -sf "$NPM_BIN" /usr/local/bin/npm

if ! grep -q 'NVM_DIR' "$HOME/.bashrc" 2>/dev/null; then
    {
        echo ''
        echo 'export NVM_DIR="$HOME/.nvm"'
        echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
    } >> "$HOME/.bashrc"
fi

# ---- 4. NPM dependencies ----
echo "[4/7] Installing workspace dependencies..."
if [ -f "$SCRIPT_DIR/package.json" ]; then
    (cd "$SCRIPT_DIR" && npm install)
fi
if [ -f "$SCRIPT_DIR/backend/package.json" ]; then
    (cd "$SCRIPT_DIR/backend" && npm install)
fi
if [ -f "$SCRIPT_DIR/frontend/package.json" ]; then
    (cd "$SCRIPT_DIR/frontend" && npm install)
fi
if [ -f "$SCRIPT_DIR/e2e/package.json" ]; then
    (cd "$SCRIPT_DIR/e2e" && npm install)
fi

# ---- 5. Aider AI Coding Agent ----
echo "[5/7] Installing Aider..."
if ! command -v aider &> /dev/null; then
    curl -LsSf https://aider.chat/install.sh | sh
fi

# ---- 6. Sudo askpass (optional) ----
echo "[6/7] Configuring sudo askpass helper..."
mkdir -p "$SCRIPT_DIR/scripts"
if [ ! -f "$SCRIPT_DIR/scripts/sudo-askpass.sh" ]; then
    cat > "$SCRIPT_DIR/scripts/sudo-askpass.sh" << 'ASKPASS_EOF'
#!/bin/bash
PW_FILE="${HOME}/.swarm_sudo"
if [ -f "$PW_FILE" ]; then
    cat "$PW_FILE"
else
    exit 1
fi
ASKPASS_EOF
    chmod +x "$SCRIPT_DIR/scripts/sudo-askpass.sh"
fi
echo "   Set SWARM_SUDO_PW in .env or create ~/.swarm_sudo (chmod 600) for non-interactive sudo."

# ---- 7. Watchdog cron ----
echo "[7/7] Installing watchdog cron job..."
WATCHDOG_CRON="*/5 * * * * cd $SCRIPT_DIR && ./scripts/watchdog.sh >> /tmp/watchdog.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "watchdog.sh"; then
    (crontab -l 2>/dev/null; echo "$WATCHDOG_CRON") | crontab -
    echo "   Watchdog cron installed (every 5 min)."
else
    echo "   Watchdog cron already installed."
fi

# ---- Done ----
echo ""
echo "=========================================="
echo " Setup complete!"
echo "   Node: $(node -v)"
echo "   NPM:  $(npm -v)"
echo "   Aider: $(aider --version 2>/dev/null || echo 'installed')"
echo "   Swap: $(free -h | grep Swap)"
echo ""
echo " Next steps:"
echo "   1. Set DEEPSEEK_API_KEY in .env"
echo "   2. (Optional) Set SWARM_SUDO_PW in .env or create ~/.swarm_sudo"
echo "   3. Run ./kickoff.sh to start the 24/7 swarm"
echo "=========================================="
