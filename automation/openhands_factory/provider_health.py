"""Provider failure classification and persistent circuit breakers."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.models import CircuitState, FailureKind, ProviderName
from openhands_factory.state import atomic_write_json, read_json

# Never wait longer than this for a single provider response, no matter what it
# claims: caps a malformed or absurd resets_in_seconds value from wedging a
# breaker open indefinitely.
MAX_RETRY_AFTER_SECONDS = 7 * 24 * 3600
DEFAULT_FAILURE_THRESHOLD = 3
DEFAULT_COOLDOWN_SECONDS = 300


def _is_health_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("breakers"), list)


@dataclass
class CircuitBreaker:
    provider: ProviderName
    failure_threshold: int
    cooldown_seconds: int
    state: CircuitState = CircuitState.CLOSED
    consecutive_failures: int = 0
    opened_at: datetime | None = None
    # A provider-reported wait duration for the failure that opened this breaker
    # (e.g. a subscription plan's usage-limit reset), when longer than the default
    # cooldown_seconds. None means the default cooldown applies.
    retry_after_seconds: int | None = None

    def _effective_cooldown_seconds(self) -> int:
        if self.retry_after_seconds is not None:
            return max(self.cooldown_seconds, self.retry_after_seconds)
        return self.cooldown_seconds

    def permits_call(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(UTC)
        if self.state is not CircuitState.OPEN:
            return True
        cooldown = self._effective_cooldown_seconds()
        if self.opened_at and current >= self.opened_at + timedelta(seconds=cooldown):
            self.state = CircuitState.HALF_OPEN
            return True
        return False

    def record_success(self) -> None:
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.opened_at = None
        self.retry_after_seconds = None

    def record_failure(
        self,
        kind: FailureKind,
        now: datetime | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        if retry_after_seconds is not None:
            self.retry_after_seconds = min(
                max(retry_after_seconds, 0),
                MAX_RETRY_AFTER_SECONDS,
            )
        if kind in {FailureKind.AUTHENTICATION, FailureKind.CONFIGURATION, FailureKind.BUDGET}:
            self.state = CircuitState.OPEN
            self.consecutive_failures = self.failure_threshold
            self.opened_at = now or datetime.now(UTC)
            return
        self.consecutive_failures += 1
        if self.consecutive_failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
            self.opened_at = now or datetime.now(UTC)


def extract_retry_after_seconds(message: str) -> int | None:
    """Pull a provider-reported wait duration out of an error message, if present.

    Some providers (e.g. a subscription plan's usage-limit response) report
    precisely how long until the limit clears, as `"resets_in_seconds":NUMBER` in
    an embedded JSON body. That is far more informative than a fixed cooldown -
    the alternative is retrying a multi-day outage every five minutes forever.
    """
    match = re.search(r'"resets_in_seconds"\s*:\s*(\d+)', message)
    if match is None:
        return None
    return int(match.group(1))


def classify_failure(status_code: int | None, message: str) -> FailureKind:
    normalised = message.lower()
    if status_code in {401, 403} or any(
        word in normalised for word in ("expired token", "invalid api key", "authentication")
    ):
        return FailureKind.AUTHENTICATION
    if (
        status_code == 429
        or "rate limit" in normalised
        or "quota" in normalised
        or "usage limit" in normalised
    ):
        return FailureKind.RATE_LIMIT
    if "budget" in normalised or "allowance exhausted" in normalised:
        return FailureKind.BUDGET
    if status_code in {400, 404} and "model" in normalised:
        return FailureKind.CONFIGURATION
    if status_code is not None and status_code >= 500:
        return FailureKind.TRANSIENT
    if "malformed" in normalised or "invalid response" in normalised:
        return FailureKind.MALFORMED_RESPONSE
    return FailureKind.TRANSIENT


def _positive_int(value: object, default: int, *, maximum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int | str):
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    if parsed <= 0:
        return default
    if maximum is not None:
        return min(parsed, maximum)
    return parsed


def _non_negative_int(value: object, default: int = 0, *, maximum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int | str):
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    if parsed < 0:
        return default
    if maximum is not None:
        return min(parsed, maximum)
    return parsed


def _load_opened_at(value: object, *, now: datetime) -> datetime | None:
    """Recover a persisted breaker timestamp without allowing indefinite lockout."""
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    parsed = parsed.astimezone(UTC)
    if parsed > now:
        # A future opened_at can only extend the breaker beyond its configured
        # cooldown. Restart a bounded cooldown from now rather than trusting it.
        return now
    return parsed


class ProviderHealthStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def save(self, breakers: list[CircuitBreaker]) -> None:
        payload = []
        for breaker in breakers:
            item = asdict(breaker)
            item["provider"] = breaker.provider.value
            item["state"] = breaker.state.value
            item["opened_at"] = breaker.opened_at.isoformat() if breaker.opened_at else None
            payload.append(item)
        atomic_write_json(
            self.path,
            {"breakers": payload},
            validator=_is_health_payload,
        )

    def load(self, *, now: datetime | None = None) -> list[CircuitBreaker]:
        """Load breaker state defensively while failing closed for known providers.

        A malformed primary JSON file is already recovered by ``read_json`` from
        its last known-good backup. This layer handles schema-level corruption in
        otherwise valid JSON. Unknown providers are discarded. If a known
        provider has an invalid circuit state or an OPEN state with an invalid
        timestamp, it is restored as OPEN from ``now`` for one bounded cooldown
        rather than crashing the daemon or silently re-enabling the provider.
        """
        current = now or datetime.now(UTC)
        payload = read_json(self.path, {"breakers": []})
        if not isinstance(payload, dict):
            return []
        items = payload.get("breakers", [])
        if not isinstance(items, list):
            return []

        result: list[CircuitBreaker] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            provider_value = item.get("provider")
            if not isinstance(provider_value, str):
                continue
            try:
                provider = ProviderName(provider_value)
            except ValueError:
                continue

            failure_threshold = _positive_int(
                item.get("failure_threshold"), DEFAULT_FAILURE_THRESHOLD
            )
            cooldown_seconds = _positive_int(
                item.get("cooldown_seconds"),
                DEFAULT_COOLDOWN_SECONDS,
                maximum=MAX_RETRY_AFTER_SECONDS,
            )
            consecutive_failures = _non_negative_int(
                item.get("consecutive_failures"),
                maximum=1_000_000,
            )
            retry_after_raw = item.get("retry_after_seconds")
            retry_after_seconds = (
                None
                if retry_after_raw is None
                else _non_negative_int(
                    retry_after_raw,
                    maximum=MAX_RETRY_AFTER_SECONDS,
                )
            )
            opened_at = _load_opened_at(item.get("opened_at"), now=current)
            state_value = item.get("state")

            try:
                if not isinstance(state_value, str):
                    raise ValueError("persisted circuit state must be a string")
                state = CircuitState(state_value)
            except ValueError:
                state = CircuitState.OPEN
                opened_at = current
                consecutive_failures = max(consecutive_failures, failure_threshold)

            if state is CircuitState.OPEN and opened_at is None:
                opened_at = current
                consecutive_failures = max(consecutive_failures, failure_threshold)

            result.append(
                CircuitBreaker(
                    provider=provider,
                    failure_threshold=failure_threshold,
                    cooldown_seconds=cooldown_seconds,
                    state=state,
                    consecutive_failures=consecutive_failures,
                    opened_at=opened_at,
                    retry_after_seconds=retry_after_seconds,
                )
            )
        return result
