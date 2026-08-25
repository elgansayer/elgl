"""Git lifecycle that cannot push or merge a protected branch."""

from __future__ import annotations

import hashlib
import os
import shutil
import time
from collections.abc import Sequence
from datetime import UTC, datetime
from functools import partial
from pathlib import Path

from openhands_factory.exceptions import RepositorySafetyError
from openhands_factory.repository_guard import (
    ProcessResult,
    ProcessRunner,
    branch_name,
    ensure_push_target,
    run_process,
)

# Every worktree shares one git dir (worktrees/, objects/, config, refs) in the base
# repository. With FACTORY_MAX_PARALLEL_JOBS > 1, workers routinely run `git fetch`,
# `git worktree add/remove`, and `git push` against that same shared git dir at the
# same time. Git's own advisory locks (config.lock, index.lock, packed-refs.lock,
# the worktrees/ directory itself) are short-lived - held only for the duration of
# the single operation that needs them - so a lock collision means the operation
# was never attempted, not that it partially ran; retrying is safe.
_LOCK_CONTENTION_MARKERS = ("could not lock", "unable to create", "already exists")
_GIT_ENVIRONMENT_ALLOWLIST = {
    "GIT_SSH_COMMAND",
    "HOME",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "LANG",
    "LC_ALL",
    "NO_PROXY",
    "PATH",
    "SSH_AUTH_SOCK",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "XDG_CONFIG_HOME",
}


def _authenticated_git_environment(token: str) -> dict[str, str]:
    environment = {key: os.environ[key] for key in _GIT_ENVIRONMENT_ALLOWLIST if key in os.environ}
    environment.setdefault("HOME", str(Path.home()))
    environment.setdefault("PATH", "/usr/local/bin:/usr/bin:/bin")
    environment.setdefault("LANG", "C.UTF-8")
    # The configured gh credential helper reads this only in the short-lived Git
    # process. Providers and repository verification never inherit it.
    environment["GH_TOKEN"] = token
    return environment


def _is_lock_contention(stderr: str) -> bool:
    lowered = stderr.lower()
    if "could not lock" in lowered:
        return True
    return ".lock" in lowered and any(marker in lowered for marker in _LOCK_CONTENTION_MARKERS)


def _run_with_lock_retry(
    runner: ProcessRunner,
    arguments: Sequence[str],
    cwd: Path,
    *,
    attempts: int = 5,
    base_delay: float = 0.5,
) -> ProcessResult:
    result = runner(tuple(arguments), cwd)
    tries = 1
    while result.returncode != 0 and tries < attempts and _is_lock_contention(result.stderr):
        time.sleep(base_delay * tries)
        result = runner(tuple(arguments), cwd)
        tries += 1
    return result


