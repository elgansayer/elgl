#!/usr/bin/env bash
set -e

# Determine if we need sudo
if [ "$EUID" -ne 0 ]; then
    SUDO="sudo"
else
    SUDO=""
fi

# Check if apt is available; if not, try apk (Alpine) or yum (RHEL)
if command -v apt &>/dev/null; then
    PKG_MANAGER="apt"
    INSTALL_CMD="$SUDO apt install -y"
    UPDATE_CMD="$SUDO apt update"
elif command -v apk &>/dev/null; then
    PKG_MANAGER="apk"
    INSTALL_CMD="$SUDO apk add"
    UPDATE_CMD="$SUDO apk update"
elif command -v yum &>/dev/null; then
    PKG_MANAGER="yum"
    INSTALL_CMD="$SUDO yum install -y"
    UPDATE_CMD="$SUDO yum check-update"
else
    echo "No supported package manager found (apt, apk, yum). Exiting."
    exit 1
fi

# Update package list
$UPDATE_CMD

# Install curl if not already installed
$INSTALL_CMD curl

# Download and run the NodeSource setup script for Node.js 20.x (LTS)
# Note: NodeSource script only supports apt-based systems.
if [ "$PKG_MANAGER" = "apt" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
    $INSTALL_CMD nodejs
    # Ensure npm is also installed (some minimal images may not include it)
    $INSTALL_CMD npm
else
    # For non-apt systems, install Node.js via the package manager directly
    $INSTALL_CMD nodejs npm
fi

# Verify installations
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Source profile to update PATH in current shell (if needed)
if [ -f /etc/profile ]; then
    . /etc/profile
fi

# Ensure npm is in PATH for subsequent commands
export PATH="$PATH:/usr/bin:/usr/local/bin"
