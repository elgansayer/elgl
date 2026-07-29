#!/bin/bash
# setup-vps.sh - Interactive VPS bootstrap (asks for keys, then delegates to setup-debian.sh).
#
# What it does:
#   1. SSH keygen + GitHub known hosts
#   2. Clones the repo (or pulls)
#   3. Prompts for DeepSeek API key
#   4. Prompts for optional sudo password
#   5. Runs setup-debian.sh
#   6. Starts the swarm via kickoff.sh
set -e

echo "========================================================"
echo " HelloTalk VPS Setup (interactive) "
echo "========================================================"

# ---- 1. SSH keys ----
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -b 4096 -C "vps-agent" -N "" -f ~/.ssh/id_rsa
    echo ""
    echo "========================================================"
    echo " ACTION REQUIRED: Add this SSH key to GitHub"
    echo "   https://github.com/settings/keys"
    echo "========================================================"
    cat ~/.ssh/id_rsa.pub
    echo "========================================================"
    read -rp "Press Enter after adding the key to GitHub..."
fi
mkdir -p ~/.ssh
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts 2>/dev/null || true

# ---- 2. Clone repo ----
REPO_OWNER="${SWARM_REPO_OWNER:-elgansayer}"
REPO_NAME="${SWARM_REPO_NAME:-hellotalk}"
WORKSPACE="$HOME/$REPO_NAME"
if [ ! -d "$WORKSPACE" ]; then
    echo "Cloning repository..."
    git clone "git@github.com:${REPO_OWNER}/${REPO_NAME}.git" "$WORKSPACE"
else
    echo "Repository exists, pulling latest..."
    (cd "$WORKSPACE" && git pull origin main 2>/dev/null || true)
fi

cd "$WORKSPACE"

# ---- 3. API keys ----
echo ""
read -rp "Enter your DeepSeek API Key (or press Enter to skip): " DEEPSEEK_KEY
if [ -n "$DEEPSEEK_KEY" ]; then
    if ! grep -q 'DEEPSEEK_API_KEY' .env 2>/dev/null; then
        echo "DEEPSEEK_API_KEY=$DEEPSEEK_KEY" >> .env
    fi
    export DEEPSEEK_API_KEY="$DEEPSEEK_KEY"
    echo "   DeepSeek key saved to .env."
fi

read -rp "Enter sudo password for non-interactive apt installs (or press Enter to skip): " SUDO_PW
if [ -n "$SUDO_PW" ]; then
    echo "$SUDO_PW" > ~/.swarm_sudo
    chmod 600 ~/.swarm_sudo
    if ! grep -q 'SWARM_SUDO_PW' .env 2>/dev/null; then
        echo "SWARM_SUDO_PW=$SUDO_PW" >> .env
    fi
    echo "   Sudo password saved."
fi

# ---- 4. Run automated setup ----
echo ""
read -rp "Run automated Debian setup now? (installs pkgs, swap, node, deps, cron) [Y/n]: " REPLY
if [ "$REPLY" != "n" ] && [ "$REPLY" != "N" ]; then
    bash "$WORKSPACE/setup-debian.sh"
fi

# ---- 5. Start the swarm ----
echo ""
read -rp "Start the 24/7 AI swarm now? [Y/n]: " REPLY
if [ "$REPLY" != "n" ] && [ "$REPLY" != "N" ]; then
    bash "$WORKSPACE/kickoff.sh"
fi

echo ""
echo "========================================================"
echo " All done. Useful commands:"
echo "   tmux attach -t ai_swarm       # watch the swarm live"
echo "   ./scripts/watchdog.sh          # manual stall check"
echo "   ./kickoff.sh                   # restart the swarm"
echo "   tmux kill-session -t ai_swarm  # stop everything"
echo "========================================================"
