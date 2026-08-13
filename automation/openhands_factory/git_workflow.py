"""Git lifecycle that cannot push or merge a protected branch."""

from __future__ import annotations

import os
import shutil
from datetime import UTC, datetime
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
        self,
        repository: Path,
        base_branch: str,
        runner: ProcessRunner = run_process,
        *,
        external_branch: str | None = None,
    ) -> None:
        self.repository = repository
        self.base_branch = base_branch
        self.runner = runner
        # Set only for a job independently reviewing a pull request it did not create.
        # Allows push() to target that pull request's own branch instead of a fresh
        # factory/* one. See ensure_push_target for why this is safe.
        self.external_branch = external_branch

    def prepare_worktree(self, worktree: Path, task_id: str, title: str) -> str:
        branch = branch_name(task_id, title)
        ensure_push_target(branch, self.base_branch)
        fetch = self.runner(("git", "fetch", "origin", self.base_branch), self.repository)
        if fetch.returncode != 0:
            raise RepositorySafetyError(f"Could not fetch base branch: {fetch.stderr}")
        self._add_worktree(worktree, branch, f"origin/{self.base_branch}")
        return branch

    def prepare_pull_request_worktree(self, worktree: Path, branch: str) -> None:
        """Check out an existing pull request branch for independent review.

        Unlike prepare_worktree, this tracks a branch the factory did not create and
        does not own the naming of - it exists to review and, if necessary, repair
        someone else's pull request in place.
        """
        fetch = self.runner(("git", "fetch", "origin", branch), self.repository)
        if fetch.returncode != 0:
            raise RepositorySafetyError(f"Could not fetch pull request branch: {fetch.stderr}")
        self._add_worktree(worktree, branch, f"origin/{branch}")

    def _add_worktree(self, worktree: Path, branch: str, start_point: str) -> None:
        if worktree.exists():
            raise RepositorySafetyError(f"Task worktree already exists: {worktree}")
        existing_branch = self.runner(
            ("git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"),
            self.repository,
        )
        if existing_branch.returncode == 0:
            remove_branch = self.runner(("git", "branch", "-D", branch), self.repository)
            if remove_branch.returncode != 0:
                raise RepositorySafetyError(
                    f"Could not reclaim stale local branch {branch}: {remove_branch.stderr}"
                )
        result = self.runner(
            ("git", "worktree", "add", "-b", branch, str(worktree), start_point),
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
        ensure_push_target(branch, self.base_branch, extra_allowed=self.external_branch)
        result = self.runner(("git", "push", "--set-upstream", "origin", branch), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Push failed: {result.stderr}")

    def remove_worktree(self, worktree: Path, *, force: bool = False) -> None:
        resolved_root = self.repository.parent.resolve()
        resolved_worktree = worktree.resolve()
        if not resolved_worktree.is_relative_to(resolved_root):
            raise RepositorySafetyError("Refusing to remove a worktree outside the factory root")
        arguments = ["git", "worktree", "remove"]
        if force:
            arguments.append("--force")
        arguments.append(str(resolved_worktree))
        result = self.runner(tuple(arguments), self.repository)
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not remove worktree: {result.stderr}")

    def archive_worktree(self, worktree: Path, recovery_root: Path) -> Path:
        """Copy a dirty worktree before it is retired during durable recovery."""
        resolved_root = self.repository.parent.resolve()
        resolved_worktree = worktree.resolve()
        resolved_recovery = recovery_root.resolve()
        if not resolved_worktree.is_relative_to(resolved_root):
            raise RepositorySafetyError("Refusing to archive a worktree outside the factory root")
        if resolved_recovery == resolved_worktree or resolved_recovery.is_relative_to(
            resolved_worktree
        ):
            raise RepositorySafetyError("Recovery directory cannot be inside the worktree")
        resolved_recovery.mkdir(parents=True, exist_ok=False)
        shutil.copytree(resolved_worktree, resolved_recovery, symlinks=True, dirs_exist_ok=True)
        (resolved_recovery / "RECOVERY.txt").write_text(
            "This is a preserved OpenHands worktree archive. The original Git worktree "
            "registration was removed after the daemon could no longer safely retire it.\n"
            f"Archived at: {datetime.now(UTC).isoformat()}\n",
            encoding="utf-8",
        )
        return resolved_recovery
