#!/bin/bash
# setup.sh

set -e

echo "Updating system and installing dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl tmux python3 python3-venv python3-pip

echo "Checking SSH keys for GitHub access..."
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -b 4096 -C "vps-agent" -N "" -f ~/.ssh/id_rsa
    echo "========================================================"
    echo "ACTION REQUIRED: Add this SSH key to your GitHub account"
    echo "========================================================"
    cat ~/.ssh/id_rsa.pub
    echo "========================================================"
    read -p "Press [Enter] after you have added the key to GitHub..."
fi

# Add GitHub to known hosts to prevent interactive prompts
mkdir -p ~/.ssh
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

echo "Cloning the repository..."
WORKSPACE="$HOME/hellotalk"
if [ ! -d "$WORKSPACE" ]; then
    git clone git@github.com:elgansayer/hellotalk.git "$WORKSPACE"
else
    echo "Repository already exists."
fi

echo "Configuring DeepSeek API..."
read -p "Enter your DeepSeek API Key: " API_KEY
echo "export DEEPSEEK_API_KEY=\"$API_KEY\"" >> ~/.bashrc
export DEEPSEEK_API_KEY="$API_KEY"

echo "Installing Aider (AI Coding Agent)..."
curl -LsSf https://aider.chat/install.sh | sh

echo "========================================================"
echo "Setup Complete! Here is how to start your 24/7 session:"
echo "1. Open a persistent session: tmux new -s builder"
echo "2. Navigate to your project: cd ~/hellotalk"
echo "3. Start the agent: aider --model deepseek/deepseek-v4-pro"
echo "4. Tell the agent: 'Read the SPEC.md and complete Phase 1 of TODO.md'"
echo "5. Press Ctrl+B, then D to safely detach and leave it running."
echo "========================================================"
