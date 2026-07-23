#!/bin/bash
# Update package list
apt update

# Install curl if not already installed
apt install -y curl

# Download and run the NodeSource setup script for Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js (includes npm)
apt install -y nodejs

# Verify installations
node --version
npm --version
