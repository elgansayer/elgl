"""Provider failure classification and persistent circuit breakers."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.models import CircuitState, FailureKind, ProviderName
from openhands_factory.state import atomic_write_json, read_json


@dataclass
class CircuitBreaker:
    provider: ProviderName
    failure_threshold: int
    cooldown_seconds: int
    state: CircuitState = CircuitState.CLOSED
    consecutive_failures: int = 0
    opened_at: datetime | None = None

    def permits_call(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(UTC)
        if self.state is not CircuitState.OPEN:
            return True
        if self.opened_at and current >= self.opened_at + timedelta(seconds=self.cooldown_seconds):
            self.state = CircuitState.HALF_OPEN
            return True
        return False

    def record_success(self) -> None:
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.opened_at = None

    def record_failure(self, kind: FailureKind, now: datetime | None = None) -> None:
        if kind in {FailureKind.AUTHENTICATION, FailureKind.CONFIGURATION, FailureKind.BUDGET}:
            self.state = CircuitState.OPEN
            self.consecutive_failures = self.failure_threshold
            self.opened_at = now or datetime.now(UTC)
            return
        self.consecutive_failures += 1
        if self.consecutive_failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
            self.opened_at = now or datetime.now(UTC)


def classify_failure(status_code: int | None, message: str) -> FailureKind:
    normalised = message.lower()
    if status_code in {401, 403} or any(
        word in normalised for word in ("expired token", "invalid api key", "authentication")
    ):
        return FailureKind.AUTHENTICATION
    if status_code == 429 or "rate limit" in normalised or "quota" in normalised:
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
        atomic_write_json(self.path, {"breakers": payload})

    def load(self) -> list[CircuitBreaker]:
        payload = read_json(self.path, {"breakers": []})
        result: list[CircuitBreaker] = []
        for item in payload.get("breakers", []):
            opened = item.get("opened_at")
            result.append(
                CircuitBreaker(
                    provider=ProviderName(item["provider"]),
                    failure_threshold=int(item["failure_threshold"]),
                    cooldown_seconds=int(item["cooldown_seconds"]),
                    state=CircuitState(item["state"]),
                    consecutive_failures=int(item["consecutive_failures"]),
                    opened_at=datetime.fromisoformat(opened) if opened else None,
                )
            )
        return result
