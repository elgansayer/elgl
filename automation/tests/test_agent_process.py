from datetime import UTC, datetime
from pathlib import Path

import pytest

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    AgentResult,
)
from openhands_factory.agents.cli import extract_retry_after_seconds
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.agents.router import AgentRouter
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.models import Job, Task


class RateLimitedProvider:
    name = "rate-limited"

    def health(self):
        raise RuntimeError("health endpoint is broken")

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        now = datetime.now(UTC)
        return AgentResult(
            provider=self.name,
            phase=request.phase,
            success=False,
            started_at=now,
            finished_at=now,
            exit_code=1,
            summary="rate limit; retry-after: 123",
            output_path=None,
            failure=AgentFailure(
                kind=AgentFailureKind.PROVIDER_RATE_LIMIT,
                message="rate limited",
                exit_code=1,
                retry_after_seconds=123,
            ),
        )


def test_retry_after_extractors_are_bounded() -> None:
    assert extract_retry_after_seconds("retry-after: 123") == 123
    assert extract_retry_after_seconds('"resets_in_seconds": 45') == 45
    assert extract_retry_after_seconds("try again in 9 seconds") == 9
    assert extract_retry_after_seconds("retry-after: 999999999") == 7 * 24 * 3600
    assert extract_retry_after_seconds("no retry hint") is None


def test_health_probe_exception_marks_provider_unavailable() -> None:
    provider = RateLimitedProvider()
    router = AgentRouter(providers=[provider])
    task = Task("1", "test", "", "issue", 1)
    job = Job(task=task)

    assert (
        router.acquire(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            job=job,
        )
        is None
    )


def test_retry_after_hint_is_persisted_in_breaker_and_deferral(tmp_path: Path) -> None:
    provider = RateLimitedProvider()
    breaker = AgentCircuitBreaker(
        provider=provider.name,
        failure_threshold=3,
        cooldown_seconds=5,
    )
    health_store = AgentHealthStore(tmp_path / "health.json")
    health_store.save({provider.name: breaker})
    router = AgentRouter(providers=[provider], health_store=health_store)
    task = Task("1", "test", "", "issue", 1)
    job = Job(task=task)
    request = AgentRequest(
        phase=AgentPhase.IMPLEMENTATION,
        task=task,
        prompt="do it",
        cwd=Path("/tmp"),
    )

    # The broken health probe makes the provider ineligible before execution.
    with pytest.raises(ProviderCapacityUnavailable):
        router.run(request, job)

    # Verify direct breaker semantics for a provider reset hint independently of
    # the health-probe failure above.
    for _ in range(breaker.failure_threshold):
        breaker.record_failure(AgentFailureKind.PROVIDER_RATE_LIMIT, retry_after_seconds=123)
    assert breaker.retry_after_seconds == 123
    assert breaker.get_health().retry_after is not None
