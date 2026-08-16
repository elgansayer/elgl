"""Structured health checks for OpenHands ChatGPT subscription OAuth.

The controller owns OAuth state. Worker containers must never receive or parse the
credential cache. This module uses OpenHands' subscription-auth API for local
credential/model validation and performs a tiny completion only for explicit online
readiness checks.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any

from openhands_factory.config import FactoryConfig


class OAuthHealthKind(StrEnum):
    HEALTHY = "healthy"
    MISSING = "missing"
    MALFORMED = "malformed"
    EXPIRED = "expired"
    UNSUPPORTED_MODEL = "unsupported-model"
    AUTH_FAILURE = "auth-failure"
    THROTTLED = "throttled"
    SDK_UNAVAILABLE = "sdk-unavailable"


@dataclass(frozen=True)
class OAuthHealth:
    kind: OAuthHealthKind
    passed: bool
    detail: str


def credential_path(home: Path | None = None) -> Path:
    return (home or Path.home()) / ".openhands" / "auth" / "openai_oauth.json"


def _parse_cache(path: Path) -> dict[str, Any] | None:
    if not path.is_file() or path.stat().st_size == 0:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"OAuth credential cache is unreadable: {error}") from error
    if not isinstance(payload, dict) or not payload:
        raise ValueError("OAuth credential cache is not a non-empty JSON object")
    return payload


def inspect_openai_oauth(config: FactoryConfig, home: Path | None = None) -> OAuthHealth:
    """Inspect cached OpenHands subscription credentials without prompting for login."""

    path = credential_path(home)
    try:
        cache = _parse_cache(path)
    except ValueError as error:
        return OAuthHealth(OAuthHealthKind.MALFORMED, False, str(error))
    if cache is None:
        return OAuthHealth(
            OAuthHealthKind.MISSING,
            False,
            "OpenHands OAuth credentials are missing",
        )

    try:
        from openhands.sdk.llm import OpenAISubscriptionAuth
    except (ImportError, AttributeError) as error:
        return OAuthHealth(
            OAuthHealthKind.SDK_UNAVAILABLE,
            False,
            f"OpenHands subscription-auth API unavailable: {error}",
        )

    try:
        auth = OpenAISubscriptionAuth()
        credentials = auth.get_credentials()
        if credentials is None:
            return OAuthHealth(
                OAuthHealthKind.MALFORMED,
                False,
                "OpenHands could not load cached OAuth credentials",
            )
        if not auth.has_valid_credentials():
            is_expired = getattr(credentials, "is_expired", None)
            expired = bool(is_expired()) if callable(is_expired) else True
            kind = OAuthHealthKind.EXPIRED if expired else OAuthHealthKind.AUTH_FAILURE
            return OAuthHealth(kind, False, "OpenHands OAuth credentials are not currently valid")
        auth.create_llm(model=config.openai_model, credentials=credentials)
    except ValueError as error:
        message = str(error)
        lowered = message.lower()
        if "model" in lowered and ("support" in lowered or "codex" in lowered):
            return OAuthHealth(OAuthHealthKind.UNSUPPORTED_MODEL, False, message)
        return OAuthHealth(OAuthHealthKind.AUTH_FAILURE, False, message)
    except RuntimeError as error:
        return OAuthHealth(OAuthHealthKind.AUTH_FAILURE, False, str(error))

    return OAuthHealth(
        OAuthHealthKind.HEALTHY,
        True,
        f"valid subscription OAuth for {config.openai_model}",
    )


def smoke_openai_subscription(config: FactoryConfig) -> OAuthHealth:
    """Perform one bounded non-mutating subscription completion."""

    local = inspect_openai_oauth(config)
    if not local.passed:
        return local
    try:
        from openhands.sdk import LLM, Message, TextContent

        llm = LLM.subscription_login(
            vendor="openai",
            model=config.openai_model,
            open_browser=False,
        )
        llm.completion(
            messages=[Message(role="user", content=[TextContent(text="Reply with OK only.")])],
            timeout=20,
            max_output_tokens=8,
        )
    except ValueError as error:
        return OAuthHealth(OAuthHealthKind.UNSUPPORTED_MODEL, False, str(error))
    except RuntimeError as error:
        return OAuthHealth(OAuthHealthKind.AUTH_FAILURE, False, str(error))
    except Exception as error:  # SDK/provider exception classes vary by installed release.
        name = type(error).__name__
        message = str(error)
        lowered = f"{name} {message}".lower()
        if "rate" in lowered or "429" in lowered or "thrott" in lowered:
            return OAuthHealth(
                OAuthHealthKind.THROTTLED,
                False,
                f"subscription throttled: {name}: {message}",
            )
        return OAuthHealth(
            OAuthHealthKind.AUTH_FAILURE,
            False,
            f"subscription smoke failed: {name}: {message}",
        )
    return OAuthHealth(
        OAuthHealthKind.HEALTHY,
        True,
        f"subscription smoke passed for {config.openai_model}",
    )
