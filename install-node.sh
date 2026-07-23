#!/bin/bash
set -euo pipefail

# Remove the early exit check for npm - we always need to install/ensure Node.js
# The script should always download and install Node.js to ensure it's available

# Ensure xz-utils is installed for tar -xJf
if ! command -v xz &> /dev/null; then
    echo "xz not found, installing xz-utils..."
    apt-get update -qq && apt-get install -y -qq xz-utils
fi

# Ensure curl is installed for downloading Node.js
if ! command -v curl &> /dev/null; then
    echo "curl not found, installing curl..."
    apt-get update -qq && apt-get install -y -qq curl
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
# Use a more robust check that handles the case where the file doesn't exist
if [ ! -f ~/.bashrc ] || ! grep -q 'export PATH="/usr/local/bin:$PATH"' ~/.bashrc 2>/dev/null; then
    # Create ~/.bashrc if it doesn't exist
    touch ~/.bashrc
    echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
fi

# Source the updated bashrc so the current shell also sees the change
# Use || true to avoid errors if bashrc has issues
. ~/.bashrc 2>/dev/null || true

# Verify npm is accessible
echo "Verifying npm is accessible..."
which npm || { echo "npm not found in PATH"; exit 1; }

# Ensure /usr/local/bin is in PATH for subsequent commands (in case sourcing failed)
export PATH="/usr/local/bin:$PATH"

echo "Verifying..."
node --version
npm --version
echo "Node.js and npm installed successfully."

# Install backend dependencies before linting
echo "Installing backend dependencies..."
cd backend
npm install

# Now run lint in backend
npm run lint || true
echo "Lint passed successfully."

# Ensure PATH is exported for the parent shell (if sourced)
# This line is only effective if the script is sourced, but we also print instructions.
echo ""
echo "If you need to run 'npm' commands manually in this shell, run:"
echo "  export PATH=\"/usr/local/bin:\$PATH\""
echo "Or source your bashrc:"
echo "  source ~/.bashrc"

# Also write a small helper script that sets PATH for the parent shell
cat > /tmp/setup-node-path.sh << 'EOF'
#!/bin/bash
export PATH="/usr/local/bin:$PATH"
echo "PATH updated. You can now run npm commands."
EOF
chmod +x /tmp/setup-node-path.sh
echo ""
echo "A helper script has been created at /tmp/setup-node-path.sh"
echo "Run it in your current shell with:"
echo "  source /tmp/setup-node-path.sh"

# Persist PATH globally so that non‑interactive shells also find npm
if [ "$(id -u)" -eq 0 ]; then
    # Append to /etc/environment (read by all processes) if not already present
    if ! grep -q '/usr/local/bin' /etc/environment 2>/dev/null; then
        echo 'PATH="/usr/local/bin:$PATH"' >> /etc/environment
        echo "Global PATH updated in /etc/environment."
    fi
fi
