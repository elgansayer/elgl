"""Routing policy implementations."""

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
            return ["openhands"]

        routing = self.config.routing
        if phase == AgentPhase.PLANNING:
            preferred = routing.planning
        elif phase == AgentPhase.ARCHITECTURE:
            preferred = routing.architecture
        elif phase == AgentPhase.IMPLEMENTATION:
            preferred = routing.implementation
        elif phase == AgentPhase.SECURITY_REVIEW:
            preferred = routing.security_review
        elif phase == AgentPhase.QUALITY_REPAIR:
            preferred = routing.quality_repair
        elif phase == AgentPhase.CODE_REVIEW:
            preferred = routing.code_review
        elif phase == AgentPhase.CI_REPAIR:
            preferred = routing.ci_repair
        elif phase == AgentPhase.GENERAL_ACTION:
            preferred = routing.general_action
        else:
            preferred = ["openhands"]

        valid_candidates = []
        for name in preferred:
            if name not in self.config.providers or not self.config.providers[name].enabled:
                continue

            health = provider_health.get(name)
            if health and health.status not in (
                ProviderStatus.HEALTHY,
                ProviderStatus.DEGRADED,
            ):
                continue

            valid_candidates.append(name)

        if not valid_candidates:
            for name, provider_cfg in self.config.providers.items():
                if not (provider_cfg.emergency_only and provider_cfg.enabled):
                    continue
                health = provider_health.get(name)
                if not health or health.status in (
                    ProviderStatus.HEALTHY,
                    ProviderStatus.DEGRADED,
                ):
                    valid_candidates.append(name)

        return valid_candidates
