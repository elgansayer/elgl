"""Health-aware, bounded routing across interchangeable agent providers."""

from __future__ import annotations

import logging
import threading
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import replace
from datetime import UTC, datetime
from functools import partial
from typing import Protocol

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentProvider,
    AgentRequest,
    AgentResult,
    HealthCacheInvalidator,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.cli import redact_agent_output
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.exceptions import (
    AgentTaskFailure,
    FactoryError,
    ProviderCapacityUnavailable,
)
from openhands_factory.metrics import MetricsStore
from openhands_factory.models import MAX_PROVIDER_HISTORY, Job, Task
from openhands_factory.provider_capacity import ProviderCapacityStore

LOGGER = logging.getLogger(__name__)
FALLBACK_FAILURES = {
    AgentFailureKind.PROVIDER_UNAVAILABLE,
    AgentFailureKind.PROVIDER_AUTH,
    AgentFailureKind.PROVIDER_RATE_LIMIT,
    AgentFailureKind.PROVIDER_QUOTA,
    AgentFailureKind.PROVIDER_TIMEOUT,
    AgentFailureKind.PROVIDER_TRANSPORT,
    AgentFailureKind.AGENT_CRASH,
    AgentFailureKind.INVALID_AGENT_OUTPUT,
}
SAME_PROVIDER_RETRY_FAILURES = {
    AgentFailureKind.PROVIDER_TIMEOUT,
    AgentFailureKind.PROVIDER_TRANSPORT,
    AgentFailureKind.AGENT_CRASH,
    AgentFailureKind.INVALID_AGENT_OUTPUT,
}
RESPONSIVE_PROVIDER_FAILURES = {
    AgentFailureKind.TASK_FAILURE,
    AgentFailureKind.TEST_FAILURE,
    AgentFailureKind.REPOSITORY_FAILURE,
    AgentFailureKind.POLICY_FAILURE,
}


class RoutingPolicy(Protocol):
    def candidates(
        self,
        phase: AgentPhase,
        job: Job,
        provider_health: Mapping[str, ProviderHealth],
    ) -> Sequence[str]: ...


def _record_probe_failure(
    breaker: AgentCircuitBreaker,
    failure: AgentFailureKind,
    retry_after_seconds: int | None,
) -> None:
    breaker.record_failure(failure, retry_after_seconds=retry_after_seconds)


