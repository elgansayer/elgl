"""Agent provider health tracking and circuit breakers."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.agents.base import (
    AgentFailureKind,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.state import atomic_write_json, read_json

MAX_RETRY_AFTER_SECONDS = 7 * 24 * 3600


@dataclass
class AgentCircuitBreaker:
    provider: str
    failure_threshold: int
    cooldown_seconds: int
    state: str = "closed"
    consecutive_failures: int = 0
    opened_at: datetime | None = None
    retry_after_seconds: int | None = None

    def permits_call(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(UTC)
        if self.state != "open":
            return True
        cooldown = max(self.cooldown_seconds, self.retry_after_seconds or 0)
        if self.opened_at and current >= self.opened_at + timedelta(seconds=cooldown):
            self.state = "half-open"
            return True
        return False

    def record_success(self) -> None:
        self.state = "closed"
        self.consecutive_failures = 0
        self.opened_at = None
        self.retry_after_seconds = None

    def record_failure(
        self,
        kind: AgentFailureKind,
        now: datetime | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        if retry_after_seconds is not None:
            self.retry_after_seconds = min(retry_after_seconds, MAX_RETRY_AFTER_SECONDS)
        
        # Hard failures that open the circuit immediately
        if kind in {
            AgentFailureKind.PROVIDER_AUTH,
            AgentFailureKind.PROVIDER_QUOTA,
        }:
            self.state = "open"
            self.consecutive_failures = self.failure_threshold
            self.opened_at = now or datetime.now(UTC)
            return

        self.consecutive_failures += 1
        if self.consecutive_failures >= self.failure_threshold:
            self.state = "open"
            self.opened_at = now or datetime.now(UTC)

    def get_health(self) -> ProviderHealth:
        status = ProviderStatus.HEALTHY
        if self.state == "open":
            # Determine specific broken status if possible
            if self.consecutive_failures >= self.failure_threshold:
                status = ProviderStatus.UNAVAILABLE
        elif self.state == "half-open":
            status = ProviderStatus.DEGRADED

        retry_after = None
        if self.state == "open" and self.opened_at:
            cooldown = max(self.cooldown_seconds, self.retry_after_seconds or 0)
            retry_after = self.opened_at + timedelta(seconds=cooldown)

        return ProviderHealth(
            provider=self.provider,
            status=status,
            checked_at=datetime.now(UTC),
            retry_after=retry_after,
        )


class AgentHealthStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def save(self, breakers: Mapping[str, AgentCircuitBreaker]) -> None:
        payload = []
        for breaker in breakers.values():
            item = asdict(breaker)
            item["opened_at"] = breaker.opened_at.isoformat() if breaker.opened_at else None
            payload.append(item)
        atomic_write_json(self.path, {"breakers": payload})

    def load(self, defaults: Mapping[str, AgentCircuitBreaker] | None = None) -> dict[str, AgentCircuitBreaker]:
        payload = read_json(self.path, {"breakers": []})
        result: dict[str, AgentCircuitBreaker] = {}
        for item in payload.get("breakers", []):
            opened = item.get("opened_at")
            breaker = AgentCircuitBreaker(
                provider=item["provider"],
                failure_threshold=int(item["failure_threshold"]),
                cooldown_seconds=int(item["cooldown_seconds"]),
                state=item["state"],
                consecutive_failures=int(item["consecutive_failures"]),
                opened_at=datetime.fromisoformat(opened) if opened else None,
                retry_after_seconds=item.get("retry_after_seconds"),
            )
            result[breaker.provider] = breaker
        
        if defaults:
            for name, default_breaker in defaults.items():
                if name not in result:
                    result[name] = default_breaker
        return result
