"""Conservative resource policy layered over the provider-neutral agent router."""

from __future__ import annotations

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
from openhands_factory.issue_admission import ReviewAdmissionGate
from openhands_factory.models import Job

MAX_PROVIDER_CANDIDATES_PER_PHASE = 2
MAX_GLOBAL_AGENT_CONCURRENCY = 2
MAX_REVIEW_CONCURRENCY = 1
REVIEW_INTERVAL_SECONDS = 60 * 60
REVIEWS_PER_INTERVAL = 2
_RESOURCE_RETRY_SECONDS = 60
_CODE_MUTATING_PHASES = {
    AgentPhase.ARCHITECTURE.value,
    AgentPhase.IMPLEMENTATION.value,
    AgentPhase.SECURITY_REVIEW.value,
    AgentPhase.QUALITY_REPAIR.value,
    AgentPhase.CI_REPAIR.value,
}


class ConservativeAgentRouter(AgentRouter):
    """Bound expensive execution without weakening the existing Factory pipeline.

    The scheduler may keep multiple cheap GitHub/CI state transitions in flight,
    while this router limits the expensive part of those workers: at most two agent
    executions globally, one independent review at a time, two newly admitted PR
    review SHAs per hour, and at most one provider fallback candidate per phase.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._global_agent_slots = BoundedSemaphore(MAX_GLOBAL_AGENT_CONCURRENCY)
        self._review_slots = BoundedSemaphore(MAX_REVIEW_CONCURRENCY)
        self._review_admission: ReviewAdmissionGate | None = None
        if self.capacity_store is not None:
            self._review_admission = ReviewAdmissionGate(
                self.capacity_store.path.parent / "review-admissions.json",
                interval_seconds=REVIEW_INTERVAL_SECONDS,
                max_admissions=REVIEWS_PER_INTERVAL,
            )

    def _candidate_names(
        self,
        phase: AgentPhase,
        job: Job,
    ) -> tuple[list[str], dict[str, ProviderHealth]]:
        candidates, health = super()._candidate_names(phase, job)

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

    def run(
        self,
        request: AgentRequest,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentResult:
        if self._stopping.is_set():
            raise ProviderCapacityUnavailable("Agent routing is stopping")
        if not self._global_agent_slots.acquire(blocking=False):
            raise ProviderCapacityUnavailable(
                "Global conservative agent concurrency is full",
                retry_after_seconds=_RESOURCE_RETRY_SECONDS,
            )

        review_slot_acquired = False
        try:
            if request.phase is AgentPhase.CODE_REVIEW:
                if not self._review_slots.acquire(blocking=False):
                    raise ProviderCapacityUnavailable(
                        "Independent review concurrency is full",
                        retry_after_seconds=_RESOURCE_RETRY_SECONDS,
                    )
                review_slot_acquired = True
                if self._review_admission is not None and not self._review_admission.admit(
                    self._review_key(job), datetime.now(UTC)
                ):
                    raise ProviderCapacityUnavailable(
                        "Independent PR review budget is exhausted "
                        "(2 reviews/hour or SHA already admitted)",
                        retry_after_seconds=_RESOURCE_RETRY_SECONDS,
                    )
            return super().run(request, job, exclude=exclude)
        finally:
            if review_slot_acquired:
                self._review_slots.release()
            self._global_agent_slots.release()