class GitWorkflow:
    def __init__(
        self,
        repository: Path,
        base_branch: str,
        runner: ProcessRunner | None = None,
        *,
        external_branch: str | None = None,
        github_token: str | None = None,
    ) -> None:
        self.repository = repository
        self.base_branch = base_branch
        self.runner: ProcessRunner
        if runner is None and github_token is not None:
            self.runner = partial(
                run_process,
                environment=_authenticated_git_environment(github_token),
            )
        else:
            self.runner = runner or run_process
        # Set only for a job independently reviewing a pull request it did not create.
        # Allows push() to target that pull request's own branch instead of a fresh
        # factory/* one. See ensure_push_target for why this is safe.
        self.external_branch = external_branch

    def prepare_worktree(self, worktree: Path, task_id: str, title: str) -> str:
        branch = branch_name(task_id, title)
        ensure_push_target(branch, self.base_branch)
        fetch = _run_with_lock_retry(
            self.runner, ("git", "fetch", "origin", self.base_branch), self.repository
        )
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
        ensure_push_target(branch, self.base_branch, extra_allowed=branch)
        fetch = _run_with_lock_retry(
            self.runner, ("git", "fetch", "origin", branch), self.repository
        )
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
        result = _run_with_lock_retry(
            self.runner,
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
            Path("admin-portal/node_modules"),
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
        paths = {Path(line) for line in result.stdout.splitlines() if line.strip()}
        # `git diff` never reports untracked files, only modifications to tracked
        # ones - but has_changes() (git status --porcelain) counts a new untracked
        # file as a change too. Without this, a task whose only output is a new
        # file would pass the has_changes() gate right after implementation, burn a
        # full security-review cycle, and only then fail verification with a
        # confusing "no changed paths" error instead of being judged - correctly -
        # on the file it actually added.
        untracked = self.runner(
            ("git", "ls-files", "--others", "--exclude-standard"), self.repository
        )
        if untracked.returncode != 0:
            raise RepositorySafetyError(f"Could not inspect changes: {untracked.stderr}")
        paths.update(Path(line) for line in untracked.stdout.splitlines() if line.strip())
        return paths

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

    def change_fingerprint(self) -> str:
        """Return a content-sensitive identity for every uncommitted change.

        Repair phases often start with an already-dirty implementation. A plain
        ``git status`` check cannot prove that a repair provider added anything.
        This fingerprint covers tracked paths, modes, deletions and every
        untracked file without loading file contents into the Factory process.
        """
        raw = self.runner(
            ("git", "diff", "--raw", "--no-renames", "-z", "HEAD", "--"),
            self.repository,
        )
        if raw.returncode != 0:
            raise RepositorySafetyError(f"Could not fingerprint changes: {raw.stderr}")
        tracked = self.runner(
            ("git", "diff", "--name-only", "--no-renames", "-z", "HEAD", "--"),
            self.repository,
        )
        if tracked.returncode != 0:
            raise RepositorySafetyError(f"Could not fingerprint changes: {tracked.stderr}")
        untracked = self.runner(
            ("git", "ls-files", "--others", "--exclude-standard", "-z"),
            self.repository,
        )
        if untracked.returncode != 0:
            raise RepositorySafetyError(f"Could not fingerprint changes: {untracked.stderr}")

        digest = hashlib.sha256()
        digest.update(raw.stdout.encode("utf-8"))
        paths = {
            path for path in (*tracked.stdout.split("\0"), *untracked.stdout.split("\0")) if path
        }
        for relative in sorted(paths):
            digest.update(relative.encode("utf-8"))
            absolute = self.repository / relative
            if not os.path.lexists(absolute):
                digest.update(b"<deleted>")
                continue
            stat = os.lstat(absolute)
            digest.update(str(stat.st_mode).encode("ascii"))
            object_hash = self.runner(
                ("git", "hash-object", "--no-filters", "--", relative),
                self.repository,
            )
            if object_hash.returncode != 0:
                # git hash-object only hashes blobs; it cannot hash a directory, and
                # some filesystems/git versions can report an entire untracked
                # directory (rather than each file within it) as a single changed
                # path, or an unusual entry (a broken symlink, socket, device file)
                # that git otherwise declines to hash. The fingerprint's job is
                # change detection, not exact content identity, so fall back to
                # size/mtime rather than letting one unusual path hard-fail the
                # whole task and force a quarantine over something that was never
                # a real safety problem.
                digest.update(b"<unhashable>")
                digest.update(str(stat.st_size).encode("ascii"))
                digest.update(str(stat.st_mtime_ns).encode("ascii"))
                continue
            digest.update(object_hash.stdout.strip().encode("ascii"))
        return digest.hexdigest()

    def committed_change_fingerprint(self) -> str:
        """Identify the resulting blobs for the branch diff, independent of rebases."""

        paths = self.changed_paths()
        if not paths:
            raise RepositorySafetyError("No changed paths were found")
        digest = hashlib.sha256()
        for path in sorted(paths):
            relative = path.as_posix()
            digest.update(relative.encode("utf-8"))
            digest.update(b"\0")
            result = self.runner(("git", "rev-parse", f"HEAD:{relative}"), self.repository)
            if result.returncode == 0:
                digest.update(result.stdout.strip().encode("ascii"))
            else:
                digest.update(b"<deleted>")
            digest.update(b"\0")
        return digest.hexdigest()

    def push(self, branch: str) -> None:
        ensure_push_target(branch, self.base_branch, extra_allowed=self.external_branch)
        result = _run_with_lock_retry(
            self.runner,
            (
                "git",
                "push",
                "--set-upstream",
                "origin",
                f"HEAD:refs/heads/{branch}",
            ),
            self.repository,
        )
        if result.returncode != 0:
            raise RepositorySafetyError(f"Push failed: {result.stderr}")

    def sync_remote_branch(self, branch: str, expected_head_sha: str) -> None:
        """Replace a Factory branch only while its inspected remote head is unchanged."""

        ensure_push_target(branch, self.base_branch)
        reference = f"refs/heads/{branch}"
        remote = self.runner(("git", "ls-remote", "--heads", "origin", reference), self.repository)
        if remote.returncode != 0:
            raise RepositorySafetyError(f"Could not inspect remote branch: {remote.stderr}")
        current_sha = ""
        for line in remote.stdout.splitlines():
            sha, separator, observed_ref = line.partition("\t")
            if separator and observed_ref == reference:
                current_sha = sha
                break
        if current_sha and current_sha != expected_head_sha:
            raise RepositorySafetyError(
                f"Remote branch {branch} moved after pull-request inspection"
            )
        result = _run_with_lock_retry(
            self.runner,
            (
                "git",
                "push",
                f"--force-with-lease={reference}:{current_sha}",
                "origin",
                f"HEAD:{reference}",
            ),
            self.repository,
        )
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not update canonical PR branch: {result.stderr}")

    def delete_remote_branch(self, branch: str, expected_head_sha: str) -> None:
        """Delete an exact Factory branch tip after another PR becomes canonical."""

        ensure_push_target(branch, self.base_branch)
        reference = f"refs/heads/{branch}"
        remote = self.runner(("git", "ls-remote", "--heads", "origin", reference), self.repository)
        if remote.returncode != 0:
            raise RepositorySafetyError(f"Could not inspect remote branch: {remote.stderr}")
        current_sha = ""
        for line in remote.stdout.splitlines():
            sha, separator, observed_ref = line.partition("\t")
            if separator and observed_ref == reference:
                current_sha = sha
                break
        if not current_sha:
            return
        if current_sha != expected_head_sha:
            raise RepositorySafetyError(f"Remote branch {branch} moved before cleanup")
        result = _run_with_lock_retry(
            self.runner,
            (
                "git",
                "push",
                f"--force-with-lease={reference}:{expected_head_sha}",
                "origin",
                f":{reference}",
            ),
            self.repository,
        )
        if result.returncode != 0:
            raise RepositorySafetyError(f"Could not delete duplicate branch: {result.stderr}")

    def remove_worktree(self, worktree: Path, *, force: bool = False) -> None:
        resolved_root = self.repository.parent.resolve()
        resolved_worktree = worktree.resolve()
        if not resolved_worktree.is_relative_to(resolved_root):
            raise RepositorySafetyError("Refusing to remove a worktree outside the factory root")
        arguments = ["git", "worktree", "remove"]
        if force:
            arguments.append("--force")
        arguments.append(str(resolved_worktree))
        result = _run_with_lock_retry(self.runner, tuple(arguments), self.repository)
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
