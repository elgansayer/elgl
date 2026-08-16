"""Repository-native verification planning and execution."""

from __future__ import annotations

import sys
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
    # True only for commands that bind a fixed host port (frontend-e2e's dev
    # server on 127.0.0.1:4200) and so cannot run concurrently with another
    # instance of themselves. Everything else - including backend-test:e2e,
    # which talks to its NestJS app in-process via supertest on an ephemeral
    # port - is safe under full worker parallelism.
    exclusive: bool = False


def commands_for(repository: Path, changed_paths: set[Path]) -> list[VerificationCommand]:
    if not changed_paths:
        raise VerificationFailed("Verification requires at least one changed path")
    commands = [
        VerificationCommand("constitution", ("npm", "run", "check:constitution"), repository),
        VerificationCommand(
            "conflict-markers", ("node", "scripts/check-conflict-markers.mjs"), repository
        ),
        VerificationCommand(
            "migration-delta", ("node", "scripts/check-migration-delta.mjs"), repository
        ),
        VerificationCommand(
            "factory-tests", (sys.executable, "-m", "pytest"), repository / "automation"
        ),
    ]
    for script in (
        "check:control-flow",
        "check:template-bindings",
        "check:rtl-logical",
        "lint:check",
        "build",
        "test",
    ):
        commands.append(
            VerificationCommand(
                f"frontend-{script}", ("npm", "run", script), repository / "frontend"
            )
        )
    if any(path.parts and path.parts[0] in {"frontend", "e2e"} for path in changed_paths):
        commands.append(
            VerificationCommand(
                "frontend-e2e",
                (
                    "bash",
                    "-lc",
                    "npm start -- --host 127.0.0.1 >/tmp/factory-angular-e2e.log 2>&1 & "
                    "server_pid=$!; trap 'kill \"$server_pid\" 2>/dev/null || true' EXIT; "
                    # 180s, not 60s: a cold Angular compile can genuinely take longer
                    # than a minute under load. Poll the process itself too, so a
                    # server that crashes immediately fails fast with its own log
                    # output instead of silently exhausting the full wait and then
                    # failing a second time, confusingly, inside npm run e2e against
                    # a server that was never coming up.
                    "for attempt in $(seq 1 180); do "
                    "if ! kill -0 \"$server_pid\" 2>/dev/null; then "
                    "echo 'dev server exited before becoming ready:' >&2; "
                    "tail -n 50 /tmp/factory-angular-e2e.log >&2; exit 1; fi; "
                    "curl -fsS http://127.0.0.1:4200 >/dev/null 2>&1 && break; sleep 1; "
                    "if [ \"$attempt\" = 180 ]; then "
                    "echo 'dev server did not become ready within 180s:' >&2; "
                    "tail -n 50 /tmp/factory-angular-e2e.log >&2; exit 1; fi; "
                    "done; npm run e2e",
                ),
                repository / "frontend",
                exclusive=True,
            )
        )
    for script in ("lint:check", "build", "test", "test:e2e"):
        commands.append(
            VerificationCommand(f"backend-{script}", ("npm", "run", script), repository / "backend")
        )
    return commands


def run_verification(
    commands: list[VerificationCommand], runner: ProcessRunner = run_process
) -> None:
    for command in commands:
        result = runner(command.arguments, command.directory, command.timeout)
        if result.returncode != 0:
            output = f"{result.stdout}\n{result.stderr}".strip()
            raise VerificationFailed(
                f"{command.name} failed with exit {result.returncode}: {output[-2000:]}"
            )
