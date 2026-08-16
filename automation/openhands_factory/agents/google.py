"""Google Agent CLI provider (Gemini/ACP)."""

from __future__ import annotations

import asyncio

from openhands_factory.agents.base import AgentPhase, AgentRequest, AgentResult, ProviderHealth
from openhands_factory.agents.process import (
    DEFAULT_AGENT_TIMEOUT_SECONDS,
    DEFAULT_MAX_OUTPUT_BYTES,
    passive_cli_health,
    run_cli_provider,
)


class GoogleAgentProvider:
    name = "google"

    def __init__(
        self,
        command: str = "gemini",
        timeout_seconds: int = DEFAULT_AGENT_TIMEOUT_SECONDS,
    ) -> None:
        self.command = command
        self.timeout_seconds = timeout_seconds

    def health(self) -> ProviderHealth:
        return passive_cli_health(self.name)

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        return asyncio.run(self._run_async(request))

    async def _run_async(self, request: AgentRequest) -> AgentResult:
        return await asyncio.to_thread(
            run_cli_provider,
            provider=self.name,
            request=request,
            command=["caveman", self.command, request.prompt],
            timeout_seconds=request.timeout_seconds or self.timeout_seconds,
            max_output_bytes=request.max_output_bytes or DEFAULT_MAX_OUTPUT_BYTES,
        )
