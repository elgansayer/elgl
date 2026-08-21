from pathlib import Path
from subprocess import CompletedProcess

import pytest
from openhands.tools.file_editor.definition import FileEditorAction
from openhands.tools.terminal.definition import TerminalAction

from openhands_factory.secure_tools import (
    ContainedFileEditorExecutor,
    PodmanTerminalExecutor,
)


def test_file_editor_rejects_path_escape(tmp_path: Path) -> None:
    workspace = tmp_path / "worktree"
    workspace.mkdir()
    outside = tmp_path / "secret"
    outside.write_text("do not read", encoding="utf-8")
    executor = ContainedFileEditorExecutor(workspace)
    result = executor(FileEditorAction(command="view", path=str(outside)))
    assert result.is_error
    assert "outside" in result.text


def test_file_editor_rejects_symlink_escape(tmp_path: Path) -> None:
    workspace = tmp_path / "worktree"
    workspace.mkdir()
    outside = tmp_path / "secret"
    outside.write_text("do not read", encoding="utf-8")
    link = workspace / "link"
    link.symlink_to(outside)
    executor = ContainedFileEditorExecutor(workspace)
    result = executor(FileEditorAction(command="view", path=str(link)))
    assert result.is_error


def test_file_editor_accepts_relative_path_inside_worktree(tmp_path: Path) -> None:
    workspace = tmp_path / "worktree"
    workspace.mkdir()
    expected = workspace / "README.md"
    expected.write_text("safe\n", encoding="utf-8")
    executor = ContainedFileEditorExecutor(workspace)

    result = executor(FileEditorAction(command="view", path="README.md"))

    assert not result.is_error
    assert "safe" in result.text


def test_secure_tool_replaces_the_frozen_executor_by_copying() -> None:
    source = (Path(__file__).parents[1] / "openhands_factory" / "secure_tools.py").read_text(
        encoding="utf-8"
    )

    assert 'model_copy(update={"executor": executor})' in source
    assert "tools[0].executor =" not in source


def test_terminal_mounts_the_workspace_at_its_real_host_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The file_editor tool reports and accepts real host paths (it edits the
    filesystem directly, not through this container), so the terminal tool's
    container must expose the workspace at that same absolute path rather than a
    generic /workspace alias - otherwise a path the agent gets back from one tool
    is one the other tool can't find. Confirmed live: an agent that created a file
    via file_editor, then ran `ls` on that exact reported path from the terminal,
    got "No such file or directory" and burned its whole conversation debugging a
    nonexistent permission issue.
    """
    workspace = tmp_path / "worktree"
    workspace.mkdir()
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        return CompletedProcess(arguments, 0, "ready\n", "")

    monkeypatch.setattr("openhands_factory.secure_tools.subprocess.run", run)
    executor = PodmanTerminalExecutor(workspace, workspace, Path("/usr/bin/podman"), "worker")

    executor(TerminalAction(command="printf ready"))

    assert f"{workspace}:{workspace}:rw,Z" in calls[0]
    assert f"--workdir={workspace}" in calls[0]
    assert "/workspace" not in " ".join(calls[0])


def test_terminal_keeps_nested_resource_and_security_limits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace = tmp_path / "worktree"
    workspace.mkdir()
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        return CompletedProcess(arguments, 0, "ready\n", "")

    monkeypatch.setattr("openhands_factory.secure_tools.subprocess.run", run)
    executor = PodmanTerminalExecutor(workspace, workspace, Path("/usr/bin/podman"), "worker")

    result = executor(TerminalAction(command="printf ready"))

    assert not result.is_error
    assert calls[0][:3] == ["/usr/bin/podman", "run", "--rm"]
    assert "--pids-limit=512" in calls[0]
    assert "--memory=3g" in calls[0]
    assert "--cpus=2" in calls[0]
    assert "--security-opt=no-new-privileges" in calls[0]
    assert "--cap-drop=all" in calls[0]
    assert "--network=none" in calls[0]


def test_terminal_worker_environment_excludes_controller_secrets(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace = tmp_path / "worktree"
    workspace.mkdir()
    captured_environment: dict[str, str] = {}
    secret_names = (
        "GITHUB_TOKEN",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "OPENCODE_GO_API_KEY",
        "GEMINI_API_KEY",
    )
    secret_values = tuple(f"controller-secret-{index}" for index in range(len(secret_names)))
    for name, value in zip(secret_names, secret_values, strict=True):
        monkeypatch.setenv(name, value)
    monkeypatch.delenv("XDG_RUNTIME_DIR", raising=False)

    def run(
        arguments: list[str], timeout: float, environment: dict[str, str]
    ) -> CompletedProcess[str]:
        del timeout
        captured_environment.update(environment)
        return CompletedProcess(arguments, 0, "ready\n", "")

    monkeypatch.setattr("openhands_factory.secure_tools._run_podman", run)
    executor = PodmanTerminalExecutor(workspace, workspace, Path("/usr/bin/podman"), "worker")

    result = executor(TerminalAction(command="printf ready"))

    assert not result.is_error
    assert set(captured_environment) == {"HOME", "PATH"}
    assert set(secret_names).isdisjoint(captured_environment)
    assert set(secret_values).isdisjoint(captured_environment.values())


def test_terminal_retries_without_nested_cgroup_limits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workspace = tmp_path / "worktree"
    workspace.mkdir()
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        if len(calls) == 1:
            return CompletedProcess(arguments, 125, "cannot set cgroup: permission denied", "")
        return CompletedProcess(arguments, 0, "ready\n", "")

    monkeypatch.setattr("openhands_factory.secure_tools.subprocess.run", run)
    executor = PodmanTerminalExecutor(workspace, workspace, Path("/usr/bin/podman"), "worker")

    result = executor(TerminalAction(command="printf ready"))

    assert not result.is_error
    assert len(calls) == 2
    assert "--pids-limit=512" in calls[0]
    assert "--pids-limit=512" not in calls[1]
    assert "--security-opt=no-new-privileges" in calls[1]
