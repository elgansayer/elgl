"""Repository-scoped entry point for additional OpenHands Factory instances.

The primary Factory remains the only automation architecture. This module only
adapts repository-native verification, control-plane prompt loading, and the
single-owner guard for a separately configured target repository.
"""

from __future__ import annotations

import os
import re
from collections.abc import Callable
from dataclasses import replace
from pathlib import Path
from typing import NoReturn, cast

from openhands_factory import architecture_guard, git_workflow, pipeline
from openhands_factory.exceptions import VerificationFailed
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.verification import VerificationCommand

WORKOUT_AGENT_PROFILE = "workout-agent"
PROFILE_ENVIRONMENT = "FACTORY_REPOSITORY_PROFILE"
CONTROL_REPOSITORY_ENVIRONMENT = "FACTORY_CONTROL_REPOSITORY"

_ORIGINAL_COMMANDS_FOR = cast(
    Callable[[Path, set[Path]], list[VerificationCommand]], pipeline.commands_for
)
_ORIGINAL_BUILD_SYSTEM_PROMPT = cast(Callable[[Path], str], pipeline.build_system_prompt)
_ORIGINAL_PIPELINE_INIT = cast(Callable[..., None], FactoryPipeline.__init__)
_ORIGINAL_ADD_WORKTREE = cast(
    Callable[[GitWorkflow, Path, str, str], None], GitWorkflow._add_worktree
)
_INSTALLED = False

WORKOUT_AGENT_RETIRED_SWARM_WORKFLOWS = (
    *architecture_guard.RETIRED_SWARM_WORKFLOWS,
    ".github/workflows/agent-daily.yml",
    ".github/workflows/agent-hourly.yml",
    ".github/workflows/agent-weekly.yml",
    ".github/workflows/on-failure.yml",
)


def _workflow_triggers(text: str) -> set[str]:
    """Read the top-level workflow triggers without accepting a partial denylist."""

    lines = text.splitlines()
    for index, line in enumerate(lines):
        match = re.fullmatch(r"\\s*on\\s*:\\s*(.*)", line)
        if match is None:
            continue
        inline = match.group(1).strip()
        if inline:
            if inline.startswith("[") and inline.endswith("]"):
                return {
                    item.strip()
                    for item in inline[1:-1].split(",")
                    if item.strip()
                }
            return {inline}

        triggers: set[str] = set()
        event_indent: int | None = None
        for candidate in lines[index + 1 :]:
            stripped = candidate.strip()
            if not stripped or stripped.startswith("#"):
                continue
            indent = len(candidate) - len(candidate.lstrip())
            if indent == 0:
                break
            event = re.match(r"^\\s+([A-Za-z_][A-Za-z0-9_-]*)\\s*:", candidate)
            if event is None:
                continue
            if event_indent is None:
                event_indent = indent
            if indent == event_indent:
                triggers.add(event.group(1))
        return triggers
    return set()


def _active_profile() -> str:
    return os.environ.get(PROFILE_ENVIRONMENT, "").strip().casefold()


def _control_repository() -> Path:
    configured = os.environ.get(CONTROL_REPOSITORY_ENVIRONMENT, "").strip()
    if not configured:
        raise RuntimeError(
            f"{CONTROL_REPOSITORY_ENVIRONMENT} is required for repository-scoped Factory instances"
        )
    repository = Path(configured).resolve()
    prompt_dir = repository / "automation/prompts"
    if not prompt_dir.is_dir():
        raise RuntimeError(f"Factory control prompts are missing: {prompt_dir}")
    return repository


def assert_workout_agent_single_owner(repository: Path) -> None:
    """Allow retired workflow stubs only when they are manual and inert.

    Workout Agent intentionally keeps small workflow_dispatch-only tombstones so
    the old GitHub-hosted agents cannot be silently reintroduced. Presence alone
    is therefore not a competing owner; any autonomous trigger is.
    """

    for relative in WORKOUT_AGENT_RETIRED_SWARM_WORKFLOWS:
        workflow = repository / relative
        if not workflow.is_file():
            continue
        text = workflow.read_text(encoding="utf-8")
        triggers = _workflow_triggers(text)
        if triggers != {"workflow_dispatch"}:
            raise RuntimeError(
                "OpenHands Factory single-owner invariant violated: retired workflow "
                f"is not manual-only: {relative}; triggers={sorted(triggers)}"
            )


def _workout_agent_roots(changed_paths: set[Path]) -> tuple[bool, bool]:
    frontend = any(path.parts and path.parts[0] == "frontend" for path in changed_paths)
    backend = any(
        path.parts
        and path.parts[0]
        in {
            "backend",
            "tests",
            "scripts",
            "migrations",
            "alembic",
        }
        for path in changed_paths
    )
    # Cross-cutting files can affect packaging, CI, runtime configuration, or
    # both applications. Fail closed by running both suites.
    if not frontend and not backend:
        frontend = backend = True
    return frontend, backend


