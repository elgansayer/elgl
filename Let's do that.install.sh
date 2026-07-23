#!/bin/bash
# Update package list and install Node.js and npm
apt update && apt install -y nodejs npm

# Verify installation
node --version && npm --version
