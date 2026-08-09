from pathlib import Path
from subprocess import CompletedProcess

import pytest
from openhands.tools.file_editor.definition import FileEditorAction
from openhands.tools.terminal.definition import TerminalAction

from openhands_factory.secure_tools import ContainedFileEditorExecutor, PodmanTerminalExecutor


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
