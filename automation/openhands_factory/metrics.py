"""Rolling provider and task metrics."""

from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from filelock import FileLock

from openhands_factory.models import ProviderName, ProviderUsage
from openhands_factory.state import atomic_write_json, read_json

DAILY_RETENTION_DAYS = 30
_DAILY_COUNTERS = ("calls", "successes", "failures", "fallbacks", "timeouts")


def _is_metrics_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("providers"), list)


def _is_daily_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("days"), dict)


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
        # Cumulative totals cannot attribute a change to a time window, so a
        # bounded per-UTC-day rollup sits beside them for routing evaluation.
        self.daily_path = path.with_name(f"{path.stem}-daily.json")
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
                    output_measured_calls=max(int(item.get("output_measured_calls", 0)), 0),
                    total_captured_output_chars=max(
                        int(item.get("total_captured_output_chars", 0)), 0
                    ),
                    max_captured_output_chars=max(int(item.get("max_captured_output_chars", 0)), 0),
                    output_truncated_calls=max(int(item.get("output_truncated_calls", 0)), 0),
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
                {
                    **asdict(item),
                    "successful_outputs_per_model_minute": (
                        round(item.successes * 60 / item.total_duration_seconds, 3)
                        if item.total_duration_seconds > 0
                        else None
                    ),
                }
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
        captured_output_chars: int | None = None,
        output_truncated: bool | None = None,
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
            if captured_output_chars is not None:
                measured_output_chars = max(captured_output_chars, 0)
                usage.output_measured_calls += 1
                usage.total_captured_output_chars += measured_output_chars
                usage.max_captured_output_chars = max(
                    usage.max_captured_output_chars,
                    measured_output_chars,
                )
                usage.output_truncated_calls += int(output_truncated is True)
            if not successful and failure_kind:
                usage.failure_counts[failure_kind] = usage.failure_counts.get(failure_kind, 0) + 1
            atomic_write_json(
                self.path,
                self._snapshot(usage_by_key),
                validator=_is_metrics_payload,
            )
            self._record_daily(
                key,
                successful=successful,
                fallback=fallback,
                timed_out=timed_out,
                duration_seconds=duration_seconds,
                failure_kind=None if successful else failure_kind,
            )

    def _record_daily(
        self,
        key: str,
        *,
        successful: bool,
        fallback: bool,
        timed_out: bool,
        duration_seconds: float,
        failure_kind: str | None,
        now: datetime | None = None,
    ) -> None:
        """Add one call to today's bucket and drop buckets past retention."""
        current = now or datetime.now(UTC)
        today = current.date()
        payload = self._read_daily()
        days = payload.get("days", {})
        if not isinstance(days, dict):
            days = {}
        kept: dict[str, object] = {}
        for day, entries in days.items():
            try:
                age = (today - datetime.fromisoformat(str(day)).date()).days
            except ValueError:
                continue
            if 0 <= age < DAILY_RETENTION_DAYS and isinstance(entries, dict):
                kept[str(day)] = entries
        bucket = kept.get(today.isoformat())
        if not isinstance(bucket, dict):
            bucket = {}
            kept[today.isoformat()] = bucket
        entry = bucket.get(key)
        if not isinstance(entry, dict):
            entry = {name: 0 for name in _DAILY_COUNTERS}
            entry["duration_seconds"] = 0.0
            entry["failure_counts"] = {}
        entry["calls"] = int(entry.get("calls", 0)) + 1
        entry["successes"] = int(entry.get("successes", 0)) + int(successful)
        entry["failures"] = int(entry.get("failures", 0)) + int(not successful)
        entry["fallbacks"] = int(entry.get("fallbacks", 0)) + int(fallback)
        entry["timeouts"] = int(entry.get("timeouts", 0)) + int(timed_out)
        entry["duration_seconds"] = float(entry.get("duration_seconds", 0)) + max(
            duration_seconds, 0
        )
        failures = _restore_failure_counts(entry.get("failure_counts"))
        if failure_kind:
            failures[failure_kind] = failures.get(failure_kind, 0) + 1
        entry["failure_counts"] = failures
        bucket[key] = entry
        atomic_write_json(
            self.daily_path,
            {"recorded_at": current.isoformat(), "days": kept},
            validator=_is_daily_payload,
        )

    def _read_daily(self) -> dict[str, object]:
        # The rollup is auxiliary: a damaged file restarts it instead of failing
        # the call that is being recorded in the cumulative totals.
        try:
            payload = read_json(self.daily_path, {"days": {}}, validator=_is_daily_payload)
        except (ValueError, UnicodeDecodeError):
            return {"days": {}}
        return payload if isinstance(payload, dict) else {"days": {}}

    def daily(self) -> dict[str, object]:
        with self.lock:
            return self._read_daily()

    def snapshot(self) -> dict[str, object]:
        with self.lock:
            return self._snapshot(self._restore())
