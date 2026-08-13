import httpx

from openhands_factory.alerts import AlertService
from openhands_factory.config import FactoryConfig


def factory_config(**overrides: str) -> FactoryConfig:
    environment = {
        "OPENCODE_GO_API_KEY": "not-a-real-key",
        "OPENCODE_GO_MODEL": "deepseek-v4-flash",
        "GITHUB_TOKEN": "not-a-real-token",
        "GEMINI_ENABLED": "false",
    }
    environment.update(overrides)
    return FactoryConfig.from_environment(environment)


def test_alert_send_returns_false_without_telegram_credentials() -> None:
    config = factory_config()

    assert AlertService(config).send("failure") is False


def test_alert_send_does_not_break_the_factory_on_delivery_error(monkeypatch) -> None:
    config = factory_config(TELEGRAM_BOT_TOKEN="token", TELEGRAM_CHAT_ID="chat")

    def fail(*_args, **_kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr("openhands_factory.alerts.httpx.post", fail)

    assert AlertService(config).send("failure") is False
