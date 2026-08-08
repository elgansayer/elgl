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
            "run",
            "--rm",
            "--network=none",
            "--pids-limit=512",
            "--memory=3g",
            "--cpus=2",
            "--security-opt=no-new-privileges",
            "--cap-drop=all",
            "--userns=keep-id",
            "--volume",
            f"{self.workspace}:/workspace:rw,Z",
        ]
        for relative in (
            "node_modules",
            "frontend/node_modules",
            "backend/node_modules",
            "e2e/node_modules",
        ):
            dependency_path = self.repository / relative
            if dependency_path.is_dir():
                arguments.extend(("--volume", f"{dependency_path}:/workspace/{relative}:ro,Z"))
        arguments.extend(("--workdir=/workspace", self.image, "/bin/bash", "-lc", action.command))
        environment = {
            "HOME": os.environ.get("HOME", "/var/empty"),
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        }
        try:
            result = subprocess.run(
                arguments,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
                env=environment,
            )
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
