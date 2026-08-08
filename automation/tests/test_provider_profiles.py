from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.models import ProviderName
from openhands_factory.provider_profiles import ordered_profiles, validate_opencode


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


def test_opencode_catalogue_accepts_exact_model() -> None:
    profile = validate_opencode(config(), Client({"data": [{"id": "kimi-k2.7-code"}]}))
    assert profile.model == "openai/kimi-k2.7-code"


def test_opencode_catalogue_rejects_unlisted_model() -> None:
    import pytest

    with pytest.raises(ConfigurationError, match="not in the authenticated catalogue"):
        validate_opencode(config(), Client({"data": [{"id": "different-model"}]}))
