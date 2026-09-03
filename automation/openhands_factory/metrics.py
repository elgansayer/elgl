"""Rolling provider and task metrics."""

from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from filelock import FileLock

from openhands_factory.models import ProviderName, ProviderUsage
from openhands_factory.state import atomic_write_json, read_json


def _is_metrics_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("providers"), list)


def _restore_failure_counts(value: object) -> dict[str, int]:
    if not isinstance(value, dict):
        return {}
    return {
        kind: count
        for kind, count in value.items()
        if isinstance(kind, str)
        and isinstance(count, int)
        and not isinstance(count, bool)
        and count >= 0
    }


class MetricsStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = FileLock(str(path) + ".lock")

    @staticmethod
    def _provider_name(provider: ProviderName | str) -> str:
        return provider.value if isinstance(provider, ProviderName) else provider

    @classmethod
    def _key(cls, provider: ProviderName | str, model: str, phase: str) -> str:
        return f"{cls._provider_name(provider)}:{model}:{phase}"

    def _restore(self) -> dict[str, ProviderUsage]:
        payload = read_json(
            self.path,
            {"providers": []},
            validator=_is_metrics_payload,
        )
        providers = payload.get("providers", []) if isinstance(payload, dict) else []
        usage_by_key: dict[str, ProviderUsage] = {}
        if not isinstance(providers, list):
            return usage_by_key
        for item in providers:
            if not isinstance(item, dict):
                continue
            provider = item.get("provider")
            model = item.get("model")
            if not isinstance(provider, str) or not isinstance(model, str):
                continue
            phase = str(item.get("phase", "legacy"))
            try:
                usage = ProviderUsage(
                    provider=provider,
                    model=model,
                    phase=phase,
                    calls=int(item.get("calls", 0)),
                    successes=int(item.get("successes", 0)),
                    failures=int(item.get("failures", 0)),
                    fallbacks=int(item.get("fallbacks", 0)),
                    rate_limits=int(item.get("rate_limits", 0)),
                    authentication_failures=int(item.get("authentication_failures", 0)),
                    quota_failures=int(item.get("quota_failures", 0)),
                    timeouts=int(item.get("timeouts", 0)),
                    total_duration_seconds=float(item.get("total_duration_seconds", 0)),
                    capacity_wait_seconds=float(item.get("capacity_wait_seconds", 0)),
                    capacity_waited_calls=int(item.get("capacity_waited_calls", 0)),
                    estimated_cost_usd=float(item.get("estimated_cost_usd", 0)),
                    unknown_cost_calls=int(item.get("unknown_cost_calls", 0)),
                    prompt_measured_calls=max(int(item.get("prompt_measured_calls", 0)), 0),
                    total_request_prompt_chars=max(
                        int(item.get("total_request_prompt_chars", 0)), 0
                    ),
                    max_request_prompt_chars=max(int(item.get("max_request_prompt_chars", 0)), 0),
                    failure_counts=_restore_failure_counts(item.get("failure_counts")),
                )
            except (TypeError, ValueError):
                continue
            usage_by_key[self._key(provider, model, phase)] = usage
        return usage_by_key

    @staticmethod
    def _snapshot(usage: dict[str, ProviderUsage]) -> dict[str, object]:
        return {
            "recorded_at": datetime.now(UTC).isoformat(),
            "providers": [
                asdict(item)
                for item in sorted(
                    usage.values(),
                    key=lambda value: (value.provider, value.model, value.phase),
                )
            ],
        }

    def record(
        self,
        provider: ProviderName | str,
        model: str,
        *,
        phase: str = "unknown",
        successful: bool,
        fallback: bool = False,
        rate_limited: bool = False,
        authentication_failure: bool = False,
        quota_failure: bool = False,
        timed_out: bool = False,
        duration_seconds: float = 0,
        capacity_wait_seconds: float = 0,
        estimated_cost_usd: float | None = None,
        failure_kind: str | None = None,
        request_prompt_chars: int | None = None,
    ) -> None:
        provider_name = self._provider_name(provider)
        with self.lock:
            usage_by_key = self._restore()
            key = self._key(provider_name, model, phase)
            usage = usage_by_key.setdefault(
                key,
                ProviderUsage(provider=provider_name, model=model, phase=phase),
            )
            usage.calls += 1
            usage.successes += int(successful)
            usage.failures += int(not successful)
            usage.fallbacks += int(fallback)
            usage.rate_limits += int(rate_limited)
            usage.authentication_failures += int(authentication_failure)
            usage.quota_failures += int(quota_failure)
            usage.timeouts += int(timed_out)
            usage.total_duration_seconds += max(duration_seconds, 0)
            usage.capacity_wait_seconds += max(capacity_wait_seconds, 0)
            usage.capacity_waited_calls += int(capacity_wait_seconds > 0.01)
            if estimated_cost_usd is None:
                usage.unknown_cost_calls += 1
            else:
                usage.estimated_cost_usd += estimated_cost_usd
            if request_prompt_chars is not None:
                measured_prompt_chars = max(request_prompt_chars, 0)
                usage.prompt_measured_calls += 1
                usage.total_request_prompt_chars += measured_prompt_chars
                usage.max_request_prompt_chars = max(
                    usage.max_request_prompt_chars,
                    measured_prompt_chars,
                )
            if not successful and failure_kind:
                usage.failure_counts[failure_kind] = usage.failure_counts.get(failure_kind, 0) + 1
            atomic_write_json(
                self.path,
                self._snapshot(usage_by_key),
                validator=_is_metrics_payload,
            )

    def snapshot(self) -> dict[str, object]:
        with self.lock:
            return self._snapshot(self._restore())