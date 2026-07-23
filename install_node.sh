#!/bin/bash
set -e

# Define Node.js version and architecture
NODE_VERSION="20.11.0"
ARCH="x64"
OS="linux"

# Define installation directory
INSTALL_DIR="$HOME/node-v${NODE_VERSION}-${OS}-${ARCH}"

# Download Node.js binary if not already present
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Downloading Node.js v${NODE_VERSION}..."
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${OS}-${ARCH}.tar.xz" \
        -o /tmp/node.tar.xz

    echo "Extracting..."
    tar -xf /tmp/node.tar.xz -C "$HOME"

    # Clean up
    rm /tmp/node.tar.xz
    echo "Node.js extracted to $INSTALL_DIR"
else
    echo "Node.js already present at $INSTALL_DIR"
fi

# Add to PATH in ~/.bashrc if not already present
NODE_BIN="$INSTALL_DIR/bin"
if ! grep -q "export PATH=\$PATH:$NODE_BIN" "$HOME/.bashrc"; then
    echo "export PATH=\$PATH:$NODE_BIN" >> "$HOME/.bashrc"
    echo "Added $NODE_BIN to PATH in ~/.bashrc"
else
    echo "PATH entry already exists in ~/.bashrc"
fi

# Export for current session
export PATH="$PATH:$NODE_BIN"

# Verify installation
echo "Verifying installation..."
node --version
npm --version

# Run lint
echo "Running lint..."
cd backend
npm run lint
