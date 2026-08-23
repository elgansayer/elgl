from __future__ import annotations

import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.conservative import ConservativeAgentRouter
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.issue_admission import ReviewAdmissionGate
from openhands_factory.models import Job, Task
from openhands_factory.provider_capacity import ProviderCapacityStore


class Provider:
    def __init__(self, name: str, failure: AgentFailureKind | None = None) -> None:
        self.name = name
        self.failure = failure
        self.calls = 0

    def health(self) -> ProviderHealth:
        return ProviderHealth(self.name, ProviderStatus.HEALTHY, datetime.now(UTC))

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        self.calls += 1
        now = datetime.now(UTC)
        failure = AgentFailure(self.failure, "failed") if self.failure is not None else None
        return AgentResult(
            self.name,
            request.phase,
            failure is None,
            now,
            now,
            0 if failure is None else 1,
            "done" if failure is None else None,
            None,
            failure,
            "fake",
            "fake-model",
        )


class OrderedPolicy:
    def __init__(self, names: list[str]) -> None:
        self.names = names

    def candidates(self, phase, job, provider_health):
        return self.names


def review_request(tmp_path: Path, identifier: str, sha: str) -> tuple[AgentRequest, Job]:
    task = Task(identifier, f"PR {identifier}", "Body", "github-pull-request", 0)
    job = Job(task, pull_request=int(identifier), head_sha=sha)
    return AgentRequest(AgentPhase.CODE_REVIEW, task, "review", tmp_path), job


def test_review_admission_gate_allows_two_unique_shas_per_hour_and_survives_restart(
    tmp_path: Path,
) -> None:
    path = tmp_path / "review-admissions.json"
    started = datetime(2026, 8, 23, 20, 0, tzinfo=UTC)
    gate = ReviewAdmissionGate(path, interval_seconds=3600, max_admissions=2)

    assert gate.admit("pr-10@aaa", started)
    assert gate.admit("pr-11@bbb", started + timedelta(minutes=1))
    assert not gate.admit("pr-12@ccc", started + timedelta(minutes=2))

    restarted = ReviewAdmissionGate(path, interval_seconds=3600, max_admissions=2)
    assert restarted.available_slots(started + timedelta(minutes=59)) == 0
    assert restarted.available_slots(started + timedelta(hours=1, minutes=1)) == 1


def test_review_admission_gate_suppresses_same_sha_inside_window(tmp_path: Path) -> None:
    gate = ReviewAdmissionGate(
        tmp_path / "review-admissions.json",
        interval_seconds=3600,
        max_admissions=2,
    )
    started = datetime(2026, 8, 23, 20, 0, tzinfo=UTC)

    assert gate.admit("pr-10@aaa", started)
    assert not gate.admit("pr-10@aaa", started + timedelta(minutes=30))
    assert gate.available_slots(started + timedelta(minutes=30)) == 1


def test_conservative_router_limits_one_phase_to_primary_plus_one_fallback(
    tmp_path: Path,
) -> None:
    first = Provider("first", AgentFailureKind.PROVIDER_RATE_LIMIT)
    second = Provider("second", AgentFailureKind.PROVIDER_RATE_LIMIT)
    third = Provider("third")
    task = Task("42", "Issue", "Body", "github-issue", 0)
    request = AgentRequest(AgentPhase.IMPLEMENTATION, task, "implement", tmp_path)
    router = ConservativeAgentRouter(
        [first, second, third],
        policy=OrderedPolicy(["first", "second", "third"]),
        same_provider_retries=0,
        enabled=True,
    )

    with pytest.raises(ProviderCapacityUnavailable, match="All eligible providers failed"):
        router.run(request, Job(task))

    assert first.calls == 1
    assert second.calls == 1
    assert third.calls == 0


def test_conservative_router_preserves_independent_review_before_candidate_cap(
    tmp_path: Path,
) -> None:
    providers = [Provider("first"), Provider("second"), Provider("third")]
    task = Task("42", "PR", "Body", "github-pull-request", 0)
    job = Job(task, pull_request=42, head_sha="abc")
    job.provider_history.append(
        {
            "provider": "first",
            "phase": AgentPhase.IMPLEMENTATION.value,
            "success": True,
        }
    )
    router = ConservativeAgentRouter(
        providers,
        policy=OrderedPolicy(["first", "second", "third"]),
        enabled=True,
    )

    candidates, _ = router._candidate_names(AgentPhase.CODE_REVIEW, job)

    assert candidates == ["second", "third"]


def test_conservative_router_enforces_two_review_shas_per_hour(tmp_path: Path) -> None:
    provider = Provider("first")
    router = ConservativeAgentRouter(
        [provider],
        capacity_store=ProviderCapacityStore(tmp_path),
        provider_limits={"first": 2},
        enabled=True,
    )

    first_request, first_job = review_request(tmp_path, "10", "aaa")
    second_request, second_job = review_request(tmp_path, "11", "bbb")
    third_request, third_job = review_request(tmp_path, "12", "ccc")

    assert router.run(first_request, first_job).success
    assert router.run(second_request, second_job).success
    with pytest.raises(ProviderCapacityUnavailable, match="2 reviews/hour"):
        router.run(third_request, third_job)

    assert provider.calls == 2


def test_conservative_router_allows_only_one_review_agent_at_a_time(tmp_path: Path) -> None:
    entered = threading.Event()
    release = threading.Event()

    class BlockingProvider(Provider):
        def run(self, request: AgentRequest) -> AgentResult:
            self.calls += 1
            entered.set()
            assert release.wait(timeout=5)
            now = datetime.now(UTC)
            return AgentResult(
                self.name,
                request.phase,
                True,
                now,
                now,
                0,
                "done",
                None,
                None,
                "fake",
                "fake-model",
            )

    provider = BlockingProvider("first")
    router = ConservativeAgentRouter(
        [provider],
        capacity_store=ProviderCapacityStore(tmp_path),
        provider_limits={"first": 2},
        enabled=True,
    )
    first_request, first_job = review_request(tmp_path, "10", "aaa")
    second_request, second_job = review_request(tmp_path, "11", "bbb")
    result: list[AgentResult] = []

    thread = threading.Thread(target=lambda: result.append(router.run(first_request, first_job)))
    thread.start()
    assert entered.wait(timeout=5)
    try:
        with pytest.raises(ProviderCapacityUnavailable, match="review concurrency"):
            router.run(second_request, second_job)
    finally:
        release.set()
        thread.join(timeout=5)

    assert not thread.is_alive()
    assert result and result[0].success
    assert provider.calls == 1
