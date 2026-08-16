"""OpenAI Codex CLI agent provider."""

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


class CodexProvider:
    name = "codex"

    def __init__(self, command: str = "codex") -> None:
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
            process = await asyncio.create_subprocess_exec(
                self.command,
                "--prompt",
                request.prompt,
                cwd=request.cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()
            exit_code = process.returncode
            finished_at = datetime.now(UTC)
            success = exit_code == 0

            failure = None
            if not success:
                stderr_text = stderr.decode(errors="replace").lower()
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
                    for marker in ("rate limit", "quota", "too many requests")
                ):
                    kind = AgentFailureKind.PROVIDER_RATE_LIMIT
                elif "timeout" in stderr_text:
                    kind = AgentFailureKind.PROVIDER_TIMEOUT
                elif exit_code == 127:
                    kind = AgentFailureKind.PROVIDER_UNAVAILABLE
                else:
                    kind = AgentFailureKind.INVALID_AGENT_OUTPUT

                stderr_summary = stderr.decode(errors="replace")[:200]
                failure = AgentFailure(
                    kind=kind,
                    message=f"Codex CLI failed with exit code {exit_code}: {stderr_summary}",
                    exit_code=exit_code,
                )

            return AgentResult(
                provider=self.name,
                phase=request.phase,
                success=success,
                started_at=started_at,
                finished_at=finished_at,
                exit_code=exit_code,
                summary=stdout.decode(errors="replace"),
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
