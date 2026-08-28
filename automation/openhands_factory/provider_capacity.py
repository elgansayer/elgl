"""Cross-process provider concurrency leases for subscription-aware backpressure."""

from __future__ import annotations

import os
import time
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.models import ProviderName
from openhands_factory.state import atomic_write_json, read_json

DEFAULT_MAX_PROVIDER_LEASE_SECONDS = 24 * 60 * 60


def _is_capacity_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("providers"), dict)


def provider_limit(config: FactoryConfig, provider: ProviderName) -> int:
    if provider is ProviderName.OPENAI_SUBSCRIPTION:
        return config.openai_max_concurrent_conversations
    if provider is ProviderName.OPENCODE_GO:
        return config.opencode_max_concurrent_conversations
    return config.gemini_max_concurrent_conversations


def maximum_agent_lease_seconds(config: FactoryConfig) -> int:
    """Return the longest valid outer-router lease for the active configuration."""
    phase_timeouts = [int(value) for value in config.agents.timeouts.model_dump().values()]
    provider_timeouts = [
        provider.timeout_seconds
        for provider in config.agents.providers.values()
        if provider.timeout_seconds is not None
    ]
    longest_attempt = max([*phase_timeouts, *provider_timeouts])
    return longest_attempt * (config.agents.routing.same_provider_retries + 1) + 300


class ProviderCapacityStore:
    """Durable provider slots shared across all Factory worker processes."""

    def __init__(
        self,
        state_dir: Path,
        factory_generation: str | None = None,
        max_lease_seconds: int = DEFAULT_MAX_PROVIDER_LEASE_SECONDS,
    ) -> None:
        if max_lease_seconds <= 0:
            raise ValueError("max_lease_seconds must be positive")
        self.path = state_dir / "provider-capacity.json"
        self.lock = FileLock(str(self.path) + ".lock")
        self.factory_generation = factory_generation
        self.max_lease_seconds = max_lease_seconds

    def _load(self) -> dict[str, list[dict[str, object]]]:
        payload = read_json(
            self.path,
            {"providers": {}},
            validator=_is_capacity_payload,
        )
        providers = payload.get("providers", {}) if isinstance(payload, dict) else {}
        if not isinstance(providers, dict):
            return {}
        return {
            str(provider): [entry for entry in entries if isinstance(entry, dict)]
            for provider, entries in providers.items()
            if isinstance(entries, list)
        }

    def _active_entries(
        self,
        entries: list[dict[str, object]],
        now: datetime,
    ) -> list[dict[str, object]]:
        active = []
        for entry in entries:
            generation = entry.get("factory_generation")
            if self.factory_generation is not None and generation != self.factory_generation:
                continue
            expires_at = entry.get("expires_at")
            acquired_at = entry.get("acquired_at")
            if not isinstance(expires_at, str) or not isinstance(acquired_at, str):
                continue
            try:
                expiry = datetime.fromisoformat(expires_at)
                acquired = datetime.fromisoformat(acquired_at)
            except ValueError:
                continue
            if expiry.tzinfo is None or acquired.tzinfo is None:
                continue
            maximum_expiry = acquired + timedelta(seconds=self.max_lease_seconds)
            if acquired <= now and now < expiry <= maximum_expiry:
                active.append(entry)
        return active

    def _save(self, providers: dict[str, list[dict[str, object]]]) -> None:
        atomic_write_json(
            self.path,
            {"updated_at": datetime.now(UTC).isoformat(), "providers": providers},
            validator=_is_capacity_payload,
        )

    def acquire(
        self,
        provider: ProviderName | str,
        *,
        limit: int,
        owner: str,
        wait_seconds: int,
        lease_seconds: int,
    ) -> float:
        """Acquire capacity and return seconds spent waiting for a slot."""
        if lease_seconds <= 0 or lease_seconds > self.max_lease_seconds:
            raise ValueError("lease_seconds must be positive and no greater than max_lease_seconds")
        started = time.monotonic()
        deadline = started + wait_seconds
        while True:
            with self.lock:
                providers = self._load()
                provider_key = provider.value if isinstance(provider, ProviderName) else provider
                entries = providers.setdefault(provider_key, [])
                now = datetime.now(UTC)
                active = self._active_entries(entries, now)
                if len(active) < limit:
                    active.append(
                        {
                            "owner": owner,
                            "pid": os.getpid(),
                            "factory_generation": self.factory_generation,
                            "acquired_at": now.isoformat(),
                            "expires_at": (now + timedelta(seconds=lease_seconds)).isoformat(),
                        }
                    )
                    providers[provider_key] = active
                    self._save(providers)
                    return time.monotonic() - started
                providers[provider_key] = active
                self._save(providers)
            if time.monotonic() >= deadline:
                raise ProviderCapacityUnavailable(
                    f"Provider capacity exhausted for {provider_key}; queued by backpressure",
                    retry_after_seconds=max(wait_seconds, 1),
                )
            time.sleep(min(1, max(deadline - time.monotonic(), 0.05)))

    def release(self, provider: ProviderName | str, *, owner: str) -> None:
        with self.lock:
            providers = self._load()
            provider_key = provider.value if isinstance(provider, ProviderName) else provider
            entries = providers.get(provider_key, [])
            providers[provider_key] = [
                entry
                for entry in entries
                if not (isinstance(entry, dict) and entry.get("owner") == owner)
            ]
            self._save(providers)

    def snapshot(self) -> dict[str, int]:
        with self.lock:
            providers = self._load()
            now = datetime.now(UTC)
            return {
                provider: len(self._active_entries(entries, now))
                for provider, entries in providers.items()
            }


@contextmanager
def provider_slot(
    config: FactoryConfig,
    provider: ProviderName,
    *,
    owner: str,
) -> Iterator[float]:
    """Reserve one durable provider slot before starting the matching conversation."""
    store = ProviderCapacityStore(
        config.provider_capacity_dir,
        max_lease_seconds=config.max_task_minutes * 60 + 300,
    )
    waited = store.acquire(
        provider,
        limit=provider_limit(config, provider),
        owner=owner,
        wait_seconds=config.provider_slot_wait_seconds,
        lease_seconds=config.max_task_minutes * 60 + 300,
    )
    try:
        yield waited
    finally:
        store.release(provider, owner=owner)
