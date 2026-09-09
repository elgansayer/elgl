from pathlib import Path

from openhands_factory.agents.base import AgentPhase, AgentRequest
from openhands_factory.agents.claude import ClaudeCodeProvider
from openhands_factory.agents.process import ProcessResult
from openhands_factory.models import Task


class FakeProcessRunner:
    def __init__(self) -> None:
        self.commands: list[tuple[str, ...]] = []

    def run(
        self,
        command,
        *,
        cwd,
        env,
        stdin_text,
        timeout_seconds,
        max_output_bytes,
        home_mounts=(),
    ) -> ProcessResult:
        del cwd, env, stdin_text, timeout_seconds, max_output_bytes, home_mounts
        self.commands.append(tuple(command))
        return ProcessResult(tuple(command), 0, "ok", "", False, False, 0.1)


def _effort_for(phase: AgentPhase) -> tuple[str, ...]:
    runner = FakeProcessRunner()
    provider = ClaudeCodeProvider(process_runner=runner)
    provider.run(
        AgentRequest(
            phase=phase,
            task=Task("1", "test", "body", "issue", 1),
            prompt="do it",
            cwd=Path("/tmp"),
        )
    )
    return runner.commands[0]


def test_claude_uses_low_effort_for_factory_general_action() -> None:
    command = _effort_for(AgentPhase.GENERAL_ACTION)

    effort_index = command.index("--effort")
    assert command[effort_index + 1] == "low"
    assert "fable" in command


def test_claude_keeps_security_and_build_effort_floors() -> None:
    security = _effort_for(AgentPhase.SECURITY_REVIEW)
    implementation = _effort_for(AgentPhase.IMPLEMENTATION)

    assert security[security.index("--effort") + 1] == "medium"
    assert implementation[implementation.index("--effort") + 1] == "max"
