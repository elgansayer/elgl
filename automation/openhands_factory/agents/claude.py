"""Claude Code CLI agent provider."""

from __future__ import annotations

import asyncio
import shutil
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


class ClaudeCodeProvider:
    name = "claude"

    def __init__(self, command: str = "claude") -> None:
        self.command = command

    def health(self) -> ProviderHealth:
        if shutil.which("caveman") is None and shutil.which(self.command) is None:
            return ProviderHealth(
                provider=self.name,
                status=ProviderStatus.UNAVAILABLE,
                checked_at=datetime.now(UTC),
                detail=f"Neither caveman nor {self.command} is installed",
            )
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
            sandbox = SandboxRunner(request.cwd, triage_tags=request.task.triage_tags)
            launcher = "caveman" if shutil.which("caveman") else self.command
            cmd = (
                [launcher, self.command, "-p", request.prompt]
                if launcher == "caveman"
                else [launcher, "-p", request.prompt]
            )
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
                    for marker in ("authentication", "invalid token", "expired")
                ):
                    kind = AgentFailureKind.PROVIDER_AUTH
                elif any(
                    marker in stderr_text
                    for marker in ("rate limit", "quota", "usage limit", "resets_in_seconds")
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
                        f"Claude Code failed with exit code {exit_code}: {stderr_summary}"
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
