#!/usr/bin/env bash
set -e

# Determine if we need sudo
if [ "$EUID" -ne 0 ]; then
    SUDO="sudo"
else
    SUDO=""
fi

# Update package list
$SUDO apt update

# Install curl if not already installed
$SUDO apt install -y curl

# Download and run the NodeSource setup script for Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -

# Install Node.js (includes npm)
$SUDO apt install -y nodejs

# Ensure npm is also installed (some minimal images may not include it)
$SUDO apt install -y npm

# Verify installations
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Source profile to update PATH in current shell (if needed)
if [ -f /etc/profile ]; then
    . /etc/profile
fi
