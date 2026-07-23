#!/bin/bash
# Update package list
apt update

# Install curl if not already installed
apt install -y curl

# Download and execute the NodeSource setup script for Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js (includes npm)
apt install -y nodejs

# Refresh command hash table to make npm available in this shell
hash -r

# Verify installations
node --version
npm --version

# Change to backend directory and run lint
cd backend && npm run lint
