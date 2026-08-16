"""Disposable Sandbox Execution Engine.

Executes CLI wrapper commands inside a heavily restricted, rootless Podman sandbox.
Mounts the worktree and blocks all network access except for necessary package registries.
"""

import subprocess
from pathlib import Path


class SandboxRunner:
    """Execute commands inside a disposable Podman container."""

    def __init__(
        self,
        worktree: Path,
        image: str = "localhost/hellotalk-factory-worker:current",
    ) -> None:
        self.worktree = worktree.resolve()
        self.image = image

    def get_podman_cmd(self, cmd: list[str]) -> list[str]:
        """Return the full Podman command array."""
        return [
            "podman",
            "run",
            "--rm",
            "-v",
            f"{self.worktree}:/workspace:Z",
            "-w",
            "/workspace",
            "--network",
            "none",
            self.image,
            *cmd,
        ]

    def execute(self, cmd: list[str]) -> subprocess.CompletedProcess[str]:
        """Run the given command array inside the sandboxed environment."""
        podman_cmd = self.get_podman_cmd(cmd)

        return subprocess.run(
            podman_cmd,
            capture_output=True,
            text=True,
            check=False,
        )
