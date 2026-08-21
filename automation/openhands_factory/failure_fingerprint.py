"""Stable failure identities for retry, recovery, and alert deduplication."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from openhands_factory.models import FailureKind, ProviderName

_HEX_IDENTIFIER = re.compile(r"\b[0-9a-fA-F]{12,}\b")
_UUID = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-"
    r"[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)
_ISO_TIMESTAMP = re.compile(
    r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})\b",
    re.IGNORECASE,
)
_LONG_NUMBER = re.compile(r"\b\d{5,}\b")
_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class FailureFingerprint:
    """Canonical identity plus bounded diagnostic text for one failure class."""

    digest: str
    canonical: str


def _normalise_detail(detail: str) -> str:
    """Remove high-cardinality values while preserving the useful failure shape."""

    value = detail.strip().lower()
    value = _UUID.sub("<uuid>", value)
    value = _ISO_TIMESTAMP.sub("<timestamp>", value)
    value = _HEX_IDENTIFIER.sub("<hex>", value)
    value = _LONG_NUMBER.sub("<number>", value)
    return _WHITESPACE.sub(" ", value)[:1000]


def fingerprint_failure(
    kind: FailureKind,
    detail: str,
    *,
    provider: ProviderName | str | None = None,
    phase: str | None = None,
) -> FailureFingerprint:
    """Build a restart-stable fingerprint for semantically equivalent failures."""

    normalised_phase = _WHITESPACE.sub("-", (phase or "").strip().lower())
    if isinstance(provider, ProviderName):
        provider_value = provider.value
    else:
        provider_value = (provider or "").strip().lower()
    canonical = "|".join(
        (
            kind.value,
            provider_value,
            normalised_phase,
            _normalise_detail(detail),
        )
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:20]
    return FailureFingerprint(digest=digest, canonical=canonical)
