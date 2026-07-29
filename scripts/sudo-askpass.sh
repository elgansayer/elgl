#!/bin/bash
# sudo-askpass.sh - reads sudo password from ~/.swarm_sudo for non-interactive use.
# Set SUDO_ASKPASS to this script in the swarm environment.
PW_FILE="${HOME}/.swarm_sudo"
if [ -f "$PW_FILE" ]; then
    cat "$PW_FILE"
else
    exit 1
fi
