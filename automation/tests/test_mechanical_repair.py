from pathlib import Path

from openhands_factory.mechanical_repair import attempt_mechanical_repair


def test_mechanical_repair_targets_only_changed_source_files(tmp_path: Path) -> None:
    for workspace in ("backend", "frontend", "admin-portal"):
        directory = tmp_path / workspace
        directory.mkdir()
        (directory / "package.json").write_text("{}")
        (directory / "src").mkdir()
    (tmp_path / "automation").mkdir()
    (tmp_path / "automation" / "pyproject.toml").write_text("")

    changed_files = {
        Path("backend/src/changed.ts"),
        Path("backend/src/deleted.ts"),
        Path("frontend/src/changed.ts"),
        Path("frontend/src/template.html"),
        Path("automation/openhands_factory/changed.py"),
        Path("README.md"),
    }
    for path in changed_files:
        if path.name not in {"deleted.ts", "template.html", "README.md"}:
            target = tmp_path / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("")

    calls: list[tuple[tuple[str, ...], Path, int]] = []

    def runner(command: tuple[str, ...], cwd: Path, timeout: int):
        calls.append((command, cwd, timeout))
        return None

    attempt_mechanical_repair(tmp_path, changed_files, runner)

    assert calls == [
        (
            ("npm", "exec", "--", "eslint", "src/changed.ts", "--fix"),
            tmp_path / "backend",
            600,
        ),
        (
            ("npm", "exec", "--", "eslint", "src/changed.ts", "--fix"),
            tmp_path / "frontend",
            600,
        ),
        (
            (
                "uv",
                "run",
                "--frozen",
                "ruff",
                "format",
                "openhands_factory/changed.py",
            ),
            tmp_path / "automation",
            300,
        ),
        (
            (
                "uv",
                "run",
                "--frozen",
                "ruff",
                "check",
                "--fix",
                "openhands_factory/changed.py",
            ),
            tmp_path / "automation",
            300,
        ),
    ]


def test_mechanical_repair_does_nothing_without_changed_source_files(tmp_path: Path) -> None:
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "package.json").write_text("{}")
    calls: list[tuple[tuple[str, ...], Path, int]] = []

    attempt_mechanical_repair(
        tmp_path,
        {Path("README.md"), Path("backend/src/deleted.ts")},
        lambda command, cwd, timeout: calls.append((command, cwd, timeout)),
    )

    assert calls == []
