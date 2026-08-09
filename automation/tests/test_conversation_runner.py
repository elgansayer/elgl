from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationRunner
from openhands_factory.models import Task


class Conversation:
    def __init__(self) -> None:
        self.closed = False

    def send_message(self, message: str) -> None:
        assert message == "prompt"

    def run(self) -> None:
        return None

    def pause(self) -> None:
        return None

    def close(self) -> None:
        self.closed = True


def test_one_bounded_conversation_is_closed(tmp_path: Path) -> None:
    config = FactoryConfig.from_environment(
        {
            "OPENCODE_GO_API_KEY": "key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "token",
            "GEMINI_ENABLED": "false",
            "FACTORY_STATE_DIR": str(tmp_path),
        }
    )
    conversation = Conversation()
    runner = ConversationRunner(config, lambda workspace, turns: conversation)
    result = runner.run(Task("one", "Task", "body", "test", 1), tmp_path, "prompt")
    assert result.completed
    assert conversation.closed
