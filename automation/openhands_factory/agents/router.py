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

    def acquire(
        self,
        *,
        phase: AgentPhase,
        task: Task,
        job: Job,
        exclude: set[str] | None = None,
    ) -> AgentProvider | None:
        if self.policy:
            health_data = {provider.name: provider.health() for provider in self.providers.values()}
            candidates = self.policy.candidates(phase, job, health_data)
            for name in candidates:
                if exclude and name in exclude:
                    continue
                provider = self.providers.get(name)
                if provider and provider.supports(phase):
                    return provider

        for provider in self.providers.values():
            if exclude and provider.name in exclude:
                continue
            if provider.supports(phase):
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
            
        # Initialize state machine for context transfer
        state_machine = StateMachine(request.work_dir)
        state_machine.initialize_state(request.task.description)
        
        # In a real environment, the underlying AgentProvider would be modified 
        # to execute via PTYWrapper and SandboxRunner, reading the FACTORY_PLAN.md
        # and FACTORY_STATE.md automatically since they are written to the workdir.
        
        try:
            result = provider.run(request)
            state_machine.update_state(f"Phase {request.phase} completed successfully by {provider.name}.")
            return result
        except Exception as e:
            state_machine.update_state(f"Phase {request.phase} failed on {provider.name}: {e}")
            raise
