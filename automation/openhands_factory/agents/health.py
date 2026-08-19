"""Agent provider health tracking and circuit breakers."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from filelock import FileLock

from openhands_factory.agents.base import (
    AgentFailureKind,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.state import atomic_write_json, read_json

MAX_RETRY_AFTER_SECONDS = 7 * 24 * 3600
HALF_OPEN_PROBE_LEASE_SECONDS = 60


def _is_health_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("breakers"), list)


@dataclass
class AgentCircuitBreaker:
    provider: str
    failure_threshold: int
    cooldown_seconds: int
    state: str = "closed"
    consecutive_failures: int = 0
    opened_at: datetime | None = None
    retry_after_seconds: int | None = None
    last_failure_kind: AgentFailureKind | None = None

    def permits_call(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(UTC)
        if self.state == "half-open":
            lease_expires = (
                self.opened_at + timedelta(seconds=HALF_OPEN_PROBE_LEASE_SECONDS)
                if self.opened_at is not None
                else None
            )
            if lease_expires is None or current >= lease_expires:
                # A daemon may die after persisting half-open but before recording
                # the probe result. Re-lease one probe after a bounded interval so
                # that state cannot strand the provider forever after restart.
                self.opened_at = current
                return True
            return False
        if self.state != "open":
            return True
        cooldown = max(self.cooldown_seconds, self.retry_after_seconds or 0)
        if self.opened_at and current >= self.opened_at + timedelta(seconds=cooldown):
            self.state = "half-open"
            self.opened_at = current
            return True
        return False

    def record_success(self) -> None:
        self.state = "closed"
        self.consecutive_failures = 0
        self.opened_at = None
        self.retry_after_seconds = None
        self.last_failure_kind = None

    def record_failure(
        self,
        kind: AgentFailureKind,
        now: datetime | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        self.last_failure_kind = kind
        if retry_after_seconds is not None:
            self.retry_after_seconds = min(
                max(retry_after_seconds, 0),
                MAX_RETRY_AFTER_SECONDS,
            )

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
            status_by_failure = {
                AgentFailureKind.PROVIDER_AUTH: ProviderStatus.AUTH_REQUIRED,
                AgentFailureKind.PROVIDER_RATE_LIMIT: ProviderStatus.RATE_LIMITED,
                AgentFailureKind.PROVIDER_QUOTA: ProviderStatus.QUOTA_EXHAUSTED,
            }
            status = ProviderStatus.UNAVAILABLE
            if self.last_failure_kind is not None:
                status = status_by_failure.get(
                    self.last_failure_kind,
                    ProviderStatus.UNAVAILABLE,
                )
        elif self.state == "half-open":
            status = ProviderStatus.DEGRADED

        retry_after = None
        if self.opened_at:
            if self.state == "open":
                cooldown = max(self.cooldown_seconds, self.retry_after_seconds or 0)
                retry_after = self.opened_at + timedelta(seconds=cooldown)
            elif self.state == "half-open":
                retry_after = self.opened_at + timedelta(seconds=HALF_OPEN_PROBE_LEASE_SECONDS)

        return ProviderHealth(
            provider=self.provider,
            status=status,
            checked_at=datetime.now(UTC),
            retry_after=retry_after,
        )


class AgentHealthStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = FileLock(str(path) + ".lock")

    def _save(self, breakers: Mapping[str, AgentCircuitBreaker]) -> None:
        payload = []
        for breaker in breakers.values():
            item = asdict(breaker)
            item["opened_at"] = breaker.opened_at.isoformat() if breaker.opened_at else None
            payload.append(item)
        atomic_write_json(
            self.path,
            {"breakers": payload},
            validator=_is_health_payload,
        )

    def save(self, breakers: Mapping[str, AgentCircuitBreaker]) -> None:
        with self.lock:
            self._save(breakers)

    def _load(
        self,
        defaults: Mapping[str, AgentCircuitBreaker] | None = None,
    ) -> dict[str, AgentCircuitBreaker]:
        current = datetime.now(UTC)
        payload = read_json(
            self.path,
            {"breakers": []},
            validator=_is_health_payload,
        )
        result: dict[str, AgentCircuitBreaker] = {}
        items = payload.get("breakers", []) if isinstance(payload, dict) else []
        if not isinstance(items, list):
            items = []
        for item in items:
            if not isinstance(item, dict):
                continue
            provider_value = item.get("provider")
            if not isinstance(provider_value, str):
                continue
            provider = provider_value
            if defaults is not None and provider not in defaults:
                continue
            default = defaults.get(provider) if defaults is not None else None
            try:
                opened_value = item.get("opened_at")
                opened = (
                    datetime.fromisoformat(opened_value) if isinstance(opened_value, str) else None
                )
                if opened is not None and opened.tzinfo is None:
                    raise ValueError("persisted circuit timestamp must include a timezone")
                if opened is not None:
                    opened = opened.astimezone(UTC)
                    if opened > current:
                        opened = current
                state = str(item["state"])
                if state not in {"closed", "open", "half-open"}:
                    raise ValueError("persisted circuit state is invalid")
                if state == "open" and opened is None:
                    raise ValueError("open circuit is missing its timestamp")
                failure_threshold = (
                    default.failure_threshold
                    if default is not None
                    else int(item["failure_threshold"])
                )
                cooldown_seconds = (
                    default.cooldown_seconds
                    if default is not None
                    else int(item["cooldown_seconds"])
                )
                retry_value = item.get("retry_after_seconds")
                retry_after = (
                    min(max(int(retry_value), 0), MAX_RETRY_AFTER_SECONDS)
                    if retry_value is not None
                    else None
                )
                failure_value = item.get("last_failure_kind")
                last_failure = (
                    AgentFailureKind(str(failure_value)) if failure_value is not None else None
                )
                breaker = AgentCircuitBreaker(
                    provider=provider,
                    failure_threshold=failure_threshold,
                    cooldown_seconds=cooldown_seconds,
                    state=state,
                    consecutive_failures=max(int(item["consecutive_failures"]), 0),
                    opened_at=opened,
                    retry_after_seconds=retry_after,
                    last_failure_kind=last_failure,
                )
            except (KeyError, TypeError, ValueError):
                if default is not None:
                    # A corrupt known-provider entry must not silently reset to a
                    # healthy circuit after restart. Keep it unavailable for one
                    # bounded current cool-down, then allow a fresh health probe.
                    result[provider] = AgentCircuitBreaker(
                        provider=provider,
                        failure_threshold=default.failure_threshold,
                        cooldown_seconds=default.cooldown_seconds,
                        state="open",
                        consecutive_failures=default.failure_threshold,
                        opened_at=current,
                        last_failure_kind=AgentFailureKind.PROVIDER_UNAVAILABLE,
                    )
                continue
            result[breaker.provider] = breaker

        if defaults:
            for name, default_breaker in defaults.items():
                if name not in result:
                    result[name] = default_breaker
        return result

    def load(
        self,
        defaults: Mapping[str, AgentCircuitBreaker] | None = None,
    ) -> dict[str, AgentCircuitBreaker]:
        with self.lock:
            return self._load(defaults)

    def update(
        self,
        provider: str,
        defaults: Mapping[str, AgentCircuitBreaker],
        mutation: Callable[[AgentCircuitBreaker], None],
    ) -> AgentCircuitBreaker:
        """Mutate one breaker under a cross-process lock without losing siblings."""
        with self.lock:
            breakers = self._load(defaults)
            breaker = breakers[provider]
            mutation(breaker)
            self._save(breakers)
            return breaker

    def permit(
        self,
        provider: str,
        defaults: Mapping[str, AgentCircuitBreaker],
    ) -> tuple[bool, AgentCircuitBreaker]:
        """Atomically admit at most one half-open probe across worker threads."""
        with self.lock:
            breakers = self._load(defaults)
            breaker = breakers[provider]
            permitted = breaker.permits_call()
            self._save(breakers)
            return permitted, breaker
