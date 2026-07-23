#!/bin/bash
# Install Node.js 20.x LTS and npm using NodeSource setup script

# Determine if sudo is available
if command -v sudo &> /dev/null; then
    SUDO="sudo"
else
    SUDO=""
fi

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
$SUDO apt-get install -y nodejs

# Verify installations
node --version
npm --version

# Refresh command hash table to make npm available in this shell
hash -r

# Use a login shell to ensure npm is in PATH, then run lint
exec bash -l -c 'cd backend && npm run lint'
