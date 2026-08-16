"""OpenHands execution provider wrapping the existing conversation runner."""

from __future__ import annotations

from datetime import UTC, datetime

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
from openhands_factory.conversation_runner import ConversationRunner
from openhands_factory.exceptions import FactoryError


class OpenHandsProvider(AgentProvider):
    name = "openhands"

    def __init__(self, runner: ConversationRunner) -> None:
        self.runner = runner

    def health(self) -> ProviderHealth:
        # In a complete implementation, this would integrate with the actual health
        # store for the legacy provider.
        return ProviderHealth(
            provider=self.name,
            status=ProviderStatus.HEALTHY,
            checked_at=datetime.now(UTC),
        )

    def supports(self, phase: AgentPhase) -> bool:
        # The legacy provider currently supports everything since it was the only provider
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        started_at = datetime.now(UTC)
        try:
            res = self.runner.run(request.task, request.cwd, request.prompt)
            finished_at = datetime.now(UTC)
            return AgentResult(
                provider=self.name,
                phase=request.phase,
                success=res.completed,
                started_at=started_at,
                finished_at=finished_at,
                exit_code=0 if res.completed else 1,
                summary=f"OpenHands completed in {res.elapsed_seconds}s",
                output_path=None,
                failure=None if res.completed else AgentFailure(
                    kind=AgentFailureKind.TASK_FAILURE,
                    message="Conversation runner failed to complete",
                )
            )
        except FactoryError as e:
            finished_at = datetime.now(UTC)
            return AgentResult(
                provider=self.name,
                phase=request.phase,
                success=False,
                started_at=started_at,
                finished_at=finished_at,
                exit_code=1,
                summary=None,
                output_path=None,
                failure=AgentFailure(
                    kind=AgentFailureKind.INTERNAL_FACTORY_FAILURE,
                    message=str(e),
                )
            )
        except Exception as e:
            finished_at = datetime.now(UTC)
            return AgentResult(
                provider=self.name,
                phase=request.phase,
                success=False,
                started_at=started_at,
                finished_at=finished_at,
                exit_code=1,
                summary=None,
                output_path=None,
                failure=AgentFailure(
                    kind=AgentFailureKind.AGENT_CRASH,
                    message=f"Agent process crashed: {e!s}",
                )
            )
