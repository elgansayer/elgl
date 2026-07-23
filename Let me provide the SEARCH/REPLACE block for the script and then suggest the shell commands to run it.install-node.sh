#!/bin/bash
set -e
echo "Downloading Node.js v22.14.0..."
curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz -o /tmp/node.tar.xz
echo "Extracting..."
tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
rm /tmp/node.tar.xz
echo "Verifying..."
node --version
npm --version
echo "Node.js and npm installed successfully."