class AgentRouter:
    def __init__(
        self,
        providers: Sequence[AgentProvider],
        policy: RoutingPolicy | None = None,
        health_store: AgentHealthStore | None = None,
        capacity_store: ProviderCapacityStore | None = None,
        provider_limits: Mapping[str, int] | None = None,
        provider_timeouts: Mapping[str, int | None] | None = None,
        phase_timeouts: Mapping[str, int] | None = None,
        provider_output_limits: Mapping[str, int] | None = None,
        failure_cooldowns: Mapping[AgentFailureKind, int] | None = None,
        metrics_store: MetricsStore | None = None,
        failure_threshold: int = 2,
        cooldown_seconds: int = 300,
        capacity_wait_seconds: int = 30,
        skip_busy_providers: bool = True,
        same_provider_retries: int = 1,
    ) -> None:
        self.providers = {provider.name: provider for provider in providers}
        self.policy = policy
        self.health_store = health_store
        self.capacity_store = capacity_store
        self.provider_limits = dict(provider_limits or {})
        self.provider_timeouts = dict(provider_timeouts or {})
        self.phase_timeouts = dict(phase_timeouts or {})
        self.provider_output_limits = dict(provider_output_limits or {})
        self.failure_cooldowns = dict(failure_cooldowns or {})
        self.metrics_store = metrics_store
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.capacity_wait_seconds = capacity_wait_seconds
        self.skip_busy_providers = skip_busy_providers
        self.same_provider_retries = same_provider_retries
        self._stopping = threading.Event()
        self._memory_breakers_lock = threading.Lock()
        self._review_capacity_lock = threading.Lock()
        self._review_capacity_tasks: set[str] = set()
        self._memory_breakers = self._default_breakers()

    def shutdown(self) -> None:
        """Stop admitting provider attempts while active children are drained."""
        self._stopping.set()

    def reserve_review_capacity(self, task_id: str) -> None:
        """Hold one provider slot for a scheduled pull request review job."""

        with self._review_capacity_lock:
            self._review_capacity_tasks.add(task_id)

    def release_review_capacity(self, task_id: str) -> None:
        """Release a pull request review reservation after its worker finishes."""

        with self._review_capacity_lock:
            self._review_capacity_tasks.discard(task_id)

    def _capacity_limit(self, provider: str, job: Job) -> int:
        limit = self.provider_limits.get(provider, 1)
        with self._review_capacity_lock:
            review_waiting = bool(self._review_capacity_tasks)
            review_job = job.task.identifier in self._review_capacity_tasks
        if review_waiting and not review_job:
            return max(limit - 1, 0)
        return limit

    def _default_breakers(self) -> dict[str, AgentCircuitBreaker]:
        return {
            name: AgentCircuitBreaker(
                provider=name,
                failure_threshold=self.failure_threshold,
                cooldown_seconds=self.cooldown_seconds,
            )
            for name in self.providers
        }

    def _breakers(self) -> dict[str, AgentCircuitBreaker]:
        defaults = self._default_breakers()
        if self.health_store is None:
            return self._memory_breakers
        return self.health_store.load(defaults)

    def _health(self) -> dict[str, ProviderHealth]:
        defaults = self._default_breakers()
        breakers = self._breakers()
        health: dict[str, ProviderHealth] = {}
        for name, provider in self.providers.items():
            if self.health_store is None:
                breaker = breakers[name]
                with self._memory_breakers_lock:
                    permitted = breaker.permits_call()
            else:
                permitted, breaker = self.health_store.permit(name, defaults)
            if not permitted:
                health[name] = breaker.get_health()
                continue
            try:
                provider_health = provider.health()
            except Exception as error:
                provider_health = ProviderHealth(
                    name,
                    ProviderStatus.UNAVAILABLE,
                    datetime.now(UTC),
                    detail=f"health probe failed: {type(error).__name__}",
                )
            if provider_health.status is ProviderStatus.DISABLED:
                health[name] = provider_health
                continue
            if provider_health.status in {ProviderStatus.HEALTHY, ProviderStatus.DEGRADED}:
                if breaker.state == "half-open":
                    if self.health_store is not None:
                        self.health_store.update(
                            name,
                            defaults,
                            lambda item: item.record_success(),
                        )
                    else:
                        with self._memory_breakers_lock:
                            breaker.record_success()
                health[name] = provider_health
                continue
            failure_by_status = {
                ProviderStatus.AUTH_REQUIRED: AgentFailureKind.PROVIDER_AUTH,
                ProviderStatus.RATE_LIMITED: AgentFailureKind.PROVIDER_RATE_LIMIT,
                ProviderStatus.QUOTA_EXHAUSTED: AgentFailureKind.PROVIDER_QUOTA,
            }
            failure_kind = failure_by_status.get(
                provider_health.status,
                AgentFailureKind.PROVIDER_UNAVAILABLE,
            )
            cooldown = self.failure_cooldowns.get(failure_kind)
            if self.health_store is not None:
                breaker = self.health_store.update(
                    name,
                    defaults,
                    partial(
                        _record_probe_failure,
                        failure=failure_kind,
                        retry_after_seconds=cooldown,
                    ),
                )
            else:
                with self._memory_breakers_lock:
                    breaker.record_failure(
                        failure_kind,
                        retry_after_seconds=cooldown,
                    )
            breaker_health = breaker.get_health()
            health[name] = ProviderHealth(
                provider=name,
                status=provider_health.status,
                checked_at=provider_health.checked_at,
                retry_after=breaker_health.retry_after,
                detail=provider_health.detail,
            )
        return health

    @staticmethod
    def _eligible(
        provider: AgentProvider,
        phase: AgentPhase,
        health: ProviderHealth,
    ) -> bool:
        return health.status in {
            ProviderStatus.HEALTHY,
            ProviderStatus.DEGRADED,
        } and provider.supports(phase)

    def _candidate_names(
        self,
        phase: AgentPhase,
        job: Job,
    ) -> tuple[list[str], dict[str, ProviderHealth]]:
        health = self._health()
        preferred = (
            self.policy.candidates(phase, job, health) if self.policy else list(self.providers)
        )
        candidates = [
            name
            for name in preferred
            if name in self.providers
            and name in health
            and self._eligible(self.providers[name], phase, health[name])
        ]
        return candidates, health

    def acquire(
        self,
        *,
        phase: AgentPhase,
        task: Task,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentProvider | None:
        del task
        candidates, _ = self._candidate_names(phase, job)
        for name in candidates:
            if exclude and name in exclude:
                continue
            return self.providers[name]
        return None

    def health_snapshot(self) -> dict[str, ProviderHealth]:
        """Return non-secret live provider health for startup and diagnostics."""
        return self._health()

    def has_usable_provider(self) -> bool:
        return any(
            item.status in {ProviderStatus.HEALTHY, ProviderStatus.DEGRADED}
            for item in self.health_snapshot().values()
        )

    def _record_breaker(self, result: AgentResult) -> None:
        if (
            not result.success
            and result.failure is not None
            and result.failure.kind in FALLBACK_FAILURES
        ):
            provider = self.providers.get(result.provider)
            if isinstance(provider, HealthCacheInvalidator):
                provider.invalidate_health_cache()
        defaults = self._default_breakers()

        def mutate(breaker: AgentCircuitBreaker) -> None:
            if result.success or (
                result.failure is not None and result.failure.kind in RESPONSIVE_PROVIDER_FAILURES
            ):
                breaker.record_success()
            elif result.failure is not None and result.failure.kind in FALLBACK_FAILURES:
                breaker.record_failure(
                    result.failure.kind,
                    retry_after_seconds=(
                        result.failure.retry_after_seconds
                        or self.failure_cooldowns.get(result.failure.kind)
                    ),
                )

        if self.health_store is None:
            with self._memory_breakers_lock:
                mutate(self._memory_breakers[result.provider])
            return
        self.health_store.update(result.provider, defaults, mutate)

    @staticmethod
    def _history_entry(result: AgentResult) -> dict[str, str | int | float | bool | None]:
        duration = max((result.finished_at - result.started_at).total_seconds(), 0)
        entry: dict[str, str | int | float | bool | None] = {
            "provider": result.provider,
            "transport": result.transport,
            "model": result.model,
            "phase": result.phase.value,
            "attempt": result.attempt,
            "success": result.success,
            "started_at": result.started_at.isoformat(),
            "finished_at": result.finished_at.isoformat(),
            "duration_seconds": round(duration, 3),
            "fallback_reason": result.fallback_reason,
        }
        if result.exit_code is not None:
            entry["exit_code"] = result.exit_code
        if result.failure is not None:
            entry["failure_classification"] = result.failure.kind.value
            entry["error"] = redact_agent_output(result.failure.message)[-1000:]
            entry["retry_after_seconds"] = result.failure.retry_after_seconds
        return entry

    def _request_for(self, request: AgentRequest, provider: str) -> AgentRequest:
        timeout = self.provider_timeouts.get(provider)
        if timeout is None:
            timeout = self.phase_timeouts.get(request.phase.value)
        return replace(
            request,
            timeout_seconds=request.timeout_seconds or timeout,
            max_output_bytes=request.max_output_bytes or self.provider_output_limits.get(provider),
        )

    def _retry_after_seconds(self, health: Mapping[str, ProviderHealth]) -> int | None:
        now = datetime.now(UTC)
        breaker_health = [breaker.get_health() for breaker in self._breakers().values()]
        waits = [
            max(1, int((item.retry_after - now).total_seconds()))
            for item in [*health.values(), *breaker_health]
            if item.retry_after is not None
        ]
        return min(waits) if waits else None

    def _reserve_capacity(
        self,
        provider: str,
        request: AgentRequest,
        owner: str,
        job: Job,
    ) -> float:
        if self.capacity_store is None:
            return 0
        limit = self._capacity_limit(provider, job)
        if limit == 0:
            raise ProviderCapacityUnavailable(
                f"Provider capacity reserved for pull request review on {provider}",
                retry_after_seconds=max(self.capacity_wait_seconds, 1),
            )
        timeout = request.timeout_seconds or 3600
        return self.capacity_store.acquire(
            provider,
            limit=limit,
            owner=owner,
            wait_seconds=0 if self.skip_busy_providers else self.capacity_wait_seconds,
            lease_seconds=timeout * (self.same_provider_retries + 1) + 300,
        )

    def _record_metrics(
        self,
        result: AgentResult,
        capacity_wait_seconds: float,
        *,
        request_prompt_chars: int | None = None,
    ) -> None:
        if self.metrics_store is None or result.provider == "openhands":
            return
        failure = result.failure
        duration = max((result.finished_at - result.started_at).total_seconds(), 0)
        self.metrics_store.record(
            result.provider,
            result.model or "provider-default",
            phase=result.phase.value,
            successful=result.success,
            fallback=result.fallback_reason is not None,
            rate_limited=(
                failure is not None and failure.kind is AgentFailureKind.PROVIDER_RATE_LIMIT
            ),
            authentication_failure=(
                failure is not None and failure.kind is AgentFailureKind.PROVIDER_AUTH
            ),
            quota_failure=(failure is not None and failure.kind is AgentFailureKind.PROVIDER_QUOTA),
            timed_out=(failure is not None and failure.kind is AgentFailureKind.PROVIDER_TIMEOUT),
            duration_seconds=duration,
            capacity_wait_seconds=capacity_wait_seconds,
            failure_kind=failure.kind.value if failure is not None else None,
            request_prompt_chars=request_prompt_chars,
        )

    def _release_capacity(self, provider: str, owner: str) -> None:
        if self.capacity_store is not None:
            self.capacity_store.release(provider, owner=owner)

    @staticmethod
    def _crash_result(provider: str, request: AgentRequest, error: Exception) -> AgentResult:
        now = datetime.now(UTC)
        return AgentResult(
            provider=provider,
            phase=request.phase,
            success=False,
            started_at=now,
            finished_at=now,
            exit_code=None,
            summary=None,
            output_path=None,
            failure=AgentFailure(
                AgentFailureKind.AGENT_CRASH,
                redact_agent_output(f"{type(error).__name__}: {error}"),
            ),
        )

    @staticmethod
    def _validate_result(result: AgentResult, request: AgentRequest) -> AgentResult:
        if not result.success and result.failure is None:
            return replace(
                result,
                failure=AgentFailure(
                    AgentFailureKind.INVALID_AGENT_OUTPUT,
                    "Provider returned an unsuccessful result without a failure classification",
                ),
            )
        if not result.success or request.validate_output is None:
            return result
        try:
            request.validate_output()
        except AgentTaskFailure as error:
            return replace(
                result,
                success=False,
                failure=AgentFailure(AgentFailureKind.TASK_FAILURE, str(error)),
            )
        except FactoryError as error:
            return replace(
                result,
                success=False,
                failure=AgentFailure(AgentFailureKind.INVALID_AGENT_OUTPUT, str(error)),
            )
        except Exception as error:
            return replace(
                result,
                success=False,
                failure=AgentFailure(
                    AgentFailureKind.INTERNAL_FACTORY_FAILURE,
                    redact_agent_output(
                        f"Output validation failed internally: {type(error).__name__}"
                    ),
                ),
            )
        return result

    def run(
        self,
        request: AgentRequest,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentResult:
        if self._stopping.is_set():
            raise ProviderCapacityUnavailable("Agent routing is stopping")
        candidates, health = self._candidate_names(request.phase, job)
        preferred = [name for name in candidates if not exclude or name not in exclude]
        diversity_fallback = [name for name in candidates if exclude and name in exclude]
        ordered = [*preferred, *diversity_fallback]
        previous_failure: str | None = None
        any_started = False
        any_busy = False

        for provider_index, name in enumerate(ordered):
            if self._stopping.is_set():
                raise ProviderCapacityUnavailable("Agent routing is stopping")
            provider = self.providers[name]
            provider_request = self._request_for(request, name)
            owner = f"{job.task.identifier}:{request.phase.value}:{uuid.uuid4()}"
            try:
                capacity_wait_seconds = self._reserve_capacity(
                    name,
                    provider_request,
                    owner,
                    job,
                )
            except ProviderCapacityUnavailable:
                any_busy = True
                previous_failure = f"{name}:busy"
                job.last_provider_failure = previous_failure
                if provider_index < len(ordered) - 1:
                    LOGGER.info(
                        "factory.agent.fallback task=%s phase=%s from=%s reason=%s",
                        job.task.identifier,
                        request.phase.value,
                        name,
                        previous_failure,
                    )
                    job.provider_failover_count += 1
                continue
            try:
                for provider_attempt in range(1, self.same_provider_retries + 2):
                    if self._stopping.is_set():
                        raise ProviderCapacityUnavailable("Agent routing is stopping")
                    any_started = True
                    if provider_request.prepare_attempt is not None:
                        provider_request.prepare_attempt()
                    LOGGER.info(
                        "factory.agent.selected task=%s phase=%s provider=%s attempt=%s",
                        job.task.identifier,
                        request.phase.value,
                        name,
                        provider_attempt,
                    )
                    try:
                        result = provider.run(provider_request)
                    except Exception as error:
                        result = self._crash_result(name, provider_request, error)
                    if self._stopping.is_set():
                        raise ProviderCapacityUnavailable("Agent routing stopped during execution")
                    fallback_reason = previous_failure
                    if exclude and name in exclude:
                        fallback_reason = fallback_reason or "diversity-last-resort"
                    result = replace(
                        result,
                        attempt=provider_attempt,
                        fallback_reason=fallback_reason,
                    )
                    result = self._validate_result(result, provider_request)
                    self._record_breaker(result)
                    self._record_metrics(
                        result,
                        capacity_wait_seconds if provider_attempt == 1 else 0,
                        request_prompt_chars=(
                            len(provider_request.system_prompt) + len(provider_request.prompt)
                        ),
                    )
                    job.provider_history.append(self._history_entry(result))
                    if len(job.provider_history) > MAX_PROVIDER_HISTORY:
                        del job.provider_history[:-MAX_PROVIDER_HISTORY]
                    if result.success:
                        LOGGER.info(
                            "factory.agent.completed task=%s phase=%s provider=%s duration=%.3f",
                            job.task.identifier,
                            request.phase.value,
                            name,
                            max((result.finished_at - result.started_at).total_seconds(), 0),
                        )
                        return result

                    failure = result.failure
                    failure_kind = (
                        failure.kind
                        if failure is not None
                        else AgentFailureKind.INVALID_AGENT_OUTPUT
                    )
                    if failure_kind not in FALLBACK_FAILURES:
                        return result
                    previous_failure = f"{name}:{failure_kind.value}"
                    job.last_provider_failure = previous_failure
                    if (
                        failure_kind not in SAME_PROVIDER_RETRY_FAILURES
                        or provider_attempt > self.same_provider_retries
                    ):
                        break
                    LOGGER.info(
                        "factory.agent.retry task=%s phase=%s provider=%s reason=%s",
                        job.task.identifier,
                        request.phase.value,
                        name,
                        failure_kind.value,
                    )
            finally:
                self._release_capacity(name, owner)

            if provider_index < len(ordered) - 1:
                LOGGER.info(
                    "factory.agent.fallback task=%s phase=%s from=%s reason=%s",
                    job.task.identifier,
                    request.phase.value,
                    name,
                    previous_failure or "unavailable",
                )
                job.provider_failover_count += 1

        retry_after: int | None
        if any_busy and not any_started:
            detail = f"All eligible providers are busy for phase {request.phase.value}"
            retry_after = max(self.capacity_wait_seconds, 1)
        elif any_started:
            detail = f"All eligible providers failed for phase {request.phase.value}"
            retry_after = self._retry_after_seconds(health)
        else:
            detail = f"No eligible provider is available for phase {request.phase.value}"
            retry_after = self._retry_after_seconds(health)
        if previous_failure is None:
            # Nothing ran, so there is no attempt history from which the daemon
            # can reconstruct why this job was deferred after a restart.
            job.last_provider_failure = detail
        raise ProviderCapacityUnavailable(detail, retry_after_seconds=retry_after)
