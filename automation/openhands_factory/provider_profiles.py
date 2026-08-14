"""Validated OpenHands provider construction."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

import httpx
from pydantic import SecretStr

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.models import ProviderName
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
    credentials = (home or Path.home()) / ".openhands" / "auth" / "openai_oauth.json"
    if not (credentials.is_file() and credentials.stat().st_size > 0):
        return False
    if config is not None:
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
    """Pick the healthiest provider tier for a conversation to use exclusively.

    No per-call cross-provider fallback is attached in build_llm() (see there for
    why), so the provider chosen here is the only one the conversation will use for
    its whole duration. Resilience across tiers instead comes from the daemon's job
    retry: build_llm() is called fresh per attempt, and each tier's circuit breaker
    in health.json already tracks whether it is currently healthy enough to try.
    """
    if openai_credentials_available(config):
        return ProviderName.OPENAI_SUBSCRIPTION
    store = ProviderHealthStore(config.state_dir / "health.json")
    breakers = {breaker.provider: breaker for breaker in store.load()}
    opencode_breaker = breakers.get(ProviderName.OPENCODE_GO)
    if opencode_breaker is None or opencode_breaker.permits_call():
        return ProviderName.OPENCODE_GO
    if config.gemini_enabled and config.gemini_api_key is not None:
        return ProviderName.GEMINI
    return ProviderName.OPENCODE_GO


def build_llm(config: FactoryConfig) -> LLM:
    """Construct this conversation's sole LLM, with no per-call fallback chain.

    openhands' FallbackStrategy retries the primary model first on every new turn
    (fallback is per-call, not per-conversation), so a multi-turn conversation that
    dips to a fallback provider on one turn and back to a strict-validating primary
    on the next replays that fallback provider's tool-call ID format into the
    primary - which OpenAI's Responses API rejects outright with "Expected an ID
    that begins with 'fc'". This is an upstream litellm bug with no released fix
    yet: https://github.com/BerriAI/litellm/pull/34387 (open since 2026-07-23).
    Provider selection instead happens once per conversation via
    select_primary_provider(), which is breaker-aware.
    """
    from openhands.sdk import LLM

    provider = select_primary_provider(config)
    if provider is ProviderName.OPENAI_SUBSCRIPTION:
        return LLM.subscription_login(
            vendor="openai",
            model=config.openai_model,
            open_browser=False,
        )
    if provider is ProviderName.GEMINI:
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
    )
