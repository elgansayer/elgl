"""Claude Code CLI agent provider."""

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


class ClaudeCodeProvider:
    name = "claude"

    def __init__(self, command: str = "claude") -> None:
        self.command = command
        # A real implementation would query its circuit breaker store here.
        # For now, assume healthy unless initialized otherwise.

    def health(self) -> ProviderHealth:
        # In a complete implementation, this would check the AgentHealthStore.
        return ProviderHealth(
            provider=self.name,
            status=ProviderStatus.HEALTHY,
            checked_at=datetime.now(UTC),
        )

    def supports(self, phase: AgentPhase) -> bool:
        # Claude Code is a general-purpose coding agent.
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        # We run the command synchronously since the current pipeline is synchronous.
        # Alternatively, run via asyncio.run if we use async subprocesses.
        return asyncio.run(self._run_async(request))

    async def _run_async(self, request: AgentRequest) -> AgentResult:
        started_at = datetime.now(UTC)
        
        try:
            # Note: Do not include credentials in the CLI arguments or prompts.
            # We assume `claude` is authenticated via its subscription token globally or via env vars managed safely.
            process = await asyncio.create_subprocess_exec(
                self.command,
                "-p",
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
                
                # Classify the error based on stderr content
                if "authentication" in stderr_text or "invalid token" in stderr_text or "expired" in stderr_text:
                    kind = AgentFailureKind.PROVIDER_AUTH
                elif "rate limit" in stderr_text or "quota" in stderr_text or "usage limit" in stderr_text or "resets_in_seconds" in stderr_text:
                    kind = AgentFailureKind.PROVIDER_RATE_LIMIT
                elif "timeout" in stderr_text:
                    kind = AgentFailureKind.PROVIDER_TIMEOUT
                elif exit_code == 127: # Command not found
                    kind = AgentFailureKind.PROVIDER_UNAVAILABLE
                else:
                    kind = AgentFailureKind.INVALID_AGENT_OUTPUT
                
                failure = AgentFailure(
                    kind=kind,
                    message=f"Claude Code failed with exit code {exit_code}: {stderr.decode(errors='replace')[:200]}",
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
        except Exception as e:
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
                    message=str(e),
                    exit_code=None,
                ),
            )
