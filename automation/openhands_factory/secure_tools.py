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
    pid_host: bool = False,
    cgroups: str | None = None,
) -> list[str]:
    """Build the common constrained worker-container command line."""
    arguments = [
        "run",
        "--rm",
        "--network=none",
        "--security-opt=no-new-privileges",
        "--cap-drop=all",
        f"--userns={userns}",
        "--volume",
        f"{workspace}:/workspace:{workspace_access},Z",
    ]
    if cgroup_manager:
        arguments.insert(1, f"--cgroup-manager={cgroup_manager}")
    if pid_host:
        arguments.insert(1, "--pid=host")
    if cgroups:
        arguments.insert(1, f"--cgroups={cgroups}")
    if resource_limits:
        arguments[3:3] = [
            f"--pids-limit={pids_limit}",
            f"--memory={memory_limit}",
            f"--cpus={cpu_limit}",
        ]
    for relative in (
        "node_modules",
        "frontend/node_modules",
        "backend/node_modules",
        "e2e/node_modules",
    ):
        dependency_path = repository / relative
        if dependency_path.is_dir():
            arguments.extend(("--volume", f"{dependency_path}:/workspace/{relative}:ro,Z"))
    arguments.extend(("--workdir=/workspace", image, "/bin/bash", "-lc", command))
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
        try:
            result = _run_podman(arguments, timeout, environment)
            fallback_reason = f"{result.stdout}\n{result.stderr}"
            if result.returncode != 0 and (
                resource_limit_error(fallback_reason) or namespace_error(fallback_reason)
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
                        pid_host=True,
                        cgroups="no-conmon",
                    ),
                ]
                result = _run_podman(fallback_arguments, timeout, environment)
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
