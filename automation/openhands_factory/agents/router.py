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
)
from openhands_factory.models import Job, Task


class RoutingPolicy(Protocol):
    def candidates(
        self,
        phase: AgentPhase,
        job: Job,
        provider_health: Mapping[str, ProviderHealth],
    ) -> Sequence[str]:
        ...


class AgentRouter:
    def __init__(self, providers: Sequence[AgentProvider], policy: RoutingPolicy | None = None) -> None:
        self.providers = {p.name: p for p in providers}
        self.policy = policy

    def acquire(
        self,
        *,
        phase: AgentPhase,
        task: Task,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentProvider | None:
        if self.policy:
            # Real implementation needs actual health data. We mock it for now
            # if we don't have health passed in.
            # In Stage 7, FactoryPipeline should pass health data to the router,
            # or the router should load it.
            health_data = {p.name: p.health() for p in self.providers.values()}
            candidates = self.policy.candidates(phase, job, health_data)
            for name in candidates:
                if exclude and name in exclude:
                    continue
                provider = self.providers.get(name)
                if provider and provider.supports(phase):
                    return provider

        # Fallback to simple iteration if no policy
        for provider in self.providers.values():
            if exclude and provider.name in exclude:
                continue
            if provider.supports(phase):
                return provider
        return None

    def run(self, request: AgentRequest, job: Job, exclude: set[str] | None = None) -> AgentResult:
        provider = self.acquire(phase=request.phase, task=request.task, job=job, exclude=exclude)
        if not provider:
            raise RuntimeError(f"No available provider found for phase: {request.phase}")
        return provider.run(request)
