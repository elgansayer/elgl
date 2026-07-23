#!/bin/bash
set -e
# Ensure xz-utils is installed for tar -xJf
if ! command -v xz &> /dev/null; then
    echo "xz not found, installing xz-utils..."
    apt-get update -qq && apt-get install -y -qq xz-utils
fi
echo "Downloading Node.js v22.14.0..."
curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz -o /tmp/node.tar.xz
echo "Extracting..."
tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
rm /tmp/node.tar.xz
# Ensure /usr/local/bin is in PATH
export PATH="/usr/local/bin:$PATH"
echo "Verifying..."
node --version
npm --version
echo "Node.js and npm installed successfully."
