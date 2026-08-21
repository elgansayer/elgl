from pathlib import Path

from openhands_factory import cli
from openhands_factory.oauth_health import OAuthHealth, OAuthHealthKind


def test_online_doctor_warns_when_optional_openai_subscription_smoke_fails(
    monkeypatch,
) -> None:
    monkeypatch.setattr(cli, "run_doctor", lambda config, online: [])
    monkeypatch.setattr(cli, "_legacy_checks", lambda: [])
    monkeypatch.setattr(
        cli,
        "smoke_openai_subscription",
        lambda config: OAuthHealth(
            OAuthHealthKind.AUTH_FAILURE,
            False,
            "subscription unavailable",
        ),
    )

    checks = cli._doctor_checks(object(), online=True)
    subscription = next(check for check in checks if check.name == "openai-subscription-online")

    assert subscription.passed
    assert subscription.warning
    assert "separate from Codex CLI" in subscription.detail
    assert "subscription unavailable" in subscription.detail


def test_systemd_requires_provider_preflight_before_daemon_start() -> None:
    repository = Path(__file__).parents[2]
    unit_lines = (
        (repository / "config" / "systemd" / "hellotalk-factory.service")
        .read_text(encoding="utf-8")
        .splitlines()
    )

    preflight = "ExecStartPre=/opt/hellotalk-factory/venv/bin/hellotalk-factory providers check"
    daemon = "ExecStart=/opt/hellotalk-factory/venv/bin/hellotalk-factory daemon"

    assert preflight in unit_lines
    assert daemon in unit_lines
    assert unit_lines.index(preflight) < unit_lines.index(daemon)
