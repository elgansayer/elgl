import time
from dataclasses import dataclass
from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationRunner
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


@dataclass(frozen=True)
class Factory:
    stuck: bool = False

    def __call__(self, workspace: Path, turns: int, provider: ProviderName) -> Conversation:
        assert turns == 100
        (workspace / "provider").write_text(provider.value, encoding="utf-8")
        return Conversation(workspace, self.stuck)


def config(tmp_path: Path) -> FactoryConfig:
    return FactoryConfig.from_environment(
        {
            "OPENCODE_GO_API_KEY": "key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "token",
            "GEMINI_ENABLED": "false",
            "FACTORY_STATE_DIR": str(tmp_path),
        }
    )


def test_selected_provider_is_passed_to_spawned_conversation(tmp_path: Path) -> None:
    runner = ConversationRunner(config(tmp_path), Factory())
    result = runner.run(Task("one", "Task", "body", "test", 1), tmp_path, "prompt")
    assert result.completed
    assert (tmp_path / "closed").is_file()
    assert (tmp_path / "provider").read_text(encoding="utf-8") == ProviderName.OPENCODE_GO.value


def test_stuck_conversation_is_cancelled_without_poisoning_provider_health(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    runner = ConversationRunner(
        factory_config, Factory(stuck=True), timeout_seconds=0.2, cancellation_grace_seconds=1
    )
    started = time.monotonic()

    with pytest.raises(FactoryError, match="maximum task duration"):
        runner.run(Task("two", "Task", "body", "test", 1), tmp_path, "prompt")

    assert time.monotonic() - started < 5
    breakers = ProviderHealthStore(factory_config.state_dir / "health.json").load()
    assert all(item.consecutive_failures == 0 for item in breakers)

    attempts = ProviderAttributionStore(
        factory_config.state_dir / "provider-attribution.json"
    ).task_summary("two")
    assert attempts[-1]["failure_kind"] == FailureKind.TASK_TIMEOUT.value
