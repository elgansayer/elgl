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

from openhands_factory.worker_container import (
    namespace_error as namespace_error,
)
from openhands_factory.worker_container import (
    podman_configuration_error as podman_configuration_error,
)
from openhands_factory.worker_container import (
    podman_run_arguments as podman_run_arguments,
)
from openhands_factory.worker_container import (
    resource_limit_error as resource_limit_error,
)

if TYPE_CHECKING:
    from openhands.sdk.conversation import LocalConversation
    from openhands.sdk.conversation.state import ConversationState


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
