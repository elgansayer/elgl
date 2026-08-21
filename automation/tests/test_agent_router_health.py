from datetime import UTC, datetime

from openhands_factory.agents.base import (
    AgentPhase,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.router import AgentRouter
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
