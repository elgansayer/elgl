"""Google Agent CLI provider (Gemini/ACP)."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.pty_wrapper import PTYWrapper
from openhands_factory.sandbox import SandboxRunner


class GoogleAgentProvider:
    name = "google"

    def __init__(self, command: str = "gemini") -> None:
        self.command = command

    def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.name,
            status=ProviderStatus.HEALTHY,
            checked_at=datetime.now(UTC),
        )

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        return asyncio.run(self._run_async(request))

    async def _run_async(self, request: AgentRequest) -> AgentResult:
        started_at = datetime.now(UTC)
        try:
            sandbox = SandboxRunner(request.cwd)
            cmd = [self.command, request.prompt]
            wrapper = PTYWrapper(sandbox.get_podman_cmd(cmd))

            stdout_text = await asyncio.to_thread(wrapper.execute)
            exit_code = 0 if "Error" not in stdout_text else 1

            finished_at = datetime.now(UTC)
            success = exit_code == 0

            failure = None
            if not success:
                stderr_text = stdout_text.lower()
                if any(
                    marker in stderr_text
                    for marker in (
                        "authentication",
                        "invalid token",
                        "expired",
                        "unauthorized",
                    )
                ):
                    kind = AgentFailureKind.PROVIDER_AUTH
                elif any(
                    marker in stderr_text
                    for marker in ("rate limit", "quota", "exhausted")
                ):
                    kind = AgentFailureKind.PROVIDER_RATE_LIMIT
                elif "timeout" in stderr_text:
                    kind = AgentFailureKind.PROVIDER_TIMEOUT
                elif exit_code == 127:
                    kind = AgentFailureKind.PROVIDER_UNAVAILABLE
                else:
                    kind = AgentFailureKind.INVALID_AGENT_OUTPUT

                stderr_summary = stdout_text[:200]
                failure = AgentFailure(
                    kind=kind,
                    message=(
                        f"Google Agent failed with exit code {exit_code}: {stderr_summary}"
                    ),
                    exit_code=exit_code,
                )

            return AgentResult(
                provider=self.name,
                phase=request.phase,
                success=success,
                started_at=started_at,
                finished_at=finished_at,
                exit_code=exit_code,
                summary=stdout_text,
                output_path=None,
                failure=failure,
            )
        except FileNotFoundError:
            finished_at = datetime.now(UTC)
            return AgentResult(
                provider=self.name,
                phase=request.phase,
                success=False,
                started_at=started_at,
                finished_at=finished_at,
                exit_code=127,
                summary=None,
                output_path=None,
                failure=AgentFailure(
                    kind=AgentFailureKind.PROVIDER_UNAVAILABLE,
                    message=f"Command '{self.command}' not found on PATH.",
                    exit_code=127,
                ),
            )
        except Exception as error:
            finished_at = datetime.now(UTC)
            return AgentResult(
                provider=self.name,
                phase=request.phase,
                success=False,
                started_at=started_at,
                finished_at=finished_at,
                exit_code=None,
                summary=None,
                output_path=None,
                failure=AgentFailure(
                    kind=AgentFailureKind.INTERNAL_FACTORY_FAILURE,
                    message=str(error),
                    exit_code=None,
                ),
            )
