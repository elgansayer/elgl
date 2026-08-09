"""Git lifecycle that cannot push or merge a protected branch."""

from __future__ import annotations

import os
from pathlib import Path

from openhands_factory.exceptions import RepositorySafetyError
from openhands_factory.repository_guard import (
    ProcessRunner,
    branch_name,
    ensure_push_target,
    run_process,
)


class GitWorkflow:
    def __init__(
        self, repository: Path, base_branch: str, runner: ProcessRunner = run_process
    ) -> None:
        self.repository = repository
        self.base_branch = base_branch
        self.runner = runner

    def prepare_worktree(self, worktree: Path, task_id: str, title: str) -> str:
        branch = branch_name(task_id, title)
        ensure_push_target(branch, self.base_branch)
        fetch = self.runner(("git", "fetch", "origin", self.base_branch), self.repository)
        if fetch.returncode != 0:
            raise RepositorySafetyError(f"Could not fetch base branch: {fetch.stderr}")
        if worktree.exists():
            raise RepositorySafetyError(f"Task worktree already exists: {worktree}")
        result = self.runner(
            (
                "git",
                "worktree",
                "add",
                "-b",
                branch,
                str(worktree),
                f"origin/{self.base_branch}",
            ),
            self.repository,
        )
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not create worktree: {result.stderr}")
        for relative in (
            Path("node_modules"),
            Path("frontend/node_modules"),
            Path("backend/node_modules"),
            Path("e2e/node_modules"),
        ):
            source = self.repository / relative
            destination = worktree / relative
            if source.is_dir() and not destination.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                os.symlink(source, destination, target_is_directory=True)
        return branch

    def create_branch(self, task_id: str, title: str) -> str:
        branch = branch_name(task_id, title)
        ensure_push_target(branch, self.base_branch)
        result = self.runner(("git", "switch", "-c", branch), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not create branch: {result.stderr}")
        return branch

    def commit(self, message: str) -> None:
        if not message or ": " not in message:
            raise RepositorySafetyError("Commit message must use Conventional Commits")
        result = self.runner(("git", "commit", "-m", message), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Commit failed: {result.stderr}")

    def changed_paths(self) -> set[Path]:
        result = self.runner(
            ("git", "diff", "--name-only", f"origin/{self.base_branch}"), self.repository
        )
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not inspect changes: {result.stderr}")
        return {Path(line) for line in result.stdout.splitlines() if line.strip()}

    def stage_all(self) -> None:
        result = self.runner(("git", "add", "--all"), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not stage changes: {result.stderr}")

    def head_sha(self) -> str:
        result = self.runner(("git", "rev-parse", "HEAD"), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not resolve HEAD: {result.stderr}")
        return result.stdout.strip()

    def has_changes(self) -> bool:
        result = self.runner(("git", "status", "--porcelain"), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not inspect worktree: {result.stderr}")
        return bool(result.stdout.strip())

    def push(self, branch: str) -> None:
        ensure_push_target(branch, self.base_branch)
        result = self.runner(("git", "push", "--set-upstream", "origin", branch), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Push failed: {result.stderr}")

    def remove_worktree(self, worktree: Path) -> None:
        resolved_root = self.repository.parent.resolve()
        resolved_worktree = worktree.resolve()
        if not resolved_worktree.is_relative_to(resolved_root):
            raise RepositorySafetyError("Refusing to remove a worktree outside the factory root")
        result = self.runner(
            ("git", "worktree", "remove", str(resolved_worktree)), self.repository
        )
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not remove worktree: {result.stderr}")
