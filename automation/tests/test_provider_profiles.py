from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.models import ProviderName
from openhands_factory.provider_profiles import (
    openai_credentials_available,
    ordered_profiles,
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


def config() -> FactoryConfig:
    return FactoryConfig.from_environment(
        {
            "OPENCODE_GO_API_KEY": "not-a-real-key",
            "OPENCODE_GO_MODEL": "kimi-k2.7-code",
            "GITHUB_TOKEN": "not-a-real-token",
            "GEMINI_ENABLED": "false",
        }
    )


def test_provider_priority_order() -> None:
    assert [profile.name for profile in ordered_profiles(config())] == [
        ProviderName.OPENAI_SUBSCRIPTION,
        ProviderName.OPENCODE_GO,
    ]


def test_configured_three_provider_order_and_models() -> None:
    factory_config = FactoryConfig.from_environment(
        {
            "OPENHANDS_OPENAI_MODEL": "gpt-5.6-sol",
            "OPENCODE_GO_API_KEY": "not-a-real-key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "not-a-real-token",
            "GEMINI_ENABLED": "true",
            "GEMINI_API_KEY": "not-a-real-key",
            "GEMINI_MODEL": "gemini-3.6-flash",
        }
    )

    profiles = ordered_profiles(factory_config)

    assert [profile.name for profile in profiles] == [
        ProviderName.OPENAI_SUBSCRIPTION,
        ProviderName.OPENCODE_GO,
        ProviderName.GEMINI,
    ]
    assert [profile.model for profile in profiles] == [
        "gpt-5.6-sol",
        "openai/deepseek-v4-flash",
        "gemini/gemini-3.6-flash",
    ]


def test_openai_credentials_must_exist_and_be_non_empty(tmp_path: Path) -> None:
    credentials = tmp_path / ".openhands" / "auth" / "openai_oauth.json"
    credentials.parent.mkdir(parents=True)

    assert not openai_credentials_available(tmp_path)
    credentials.write_text("{}", encoding="utf-8")
    assert openai_credentials_available(tmp_path)


def test_opencode_catalogue_accepts_exact_model() -> None:
    profile = validate_opencode(config(), Client({"data": [{"id": "kimi-k2.7-code"}]}))
    assert profile.model == "openai/kimi-k2.7-code"


def test_opencode_catalogue_rejects_unlisted_model() -> None:
    import pytest

    with pytest.raises(ConfigurationError, match="not in the authenticated catalogue"):
        validate_opencode(config(), Client({"data": [{"id": "different-model"}]}))
