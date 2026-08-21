"""Repository and Git safety boundaries."""

from __future__ import annotations

import contextlib
import os
import re
import signal
import subprocess
import threading
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from openhands_factory.exceptions import RepositorySafetyError

CONFLICT_MARKER = re.compile(r"^(<<<<<<<|=======|>>>>>>>)", re.MULTILINE)
SAFE_BRANCH = re.compile(r"[^a-z0-9-]+")
_PROCESSES: set[subprocess.Popen[str]] = set()
_PROCESSES_LOCK = threading.Lock()
_ACCEPTING_PROCESSES = True


@dataclass(frozen=True)
class ProcessResult:
    returncode: int
    stdout: str
    stderr: str


class ProcessRunner(Protocol):
    def __call__(
        self, arguments: Sequence[str], cwd: Path, timeout: int = 300
    ) -> ProcessResult: ...


def run_process(
    arguments: Sequence[str],
    cwd: Path,
    timeout: int = 300,
    *,
    environment: Mapping[str, str] | None = None,
) -> ProcessResult:
    # A verification command can background a long-lived child of its own (e.g.
    # the frontend-e2e step's `npm start -- --host 127.0.0.1 &` dev server). A
    # plain subprocess.run(timeout=...) only kills the immediate bash child on
    # timeout - SIGKILL can never be trapped, so bash's own `trap ... EXIT`
    # cleanup never runs either, and the backgrounded server is orphaned
    # (reparented to init) rather than terminated, leaking memory indefinitely.
    # start_new_session puts the whole command in its own process group so it
    # can be killed as a unit regardless of how it exits.
    with _PROCESSES_LOCK:
        if not _ACCEPTING_PROCESSES:
            raise RuntimeError("Process start cancelled during Factory shutdown")
        process = subprocess.Popen(
            list(arguments),
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
            env=dict(environment) if environment is not None else None,
        )
        _PROCESSES.add(process)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        _kill_process_group(process)
        stdout, stderr = process.communicate()
        raise
    finally:
        _kill_process_group(process)
        with _PROCESSES_LOCK:
            _PROCESSES.discard(process)
    return ProcessResult(process.returncode, stdout, stderr)


def _kill_process_group(process: subprocess.Popen[str]) -> None:
    with contextlib.suppress(ProcessLookupError):
        os.killpg(process.pid, signal.SIGKILL)


def request_process_shutdown() -> None:
    """Block new repository children and terminate every active process group."""

    global _ACCEPTING_PROCESSES
    with _PROCESSES_LOCK:
        _ACCEPTING_PROCESSES = False
        processes = tuple(_PROCESSES)
    for process in processes:
        if process.poll() is not None:
            _kill_process_group(process)
            continue
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _kill_process_group(process)


def reset_process_shutdown() -> None:
    """Allow repository children for a newly activated daemon generation."""

    global _ACCEPTING_PROCESSES
    with _PROCESSES_LOCK:
        _ACCEPTING_PROCESSES = True


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


def ensure_push_target(branch: str, base_branch: str, *, extra_allowed: str | None = None) -> None:
    components = branch.split("/")
    invalid_ref = (
        not branch
        or branch == "@"
        or branch.startswith(("-", "."))
        or branch.endswith(("/", ".", ".lock"))
        or ".." in branch
        or "@{" in branch
        or "//" in branch
        or any(ord(character) < 32 or ord(character) == 127 for character in branch)
        or any(character in " ~^:?*[\\" for character in branch)
        or any(
            not component or component.startswith(".") or component.endswith(".lock")
            for component in components
        )
    )
    if invalid_ref:
        raise RepositorySafetyError(f"Unsafe Git branch name: {branch!r}")
    if branch in {base_branch, "main", "master"}:
        raise RepositorySafetyError(f"Direct push to protected branch {branch} is forbidden")
    if branch.startswith("factory/"):
        return
    # A job independently reviewing a pull request it did not create pushes repair
    # commits back to that pull request's own branch. extra_allowed is set by trusted
    # code from the tracked pull request's branch name, never from LLM output inside
    # the network-isolated worker, so this does not weaken the protected-branch check
    # above.
    if extra_allowed is not None and branch == extra_allowed:
        return
    raise RepositorySafetyError(
        "Factory may push only factory/* branches or its assigned pull request branch"
    )


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