def workout_agent_commands_for(
    repository: Path,
    changed_paths: set[Path],
) -> list[VerificationCommand]:
    """Return build/test gates matching Workout Agent's Python + Angular stack."""

    if not changed_paths:
        raise VerificationFailed("Verification requires at least one changed path")

    frontend, backend = _workout_agent_roots(changed_paths)
    commands: list[VerificationCommand] = [
        VerificationCommand(
            "workout-agent-diff-check",
            ("git", "diff", "--check", "origin/main"),
            repository,
            timeout=300,
        )
    ]

    if backend:
        python = repository / "backend/.venv/bin/python"
        if not python.is_file():
            raise VerificationFailed(
                "Workout Agent backend environment is missing; run "
                "scripts/install-workout-agent-factory.sh"
            )
        commands.extend(
            [
                VerificationCommand(
                    "workout-agent-backend-build",
                    (
                        str(python),
                        "-m",
                        "compileall",
                        "-q",
                        "-x",
                        r"(^|/)\\.venv/",
                        "backend",
                    ),
                    repository,
                    timeout=900,
                ),
                VerificationCommand(
                    "workout-agent-backend-tests",
                    (
                        str(python),
                        "-m",
                        "pytest",
                        "-q",
                        "backend/tests",
                    ),
                    repository,
                    timeout=2400,
                ),
            ]
        )

    if frontend:
        commands.extend(
            [
                VerificationCommand(
                    "workout-agent-frontend-build",
                    ("npm", "run", "build"),
                    repository / "frontend",
                    timeout=2400,
                ),
                VerificationCommand(
                    "workout-agent-frontend-tests",
                    ("npm", "test", "--", "--watch=false"),
                    repository / "frontend",
                    timeout=2400,
                ),
            ]
        )

    return [replace(command, workspace=repository) for command in commands]


def _profiled_commands_for(
    repository: Path,
    changed_paths: set[Path],
) -> list[VerificationCommand]:
    if _active_profile() == WORKOUT_AGENT_PROFILE:
        return workout_agent_commands_for(repository, changed_paths)
    return _ORIGINAL_COMMANDS_FOR(repository, changed_paths)


def _profiled_build_system_prompt(prompt_dir: Path) -> str:
    if _active_profile() == WORKOUT_AGENT_PROFILE:
        prompt_dir = _control_repository() / "automation/prompts"
    return _ORIGINAL_BUILD_SYSTEM_PROMPT(prompt_dir)


def _profiled_pipeline_init(self: FactoryPipeline, *args: object, **kwargs: object) -> None:
    _ORIGINAL_PIPELINE_INIT(self, *args, **kwargs)
    if _active_profile() == WORKOUT_AGENT_PROFILE:
        self.prompt_dir = _control_repository() / "automation/prompts"


def _profiled_add_worktree(
    self: GitWorkflow,
    worktree: Path,
    branch: str,
    start_point: str,
) -> None:
    _ORIGINAL_ADD_WORKTREE(self, worktree, branch, start_point)
    if _active_profile() != WORKOUT_AGENT_PROFILE:
        return
    source = self.repository / "backend/.venv"
    destination = worktree / "backend/.venv"
    if source.is_dir() and not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        os.symlink(source, destination, target_is_directory=True)


def install_repository_profile() -> None:
    """Install the selected adapter before the ordinary CLI imports the daemon."""

    global _INSTALLED
    if _INSTALLED:
        return
    profile = _active_profile()
    if profile != WORKOUT_AGENT_PROFILE:
        raise RuntimeError(f"Unsupported repository Factory profile: {profile or '<empty>'}")

    _control_repository()
    pipeline.commands_for = _profiled_commands_for
    pipeline.build_system_prompt = _profiled_build_system_prompt
    pipeline.FactoryPipeline.__init__ = _profiled_pipeline_init  # type: ignore[method-assign]
    git_workflow.GitWorkflow._add_worktree = _profiled_add_worktree  # type: ignore[method-assign]
    architecture_guard.assert_single_owner = assert_workout_agent_single_owner
    _INSTALLED = True


def main(arguments: list[str] | None = None) -> int:
    install_repository_profile()
    # Import only after installing the guard. daemon.py binds assert_single_owner
    # at import time, so eager CLI import would retain the generic presence-only
    # check and reject Workout Agent's intentionally inert workflow tombstones.
    from openhands_factory.cli import main as factory_main

    return factory_main(arguments)


def run() -> NoReturn:
    raise SystemExit(main())


if __name__ == "__main__":
    run()
