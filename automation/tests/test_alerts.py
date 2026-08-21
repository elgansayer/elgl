from pathlib import Path

import httpx

from openhands_factory.alerts import AlertService
from openhands_factory.config import FactoryConfig


def factory_config(tmp_path: Path, **overrides: str) -> FactoryConfig:
    environment = {
        "OPENCODE_GO_API_KEY": "not-a-real-key",
        "OPENCODE_GO_MODEL": "deepseek-v4-flash",
        "GITHUB_TOKEN": "not-a-real-token",
        "GEMINI_ENABLED": "false",
        "FACTORY_STATE_DIR": str(tmp_path / "state"),
    }
    environment.update(overrides)
    return FactoryConfig.from_environment(environment)


def test_alert_send_returns_false_without_telegram_credentials(tmp_path: Path) -> None:
    config = factory_config(tmp_path)

    assert AlertService(config).send("failure") is False


def test_alert_send_does_not_break_the_factory_on_delivery_error(
    tmp_path: Path, monkeypatch
) -> None:
    config = factory_config(tmp_path, TELEGRAM_BOT_TOKEN="token", TELEGRAM_CHAT_ID="chat")

    def fail(*_args, **_kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr("openhands_factory.alerts.httpx.post", fail)

    assert AlertService(config).send("failure") is False


def test_repeated_alerts_in_the_same_category_are_suppressed_after_the_first(
    tmp_path: Path, monkeypatch
) -> None:
    config = factory_config(tmp_path, TELEGRAM_BOT_TOKEN="token", TELEGRAM_CHAT_ID="chat")
    sent_texts: list[str] = []

    class Response:
        is_success = True

    def fake_post(_url, json, timeout):
        sent_texts.append(json["text"])
        return Response()

    monkeypatch.setattr("openhands_factory.alerts.httpx.post", fake_post)
    service = AlertService(config)

    first = service.send("OpenHands factory ultimate failure: issue #1 quarantined")
    second = service.send("OpenHands factory ultimate failure: issue #2 quarantined")
    third = service.send("OpenHands factory ultimate failure: issue #3 quarantined")

    assert first is True
    assert second is False
    assert third is False
    assert len(sent_texts) == 1


def test_alert_after_cooldown_reports_the_suppressed_count(tmp_path: Path, monkeypatch) -> None:
    from datetime import UTC, datetime, timedelta

    from openhands_factory.state import atomic_write_json, read_json

    config = factory_config(tmp_path, TELEGRAM_BOT_TOKEN="token", TELEGRAM_CHAT_ID="chat")
    sent_texts: list[str] = []

    class Response:
        is_success = True

    def fake_post(_url, json, timeout):
        sent_texts.append(json["text"])
        return Response()

    monkeypatch.setattr("openhands_factory.alerts.httpx.post", fake_post)
    service = AlertService(config, cooldown_seconds=1800)

    service.send("OpenHands factory ultimate failure: issue #1 quarantined")
    service.send("OpenHands factory ultimate failure: issue #2 quarantined")
    service.send("OpenHands factory ultimate failure: issue #3 quarantined")

    state = read_json(service.state_path, {})
    category = "OpenHands factory ultimate failure"
    state[category]["last_sent"] = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    atomic_write_json(service.state_path, state)

    service.send("OpenHands factory ultimate failure: issue #4 quarantined")

    assert len(sent_texts) == 2
    assert "2 similar alerts suppressed" in sent_texts[-1]


def test_factory_health_alerts_use_the_check_name_as_the_cooldown_category(
    tmp_path: Path, monkeypatch
) -> None:
    config = factory_config(tmp_path, TELEGRAM_BOT_TOKEN="token", TELEGRAM_CHAT_ID="chat")
    sent_texts: list[str] = []

    class Response:
        is_success = True

    def fake_post(_url, json, timeout):
        sent_texts.append(json["text"])
        return Response()

    monkeypatch.setattr("openhands_factory.alerts.httpx.post", fake_post)
    service = AlertService(config)

    quarantine = service.send("OpenHands factory alert: jobs-quarantined: ALERT: issues=1")
    stalled = service.send("OpenHands factory alert: jobs-stalled: ALERT: issues=2")

    assert quarantine is True
    assert stalled is True
    assert len(sent_texts) == 2


def test_large_issue_lists_are_compacted_before_delivery(tmp_path: Path, monkeypatch) -> None:
    config = factory_config(tmp_path, TELEGRAM_BOT_TOKEN="token", TELEGRAM_CHAT_ID="chat")
    sent_texts: list[str] = []

    class Response:
        is_success = True

    def fake_post(_url, json, timeout):
        sent_texts.append(json["text"])
        return Response()

    monkeypatch.setattr("openhands_factory.alerts.httpx.post", fake_post)
    identifiers = ",".join(str(identifier) for identifier in range(1, 101))

    sent = AlertService(config).send(
        f"OpenHands factory alert: jobs-quarantined: ALERT: issues={identifiers}"
    )

    assert sent is True
    assert "issues=1,2,3,4,5,6,7,8,..." in sent_texts[0]
    assert "total=100" in sent_texts[0]
    assert "+92 more" in sent_texts[0]
    assert ",9," not in sent_texts[0]
    assert len(sent_texts[0]) < 4000


def test_different_categories_are_not_suppressed_by_each_other(tmp_path: Path, monkeypatch) -> None:
    config = factory_config(tmp_path, TELEGRAM_BOT_TOKEN="token", TELEGRAM_CHAT_ID="chat")
    sent_texts: list[str] = []

    class Response:
        is_success = True

    def fake_post(_url, json, timeout):
        sent_texts.append(json["text"])
        return Response()

    monkeypatch.setattr("openhands_factory.alerts.httpx.post", fake_post)
    service = AlertService(config)

    quarantine = service.send("OpenHands factory ultimate failure: issue #1 quarantined")
    disk_alert = service.send("OpenHands factory alert: low-disk: 2 GiB free")

    assert quarantine is True
    assert disk_alert is True
    assert len(sent_texts) == 2
