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
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import ProviderName
from openhands_factory.state import atomic_write_json, read_json


def provider_limit(config: FactoryConfig, provider: ProviderName) -> int:
    if provider is ProviderName.OPENAI_SUBSCRIPTION:
        return config.openai_max_concurrent_conversations
    if provider is ProviderName.OPENCODE_GO:
        return config.opencode_max_concurrent_conversations
    return config.gemini_max_concurrent_conversations


class ProviderCapacityStore:
    """Durable provider slots shared across all Factory worker processes."""

    def __init__(self, state_dir: Path) -> None:
        self.path = state_dir / "provider-capacity.json"
        self.lock = FileLock(str(self.path) + ".lock")

    def _load(self) -> dict[str, list[dict[str, object]]]:
        payload = read_json(self.path, {"providers": {}})
        providers = payload.get("providers", {}) if isinstance(payload, dict) else {}
        return providers if isinstance(providers, dict) else {}

    def _save(self, providers: dict[str, list[dict[str, object]]]) -> None:
        atomic_write_json(
            self.path,
            {"updated_at": datetime.now(UTC).isoformat(), "providers": providers},
        )

    def acquire(
        self,
        provider: ProviderName,
        *,
        limit: int,
        owner: str,
        wait_seconds: int,
        lease_seconds: int,
    ) -> float:
        """Acquire capacity and return seconds spent waiting for a slot."""
        started = time.monotonic()
        deadline = started + wait_seconds
        while True:
            with self.lock:
                providers = self._load()
                entries = providers.setdefault(provider.value, [])
                now = datetime.now(UTC)
                active = [
                    entry
                    for entry in entries
                    if isinstance(entry, dict)
                    and isinstance(entry.get("expires_at"), str)
                    and datetime.fromisoformat(str(entry["expires_at"])) > now
                ]
                if len(active) < limit:
                    active.append(
                        {
                            "owner": owner,
                            "pid": os.getpid(),
                            "acquired_at": now.isoformat(),
                            "expires_at": (now + timedelta(seconds=lease_seconds)).isoformat(),
                        }
                    )
                    providers[provider.value] = active
                    self._save(providers)
                    return time.monotonic() - started
                providers[provider.value] = active
                self._save(providers)
            if time.monotonic() >= deadline:
                raise FactoryError(
                    f"Provider capacity exhausted for {provider.value}; queued by backpressure"
                )
            time.sleep(min(1, max(deadline - time.monotonic(), 0.05)))

    def release(self, provider: ProviderName, *, owner: str) -> None:
        with self.lock:
            providers = self._load()
            entries = providers.get(provider.value, [])
            providers[provider.value] = [
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
                provider: sum(
                    1
                    for entry in entries
                    if isinstance(entry, dict)
                    and isinstance(entry.get("expires_at"), str)
                    and datetime.fromisoformat(str(entry["expires_at"])) > now
                )
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
    store = ProviderCapacityStore(config.state_dir)
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
