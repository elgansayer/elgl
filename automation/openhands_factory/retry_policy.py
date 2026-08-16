"""Durable failure classification and restart-stable retry scheduling."""

from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Any

from openhands_factory.failure_fingerprint import fingerprint_failure
from openhands_factory.models import FailureKind, Job

_AGENT_KIND_MAP: dict[str, FailureKind] = {
    "provider_auth": FailureKind.AUTHENTICATION,
    "provider_rate_limit": FailureKind.RATE_LIMIT,
    "provider_quota": FailureKind.RATE_LIMIT,
    "provider_timeout": FailureKind.TASK_TIMEOUT,
    "invalid_agent_output": FailureKind.MALFORMED_RESPONSE,
    "test_failure": FailureKind.VALIDATION,
    "repository_failure": FailureKind.TOOL,
    "policy_failure": FailureKind.CONFIGURATION,
}


def classify_failure(detail: str, *, agent_kind: str | None = None) -> FailureKind:
    """Map provider/factory failures into durable scheduling classes.

    Agent-native kinds win when they are specific. The text fallback handles the
    OpenHands control-plane wrapper, which deliberately collapses some inner model
    failures into an outer ``internal_factory_failure`` while retaining the useful
    diagnostic message.
    """

    if agent_kind in _AGENT_KIND_MAP:
        return _AGENT_KIND_MAP[agent_kind]

    text = detail.lower()
    if any(token in text for token in ("unauthorized", "authentication", "auth failed", "oauth", "login required", "token expired")):
        return FailureKind.AUTHENTICATION
    if any(token in text for token in ("rate limit", "rate-limit", "quota", "http 429", "status 429", "too many requests")):
        return FailureKind.RATE_LIMIT
    if any(token in text for token in ("timed out", "timeout", "maximum task duration", "deadline exceeded")):
        return FailureKind.TASK_TIMEOUT
    if any(token in text for token in ("malformed", "invalid json", "json decode", "parse error", "invalid agent output")):
        return FailureKind.MALFORMED_RESPONSE
    if any(token in text for token in ("validation", "quality gate", "review report", "acceptance criteria", "test failed", "tests failed")):
        return FailureKind.VALIDATION
    if any(token in text for token in ("budget", "cost ceiling", "spend limit")):
        return FailureKind.BUDGET
    if any(token in text for token in ("configuration", "misconfigured", "missing environment", "missing env", "unsupported provider")):
        return FailureKind.CONFIGURATION
    if any(token in text for token in ("repository", "git ", "verification", "tool failed", "no changed paths", "no repository changes")):
        return FailureKind.TOOL
    return FailureKind.TRANSIENT


def _matching_agent_failure(job: Job, detail: str) -> tuple[str | None, str | None, str | None]:
    """Return agent kind/provider/phase only when it belongs to this failure.

    ``provider_history`` spans the entire job. Reusing the latest historical agent
    failure for a later CI or repository error would corrupt retry attribution, so
    match the current exception text before attaching provider context.
    """

    for entry in reversed(job.provider_history):
        if entry.get("success") is not False:
            continue
        error = str(entry.get("error") or "")
        if not error or error not in detail:
            continue
        kind = str(entry.get("kind") or "") or None
        provider = str(entry.get("provider") or "") or None
        phase = str(entry.get("phase") or "") or None
        return kind, provider, phase
    return None, None, None


def record_failure_diagnostics(job: Job, detail: str) -> int:
    """Persist one failure against its class and stable semantic fingerprint.

    Returns the retry count for the current failure class so callers can schedule
    backoff independently for timeout storms, authentication failures, validation
    loops, and other classes instead of sharing one generic counter.
    """

    agent_kind, provider, phase = _matching_agent_failure(job, detail)
    kind = classify_failure(detail, agent_kind=agent_kind)
    fingerprint = fingerprint_failure(kind, detail, provider=provider, phase=phase)

    count = job.failure_counts.get(kind.value, 0) + 1
    job.failure_counts[kind.value] = count
    job.last_failure_kind = kind.value
    if job.last_failure_fingerprint == fingerprint.digest:
        job.repeated_failure_count += 1
    else:
        job.repeated_failure_count = 1
    job.last_failure_fingerprint = fingerprint.digest
    return count


def reset_retry_diagnostics(job: Job) -> None:
    """Clear durable retry evidence after meaningful pipeline progress."""

    job.failure_counts.clear()
    job.last_failure_kind = None
    job.last_failure_fingerprint = None
    job.repeated_failure_count = 0


def deterministic_backoff(retry_count: int, *, jitter_key: str) -> timedelta:
    """Return capped exponential backoff with deterministic ±20% jitter.

    The jitter key is persisted-derived data (task id + failure fingerprint), making
    the timestamp stable across daemon restart while preventing a fleet of failing
    jobs from waking on exactly the same exponential boundary.
    """

    retry_count = max(retry_count, 1)
    base_seconds = min(5 * 60 * 2 ** (retry_count - 1), 24 * 60 * 60)
    digest = hashlib.sha256(f"{jitter_key}:{retry_count}".encode("utf-8")).digest()
    sample = int.from_bytes(digest[:8], "big") / ((1 << 64) - 1)
    multiplier = 0.8 + (sample * 0.4)
    seconds = min(max(int(round(base_seconds * multiplier)), 1), 24 * 60 * 60)
    return timedelta(seconds=seconds)
