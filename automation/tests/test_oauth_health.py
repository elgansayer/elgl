import json
from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.oauth_health import OAuthHealthKind, inspect_openai_oauth


def config(tmp_path: Path) -> FactoryConfig:
    return FactoryConfig.from_environment(
        {
            "OPENCODE_GO_API_KEY": "not-a-real-key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "not-a-real-token",
            "GEMINI_ENABLED": "false",
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
        }
    )


def test_missing_oauth_cache_is_classified(tmp_path: Path) -> None:
    health = inspect_openai_oauth(config(tmp_path), tmp_path)
    assert health.kind is OAuthHealthKind.MISSING
    assert not health.passed


def test_empty_oauth_cache_is_missing(tmp_path: Path) -> None:
    path = tmp_path / ".openhands" / "auth" / "openai_oauth.json"
    path.parent.mkdir(parents=True)
    path.write_text("", encoding="utf-8")
    health = inspect_openai_oauth(config(tmp_path), tmp_path)
    assert health.kind is OAuthHealthKind.MISSING


def test_malformed_oauth_cache_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / ".openhands" / "auth" / "openai_oauth.json"
    path.parent.mkdir(parents=True)
    path.write_text("not-json", encoding="utf-8")
    health = inspect_openai_oauth(config(tmp_path), tmp_path)
    assert health.kind is OAuthHealthKind.MALFORMED
    assert not health.passed


def test_empty_json_object_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / ".openhands" / "auth" / "openai_oauth.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({}), encoding="utf-8")
    health = inspect_openai_oauth(config(tmp_path), tmp_path)
    assert health.kind is OAuthHealthKind.MALFORMED
