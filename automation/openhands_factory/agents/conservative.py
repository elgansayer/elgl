"""Conservative resource policy layered over the provider-neutral agent router."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from threading import BoundedSemaphore
from typing import Any

from openhands_factory.agents.base import (
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
)
from openhands_factory.agents.router import AgentRouter
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.issue_admission import DurableAdmissionGate, ReviewAdmissionGate
from openhands_factory.models import Job

MAX_PROVIDER_CANDIDATES_PER_PHASE = 2
MAX_GLOBAL_AGENT_CONCURRENCY = 2
MAX_REVIEW_CONCURRENCY = 1
REVIEW_INTERVAL_SECONDS = 60 * 60
REVIEWS_PER_INTERVAL = 2
AGENT_ROUTE_INTERVAL_SECONDS = 60 * 60
AGENT_ROUTES_PER_INTERVAL = 6
_RESOURCE_RETRY_SECONDS = 60
_CODE_MUTATING_PHASES = {
    AgentPhase.ARCHITECTURE.value,
    AgentPhase.IMPLEMENTATION.value,
    AgentPhase.SECURITY_REVIEW.value,
    AgentPhase.QUALITY_REPAIR.value,
    AgentPhase.CI_REPAIR.value,
}


def _positive_int_environment(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer") from error
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


def _gate_retry_seconds(gate: DurableAdmissionGate, now: datetime) -> int:
    snapshot = gate.snapshot(now)
    next_available_at = snapshot.get("next_available_at")
    if not isinstance(next_available_at, str):
        return _RESOURCE_RETRY_SECONDS
    try:
        available_at = datetime.fromisoformat(next_available_at)
    except ValueError:
        return _RESOURCE_RETRY_SECONDS
    if available_at.tzinfo is None:
        available_at = available_at.replace(tzinfo=UTC)
    return max(1, int((available_at - now).total_seconds()) + 1)


def conservative_policy_enabled() -> bool:
    """Enable the agent budget alongside the existing issue-admission policy.

    Production already configures a non-zero issue interval. Keeping the wrapper
    dormant when that interval is disabled preserves historical local/test behavior
    while making the deployed Factory conservative without another rollout switch.
    """

    explicit = os.environ.get("FACTORY_CONSERVATIVE_RESOURCE_POLICY")
    if explicit is not None:
        return explicit.strip().lower() in {"1", "true", "yes"}
    try:
        return int(os.environ.get("FACTORY_NEW_ISSUE_INTERVAL_SECONDS", "0")) > 0
    except ValueError:
        return False


class ConservativeAgentRouter(AgentRouter):
    """Bound expensive execution without weakening the existing Factory pipeline."""

    def __init__(self, *args: Any, enabled: bool | None = None, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.conservative_enabled = conservative_policy_enabled() if enabled is None else enabled
        self._global_agent_slots = BoundedSemaphore(MAX_GLOBAL_AGENT_CONCURRENCY)
        self._review_slots = BoundedSemaphore(MAX_REVIEW_CONCURRENCY)
        self._review_admission: ReviewAdmissionGate | None = None
        self._agent_route_admission: DurableAdmissionGate | None = None
        if self.conservative_enabled:
            # Retrying the same subscription immediately doubles the cost of one
            # provider-side failure. The conservative policy instead permits one
            # distinct fallback provider; a durable scheduler retry can revisit the
            # preferred provider later after its health/circuit state has changed.
            self.same_provider_retries = 0
        if self.conservative_enabled and self.capacity_store is not None:
            state_dir = self.capacity_store.path.parent
            self._review_admission = ReviewAdmissionGate(
                state_dir / "review-admissions.json",
                interval_seconds=REVIEW_INTERVAL_SECONDS,
                max_admissions=REVIEWS_PER_INTERVAL,
            )
            self._agent_route_admission = DurableAdmissionGate(
                state_dir / "agent-route-admissions.json",
                interval_seconds=_positive_int_environment(
                    "FACTORY_AGENT_ROUTE_INTERVAL_SECONDS",
                    AGENT_ROUTE_INTERVAL_SECONDS,
                ),
                max_admissions=_positive_int_environment(
                    "FACTORY_AGENT_ROUTES_PER_INTERVAL",
                    AGENT_ROUTES_PER_INTERVAL,
                ),
            )

    def _candidate_names(
        self,
        phase: AgentPhase,
        job: Job,
    ) -> tuple[list[str], dict[str, ProviderHealth]]:
        candidates, health = super()._candidate_names(phase, job)
        if not self.conservative_enabled:
            return candidates, health

        # Preserve independent review when possible before applying the provider
        # budget. Without this reorder, capping a route could retain the original
        # implementation provider and accidentally discard an independent reviewer.
        if phase in {AgentPhase.CODE_REVIEW, AgentPhase.SECURITY_REVIEW}:
            mutating_providers = {
                str(entry.get("provider"))
                for entry in job.provider_history
                if (
                    entry.get("phase") in _CODE_MUTATING_PHASES or entry.get("mutated_code") is True
                )
                and isinstance(entry.get("provider"), str)
            }
            candidates = [name for name in candidates if name not in mutating_providers] + [
                name for name in candidates if name in mutating_providers
            ]

        return candidates[:MAX_PROVIDER_CANDIDATES_PER_PHASE], health

    @staticmethod
    def _review_key(job: Job) -> str:
        pull_request = job.pull_request if job.pull_request is not None else job.task.identifier
        return f"pr-{pull_request}@{job.head_sha or 'unknown'}"

    def _admit_agent_route(self, request: AgentRequest, job: Job, now: datetime) -> None:
        gate = self._agent_route_admission
        if gate is None:
            return
        if not gate.admit(
            f"{job.task.identifier}:{request.phase.value}:{now.isoformat()}",
            now,
        ):
            raise ProviderCapacityUnavailable(
                "Global conservative agent-route budget is exhausted",
                retry_after_seconds=_gate_retry_seconds(gate, now),
            )

    def run(
        self,
        request: AgentRequest,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentResult:
        if not self.conservative_enabled:
            return super().run(request, job, exclude=exclude)
        if self._stopping.is_set():
            raise ProviderCapacityUnavailable("Agent routing is stopping")
        if not self._global_agent_slots.acquire(blocking=False):
            raise ProviderCapacityUnavailable(
                "Global conservative agent concurrency is full",
                retry_after_seconds=_RESOURCE_RETRY_SECONDS,
            )

        review_slot_acquired = False
        try:
            now = datetime.now(UTC)
            route_gate = self._agent_route_admission
            route_slots = route_gate.available_slots(now) if route_gate is not None else None
            if route_slots == 0:
                raise ProviderCapacityUnavailable(
                    "Global conservative agent-route budget is exhausted",
                    retry_after_seconds=_gate_retry_seconds(route_gate, now),
                )
            if request.phase is AgentPhase.CODE_REVIEW:
                if not self._review_slots.acquire(blocking=False):
                    raise ProviderCapacityUnavailable(
                        "Independent review concurrency is full",
                        retry_after_seconds=_RESOURCE_RETRY_SECONDS,
                    )
                review_slot_acquired = True
                if self._review_admission is not None and not self._review_admission.admit(
                    self._review_key(job), now
                ):
                    raise ProviderCapacityUnavailable(
                        "Independent PR review budget is exhausted "
                        f"({REVIEWS_PER_INTERVAL} reviews/hour or SHA already admitted)",
                        retry_after_seconds=_gate_retry_seconds(self._review_admission, now),
                    )
            self._admit_agent_route(request, job, now)
            return super().run(request, job, exclude=exclude)
        finally:
            if review_slot_acquired:
                self._review_slots.release()
            self._global_agent_slots.release()
