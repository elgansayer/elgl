from datetime import UTC, datetime
from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError, FactoryError
from openhands_factory.models import CircuitState, ProviderName
from openhands_factory.provider_health import CircuitBreaker, ProviderHealthStore
from openhands_factory.provider_profiles import (
    openai_credentials_available,
    ordered_profiles,
    select_primary_provider,
    validate_opencode,
)


class Response:
    status_code = 200

    def __init__(self, payload: object) -> None:
        self.payload = payload

    def json(self) -> object:
        return self.payload

    def raise_for_status(self) -> None:
        return None


class Client:
    def __init__(self, payload: object) -> None:
        self.payload = payload

    def get(self, url: str, *, headers: dict[str, str], timeout: float) -> Response:
        assert "not-a-real-key" in headers["Authorization"]
        assert url.endswith("/models")
        return Response(self.payload)


def config(**overrides: str) -> FactoryConfig:
    environment = {
        "OPENCODE_GO_API_KEY": "not-a-real-key",
        "OPENCODE_GO_MODEL": "kimi-k2.7-code",
        "GITHUB_TOKEN": "not-a-real-token",
    }
    environment.update(overrides)
    return FactoryConfig.from_environment(environment)


def test_default_provider_policy_is_codex_oauth_then_opencode() -> None:
    factory_config = config()
    assert factory_config.openai_model == "gpt-5.6-sol"
    assert factory_config.gemini_enabled is False
    assert [profile.name for profile in ordered_profiles(factory_config)] == [
        ProviderName.OPENAI_SUBSCRIPTION,
        ProviderName.OPENCODE_GO,
    ]


def test_provider_priority_order() -> None:
    assert [profile.name for profile in ordered_profiles(config())] == [
        ProviderName.OPENAI_SUBSCRIPTION,
        ProviderName.OPENCODE_GO,
    ]


def test_gemini_cannot_be_reenabled_as_a_production_fallback() -> None:
    with pytest.raises(ConfigurationError, match="GEMINI_ENABLED is retired"):
        config(GEMINI_ENABLED="true", GEMINI_API_KEY="not-a-real-key")


def test_openai_credentials_must_exist_and_be_non_empty(tmp_path: Path) -> None:
    credentials = tmp_path / ".openhands" / "auth" / "openai_oauth.json"
    credentials.parent.mkdir(parents=True)
    assert not openai_credentials_available(home=tmp_path)
    credentials.write_text("{}", encoding="utf-8")
    assert openai_credentials_available(home=tmp_path)


def test_opencode_catalogue_accepts_exact_model() -> None:
    profile = validate_opencode(config(), Client({"data": [{"id": "kimi-k2.7-code"}]}))
    assert profile.model == "openai/kimi-k2.7-code"


def test_opencode_catalogue_rejects_unlisted_model() -> None:
    with pytest.raises(ConfigurationError, match="not in the authenticated catalogue"):
        validate_opencode(config(), Client({"data": [{"id": "different-model"}]}))


def test_factory_waits_when_both_openhands_inner_providers_are_unavailable(
    tmp_path: Path,
) -> None:
    factory_config = config(
        FACTORY_STATE_DIR=str(tmp_path),
        OPENCODE_GO_MODEL="deepseek-v4-flash",
    )
    ProviderHealthStore(factory_config.state_dir / "health.json").save(
        [
            CircuitBreaker(
                ProviderName.OPENCODE_GO,
                1,
                3600,
                state=CircuitState.OPEN,
                consecutive_failures=1,
                opened_at=datetime.now(UTC),
            )
        ]
    )
    with pytest.raises(FactoryError, match="Both OpenHands inner providers"):
        select_primary_provider(factory_config)
