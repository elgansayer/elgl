from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from openhands_factory.agents.base import (
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.conservative import ConservativeAgentRouter
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.models import Job, Task
from openhands_factory.provider_capacity import ProviderCapacityStore


class Provider:
    name = "first"

    def __init__(self) -> None:
        self.calls = 0

    def health(self) -> ProviderHealth:
        return ProviderHealth(self.name, ProviderStatus.HEALTHY, datetime.now(UTC))

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        self.calls += 1
        now = datetime.now(UTC)
        return AgentResult(
            provider=self.name,
            phase=request.phase,
            success=True,
            started_at=now,
            finished_at=now,
            exit_code=0,
            summary="done",
            output_path=None,
            failure=None,
            transport="fake",
            model="fake-model",
        )


def review_request(tmp_path: Path) -> tuple[AgentRequest, Job]:
    task = Task("42", "PR 42", "Body", "github-pull-request", 0)
    job = Job(task, pull_request=42, head_sha="reviewed-head")
    return AgentRequest(AgentPhase.CODE_REVIEW, task, "review", tmp_path), job


def test_busy_provider_does_not_consume_exact_head_review_budget(tmp_path: Path) -> None:
    store = ProviderCapacityStore(tmp_path)
    store.acquire(
        "first",
        limit=1,
        owner="external-holder",
        wait_seconds=0,
        lease_seconds=300,
    )
    provider = Provider()
    router = ConservativeAgentRouter(
        [provider],
        capacity_store=store,
        provider_limits={"first": 1},
        enabled=True,
    )
    request, job = review_request(tmp_path)

    with pytest.raises(ProviderCapacityUnavailable, match="All eligible providers are busy"):
        router.run(request, job)

    assert provider.calls == 0
    assert router._review_admission is not None
    assert router._review_admission.available_slots() == 2

    store.release("first", owner="external-holder")
    result = router.run(request, job)

    assert result.success
    assert provider.calls == 1
    assert router._review_admission.available_slots() == 1


def test_prepare_failure_does_not_consume_exact_head_review_budget(tmp_path: Path) -> None:
    provider = Provider()
    router = ConservativeAgentRouter(
        [provider],
        capacity_store=ProviderCapacityStore(tmp_path),
        provider_limits={"first": 1},
        enabled=True,
    )
    request, job = review_request(tmp_path)

    def fail_before_provider_start() -> None:
        raise RuntimeError("review preparation failed")

    request.prepare_attempt = fail_before_provider_start

    with pytest.raises(RuntimeError, match="review preparation failed"):
        router.run(request, job)

    assert provider.calls == 0
    assert router._review_admission is not None
    assert router._review_admission.available_slots() == 2
