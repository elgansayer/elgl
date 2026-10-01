"""Deterministic auto-fixers tried before an LLM repair attempt.

A large share of CI repair cycles are triggered by a purely mechanical
failure - drifted formatting, an auto-fixable lint rule - that a formatter
already resolves for free. Running those fixers first, and only falling
through to an agent when they leave the worktree unchanged, saves an LLM
call (and its retry/fallback chain) on exactly the failures that need one
the least.
"""

from __future__ import annotations

from pathlib import Path

from openhands_factory.repository_guard import ProcessRunner, run_process

# backend and frontend both have their own fixing "lint" script (eslint --fix,
# which also applies prettier's fixes via eslint-plugin-prettier); admin-portal
# only has the non-fixing "lint:check", so it gets the same eslint --fix call
# those two scripts wrap, run directly instead.
_FIXING_LINT_SCRIPT_WORKSPACES = ("backend", "frontend")
_DIRECT_ESLINT_FIX_WORKSPACES = ("admin-portal",)


def attempt_mechanical_repair(repository: Path, runner: ProcessRunner = run_process) -> None:
    """Run each workspace's own fixing lint/format command, best effort.

    Prefers the project's existing "lint" (fixing) script over
    reimplementing prettier/eslint invocations, so this always matches
    whatever that workspace's own CI gate actually checks. Failures here are
    not fatal - the caller decides what happened by checking the worktree
    for changes afterwards, so a tool crashing just means nothing to skip
    the agent step for.
    """
    for workspace in _FIXING_LINT_SCRIPT_WORKSPACES:
        directory = repository / workspace
        if not (directory / "package.json").exists():
            continue
        runner(("npm", "run", "lint"), directory, 600)

    for workspace in _DIRECT_ESLINT_FIX_WORKSPACES:
        directory = repository / workspace
        if not (directory / "package.json").exists():
            continue
        runner(("npx", "eslint", "src/**/*.ts", "--fix"), directory, 600)

    automation_dir = repository / "automation"
    if (automation_dir / "pyproject.toml").exists():
        runner(("uv", "run", "--frozen", "ruff", "format", "."), automation_dir, 300)
        runner(("uv", "run", "--frozen", "ruff", "check", "--fix", "."), automation_dir, 300)
