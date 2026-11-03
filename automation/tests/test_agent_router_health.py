from datetime import UTC, datetime, timedelta

import pytest

from openhands_factory.agents import health as health_module
from openhands_factory.agents import router as router_module
from openhands_factory.agents.base import (
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.agents.router import AgentRouter
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.models import Job, Task


class Provider:
    def __init__(self, name: str, status: ProviderStatus) -> None:
        self.name = name
        self.status = status

    def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.name,
            status=self.status,
            checked_at=datetime.now(UTC),
        )

    def supports(self, phase: AgentPhase) -> bool:
        return True


class EmptyPolicy:
    def candidates(self, phase, job, provider_health):
        return []


def _job() -> Job:
    return Job(task=Task("7036", "bounded recovery", "", "github-issue", 1))


def test_router_skips_unhealthy_provider_without_policy() -> None:
    unhealthy = Provider("unhealthy", ProviderStatus.RATE_LIMITED)
    healthy = Provider("healthy", ProviderStatus.HEALTHY)
    router = AgentRouter([unhealthy, healthy])
    job = _job()

    acquired = router.acquire(
        phase=AgentPhase.IMPLEMENTATION,
        task=job.task,
        job=job,
    )

    assert acquired is healthy


def test_router_returns_none_when_every_provider_is_cooling_down() -> None:
    router = AgentRouter(
        [
            Provider("rate-limited", ProviderStatus.RATE_LIMITED),
            Provider("auth-required", ProviderStatus.AUTH_REQUIRED),
        ]
    )
    job = _job()

    acquired = router.acquire(
        phase=AgentPhase.IMPLEMENTATION,
        task=job.task,
        job=job,
    )

    assert acquired is None


def test_policy_cannot_fall_through_to_unhealthy_generic_fallback() -> None:
    provider = Provider("cooling-down", ProviderStatus.QUOTA_EXHAUSTED)
    router = AgentRouter([provider], policy=EmptyPolicy())
    job = _job()

    acquired = router.acquire(
        phase=AgentPhase.IMPLEMENTATION,
        task=job.task,
        job=job,
    )

    assert acquired is None


def test_degraded_provider_remains_eligible() -> None:
    provider = Provider("degraded", ProviderStatus.DEGRADED)
    router = AgentRouter([provider])
    job = _job()

    acquired = router.acquire(
        phase=AgentPhase.CODE_REVIEW,
        task=job.task,
        job=job,
    )

    assert acquired is provider


@pytest.fixture
def fixed_clock(monkeypatch):
    now = datetime(2026, 11, 2, 21, tzinfo=UTC)

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return now.astimezone(tz) if tz is not None else now.replace(tzinfo=None)

    monkeypatch.setattr(router_module, "datetime", Clock)
    monkeypatch.setattr(health_module, "datetime", Clock)
    return now


def test_expired_disabled_breaker_cannot_shorten_live_review_backoff(tmp_path, fixed_clock):
    class NoCalls(Provider):
        calls = 0

        def run(self, request):
            self.calls += 1
            raise AssertionError("Cooling or disabled provider must not run")

    active = NoCalls("review", ProviderStatus.HEALTHY)
    retired = NoCalls("retired", ProviderStatus.DISABLED)
    store = AgentHealthStore(tmp_path / "private-health.json")
    live = AgentCircuitBreaker(active.name, failure_threshold=1, cooldown_seconds=300)
    live.record_failure(AgentFailureKind.INVALID_AGENT_OUTPUT, fixed_clock, retry_after_seconds=900)
    expired = AgentCircuitBreaker(retired.name, failure_threshold=1, cooldown_seconds=300)
    expired.record_failure(AgentFailureKind.PROVIDER_TRANSPORT, fixed_clock - timedelta(hours=1))
    store.save({live.provider: live, expired.provider: expired})
    before = store.path.read_bytes()
    router = AgentRouter([active, retired], health_store=store, failure_threshold=1)
    job = _job()

    with pytest.raises(ProviderCapacityUnavailable, match="No eligible provider") as caught:
        router.run(AgentRequest(AgentPhase.CODE_REVIEW, job.task, "owned review", tmp_path), job)

    assert caught.value.retry_after_seconds == 900
    assert active.calls == retired.calls == 0
    assert store.path.read_bytes() == before


@pytest.mark.parametrize("seconds,expected", [(0.01, 1), (1.01, 2), (899.99, 900)])
def test_future_retry_delay_rounds_up(fixed_clock, seconds, expected):
    router = AgentRouter([])
    health = ProviderHealth(
        "owned",
        ProviderStatus.UNAVAILABLE,
        fixed_clock,
        retry_after=fixed_clock + timedelta(seconds=seconds),
    )
    assert router._retry_after_seconds({"owned": health}) == expected


def test_all_expired_deadlines_leave_existing_fallback_delay(fixed_clock):
    router = AgentRouter([])
    health = {
        str(offset): ProviderHealth(
            str(offset),
            ProviderStatus.DISABLED,
            fixed_clock,
            retry_after=fixed_clock - timedelta(seconds=offset),
        )
        for offset in (0, 1, 3600)
    }
    assert router._retry_after_seconds(health) is None


def test_retry_uses_new_failure_deadline_after_initial_healthy_snapshot(fixed_clock):
    provider = Provider("review", ProviderStatus.HEALTHY)
    router = AgentRouter([provider], failure_threshold=1)
    initial = {provider.name: provider.health()}
    router._memory_breakers[provider.name].record_failure(
        AgentFailureKind.INVALID_AGENT_OUTPUT, fixed_clock, retry_after_seconds=900
    )
    assert router._retry_after_seconds(initial) == 900
