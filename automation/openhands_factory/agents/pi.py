"""Pi coding agent CLI provider, a multi-backend fallback behind claude/codex/google/opencode."""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import AgentPhase, AgentRequest, ProviderHealth, ProviderStatus
from openhands_factory.agents.cli import CLIProvider, classify_process_failure
from openhands_factory.agents.process import ProcessResult

# Pi exposes an explicit reasoning control, but the Factory previously forced
# ``--thinking max`` for every phase. That is disproportionate for bounded
# repair/review/control-plane work, especially because production already routes
# those phases to Haiku. Preserve maximum reasoning for open-ended build work,
# keep a strong security-review tier, and align the remaining bounded phases with
# the effort policy already used by Claude/Codex.
_THINKING_BY_PHASE: dict[AgentPhase, str] = {
    AgentPhase.SECURITY_REVIEW: "high",
    AgentPhase.QUALITY_REPAIR: "low",
    AgentPhase.CODE_REVIEW: "medium",
    AgentPhase.CI_REPAIR: "low",
    AgentPhase.GENERAL_ACTION: "medium",
}
_DEFAULT_THINKING = "max"


class PiProvider(CLIProvider):
    name = "pi"
    default_command = "pi"
    default_model = "github-copilot/claude-sonnet-5"
    default_credential_paths = (".pi",)
    # pi's native installer places its executable in .local/bin as a symlink
    # into .local/lib/node_modules; both must be mounted or the sandboxed
    # process cannot resolve the symlink target.
    default_runtime_paths = (".local/bin", ".local/lib")

    @staticmethod
    def _full_prompt(request: AgentRequest) -> str:
        """Keep trusted policy in Pi's dedicated system-prompt channel."""

        return request.prompt

    def auth_probe(self) -> tuple[Sequence[str], ProviderStatus]:
        backend = self.model.partition("/")[0] or "google"
        return (
            [*self._prefix(), "auth", "check", "--provider", backend, "--json"],
            ProviderStatus.HEALTHY,
        )

    def interpret_auth_probe(
        self,
        result: ProcessResult,
        successful_status: ProviderStatus,
    ) -> ProviderHealth:
        del successful_status
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            failure = classify_process_failure(result)
            return ProviderHealth(
                self.name,
                ProviderStatus.AUTH_REQUIRED,
                datetime.now(UTC),
                detail=failure.message,
            )
        status = payload.get("status") if isinstance(payload, dict) else None
        if status == "ready":
            return ProviderHealth(
                self.name,
                ProviderStatus.HEALTHY,
                datetime.now(UTC),
                detail=(
                    f"authenticated; backend={payload.get('provider')}; "
                    f"authType={payload.get('authType')}"
                ),
            )
        reason = payload.get("reason") if isinstance(payload, dict) else None
        return ProviderHealth(
            self.name,
            ProviderStatus.AUTH_REQUIRED,
            datetime.now(UTC),
            detail=reason or "pi backend authentication is required",
        )

    def build_command(
        self,
        request: AgentRequest,
        model: str,
        prompt_path: Path | None,
    ) -> Sequence[str]:
        del prompt_path
        thinking = _THINKING_BY_PHASE.get(request.phase, _DEFAULT_THINKING)
        command = [
            *self._prefix(),
            "-p",
            "--model",
            model,
            "--thinking",
            thinking,
            "--no-approve",
            "--no-context-files",
            "--no-extensions",
            "--no-skills",
            "--no-prompt-templates",
            "--no-themes",
            "--no-session",
        ]
        if request.system_prompt:
            command.extend(("--append-system-prompt", request.system_prompt))
        return [*command, *self.extra_args]
