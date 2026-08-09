"""Repository and Git safety boundaries."""

from __future__ import annotations

import re
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from openhands_factory.exceptions import RepositorySafetyError

CONFLICT_MARKER = re.compile(r"^(<<<<<<<|=======|>>>>>>>)", re.MULTILINE)
SAFE_BRANCH = re.compile(r"[^a-z0-9-]+")


@dataclass(frozen=True)
class ProcessResult:
    returncode: int
    stdout: str
    stderr: str


class ProcessRunner(Protocol):
    def __call__(
        self, arguments: Sequence[str], cwd: Path, timeout: int = 300
    ) -> ProcessResult: ...


def run_process(arguments: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
    result = subprocess.run(
        list(arguments), cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False
    )
    return ProcessResult(result.returncode, result.stdout, result.stderr)


def verify_repository(
    path: Path, expected_remote: str, runner: ProcessRunner = run_process
) -> None:
    resolved = path.resolve()
    forbidden = {Path("/"), Path.home().resolve()}
    if resolved in forbidden or not (resolved / ".git").exists():
        raise RepositorySafetyError(f"Unverified repository path: {resolved}")
    remote = runner(("git", "remote", "get-url", "origin"), resolved)
    if remote.returncode != 0 or expected_remote not in remote.stdout.strip():
        raise RepositorySafetyError("Repository origin does not match GITHUB_REPOSITORY")


def branch_name(task_identifier: str, title: str) -> str:
    slug = SAFE_BRANCH.sub("-", title.lower()).strip("-")[:48].rstrip("-")
    identifier = SAFE_BRANCH.sub("-", task_identifier.lower()).strip("-")
    return f"factory/{identifier}-{slug}" if slug else f"factory/{identifier}"


def ensure_push_target(branch: str, base_branch: str) -> None:
    if branch in {base_branch, "main", "master"}:
        raise RepositorySafetyError(f"Direct push to protected branch {branch} is forbidden")
    if not branch.startswith("factory/"):
        raise RepositorySafetyError("Factory may push only factory/* branches")


def find_conflict_markers(root: Path) -> list[Path]:
    matches: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        try:
            if CONFLICT_MARKER.search(path.read_text(encoding="utf-8")):
                matches.append(path)
        except (UnicodeDecodeError, OSError):
            continue
    return matches
