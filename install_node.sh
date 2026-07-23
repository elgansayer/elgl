#!/bin/bash
# Install Node.js 20.x LTS and npm using NodeSource setup script
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node --version
npm --version
