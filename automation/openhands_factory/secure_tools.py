"""OpenHands tools confined to a secretless rootless Podman worker."""

from __future__ import annotations

import os
import subprocess
from collections.abc import Sequence
from pathlib import Path
from typing import TYPE_CHECKING

from openhands.sdk.tool import ToolExecutor, register_tool
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.file_editor.definition import FileEditorAction, FileEditorObservation
from openhands.tools.file_editor.impl import FileEditorExecutor
from openhands.tools.terminal import TerminalTool
from openhands.tools.terminal.definition import TerminalAction, TerminalObservation

if TYPE_CHECKING:
    from openhands.sdk.conversation import LocalConversation
    from openhands.sdk.conversation.state import ConversationState


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


class ContainedFileEditorExecutor(ToolExecutor[FileEditorAction, FileEditorObservation]):
    """Reject reads and writes which resolve outside the task worktree."""

    def __init__(self, workspace: Path) -> None:
        self.workspace = workspace.resolve()
        self.delegate = FileEditorExecutor(workspace_root=str(self.workspace))

    def __call__(
        self,
        action: FileEditorAction,
        conversation: LocalConversation | None = None,
    ) -> FileEditorObservation:
        candidate = Path(action.path)
        resolved = (
            candidate.resolve(strict=False)
            if candidate.is_absolute()
            else (self.workspace / candidate).resolve(strict=False)
        )
        if not resolved.is_relative_to(self.workspace):
            return FileEditorObservation.from_text(
                text="Path is outside the permitted task worktree",
                command=action.command,
                is_error=True,
            )
        confined_action = action.model_copy(update={"path": str(resolved)})
        return self.delegate(confined_action, conversation)


class PodmanTerminalExecutor(ToolExecutor[TerminalAction, TerminalObservation]):
    """Execute one bounded command in a credential-free rootless container."""

    def __init__(self, workspace: Path, repository: Path, podman_path: Path, image: str) -> None:
        self.workspace = workspace.resolve()
        self.repository = repository.resolve()
        self.podman_path = podman_path
        self.image = image

    def __call__(
        self,
        action: TerminalAction,
        conversation: LocalConversation | None = None,
    ) -> TerminalObservation:
        if action.is_input or action.reset or not action.command:
            return TerminalObservation.from_text(
                text="Interactive terminal sessions are disabled by the factory security policy",
                command=action.command,
                exit_code=2,
                is_error=True,
            )
        timeout = min(action.timeout or 300, 1800)
        arguments = [
            str(self.podman_path),
            *podman_run_arguments(
                self.workspace,
                self.repository,
                self.image,
                action.command,
            ),
        ]
        environment = {
            "HOME": os.environ.get("HOME", "/var/empty"),
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        }
        if "XDG_RUNTIME_DIR" in os.environ:
            environment["XDG_RUNTIME_DIR"] = os.environ["XDG_RUNTIME_DIR"]
        try:
            result = _run_podman(arguments, timeout, environment)
            fallback_reason = f"{result.stdout}\n{result.stderr}"
            if result.returncode != 0 and (
                resource_limit_error(fallback_reason)
                or namespace_error(fallback_reason)
                or podman_configuration_error(fallback_reason)
            ):
                fallback_arguments = [
                    str(self.podman_path),
                    *podman_run_arguments(
                        self.workspace,
                        self.repository,
                        self.image,
                        action.command,
                        resource_limits=False,
                        userns="host",
                        cgroup_manager="cgroupfs",
                        cgroups="no-conmon",
                    ),
                ]
                # This fallback never needs XDG_RUNTIME_DIR: cgroup_manager=cgroupfs and
                # userns=host both sidestep the systemd user session it points at, which
                # is also the thing intermittently failing with "Failed to obtain podman
                # configuration: lstat /run/user/<uid>: permission denied" on the primary
                # attempt (a pre-existing host flakiness, not caused by this fallback).
                fallback_environment = {
                    key: value for key, value in environment.items() if key != "XDG_RUNTIME_DIR"
                }
                result = _run_podman(fallback_arguments, timeout, fallback_environment)
        except subprocess.TimeoutExpired as error:
            stdout = (
                error.stdout.decode(errors="replace")
                if isinstance(error.stdout, bytes)
                else error.stdout
            )
            stderr = (
                error.stderr.decode(errors="replace")
                if isinstance(error.stderr, bytes)
                else error.stderr
            )
            output = (stdout or "") + (stderr or "")
            return TerminalObservation.from_text(
                text=output[-100_000:],
                command=action.command,
                exit_code=124,
                timeout=True,
                is_error=True,
            )
        output = f"{result.stdout}{result.stderr}"[-100_000:]
        return TerminalObservation.from_text(
            text=output,
            command=action.command,
            exit_code=result.returncode,
            is_error=result.returncode != 0,
        )


def _run_podman(
    arguments: list[str], timeout: float, environment: dict[str, str]
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        arguments,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        env=environment,
    )


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


class SecureTerminalTool(TerminalTool):
    @classmethod
    def create(  # type: ignore[override]
        cls, conv_state: ConversationState, **kwargs: object
    ) -> Sequence[TerminalTool]:
        podman_path = Path(os.environ.get("FACTORY_PODMAN_PATH", "/usr/bin/podman"))
        image = os.environ.get("FACTORY_TASK_IMAGE", "localhost/hellotalk-factory-worker:current")
        executor = PodmanTerminalExecutor(
            Path(conv_state.workspace.working_dir),
            Path(os.environ.get("FACTORY_REPOSITORY", conv_state.workspace.working_dir)),
            podman_path,
            image,
        )
        return TerminalTool.create(conv_state, executor=executor)


class SecureFileEditorTool(FileEditorTool):
    @classmethod
    def create(  # type: ignore[override]
        cls, conv_state: ConversationState
    ) -> Sequence[FileEditorTool]:
        tools = list(FileEditorTool.create(conv_state))
        executor = ContainedFileEditorExecutor(Path(conv_state.workspace.working_dir))
        return [tools[0].model_copy(update={"executor": executor})]


register_tool(SecureTerminalTool.name, SecureTerminalTool)
register_tool(SecureFileEditorTool.name, SecureFileEditorTool)
