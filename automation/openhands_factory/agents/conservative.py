"""Conservative resource policy layered over the provider-neutral agent router."""

from __future__ import annotations

import os
from dataclasses import replace
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
AGENT_ROUTES_PER_TASK_PER_INTERVAL = 4
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


def _task_route_admissions(
    gate: DurableAdmissionGate,
    task_id: str,
    now: datetime,
) -> list[datetime]:
    """Return active route admissions belonging to one durable task."""

    snapshot = gate.snapshot(now)
    active = snapshot.get("active_admissions")
    if not isinstance(active, list):
        return []
    prefix = f"{task_id}:"
    admitted_at: list[datetime] = []
    for item in active:
        if not isinstance(item, dict):
            continue
        route_key = item.get("task_id")
        timestamp = item.get("admitted_at")
        if not isinstance(route_key, str) or not route_key.startswith(prefix):
            continue
        if not isinstance(timestamp, str):
            continue
        try:
            parsed = datetime.fromisoformat(timestamp)
        except ValueError:
            continue
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        admitted_at.append(parsed)
    return admitted_at


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
        self._agent_routes_per_task_interval = AGENT_ROUTES_PER_TASK_PER_INTERVAL
        if self.conservative_enabled:
            self._agent_routes_per_task_interval = _positive_int_environment(
                "FACTORY_AGENT_ROUTES_PER_TASK_PER_INTERVAL",
                AGENT_ROUTES_PER_TASK_PER_INTERVAL,
            )
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

    def _ensure_task_route_available(self, job: Job, now: datetime) -> None:
        """Prevent one troubled task from monopolising the hourly agent allowance."""

        gate = self._agent_route_admission
        if gate is None:
            return
        task_admissions = _task_route_admissions(gate, job.task.identifier, now)
        if len(task_admissions) < self._agent_routes_per_task_interval:
            return
        oldest = min(task_admissions)
        retry_seconds = max(1, int((oldest + gate.interval - now).total_seconds()) + 1)
        raise ProviderCapacityUnavailable(
            "Per-task conservative agent-route budget is exhausted "
            f"({self._agent_routes_per_task_interval} routes per configured interval)",
            retry_after_seconds=retry_seconds,
        )

    def _admit_agent_route(self, request: AgentRequest, job: Job, now: datetime) -> None:
        """Persist one allowance admission immediately before a provider process starts."""

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

    def _admit_review(self, job: Job, now: datetime) -> tuple[str, datetime] | None:
        """Charge one exact-head review only when a provider is about to start."""

        gate = self._review_admission
        if gate is None:
            return None
        review_key = self._review_key(job)
        if not gate.admit(review_key, now):
            raise ProviderCapacityUnavailable(
                "Independent PR review budget is exhausted "
                f"({REVIEWS_PER_INTERVAL} reviews/hour or SHA already admitted)",
                retry_after_seconds=_gate_retry_seconds(gate, now),
            )
        return review_key, now

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
            if route_gate is not None and route_slots == 0:
                raise ProviderCapacityUnavailable(
                    "Global conservative agent-route budget is exhausted",
                    retry_after_seconds=_gate_retry_seconds(route_gate, now),
                )
            # Check task fairness before reserving review concurrency. Otherwise a
            # task that already exhausted its route share could delay a useful review
            # even though it cannot start a provider in this scheduling attempt.
            self._ensure_task_route_available(job, now)
            if request.phase is AgentPhase.CODE_REVIEW:
                if not self._review_slots.acquire(blocking=False):
                    raise ProviderCapacityUnavailable(
                        "Independent review concurrency is full",
                        retry_after_seconds=_RESOURCE_RETRY_SECONDS,
                    )
                review_slot_acquired = True

            # A logical route can examine provider health/capacity and still start no
            # paid agent process at all. Do not consume durable allowance for those
            # control-plane-only attempts. AgentRouter invokes prepare_attempt only
            # after a provider slot is successfully reserved and immediately before
            # provider.run(); wrapping it makes both route and review admissions count
            # real provider starts rather than scheduler calls.
            original_prepare_attempt = request.prepare_attempt
            review_admitted = False

            def prepare_and_admit_provider_start() -> None:
                nonlocal review_admitted
                if original_prepare_attempt is not None:
                    original_prepare_attempt()
                attempt_now = datetime.now(UTC)
                # Re-check task fairness at the actual start boundary so concurrent
                # work cannot race past the per-task allowance after the early check.
                self._ensure_task_route_available(job, attempt_now)
                review_admission: tuple[str, datetime] | None = None
                if request.phase is AgentPhase.CODE_REVIEW and not review_admitted:
                    review_admission = self._admit_review(job, attempt_now)
                try:
                    self._admit_agent_route(request, job, attempt_now)
                except Exception:
                    # The route gate can become full after the early availability
                    # check. Roll back this attempt's exact review admission so a
                    # provider-capacity race cannot spend review budget without
                    # starting any provider process.
                    if review_admission is not None and self._review_admission is not None:
                        self._review_admission.revoke(*review_admission, now=attempt_now)
                    raise
                if review_admission is not None:
                    review_admitted = True

            routed_request = replace(
                request,
                prepare_attempt=prepare_and_admit_provider_start,
            )
            return super().run(routed_request, job, exclude=exclude)
        finally:
            if review_slot_acquired:
                self._review_slots.release()
            self._global_agent_slots.release()
