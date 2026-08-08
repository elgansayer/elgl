"""Repository-native verification planning and execution."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from openhands_factory.exceptions import VerificationFailed
from openhands_factory.repository_guard import ProcessRunner, run_process


@dataclass(frozen=True)
class VerificationCommand:
    name: str
    arguments: tuple[str, ...]
    directory: Path
    timeout: int = 1800


def commands_for(repository: Path, changed_paths: set[Path]) -> list[VerificationCommand]:
    if not changed_paths:
        raise VerificationFailed("Verification requires at least one changed path")
    commands = [
        VerificationCommand("constitution", ("npm", "run", "check:constitution"), repository),
        VerificationCommand(
            "conflict-markers", ("node", "scripts/check-conflict-markers.mjs"), repository
        ),
        VerificationCommand("factory-tests", ("python", "-m", "pytest"), repository / "automation"),
    ]
    for script in (
        "check:control-flow",
        "check:template-bindings",
        "check:rtl-logical",
        "lint:check",
        "build",
        "test",
        "e2e",
    ):
        commands.append(
            VerificationCommand(
                f"frontend-{script}", ("npm", "run", script), repository / "frontend"
            )
        )
    for script in ("lint:check", "build", "test", "test:e2e"):
        commands.append(
            VerificationCommand(
                f"backend-{script}", ("npm", "run", script), repository / "backend"
            )
        )
    return commands


def run_verification(
    commands: list[VerificationCommand], runner: ProcessRunner = run_process
) -> None:
    for command in commands:
        result = runner(command.arguments, command.directory, command.timeout)
        if result.returncode != 0:
            raise VerificationFailed(
                f"{command.name} failed with exit {result.returncode}: {result.stderr[-2000:]}"
            )
