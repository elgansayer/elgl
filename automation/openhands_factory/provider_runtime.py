"""Shared provider runtime controls for the active OpenHands Factory."""

from __future__ import annotations

from collections import Counter
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from threading import BoundedSemaphore, Lock
from typing import Iterator

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.models import FailureKind, ProviderName
from openhands_factory.state import atomic_write_json, read_json


class ProviderConcurrencyLimiter:
    """Bound concurrent conversations independently for each configured provider."""

    def __init__(self, config: FactoryConfig) -> None:
        self._limits = {
            ProviderName.OPENAI_SUBSCRIPTION: config.openai_max_concurrent_conversations,
            ProviderName.OPENCODE_GO: config.opencode_max_concurrent_conversations,
            ProviderName.GEMINI: config.gemini_max_concurrent_conversations,
        }
        self._slots = {
            provider: BoundedSemaphore(limit) for provider, limit in self._limits.items()
        }
        self._active: Counter[ProviderName] = Counter()
        self._lock = Lock()

    @contextmanager
    def reserve(self, provider: ProviderName) -> Iterator[None]:
        slot = self._slots[provider]
        slot.acquire()
        with self._lock:
            self._active[provider] += 1
        try:
            yield
        finally:
            with self._lock:
                self._active[provider] -= 1
            slot.release()

    def snapshot(self) -> dict[str, dict[str, int]]:
        with self._lock:
            return {
                provider.value: {
                    "active": self._active[provider],
                    "limit": self._limits[provider],
                }
                for provider in self._limits
            }


_LIMITERS: dict[str, ProviderConcurrencyLimiter] = {}
_LIMITERS_LOCK = Lock()


def shared_provider_limiter(config: FactoryConfig) -> ProviderConcurrencyLimiter:
    key = str(config.state_dir.resolve())
    with _LIMITERS_LOCK:
        limiter = _LIMITERS.get(key)
        if limiter is None:
            limiter = ProviderConcurrencyLimiter(config)
            _LIMITERS[key] = limiter
        return limiter


def provider_model(config: FactoryConfig, provider: ProviderName) -> str:
    if provider is ProviderName.OPENAI_SUBSCRIPTION:
        return config.openai_model
    if provider is ProviderName.OPENCODE_GO:
        return f"openai/{config.opencode_model}"
    return f"gemini/{config.gemini_model}"


class ProviderAttributionStore:
    """Durably record non-secret provider attribution for every conversation attempt."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = FileLock(str(path) + ".lock")

    def record(
        self,
        *,
        task_id: str,
        provider: ProviderName,
        model: str,
        generation: str,
        successful: bool,
        fallback: bool,
        elapsed_seconds: float,
        failure_kind: FailureKind | None = None,
    ) -> None:
        with self.lock:
            payload = read_json(self.path, {"attempts": []})
            attempts = list(payload.get("attempts", []))
            attempts.append(
                {
                    "task_id": task_id,
                    "provider": provider.value,
                    "model": model,
                    "factory_generation": generation,
                    "successful": successful,
                    "fallback": fallback,
                    "elapsed_seconds": round(elapsed_seconds, 3),
                    "failure_kind": failure_kind.value if failure_kind else None,
                    "recorded_at": datetime.now(UTC).isoformat(),
                }
            )
            atomic_write_json(self.path, {"attempts": attempts[-5000:]})
