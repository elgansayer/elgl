"""Validated OpenHands provider construction.

The active OpenHands-on-VPS LLM chain uses OpenAI subscription OAuth (Codex) first.
OpenCode Go is an optional configured fallback. Historical Gemini helpers remain only
for state/config migration compatibility and are never selected by production routing.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

import httpx
from pydantic import SecretStr

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError, FactoryError
from openhands_factory.models import ProviderName
from openhands_factory.oauth_health import inspect_openai_oauth
from openhands_factory.provider_health import ProviderHealthStore

if TYPE_CHECKING:
    from openhands.sdk import LLM


class JsonResponse(Protocol):
    status_code: int

    def json(self) -> object: ...

    def raise_for_status(self) -> None: ...


class HttpClient(Protocol):
    def get(self, url: str, *, headers: dict[str, str], timeout: float) -> JsonResponse: ...


@dataclass(frozen=True)
class ProviderProfile:
    name: ProviderName
    profile_name: str
    model: str
    base_url: str | None
    api_key: SecretStr | None


@dataclass(frozen=True)
class ProviderDecision:
    provider: ProviderName
    fallback_reason: str | None = None


def openai_credentials_available(
    config: FactoryConfig | None = None, home: Path | None = None
) -> bool:
    if config is None:
        credentials = (home or Path.home()) / ".openhands" / "auth" / "openai_oauth.json"
        return credentials.is_file() and credentials.stat().st_size > 0

    if not inspect_openai_oauth(config, home).passed:
        return False
    store = ProviderHealthStore(config.state_dir / "health.json")
    for breaker in store.load():
        if breaker.provider == ProviderName.OPENAI_SUBSCRIPTION and not breaker.permits_call():
            return False
    return True


def _model_identifiers(payload: object) -> set[str]:
    if not isinstance(payload, dict):
        raise ConfigurationError("Provider model catalogue was not a JSON object")
    data = payload.get("data", payload.get("models", []))
    if not isinstance(data, list):
        raise ConfigurationError("Provider model catalogue did not contain a model list")
    identifiers: set[str] = set()
    for item in data:
        if not isinstance(item, dict):
            continue
        identifier = item.get("id", item.get("name"))
        if isinstance(identifier, str):
            identifiers.add(identifier.removeprefix("models/"))
    return identifiers


def _opencode_credentials(config: FactoryConfig) -> tuple[SecretStr, str]:
    if config.opencode_api_key is None or config.opencode_model is None:
        raise ConfigurationError("OpenCode Go is not configured")
    return config.opencode_api_key, config.opencode_model


def discover_opencode_models(config: FactoryConfig, client: HttpClient | None = None) -> set[str]:
    api_key, _ = _opencode_credentials(config)
    http = client or httpx.Client()
    response = http.get(
        f"{config.opencode_base_url}/models",
        headers={"Authorization": f"Bearer {api_key.get_secret_value()}"},
        timeout=20,
    )
    response.raise_for_status()
    return _model_identifiers(response.json())


def validate_opencode(config: FactoryConfig, client: HttpClient | None = None) -> ProviderProfile:
    api_key, model = _opencode_credentials(config)
    available = discover_opencode_models(config, client)
    if model not in available:
        raise ConfigurationError(
            f"Configured OpenCode Go model {model!r} is not in the authenticated catalogue"
        )
    return ProviderProfile(
        name=ProviderName.OPENCODE_GO,
        profile_name=config.opencode_profile_name,
        model=f"openai/{model}",
        base_url=config.opencode_base_url,
        api_key=api_key,
    )


def discover_gemini_models(config: FactoryConfig, client: HttpClient | None = None) -> set[str]:
    """Legacy diagnostic helper retained for backwards-compatible config migration."""
    if config.gemini_api_key is None:
        return set()
    http = client or httpx.Client()
    response = http.get(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
        headers={"x-goog-api-key": config.gemini_api_key.get_secret_value()},
        timeout=20,
    )
    response.raise_for_status()
    return _model_identifiers(response.json())


def validate_gemini(
    config: FactoryConfig, client: HttpClient | None = None
) -> ProviderProfile | None:
    """Legacy diagnostic helper; Gemini is not eligible for production routing."""
    if not config.gemini_enabled:
        return None
    if config.monthly_variable_budget_usd != 0 or not config.gemini_free_tier_only:
        raise ConfigurationError("Gemini must remain free-tier-only while billing is disabled")
    available = discover_gemini_models(config, client)
    if config.gemini_model not in available:
        raise ConfigurationError(
            f"Configured Gemini model {config.gemini_model!r} is not in the authenticated catalogue"
        )
    return ProviderProfile(
        name=ProviderName.GEMINI,
        profile_name=config.gemini_profile_name,
        model=f"gemini/{config.gemini_model}",
        base_url=None,
        api_key=config.gemini_api_key,
    )


def ordered_profiles(config: FactoryConfig) -> list[ProviderProfile]:
    """Return the authoritative OpenHands LLM chain for this host."""
    profiles = [
        ProviderProfile(
            ProviderName.OPENAI_SUBSCRIPTION,
            "openai-subscription",
            config.openai_model,
            None,
            None,
        )
    ]
    if config.opencode_go_enabled:
        api_key, model = _opencode_credentials(config)
        profiles.append(
            ProviderProfile(
                ProviderName.OPENCODE_GO,
                config.opencode_profile_name,
                f"openai/{model}",
                config.opencode_base_url,
                api_key,
            )
        )
    return profiles


def select_provider_decision(
    config: FactoryConfig,
    *,
    prefer_different_from: ProviderName | None = None,
) -> ProviderDecision:
    """Choose one stable OpenHands LLM provider for a whole conversation."""
    store = ProviderHealthStore(config.state_dir / "health.json")
    breakers = {breaker.provider: breaker for breaker in store.load()}
    oauth = inspect_openai_oauth(config)
    openai_breaker = breakers.get(ProviderName.OPENAI_SUBSCRIPTION)
    openai_usable = oauth.passed and (
        openai_breaker is None or openai_breaker.permits_call()
    )

    opencode_breaker = breakers.get(ProviderName.OPENCODE_GO)
    opencode_usable = config.opencode_go_enabled and (
        opencode_breaker is None or opencode_breaker.permits_call()
    )

    if prefer_different_from is ProviderName.OPENAI_SUBSCRIPTION and opencode_usable:
        return ProviderDecision(
            ProviderName.OPENCODE_GO,
            "independent-review-provider-diversity",
        )
    if prefer_different_from is ProviderName.OPENCODE_GO and openai_usable:
        return ProviderDecision(
            ProviderName.OPENAI_SUBSCRIPTION,
            "independent-review-provider-diversity",
        )

    if openai_usable:
        return ProviderDecision(ProviderName.OPENAI_SUBSCRIPTION)

    if not oauth.passed:
        fallback_reason = f"openai-oauth-{oauth.kind.value}"
    else:
        fallback_reason = "openai-provider-circuit-open"

    if opencode_usable:
        return ProviderDecision(ProviderName.OPENCODE_GO, fallback_reason)

    configured = "Codex subscription OAuth"
    if config.opencode_go_enabled:
        configured += " and OpenCode Go"
    raise FactoryError(f"No configured OpenHands LLM provider is currently available ({configured})")


def select_primary_provider(config: FactoryConfig) -> ProviderName:
    """Compatibility wrapper returning only the conversation-stable provider."""
    return select_provider_decision(config).provider


def build_llm(config: FactoryConfig, provider: ProviderName | None = None) -> LLM:
    """Construct this conversation's sole LLM, with no per-call fallback chain."""
    from openhands.sdk import LLM

    selected_provider = provider or select_primary_provider(config)
    if selected_provider is ProviderName.OPENAI_SUBSCRIPTION:
        return LLM.subscription_login(
            vendor="openai",
            model=config.openai_model,
            open_browser=False,
        )
    if selected_provider is ProviderName.OPENCODE_GO:
        api_key, model = _opencode_credentials(config)
        return LLM(
            model=f"openai/{model}",
            api_key=api_key,
            base_url=config.opencode_base_url,
            usage_id=config.opencode_profile_name,
            reasoning_effort="none",
        )
    raise ConfigurationError(
        f"Provider {selected_provider.value!r} is historical-only and is not eligible "
        "for production factory conversations"
    )
