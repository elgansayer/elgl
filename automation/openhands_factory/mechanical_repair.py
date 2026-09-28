"""Deterministic auto-fixers tried before an LLM repair attempt.

A large share of CI repair cycles are triggered by a purely mechanical
failure - drifted formatting, an auto-fixable lint rule - that a formatter
already resolves for free. Running those fixers against the task-owned files
first, and only falling through to an agent when they leave the worktree
unchanged, saves an LLM call without formatting unrelated parts of a large
repository.
"""

from __future__ import annotations

from pathlib import Path

from openhands_factory.repository_guard import ProcessRunner, run_process

_TYPESCRIPT_WORKSPACES = ("backend", "frontend", "admin-portal")


def attempt_mechanical_repair(
    repository: Path,
    changed_paths: set[Path],
    runner: ProcessRunner = run_process,
) -> None:
    """Run fixing lint/format commands for changed source files, best effort.

    The authoritative verification and GitHub CI gates still inspect the full
    affected workspace. This pass is only an inexpensive auto-fix attempt, so
    it must not scan or mutate files outside the pull request diff. Failures
    are not fatal - the caller decides what happened by checking the worktree
    afterwards, so a tool crashing just means nothing to skip the agent step.
    """
    for workspace in _TYPESCRIPT_WORKSPACES:
        directory = repository / workspace
        if not (directory / "package.json").exists():
            continue
        files = sorted(
            str(path.relative_to(workspace))
            for path in changed_paths
            if path.parts
            and path.parts[0] == workspace
            and path.suffix == ".ts"
            and (repository / path).is_file()
        )
        if not files:
            continue
        runner(("npm", "exec", "--", "eslint", *files, "--fix"), directory, 600)

    automation_dir = repository / "automation"
    automation_files = sorted(
        str(path.relative_to("automation"))
        for path in changed_paths
        if path.parts
        and path.parts[0] == "automation"
        and path.suffix == ".py"
        and (repository / path).is_file()
    )
    if (automation_dir / "pyproject.toml").exists() and automation_files:
        runner(
            ("uv", "run", "--frozen", "ruff", "format", *automation_files),
            automation_dir,
            300,
        )
        runner(
            ("uv", "run", "--frozen", "ruff", "check", "--fix", *automation_files),
            automation_dir,
            300,
        )
