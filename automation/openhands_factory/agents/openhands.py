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
from openhands_factory.agents.cli import redact_agent_output
from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationProviderError, ConversationRunner
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import FailureKind
from openhands_factory.provider_profiles import openai_credentials_available


class OpenHandsProvider(AgentProvider):
    name = "openhands"

    def __init__(
        self,
        runner: ConversationRunner,
        config: FactoryConfig | None = None,
        *,
        enabled: bool = True,
    ) -> None:
        self.runner = runner
        self.config = config
        self.enabled = enabled

    def health(self) -> ProviderHealth:
        if not self.enabled:
            return ProviderHealth(
                provider=self.name,
                status=ProviderStatus.DISABLED,
                checked_at=datetime.now(UTC),
            )
        config = self.config
        if config is None:
            return ProviderHealth(
                provider=self.name,
                status=ProviderStatus.DEGRADED,
                checked_at=datetime.now(UTC),
                detail="OpenHands health configuration was not supplied",
            )
        openai_usable = openai_credentials_available(config)
        opencode_usable = config.opencode_api_key is not None and config.opencode_model is not None
        usable = openai_usable or opencode_usable
        detail = "OpenHands has no authenticated subscription or configured API fallback"
        if openai_usable:
            detail = "OpenHands OpenAI OAuth is configured"
        elif opencode_usable:
            detail = "OpenHands OpenCode Go API emergency fallback is configured"
        return ProviderHealth(
            provider=self.name,
            status=ProviderStatus.HEALTHY if usable else ProviderStatus.AUTH_REQUIRED,
            checked_at=datetime.now(UTC),
            detail=detail,
        )

    def supports(self, phase: AgentPhase) -> bool:
        # Preserve the compatibility runner's established support for every phase.
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        started_at = datetime.now(UTC)
        try:
            res = self.runner.run(
                request.task,
                request.cwd,
                request.prompt,
                timeout_seconds=request.timeout_seconds,
            )
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
                failure=None
                if res.completed
                else AgentFailure(
                    kind=AgentFailureKind.TASK_FAILURE,
                    message="Conversation runner failed to complete",
                ),
                transport="openhands-sdk",
                model=res.model,
            )
        except ConversationProviderError as error:
            finished_at = datetime.now(UTC)
            kind = {
                FailureKind.AUTHENTICATION: AgentFailureKind.PROVIDER_AUTH,
                FailureKind.CONFIGURATION: AgentFailureKind.PROVIDER_UNAVAILABLE,
                FailureKind.BUDGET: AgentFailureKind.PROVIDER_QUOTA,
                FailureKind.RATE_LIMIT: AgentFailureKind.PROVIDER_RATE_LIMIT,
                FailureKind.MALFORMED_RESPONSE: AgentFailureKind.INVALID_AGENT_OUTPUT,
                FailureKind.TOOL: AgentFailureKind.TASK_FAILURE,
                FailureKind.TASK_TIMEOUT: AgentFailureKind.PROVIDER_TIMEOUT,
                FailureKind.TRANSIENT: AgentFailureKind.PROVIDER_TRANSPORT,
            }[error.failure_kind]
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
                    kind=kind,
                    message=redact_agent_output(str(error)),
                    retry_after_seconds=error.retry_after_seconds,
                ),
                transport="openhands-sdk",
            )
        except FactoryError as error:
            finished_at = datetime.now(UTC)
            detail = redact_agent_output(str(error))
            lowered = detail.lower()
            if any(marker in lowered for marker in ("authentication", "oauth", "log in")):
                kind = AgentFailureKind.PROVIDER_AUTH
            elif "rate limit" in lowered or "429" in lowered:
                kind = AgentFailureKind.PROVIDER_RATE_LIMIT
            elif "quota" in lowered or "budget" in lowered:
                kind = AgentFailureKind.PROVIDER_QUOTA
            elif "capacity exhausted" in lowered or "temporarily unavailable" in lowered:
                kind = AgentFailureKind.PROVIDER_UNAVAILABLE
            elif "timeout" in lowered or "maximum task duration" in lowered:
                # Preserve the legacy OpenHands-only retry contract while making
                # a routed timeout eligible for another provider immediately.
                kind = (
                    AgentFailureKind.PROVIDER_TIMEOUT
                    if self.config is None or self.config.agents.routing_enabled
                    else AgentFailureKind.TASK_FAILURE
                )
            elif any(marker in lowered for marker in ("tests failed", "build failed")):
                kind = AgentFailureKind.TEST_FAILURE
            elif any(
                marker in lowered
                for marker in ("not a git repository", "worktree", "repository is locked")
            ):
                kind = AgentFailureKind.REPOSITORY_FAILURE
            elif any(marker in lowered for marker in ("blocked by policy", "sandbox denied")):
                kind = AgentFailureKind.POLICY_FAILURE
            else:
                kind = AgentFailureKind.TASK_FAILURE
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
                    kind=kind,
                    message=detail,
                ),
                transport="openhands-sdk",
            )
        except Exception as error:
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
                    message=redact_agent_output(f"Agent process crashed: {error!s}"),
                ),
                transport="openhands-sdk",
            )
