"""Cross-process provider concurrency leases for subscription-aware backpressure."""

from __future__ import annotations

import os
import time
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterator

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import ProviderName
from openhands_factory.state import atomic_write_json, read_json


def provider_limit(config: FactoryConfig, provider: ProviderName) -> int:
    if provider is ProviderName.OPENAI_SUBSCRIPTION:
        return config.openai_max_parallel
    if provider is ProviderName.OPENCODE_GO:
        return config.opencode_max_parallel
    return config.gemini_max_parallel


class ProviderCapacityStore:
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
    ) -> None:
        deadline = time.monotonic() + wait_seconds
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
                    return
                providers[provider.value] = active
                self._save(providers)
            if time.monotonic() >= deadline:
                raise FactoryError(
                    f"Provider capacity exhausted for {provider.value}; queued by backpressure"
                )
            time.sleep(1)

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


@contextmanager
def provider_slot(
    config: FactoryConfig,
    provider: ProviderName,
    *,
    owner: str,
) -> Iterator[None]:
    """Acquire one provider slot before creating the provider-backed conversation."""
    store = ProviderCapacityStore(config.state_dir)
    store.acquire(
        provider,
        limit=provider_limit(config, provider),
        owner=owner,
        wait_seconds=config.provider_slot_wait_seconds,
        lease_seconds=config.max_task_minutes * 60 + 300,
    )
    try:
        yield
    finally:
        store.release(provider, owner=owner)
