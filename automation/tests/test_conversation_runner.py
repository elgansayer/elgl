import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import (
    ConversationProviderError,
    ConversationRunner,
    SdkConversationFactory,
)
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import FailureKind, ProviderName, Task
from openhands_factory.provider_health import ProviderHealthStore
from openhands_factory.provider_runtime import ProviderAttributionStore


class Conversation:
    def __init__(self, workspace: Path, stuck: bool) -> None:
        self.workspace = workspace
        self.stuck = stuck

    def send_message(self, message: str) -> None:
        assert message == "prompt"

    def run(self) -> None:
        if self.stuck:
            time.sleep(60)

    def pause(self) -> None:
        (self.workspace / "paused").write_text("yes", encoding="utf-8")

    def close(self) -> None:
        (self.workspace / "closed").write_text("yes", encoding="utf-8")


class CrashingConversation(Conversation):
    def run(self) -> None:
        os._exit(9)


class NoisyConversation(Conversation):
    def run(self) -> None:
        print("raw provider transcript must not reach the daemon log")
        print("raw provider error must not reach the daemon log", file=sys.stderr)


@dataclass(frozen=True)
class Factory:
    stuck: bool = False

    def __call__(self, workspace: Path, turns: int, provider: ProviderName) -> Conversation:
        assert turns == 100
        (workspace / "provider").write_text(provider.value, encoding="utf-8")
        return Conversation(workspace, self.stuck)


@dataclass(frozen=True)
class CrashingFactory:
    def __call__(self, workspace: Path, turns: int, provider: ProviderName) -> Conversation:
        del turns, provider
        return CrashingConversation(workspace, False)


@dataclass(frozen=True)
class NoisyFactory:
    def __call__(self, workspace: Path, turns: int, provider: ProviderName) -> Conversation:
        del turns, provider
        return NoisyConversation(workspace, False)


def config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    prompt_dir = repository / "automation" / "prompts"
    prompt_dir.mkdir(parents=True, exist_ok=True)
    (prompt_dir / "system.md").write_text("trusted system prompt", encoding="utf-8")
    return FactoryConfig.from_environment(
        {
            "OPENCODE_GO_API_KEY": "key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "token",
            "GEMINI_ENABLED": "false",
            "FACTORY_STATE_DIR": str(tmp_path),
            "FACTORY_REPOSITORY": str(repository),
        }
    )


def test_selected_provider_is_passed_to_spawned_conversation(tmp_path: Path) -> None:
    runner = ConversationRunner(config(tmp_path), Factory())
    result = runner.run(Task("one", "Task", "body", "test", 1), tmp_path, "prompt")
    assert result.completed
    assert (tmp_path / "closed").is_file()
    assert (tmp_path / "provider").read_text(encoding="utf-8") == ProviderName.OPENCODE_GO.value


def test_sdk_child_output_does_not_reach_daemon_stdio(
    tmp_path: Path,
    capfd: pytest.CaptureFixture[str],
) -> None:
    runner = ConversationRunner(config(tmp_path), NoisyFactory())

    result = runner.run(Task("noisy", "Task", "body", "test", 1), tmp_path, "prompt")
    captured = capfd.readouterr()

    assert result.completed
    assert "raw provider transcript" not in captured.out
    assert "raw provider error" not in captured.err


def test_stuck_conversation_is_cancelled_without_poisoning_provider_health(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    runner = ConversationRunner(
        factory_config, Factory(stuck=True), timeout_seconds=60, cancellation_grace_seconds=1
    )
    started = time.monotonic()

    with pytest.raises(FactoryError, match="maximum task duration"):
        runner.run(
            Task("two", "Task", "body", "test", 1),
            tmp_path,
            "prompt",
            timeout_seconds=0.2,
        )

    assert time.monotonic() - started < 5
    breakers = ProviderHealthStore(factory_config.state_dir / "health.json").load()
    assert all(item.consecutive_failures == 0 for item in breakers)

    attempts = ProviderAttributionStore(
        factory_config.state_dir / "provider-attribution.json"
    ).task_summary("two")
    assert attempts[-1]["failure_kind"] == FailureKind.TASK_TIMEOUT.value


def test_shutdown_gate_prevents_a_late_sdk_process_start(tmp_path: Path) -> None:
    runner = ConversationRunner(config(tmp_path), Factory())
    ConversationRunner.request_shutdown()
    try:
        with pytest.raises(FactoryError, match="cancelled during Factory shutdown"):
            runner.run(Task("stop", "Task", "body", "test", 1), tmp_path, "prompt")
    finally:
        ConversationRunner.reset_shutdown()

    assert ConversationRunner._active_processes == set()


def test_shutdown_force_kills_an_sdk_process_with_a_stuck_graceful_handler(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class StuckProcess:
        pid = 9876

        def __init__(self) -> None:
            self.alive = True
            self.join_timeouts: list[float | None] = []

        def is_alive(self) -> bool:
            return self.alive

        def join(self, timeout: float | None = None) -> None:
            self.join_timeouts.append(timeout)

    process = StuckProcess()
    signals: list[int] = []

    def kill_group(identifier: int, process_signal: int) -> None:
        assert identifier == process.pid
        signals.append(process_signal)
        if process_signal == 9:
            process.alive = False

    monkeypatch.setattr("openhands_factory.conversation_runner.os.killpg", kill_group)
    ConversationRunner._active_processes = {process}  # type: ignore[assignment]
    try:
        ConversationRunner.request_shutdown()
    finally:
        ConversationRunner._active_processes.clear()
        ConversationRunner.reset_shutdown()

    assert signals == [15, 9]
    assert process.join_timeouts == [5, 5]


def test_sdk_child_crash_is_typed_and_does_not_leak_process_state(tmp_path: Path) -> None:
    runner = ConversationRunner(config(tmp_path), CrashingFactory())

    with pytest.raises(ConversationProviderError) as raised:
        runner.run(Task("crash", "Task", "body", "test", 1), tmp_path, "prompt")

    assert raised.value.failure_kind is FailureKind.TRANSIENT
    assert ConversationRunner._active_processes == set()


def test_sdk_conversation_uses_system_prompt_from_trusted_factory_checkout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import openhands_factory.secure_tools  # noqa: F401

    factory_config = config(tmp_path)
    worktree = tmp_path / "worktree"
    untrusted_prompts = worktree / "automation" / "prompts"
    untrusted_prompts.mkdir(parents=True)
    (untrusted_prompts / "system.md").write_text(
        "untrusted replacement",
        encoding="utf-8",
    )
    captured: dict[str, object] = {}
    sdk = ModuleType("openhands.sdk")

    class Agent:
        def __init__(self, **kwargs: object) -> None:
            captured.update(kwargs)

    class Tool:
        def __init__(self, *, name: str) -> None:
            self.name = name

    class SdkConversation:
        def __init__(self, **kwargs: object) -> None:
            captured["conversation"] = kwargs

    sdk.Agent = Agent
    sdk.Tool = Tool
    sdk.Conversation = SdkConversation
    monkeypatch.setitem(__import__("sys").modules, "openhands.sdk", sdk)
    monkeypatch.setattr(
        "openhands_factory.provider_profiles.build_llm",
        lambda *args, **kwargs: object(),
    )

    SdkConversationFactory(factory_config)(
        worktree,
        100,
        ProviderName.OPENAI_SUBSCRIPTION,
    )

    assert captured["system_prompt"] == "trusted system prompt"
