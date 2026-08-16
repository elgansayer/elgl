"""Agent router for managing multiple provider execution engines."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol

from openhands_factory.agents.base import (
    AgentPhase,
    AgentProvider,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
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
    ) -> None:
        self.providers = {provider.name: provider for provider in providers}
        self.policy = policy

    @staticmethod
    def _eligible(
        provider: AgentProvider,
        phase: AgentPhase,
        health: ProviderHealth,
    ) -> bool:
        """Return whether a provider is currently safe to receive work.

        Routing must fail closed for providers whose live health says they are
        cooling down, unauthenticated, exhausted, disabled, or unavailable.  A
        policy may order candidates, but it must never be possible for the
        router's generic fallback path to bypass the policy's health decision.
        """

        return health.status in (ProviderStatus.HEALTHY, ProviderStatus.DEGRADED) and provider.supports(
            phase
        )

    def acquire(
        self,
        *,
        phase: AgentPhase,
        task: Task,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentProvider | None:
        health_data = {provider.name: provider.health() for provider in self.providers.values()}

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
        provider = self.acquire(
            phase=request.phase,
            task=request.task,
            job=job,
            exclude=exclude,
        )
        if not provider:
            raise RuntimeError(f"No available provider found for phase: {request.phase}")

        state_machine = StateMachine(request.cwd)
        initial_plan = request.task.title
        if request.task.body:
            initial_plan = f"{initial_plan}\n\n{request.task.body}"
        state_machine.initialize_state(initial_plan)

        try:
            result = provider.run(request)
            state_machine.update_state(
                f"Phase {request.phase} completed successfully by {provider.name}."
            )
            return result
        except Exception as error:
            state_machine.update_state(
                f"Phase {request.phase} failed on {provider.name}: {error}"
            )
            raise
