"""Cross-process provider concurrency leases for subscription-aware backpressure."""

from __future__ import annotations

import os
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.models import ProviderName
from openhands_factory.state import atomic_write_json, read_json

DEFAULT_MAX_PROVIDER_LEASE_SECONDS = 24 * 60 * 60
MAX_RENEWABLE_LEASE_SECONDS = 60


@dataclass(frozen=True)
class RenewableCapacityLease:
    """Persistable ownership handle; no provider credential or model invocation."""

    provider: str
    owner: str
    token: str
    store_path: str
    lease_seconds: int
    protocol_version: int = 1


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
        return self._acquire(
            provider,
            limit=limit,
            owner=owner,
            wait_seconds=wait_seconds,
            lease_seconds=lease_seconds,
        )

    def _acquire(
        self,
        provider: ProviderName | str,
        *,
        limit: int,
        owner: str,
        wait_seconds: int,
        lease_seconds: int,
        token: str | None = None,
    ) -> float:
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
                duplicate_owner = token is not None and any(
                    entry.get("owner") == owner for entry in active
                )
                if len(active) < limit and not duplicate_owner:
                    entry: dict[str, object] = {
                        "owner": owner,
                        "pid": os.getpid(),
                        "factory_generation": self.factory_generation,
                        "acquired_at": now.isoformat(),
                        "expires_at": (now + timedelta(seconds=lease_seconds)).isoformat(),
                    }
                    if token is not None:
                        entry.update({"lease_protocol": 1, "lease_token": token})
                    active.append(entry)
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

    def acquire_renewable(
        self,
        provider: ProviderName | str,
        *,
        limit: int,
        owner: str,
        wait_seconds: int = 0,
        lease_seconds: int = MAX_RENEWABLE_LEASE_SECONDS,
    ) -> RenewableCapacityLease:
        """Reserve a short renewable slot visible to existing bounded readers.

        Every participating reader must accept at least ``lease_seconds``. Keep
        the existing provider key and shared directory; this grants no allowance.
        """
        key = provider.value if isinstance(provider, ProviderName) else provider
        handle = RenewableCapacityLease(
            key, owner, str(uuid.uuid4()), str(self.path.resolve()), lease_seconds
        )
        self._validate_handle(handle)
        self._acquire(
            provider,
            limit=limit,
            owner=owner,
            wait_seconds=wait_seconds,
            lease_seconds=lease_seconds,
            token=handle.token,
        )
        return handle

    def _validate_handle(self, handle: RenewableCapacityLease) -> None:
        if (
            self.factory_generation is not None
            or type(handle.protocol_version) is not int
            or handle.protocol_version != 1
            or not isinstance(handle.provider, str)
            or not handle.provider
            or not isinstance(handle.owner, str)
            or not handle.owner
            or not isinstance(handle.token, str)
            or not handle.token
            or handle.store_path != str(self.path.resolve())
            or type(handle.lease_seconds) is not int
            or not 0
            < handle.lease_seconds
            <= min(self.max_lease_seconds, MAX_RENEWABLE_LEASE_SECONDS)
        ):
            raise ValueError("Invalid renewable capacity lease handle or incompatible store bound")

    @staticmethod
    def _owns_entry(entry: dict[str, object], handle: RenewableCapacityLease) -> bool:
        return (
            entry.get("owner") == handle.owner
            and entry.get("lease_token") == handle.token
            and entry.get("lease_protocol") == handle.protocol_version
        )

    def renew(self, handle: RenewableCapacityLease) -> None:
        """Atomically refresh a live slot, never reacquiring an expired/lost one."""
        self._validate_handle(handle)
        with self.lock:
            providers = self._load()
            now = datetime.now(UTC)
            active = self._active_entries(providers.get(handle.provider, []), now)
            owned = [entry for entry in active if self._owns_entry(entry, handle)]
            if len(owned) != 1:
                raise ProviderCapacityUnavailable(
                    "Renewable provider lease expired or ownership lost; stop the participant",
                    retry_after_seconds=1,
                )
            # Refresh the legacy time envelope too, so old readers count a
            # heartbeat after the session has outlived their maximum duration.
            owned[0]["acquired_at"] = now.isoformat()
            owned[0]["expires_at"] = (now + timedelta(seconds=handle.lease_seconds)).isoformat()
            providers[handle.provider] = active
            self._save(providers)

    def release_renewable(self, handle: RenewableCapacityLease) -> bool:
        """Release only this ownership token; stale cleanup cannot free a successor."""
        self._validate_handle(handle)
        with self.lock:
            providers = self._load()
            entries = providers.get(handle.provider, [])
            remaining = [entry for entry in entries if not self._owns_entry(entry, handle)]
            if len(remaining) == len(entries):
                return False
            providers[handle.provider] = remaining
            self._save(providers)
            return True

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
