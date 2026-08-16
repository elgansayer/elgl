"""Agent router for managing multiple provider execution engines."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import replace
from datetime import UTC, datetime
from threading import BoundedSemaphore
from typing import Protocol

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentProvider,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.models import Job, Task
from openhands_factory.state_machine import StateMachine

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


class RoutingPolicy(Protocol):
    def candidates(
        self,
        phase: AgentPhase,
        job: Job,
        provider_health: Mapping[str, ProviderHealth],
    ) -> Sequence[str]:
        ...


class AgentRouter:
    def __init__(
        self,
        providers: Sequence[AgentProvider],
        policy: RoutingPolicy | None = None,
        breakers: Mapping[str, AgentCircuitBreaker] | None = None,
        health_store: AgentHealthStore | None = None,
        provider_slots: Mapping[str, BoundedSemaphore] | None = None,
        skip_busy_providers: bool | None = None,
    ) -> None:
        self.providers = {provider.name: provider for provider in providers}
        self.policy = policy
        self.breakers = dict(breakers or {})
        self.health_store = health_store

        policy_config = getattr(policy, "config", None)
        configured_providers = getattr(policy_config, "providers", {}) if policy_config else {}
        if provider_slots is None:
            self.provider_slots = {
                name: BoundedSemaphore(provider_cfg.max_concurrency)
                for name, provider_cfg in configured_providers.items()
                if provider_cfg.enabled and name in self.providers
            }
        else:
            self.provider_slots = dict(provider_slots)

        configured_routing = getattr(policy_config, "routing", None) if policy_config else None
        if skip_busy_providers is None and configured_routing is not None:
            skip_busy_providers = configured_routing.skip_busy_providers
        self.skip_busy_providers = True if skip_busy_providers is None else skip_busy_providers

    def _provider_config(self, name: str):
        policy_config = getattr(self.policy, "config", None)
        providers = getattr(policy_config, "providers", {}) if policy_config else {}
        return providers.get(name)

    def _request_for_provider(self, request: AgentRequest, name: str) -> AgentRequest:
        provider_cfg = self._provider_config(name)
        if provider_cfg is None:
            return request
        return replace(
            request,
            timeout_seconds=request.timeout_seconds or provider_cfg.timeout_seconds,
            max_output_bytes=request.max_output_bytes or provider_cfg.max_output_bytes,
        )

    def _health(self) -> dict[str, ProviderHealth]:
        health: dict[str, ProviderHealth] = {}
        for name, provider in self.providers.items():
            breaker = self.breakers.get(name)
            if breaker is not None and not breaker.permits_call():
                health[name] = breaker.get_health()
                continue
            try:
                provider_health = provider.health()
            except Exception as error:
                health[name] = ProviderHealth(
                    provider=name,
                    status=ProviderStatus.UNAVAILABLE,
                    checked_at=datetime.now(UTC),
                    detail=f"health probe failed: {type(error).__name__}",
                )
                continue
            if (
                provider_health.status in {ProviderStatus.HEALTHY, ProviderStatus.DEGRADED}
                and breaker is not None
                and breaker.state == "half-open"
            ):
                health[name] = breaker.get_health()
            else:
                health[name] = provider_health
        return health

    def _candidate_names(self, phase: AgentPhase, job: Job) -> list[str]:
        health_data = self._health()
        if self.policy:
            return list(self.policy.candidates(phase, job, health_data))
        return [
            name
            for name, provider in self.providers.items()
            if provider.supports(phase)
            and health_data[name].status in {ProviderStatus.HEALTHY, ProviderStatus.DEGRADED}
        ]

    def acquire(
        self,
        *,
        phase: AgentPhase,
        task: Task,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentProvider | None:
        del task
        for name in self._candidate_names(phase, job):
            if exclude and name in exclude:
                continue
            provider = self.providers.get(name)
            if provider and provider.supports(phase):
                return provider
        return None

    def _save_health(self) -> None:
        if self.health_store is not None:
            self.health_store.save(self.breakers)

    @staticmethod
    def _history_entry(
        result: AgentResult,
        fallback_reason: str | None = None,
    ) -> dict[str, str | int]:
        entry: dict[str, str | int] = {
            "provider": result.provider,
            "phase": result.phase.value,
            "success": int(result.success),
            "started_at": result.started_at.isoformat(),
            "finished_at": result.finished_at.isoformat(),
        }
        if result.exit_code is not None:
            entry["exit_code"] = result.exit_code
        if result.failure is not None:
            entry["kind"] = result.failure.kind.value
            entry["error"] = result.failure.message[-1000:]
            if result.failure.retry_after_seconds is not None:
                entry["retry_after_seconds"] = result.failure.retry_after_seconds
        if fallback_reason:
            entry["fallback_reason"] = fallback_reason
        return entry

    def _retry_after_seconds(self) -> int | None:
        now = datetime.now(UTC)
        waits: list[int] = []
        for breaker in self.breakers.values():
            health = breaker.get_health()
            if health.retry_after is None:
                continue
            waits.append(max(1, int((health.retry_after - now).total_seconds())))
        return min(waits) if waits else None

    def _try_acquire_slot(self, name: str) -> tuple[BoundedSemaphore | None, bool]:
        slot = self.provider_slots.get(name)
        if slot is None:
            return None, True
        if self.skip_busy_providers:
            return slot, slot.acquire(blocking=False)
        slot.acquire()
        return slot, True

    def run(
        self,
        request: AgentRequest,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentResult:
        state_machine = StateMachine(request.cwd)
        initial_plan = request.task.title
        if request.task.body:
            initial_plan = f"{initial_plan}\n\n{request.task.body}"
        state_machine.initialize_state(initial_plan)

        candidates = self._candidate_names(request.phase, job)
        attempted = False
        busy = False
        for name in candidates:
            if exclude and name in exclude:
                continue
            provider = self.providers.get(name)
            if provider is None or not provider.supports(request.phase):
                continue
            breaker = self.breakers.get(name)
            if breaker is not None and not breaker.permits_call():
                continue

            slot, acquired = self._try_acquire_slot(name)
            if not acquired:
                busy = True
                continue

            attempted = True
            provider_request = self._request_for_provider(request, name)
            try:
                try:
                    result = provider.run(provider_request)
                except Exception as error:
                    now = datetime.now(UTC)
                    result = AgentResult(
                        provider=name,
                        phase=request.phase,
                        success=False,
                        started_at=now,
                        finished_at=now,
                        exit_code=None,
                        summary=None,
                        output_path=None,
                        failure=AgentFailure(
                            kind=AgentFailureKind.AGENT_CRASH,
                            message=f"{type(error).__name__}: {error}",
                            exit_code=None,
                        ),
                    )
            finally:
                if slot is not None:
                    slot.release()

            if result.success:
                if breaker is not None:
                    breaker.record_success()
                    self._save_health()
                job.provider_history.append(self._history_entry(result))
                state_machine.update_state(
                    f"Phase {request.phase} completed successfully by {provider.name}."
                )
                return result

            failure = result.failure
            failure_kind = failure.kind if failure is not None else AgentFailureKind.INVALID_AGENT_OUTPUT
            fallback = failure_kind in FALLBACK_FAILURES
            if breaker is not None:
                breaker.record_failure(
                    failure_kind,
                    retry_after_seconds=(failure.retry_after_seconds if failure is not None else None),
                )
                self._save_health()
            job.provider_history.append(
                self._history_entry(
                    result,
                    fallback_reason=failure_kind.value if fallback else None,
                )
            )
            state_machine.update_state(
                f"Phase {request.phase} failed on {provider.name}: "
                f"{failure.message if failure else 'invalid provider result'}"
            )
            if not fallback:
                return result

        if busy and not attempted:
            detail = f"All eligible providers are busy for phase {request.phase.value}"
        elif attempted:
            detail = f"All eligible providers failed or were unavailable for phase {request.phase.value}"
        else:
            detail = f"No eligible provider is currently available for phase {request.phase.value}"
        raise ProviderCapacityUnavailable(detail, retry_after_seconds=self._retry_after_seconds())
