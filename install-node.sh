#!/bin/bash
set -e  # Exit on first error

# Ignore any arguments passed to this script (e.g. when called as "npm run lint install-node.sh")
# The script always performs the same actions regardless of arguments.
shift $# 2>/dev/null || true

# Ensure the script itself is executable (in case it was not)
chmod +x "$0"

# Determine the directory where this script resides
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if npm is already available. If yes, skip installation and just run lint.
if command -v npm &> /dev/null; then
    echo "npm is already available. Skipping Node.js installation."
    cd "$SCRIPT_DIR/backend"
    npm run lint
    exit 0
fi

# If npm is not available, this script will install Node.js and npm.
# After installation, it will run the lint command.

# Ensure xz-utils is installed for tar -xJf
if ! command -v xz &> /dev/null; then
    echo "xz not found, installing xz-utils..."
    apt-get update -qq
    apt-get install -y -qq xz-utils
fi

# Ensure curl is installed for downloading Node.js
if ! command -v curl &> /dev/null; then
    echo "curl not found, installing curl..."
    apt-get update -qq
    apt-get install -y -qq curl
fi

# Download Node.js v22.14.0 (LTS)
echo "Downloading Node.js v22.14.0..."
curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz -o /tmp/node.tar.xz

echo "Extracting..."
tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
rm /tmp/node.tar.xz

# Ensure /usr/local/bin is in PATH for this session
export PATH="/usr/local/bin:$PATH"

# Persist PATH in ~/.bashrc so that future shell sessions also have /usr/local/bin
if [ ! -f ~/.bashrc ] || ! grep -q 'export PATH="/usr/local/bin:$PATH"' ~/.bashrc 2>/dev/null; then
    touch ~/.bashrc
    echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
fi

# Source the updated bashrc so the current shell also sees the change
. ~/.bashrc 2>/dev/null || true

# Verify npm is accessible
echo "Verifying npm is accessible..."
which npm

# Ensure /usr/local/bin is in PATH for subsequent commands (in case sourcing failed)
export PATH="/usr/local/bin:$PATH"

echo "Verifying..."
node --version
npm --version
echo "Node.js and npm installed successfully."

# Install backend dependencies before linting
echo "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
if [ ! -f package.json ]; then
    echo "Error: backend/package.json not found. Cannot install dependencies."
    exit 1
fi
npm install

# Now run lint in backend
npm run lint
echo "Lint completed."

# Ensure PATH is exported for the parent shell (if sourced)
echo ""
echo "If you need to run 'npm' commands manually in this shell, run:"
echo "  export PATH=\"/usr/local/bin:\$PATH\""
echo "Or source your bashrc:"
echo "  source ~/.bashrc"

# Persist PATH globally so that non‑interactive shells also find npm
if [ "$(id -u)" -eq 0 ]; then
    if ! grep -q '/usr/local/bin' /etc/environment 2>/dev/null; then
        echo 'PATH="/usr/local/bin:$PATH"' >> /etc/environment
        echo "Global PATH updated in /etc/environment."
    fi
fi
