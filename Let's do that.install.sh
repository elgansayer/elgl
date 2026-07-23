#!/bin/bash
# Ensure script is run with bash
if [ -z "$BASH_VERSION" ]; then
    echo "This script must be run with bash." >&2
    exit 1
fi

# Check if running as root, if not use sudo
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo." >&2
    exit 1
fi

# Update package list and install Node.js and npm
apt update && apt install -y nodejs npm

# Verify installation
node --version && npm --version

# Now run the lint command in the backend directory
cd backend && npm run lint

# Now run the lint command in the backend directory
cd backend && npm run lint
