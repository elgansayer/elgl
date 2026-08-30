"""Configurable phase routing and provider-rotation policy."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from openhands_factory.agents.base import AgentPhase, ProviderHealth, ProviderStatus
from openhands_factory.agents.router import RoutingPolicy
from openhands_factory.config import AgentsConfig
from openhands_factory.models import Job


class ConfigRoutingPolicy(RoutingPolicy):
    def __init__(self, config: AgentsConfig) -> None:
        self.config = config

    def candidates(
        self,
        phase: AgentPhase,
        job: Job,
        provider_health: Mapping[str, ProviderHealth],
    ) -> Sequence[str]:
        if not self.config.routing_enabled:
            openhands = self.config.providers.get("openhands")
            return ["openhands"] if openhands is not None and openhands.enabled else []

        preferred = list(getattr(self.config.routing, phase.value.replace("-", "_")))
        eligible: list[str] = []
        emergency: list[str] = []
        for name in preferred:
            provider = self.config.providers.get(name)
            health = provider_health.get(name)
            if provider is None or not provider.enabled or health is None:
                continue
            if health.status not in {ProviderStatus.HEALTHY, ProviderStatus.DEGRADED}:
                continue
            target = emergency if provider.emergency_only else eligible
            if name not in target:
                target.append(name)

        # Factory-internal GENERAL_ACTION work is strictly best-effort control-plane
        # analysis. The current caller is stall diagnosis, which already sends a
        # deterministic diagnostic snapshot to the operator before invoking an agent.
        # Do not cascade that optional analysis across subscriptions or into an
        # emergency/PAYG provider: one healthy regular provider is sufficient, and a
        # failure should leave the deterministic evidence intact for the next cycle.
        if phase is AgentPhase.GENERAL_ACTION and job.task.source == "factory-internal":
            return eligible[:1]

        if phase in {AgentPhase.QUALITY_REPAIR, AgentPhase.CI_REPAIR}:
            used = {
                str(entry.get("provider"))
                for entry in job.provider_history
                if entry.get("phase") == phase.value
            }
            eligible = [name for name in eligible if name not in used] + [
                name for name in eligible if name in used
            ]
        return [*eligible, *emergency]
