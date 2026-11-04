"""SDK-free worker container arguments and bounded error classification."""

from __future__ import annotations

import os
from pathlib import Path


def podman_run_arguments(
    workspace: Path,
    repository: Path,
    image: str,
    command: str,
    *,
    workspace_access: str = "rw",
    pids_limit: int = 512,
    memory_limit: str = "3g",
    cpu_limit: str = "2",
    resource_limits: bool = True,
    userns: str = "keep-id",
    cgroup_manager: str | None = None,
    cgroups: str | None = None,
) -> list[str]:
    """Build the common constrained worker-container command line."""
    # The image's default user ("worker") is an arbitrary numeric uid unrelated to
    # the host - --userns=keep-id only maps host uid <-> container uid values, it
    # does not change which uid the container's process actually runs as. Without
    # --user pinning it to the daemon's own uid, every worktree file and the shared
    # .git metadata (created with a restrictive 0600/0700 umask) is unreadable from
    # inside the container even though it's bind-mounted read-write.
    uid = os.getuid()
    gid = os.getgid()
    arguments = [
        "run",
        "--rm",
        "--network=none",
        "--security-opt=no-new-privileges",
        "--cap-drop=all",
        f"--userns={userns}",
        f"--user={uid}:{gid}",
        "--volume",
        # Mounted at the SAME absolute path it has on the host, not a generic
        # /workspace alias: the file_editor tool (ContainedFileEditorExecutor,
        # below) reports and accepts real host paths, since it edits the
        # filesystem directly rather than through this container. A mismatched
        # alias here means every path the agent sees from file_editor is one it
        # cannot find from the terminal tool, or vice versa - confirmed live: an
        # agent that created a file via file_editor, then tried `ls` on that exact
        # reported path from the terminal, got "No such file or directory" and
        # burned its whole conversation debugging a nonexistent permission issue
        # instead of finishing its actual task.
        f"{workspace}:{workspace}:{workspace_access},Z",
    ]
    if cgroup_manager:
        arguments.insert(1, f"--cgroup-manager={cgroup_manager}")
    if cgroups:
        arguments.insert(1, f"--cgroups={cgroups}")
    if resource_limits:
        arguments[3:3] = [
            f"--pids-limit={pids_limit}",
            f"--memory={memory_limit}",
            f"--cpus={cpu_limit}",
        ]
    # A task worktree's .git is a file pointing at an absolute host path under the
    # shared base checkout (repository/.git/worktrees/<name>), since git worktrees
    # keep their real git-dir there rather than inside the worktree itself. Without
    # this mounted at that same absolute path, every git command the agent runs
    # inside the container - status, diff, log, rev-parse - fails outright with
    # "fatal: not a git repository". Read-only: the agent can edit the worktree
    # freely, but the daemon (outside the container) owns every actual git mutation
    # (add/commit/push), so the object database and refs never need write access
    # from inside the sandbox.
    git_dir = repository / ".git"
    if git_dir.is_dir():
        arguments.extend(("--volume", f"{git_dir}:{git_dir}:ro,Z"))
    for relative in (
        "node_modules",
        "frontend/node_modules",
        "backend/node_modules",
        "e2e/node_modules",
        "admin-portal/node_modules",
    ):
        dependency_path = repository / relative
        if dependency_path.is_dir():
            arguments.extend(("--volume", f"{dependency_path}:{workspace}/{relative}:ro,Z"))
    arguments.extend((f"--workdir={workspace}", image, "/bin/bash", "-lc", command))
    return arguments


def podman_configuration_error(stderr: str) -> bool:
    return "failed to obtain podman configuration" in stderr.lower()


def resource_limit_error(stderr: str) -> bool:
    lowered = stderr.lower()
    return "cgroup" in lowered and any(
        marker in lowered for marker in ("permission denied", "no such device", "not supported")
    )


def namespace_error(stderr: str) -> bool:
    lowered = stderr.lower()
    return (
        "newuidmap" in lowered
        or "cannot set up namespace" in lowered
        or 'error mounting "proc"' in lowered
        or ("operation not permitted" in lowered and "rootfs" in lowered)
    )
