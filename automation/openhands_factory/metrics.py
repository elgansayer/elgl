"""Rolling provider and task metrics."""

from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.models import ProviderName, ProviderUsage
from openhands_factory.state import atomic_write_json, read_json


class MetricsStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._usage: dict[str, ProviderUsage] = {}
        self.restore()

    @staticmethod
    def _key(provider: ProviderName, model: str) -> str:
        return f"{provider.value}:{model}"

    def record(
        self,
        provider: ProviderName,
        model: str,
        *,
        successful: bool,
        fallback: bool = False,
        rate_limited: bool = False,
        authentication_failure: bool = False,
        capacity_wait: bool = False,
        capacity_exhausted: bool = False,
        estimated_cost_usd: float | None = None,
    ) -> None:
        key = self._key(provider, model)
        usage = self._usage.setdefault(key, ProviderUsage(provider=provider, model=model))
        usage.calls += 1
        usage.successes += int(successful)
        usage.failures += int(not successful)
        usage.fallbacks += int(fallback)
        usage.rate_limits += int(rate_limited)
        usage.authentication_failures += int(authentication_failure)
        usage.capacity_waits += int(capacity_wait)
        usage.capacity_exhausted += int(capacity_exhausted)
        if estimated_cost_usd is None:
            usage.unknown_cost_calls += 1
        else:
            usage.estimated_cost_usd += estimated_cost_usd
        self.save()

    def snapshot(self) -> dict[str, object]:
        return {
            "recorded_at": datetime.now(UTC).isoformat(),
            "providers": [
                {**asdict(item), "provider": item.provider.value}
                for item in sorted(
                    self._usage.values(), key=lambda value: (value.provider, value.model)
                )
            ],
        }

    def save(self) -> None:
        atomic_write_json(self.path, self.snapshot())

    def restore(self) -> None:
        payload = read_json(self.path, {"providers": []})
        for item in payload.get("providers", []):
            usage = ProviderUsage(
                provider=ProviderName(item["provider"]),
                model=item["model"],
                calls=int(item.get("calls", 0)),
                successes=int(item.get("successes", 0)),
                failures=int(item.get("failures", 0)),
                fallbacks=int(item.get("fallbacks", 0)),
                rate_limits=int(item.get("rate_limits", 0)),
                authentication_failures=int(item.get("authentication_failures", 0)),
                capacity_waits=int(item.get("capacity_waits", 0)),
                capacity_exhausted=int(item.get("capacity_exhausted", 0)),
                estimated_cost_usd=float(item.get("estimated_cost_usd", 0)),
                unknown_cost_calls=int(item.get("unknown_cost_calls", 0)),
            )
            self._usage[self._key(usage.provider, usage.model)] = usage
