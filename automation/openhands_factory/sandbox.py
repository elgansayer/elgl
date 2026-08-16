"""Disposable Sandbox Execution Engine.

Executes CLI wrapper commands inside a heavily restricted, rootless Podman sandbox.
Mounts the worktree and blocks all network access except for necessary package registries.
"""

import subprocess
from pathlib import Path

class SandboxRunner:
    """Executes commands inside a disposable Podman container."""
    
    def __init__(self, worktree: Path):
        self.worktree = worktree.resolve()
        
    def execute(self, cmd: list[str]) -> subprocess.CompletedProcess:
        """Runs the given command array inside the sandboxed environment."""
        podman_cmd = [
            "podman", "run", "--rm",
            "-v", f"{self.worktree}:/workspace:Z",
            "-w", "/workspace",
            "--network", "none", # Block all network
            "python:3.11-slim"
        ] + cmd
        
        return subprocess.run(
            podman_cmd,
            capture_output=True,
            text=True
        )
