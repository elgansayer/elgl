"""Agent router for managing multiple provider execution engines."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
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
from openhands_factory.models import Job, Task
from openhands_factory.state_machine import StateMachine


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
        health_store: AgentHealthStore | None = None,
        failure_threshold: int = 2,
        cooldown_seconds: int = 300,
    ) -> None:
        self.providers = {provider.name: provider for provider in providers}
        self.policy = policy
        self.health_store = health_store
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.last_attempts: list[AgentResult] = []

    def _breakers(self) -> dict[str, AgentCircuitBreaker]:
        if self.health_store is None:
            return {}
        defaults = {
            name: AgentCircuitBreaker(
                provider=name,
                failure_threshold=self.failure_threshold,
                cooldown_seconds=self.cooldown_seconds,
            )
            for name in self.providers
            if name != "openhands"
        }
        return self.health_store.load(defaults)

    def _health(self) -> dict[str, ProviderHealth]:
        breakers = self._breakers()
        result: dict[str, ProviderHealth] = {}
        for name, provider in self.providers.items():
            provider_health = provider.health()
            breaker = breakers.get(name)
            if breaker is not None:
                breaker_health = breaker.get_health()
                if breaker_health.status is not ProviderStatus.HEALTHY:
                    provider_health = breaker_health
            result[name] = provider_health
        if self.health_store is not None:
            self.health_store.save(breakers)
        return result

    def _record_result(self, provider: str, result: AgentResult) -> None:
        if self.health_store is None or provider == "openhands":
            return
        breakers = self._breakers()
        breaker = breakers[provider]
        if result.success:
            breaker.record_success()
        elif result.failure is not None and result.failure.kind in {
            AgentFailureKind.PROVIDER_UNAVAILABLE,
            AgentFailureKind.PROVIDER_AUTH,
            AgentFailureKind.PROVIDER_RATE_LIMIT,
            AgentFailureKind.PROVIDER_QUOTA,
            AgentFailureKind.PROVIDER_TIMEOUT,
            AgentFailureKind.PROVIDER_TRANSPORT,
            AgentFailureKind.AGENT_CRASH,
            AgentFailureKind.INVALID_AGENT_OUTPUT,
        }:
            breaker.record_failure(result.failure.kind)
        else:
            return
        self.health_store.save(breakers)

    @staticmethod
    def _eligible(
        provider: AgentProvider,
        phase: AgentPhase,
        health: ProviderHealth,
    ) -> bool:
        """Return whether a provider is currently safe to receive work.

        Routing must fail closed for providers whose live health says they are
        cooling down, unauthenticated, exhausted, disabled, or unavailable. A
        policy may order candidates, but it must never be possible for the
        router's generic fallback path to bypass the policy's health decision.
        """

        usable = health.status in (ProviderStatus.HEALTHY, ProviderStatus.DEGRADED)
        return usable and provider.supports(phase)

    def acquire(
        self,
        *,
        phase: AgentPhase,
        task: Task,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentProvider | None:
        health_data = self._health()

        if self.policy:
            candidates = self.policy.candidates(phase, job, health_data)
            for name in candidates:
                if exclude and name in exclude:
                    continue
                provider = self.providers.get(name)
                health = health_data.get(name)
                if provider and health and self._eligible(provider, phase, health):
                    return provider
            # A configured policy returning no eligible provider is an explicit
            # bounded-recovery condition. Do not fall through to an unhealthy or
            # disabled provider simply because it happens to support the phase.
            return None

        for provider in self.providers.values():
            if exclude and provider.name in exclude:
                continue
            health = health_data[provider.name]
            if self._eligible(provider, phase, health):
                return provider
        return None

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

        attempted: set[str] = set(exclude or set())
        diversity_fallback_used = False
        failures: list[str] = []
        self.last_attempts = []
        while True:
            provider = self.acquire(
                phase=request.phase,
                task=request.task,
                job=job,
                exclude=attempted,
            )
            if provider is None:
                if exclude and not diversity_fallback_used:
                    # Independent review is preferred, not a deadlock. If every
                    # other eligible provider is unavailable, allow the implementer
                    # to review as the explicit last resort.
                    attempted.difference_update(exclude)
                    diversity_fallback_used = True
                    continue
                detail = "; ".join(failures) or "no eligible provider"
                state_machine.update_state(f"Phase {request.phase} unavailable: {detail}")
                raise RuntimeError(
                    f"No available provider found for phase: {request.phase}: {detail}"
                )
            attempted.add(provider.name)
            try:
                result = provider.run(request)
            except Exception as error:
                result = AgentResult(
                    provider=provider.name,
                    phase=request.phase,
                    success=False,
                    started_at=datetime.now(UTC),
                    finished_at=datetime.now(UTC),
                    exit_code=None,
                    summary=None,
                    output_path=None,
                    failure=AgentFailure(
                        kind=AgentFailureKind.AGENT_CRASH,
                        message=str(error),
                    ),
                )
            self._record_result(provider.name, result)
            self.last_attempts.append(result)
            if result.success:
                state_machine.update_state(
                    f"Phase {request.phase} completed successfully by {provider.name}."
                )
                return result
            failure = result.failure
            message = failure.message if failure else "provider returned an unsuccessful result"
            failures.append(f"{provider.name}: {message}")
            if failure is None or failure.kind not in {
                AgentFailureKind.PROVIDER_UNAVAILABLE,
                AgentFailureKind.PROVIDER_AUTH,
                AgentFailureKind.PROVIDER_RATE_LIMIT,
                AgentFailureKind.PROVIDER_QUOTA,
                AgentFailureKind.PROVIDER_TIMEOUT,
                AgentFailureKind.PROVIDER_TRANSPORT,
                AgentFailureKind.AGENT_CRASH,
                AgentFailureKind.INVALID_AGENT_OUTPUT,
            }:
                state_machine.update_state(
                    f"Phase {request.phase} failed on {provider.name}: {message}"
                )
                return result
