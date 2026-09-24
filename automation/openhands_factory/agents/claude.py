"""Claude Code subscription provider."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from openhands_factory.agents.base import AgentPhase, AgentRequest, ProviderHealth, ProviderStatus
from openhands_factory.agents.cli import CLIProvider, JsonAuthProbeMixin
from openhands_factory.agents.process import ProcessResult

# Planning/architecture/implementation are build-critical and keep maximum
# reasoning effort. Quality-repair, code-review, ci-repair, and general-action are
# the fast phases - most of what they see is a mechanical CI failure, a narrow
# finding, or deterministic stall diagnostics (attempt_mechanical_repair() already
# catches the purely mechanical CI cases before an agent is ever invoked here).
# Forcing "max" or "medium" reasoning on those bounded tasks spends thinking
# allowance that their verification/review or best-effort diagnostic role does not
# need. Security-review is a bounded checklist too, but it is merge-critical and
# higher-stakes, so it keeps a medium reasoning floor.
_EFFORT_BY_PHASE: dict[AgentPhase, str] = {
    AgentPhase.QUALITY_REPAIR: "low",
    AgentPhase.CODE_REVIEW: "low",
    AgentPhase.CI_REPAIR: "low",
    AgentPhase.GENERAL_ACTION: "low",
    AgentPhase.SECURITY_REVIEW: "medium",
}
_DEFAULT_EFFORT = "max"


class ClaudeCodeProvider(JsonAuthProbeMixin, CLIProvider):
    name = "claude"
    default_command = "claude"
    default_model = "fable"
    default_credential_paths = (".claude", ".claude.json")
    default_runtime_paths = (".local/bin", ".local/share/claude", ".npm-global")

    @staticmethod
    def _full_prompt(request: AgentRequest) -> str:
        """Keep trusted policy in Claude's dedicated system-prompt channel."""

        return request.prompt

    def auth_probe(self) -> tuple[Sequence[str], ProviderStatus]:
        return ([*self._prefix(), "auth", "status", "--json"], ProviderStatus.HEALTHY)

    def interpret_auth_probe(
        self,
        result: ProcessResult,
        successful_status: ProviderStatus,
    ) -> ProviderHealth:
        del successful_status
        return self.interpret_json_auth_probe(result)

    def build_command(
        self,
        request: AgentRequest,
        model: str,
        prompt_path: Path | None,
    ) -> Sequence[str]:
        del prompt_path
        effort = _EFFORT_BY_PHASE.get(request.phase, _DEFAULT_EFFORT)
        command = [
            *self._prefix(),
            "-p",
            "--model",
            model,
            "--effort",
            effort,
            "--output-format",
            "text",
            "--no-session-persistence",
            "--safe-mode",
            "--permission-mode",
            "auto",
        ]
        if request.system_prompt:
            command.extend(("--append-system-prompt", request.system_prompt))
        return [*command, *self.extra_args]
