from pathlib import Path

from openhands_factory.agents.base import AgentPhase, AgentRequest
from openhands_factory.agents.codex import CodexProvider
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


def _reasoning_effort_for(phase: AgentPhase) -> tuple[str, tuple[str, ...]]:
    runner = FakeProcessRunner()
    provider = CodexProvider(process_runner=runner)
    provider.run(
        AgentRequest(
            phase=phase,
            task=Task("1", "test", "body", "issue", 1),
            prompt="do it",
            cwd=Path("/tmp"),
        )
    )
    command = runner.commands[0]
    setting = next(value for value in command if value.startswith("model_reasoning_effort="))
    return setting, command


def test_codex_keeps_max_reasoning_for_open_ended_build_phases() -> None:
    for phase in (
        AgentPhase.PLANNING,
        AgentPhase.ARCHITECTURE,
        AgentPhase.IMPLEMENTATION,
    ):
        setting, command = _reasoning_effort_for(phase)
        assert setting == 'model_reasoning_effort="max"', phase
        assert "gpt-5.6-sol" in command


def test_codex_uses_high_reasoning_for_security_review() -> None:
    setting, command = _reasoning_effort_for(AgentPhase.SECURITY_REVIEW)

    assert setting == 'model_reasoning_effort="high"'
    assert "gpt-5.6-sol" in command


def test_codex_uses_medium_reasoning_for_independent_review() -> None:
    setting, command = _reasoning_effort_for(AgentPhase.CODE_REVIEW)

    assert setting == 'model_reasoning_effort="medium"'
    assert "gpt-5.6-sol" in command


def test_codex_uses_low_reasoning_for_bounded_repair_and_general_action_phases() -> None:
    for phase in (
        AgentPhase.QUALITY_REPAIR,
        AgentPhase.CI_REPAIR,
        AgentPhase.GENERAL_ACTION,
    ):
        setting, command = _reasoning_effort_for(phase)
        assert setting == 'model_reasoning_effort="low"', phase
        assert "gpt-5.6-sol" in command
