from __future__ import annotations

from datetime import UTC, datetime, timedelta
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
from openhands_factory.issue_admission import ReviewHeadStabilityGate
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


def test_review_head_must_remain_unchanged_for_quiet_period(tmp_path: Path) -> None:
    gate = ReviewHeadStabilityGate(tmp_path / "heads.json", quiet_seconds=120)
    start = datetime(2026, 9, 7, 22, 0, tzinfo=UTC)

    assert gate.defer_seconds("pr-42", "head-a", start) == 120
    assert gate.defer_seconds("pr-42", "head-a", start + timedelta(seconds=60)) == 60
    assert gate.defer_seconds("pr-42", "head-a", start + timedelta(seconds=120)) == 0

    assert gate.defer_seconds("pr-42", "head-b", start + timedelta(seconds=121)) == 120
    assert gate.defer_seconds("pr-42", "head-b", start + timedelta(seconds=241)) == 0


def test_review_head_observation_survives_restart(tmp_path: Path) -> None:
    path = tmp_path / "heads.json"
    start = datetime(2026, 9, 7, 22, 0, tzinfo=UTC)

    first = ReviewHeadStabilityGate(path, quiet_seconds=120)
    assert first.defer_seconds("pr-42", "head-a", start) == 120

    restarted = ReviewHeadStabilityGate(path, quiet_seconds=120)
    assert restarted.defer_seconds("pr-42", "head-a", start + timedelta(seconds=90)) == 30
    assert restarted.defer_seconds("pr-42", "head-a", start + timedelta(seconds=120)) == 0


def test_future_review_head_observation_resets_to_current_clock(tmp_path: Path) -> None:
    path = tmp_path / "heads.json"
    current = datetime(2026, 9, 7, 22, 0, tzinfo=UTC)
    future = current + timedelta(days=1)

    skewed = ReviewHeadStabilityGate(path, quiet_seconds=120)
    assert skewed.defer_seconds("pr-42", "head-a", future) == 120

    corrected = ReviewHeadStabilityGate(path, quiet_seconds=120)
    assert corrected.defer_seconds("pr-42", "head-a", current) == 120
    assert corrected.defer_seconds("pr-42", "head-a", current + timedelta(seconds=120)) == 0


def test_moving_external_pr_consumes_no_provider_or_review_budget(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FACTORY_REVIEW_HEAD_STABILITY_SECONDS", "120")
    provider = Provider()
    router = ConservativeAgentRouter(
        [provider],
        capacity_store=ProviderCapacityStore(tmp_path),
        provider_limits={"first": 1},
        enabled=True,
    )
    task = Task("42", "PR 42", "Body", "github-pull-request", 0)
    job = Job(task, pull_request=42, head_sha="moving-head")
    request = AgentRequest(AgentPhase.CODE_REVIEW, task, "review", tmp_path)

    route_gate = router._agent_route_admission
    review_gate = router._review_admission
    assert route_gate is not None
    assert review_gate is not None
    route_slots_before = route_gate.available_slots()
    review_slots_before = review_gate.available_slots()

    with pytest.raises(ProviderCapacityUnavailable, match="head is still settling") as error:
        router.run(request, job)

    assert error.value.retry_after_seconds > 0
    assert provider.calls == 0
    assert route_gate.available_slots() == route_slots_before
    assert review_gate.available_slots() == review_slots_before


def test_factory_owned_issue_pr_is_not_delayed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FACTORY_REVIEW_HEAD_STABILITY_SECONDS", "120")
    provider = Provider()
    router = ConservativeAgentRouter(
        [provider],
        capacity_store=ProviderCapacityStore(tmp_path),
        provider_limits={"first": 1},
        enabled=True,
    )
    task = Task("42", "Issue 42", "Body", "github-issue", 0)
    job = Job(task, pull_request=42, head_sha="factory-owned-head")
    request = AgentRequest(AgentPhase.CODE_REVIEW, task, "review", tmp_path)

    result = router.run(request, job)

    assert result.success
    assert provider.calls == 1
