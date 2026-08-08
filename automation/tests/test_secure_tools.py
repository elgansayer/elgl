from pathlib import Path

from openhands.tools.file_editor.definition import FileEditorAction

from openhands_factory.secure_tools import ContainedFileEditorExecutor


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
