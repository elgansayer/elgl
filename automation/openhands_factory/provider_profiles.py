"""Validated OpenHands provider construction."""

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


def discover_opencode_models(config: FactoryConfig, client: HttpClient | None = None) -> set[str]:
    http = client or httpx.Client()
    response = http.get(
        f"{config.opencode_base_url}/models",
        headers={"Authorization": f"Bearer {config.opencode_api_key.get_secret_value()}"},
        timeout=20,
    )
    response.raise_for_status()
    return _model_identifiers(response.json())


def validate_opencode(config: FactoryConfig, client: HttpClient | None = None) -> ProviderProfile:
    available = discover_opencode_models(config, client)
    if config.opencode_model not in available:
        raise ConfigurationError(
            f"Configured OpenCode Go model {config.opencode_model!r} is not in the "
            "authenticated catalogue"
        )
    return ProviderProfile(
        name=ProviderName.OPENCODE_GO,
        profile_name=config.opencode_profile_name,
        model=f"openai/{config.opencode_model}",
        base_url=config.opencode_base_url,
        api_key=config.opencode_api_key,
    )


def discover_gemini_models(config: FactoryConfig, client: HttpClient | None = None) -> set[str]:
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
    profiles = [
        ProviderProfile(
            ProviderName.OPENAI_SUBSCRIPTION,
            "openai-subscription",
            config.openai_model,
            None,
            None,
        ),
        ProviderProfile(
            ProviderName.OPENCODE_GO,
            config.opencode_profile_name,
            f"openai/{config.opencode_model}",
            config.opencode_base_url,
            config.opencode_api_key,
        ),
    ]
    if config.gemini_enabled:
        profiles.append(
            ProviderProfile(
                ProviderName.GEMINI,
                config.gemini_profile_name,
                f"gemini/{config.gemini_model}",
                None,
                config.gemini_api_key,
            )
        )
    return profiles


def select_primary_provider(config: FactoryConfig) -> ProviderName:
    """Pick the healthiest available provider tier for one conversation.

    Every configured tier's circuit breaker is authoritative. If all usable tiers
    are cooling down, fail the attempt locally so the job-level backoff can wait
    rather than hammering a provider whose breaker is already open.
    """
    if openai_credentials_available(config):
        return ProviderName.OPENAI_SUBSCRIPTION

    store = ProviderHealthStore(config.state_dir / "health.json")
    breakers = {breaker.provider: breaker for breaker in store.load()}

    opencode_breaker = breakers.get(ProviderName.OPENCODE_GO)
    if opencode_breaker is None or opencode_breaker.permits_call():
        return ProviderName.OPENCODE_GO

    if config.gemini_enabled and config.gemini_api_key is not None:
        gemini_breaker = breakers.get(ProviderName.GEMINI)
        if gemini_breaker is None or gemini_breaker.permits_call():
            return ProviderName.GEMINI

    raise FactoryError("All configured model providers are temporarily unavailable")


def build_llm(config: FactoryConfig, provider: ProviderName | None = None) -> LLM:
    """Construct this conversation's sole LLM, with no per-call fallback chain.

    The caller may reserve a provider before process startup and pass it here. When
    no provider is supplied, this helper preserves the existing standalone behavior
    by selecting the healthiest provider once. A reserved provider is never silently
    replaced inside the conversation.
    """
    from openhands.sdk import LLM

    selected_provider = provider or select_primary_provider(config)
    if selected_provider is ProviderName.OPENAI_SUBSCRIPTION:
        return LLM.subscription_login(
            vendor="openai",
            model=config.openai_model,
            open_browser=False,
        )
    if selected_provider is ProviderName.GEMINI:
        return LLM(
            model=f"gemini/{config.gemini_model}",
            api_key=config.gemini_api_key,
            usage_id=config.gemini_profile_name,
        )
    return LLM(
        model=f"openai/{config.opencode_model}",
        api_key=config.opencode_api_key,
        base_url=config.opencode_base_url,
        usage_id=config.opencode_profile_name,
        reasoning_effort="none",
    )
