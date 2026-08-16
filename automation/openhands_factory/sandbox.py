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
        triage_tags: frozenset[str] = frozenset(),
    ) -> None:
        self.worktree = worktree.resolve()
        self.image = image

        # Default limits
        self.memory = "2g"
        self.cpus = 1.0

        # Dynamic sizing based on triage tags
        if "deep-refactor" in triage_tags:
            self.memory = "4g"
            self.cpus = 2.0
        elif "ci-fix" in triage_tags:
            self.memory = "1g"
            self.cpus = 0.5
        elif "terminal-task" in triage_tags:
            self.memory = "2g"
            self.cpus = 1.0

    def get_podman_cmd(self, cmd: list[str]) -> list[str]:
        """Return the full Podman command array."""
        return [
            "podman",
            "run",
            "--rm",
            "--memory",
            self.memory,
            "--cpus",
            str(self.cpus),
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
