"""OpenAI Codex CLI provider using ChatGPT subscription authentication."""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import AgentPhase, AgentRequest, ProviderHealth, ProviderStatus
from openhands_factory.agents.cli import CLIProvider, classify_process_failure
from openhands_factory.agents.process import ProcessResult

# Keep maximum reasoning for open-ended planning, architecture, and implementation
# where broad exploration can materially improve the result. Security review is a
# bounded checklist over an existing diff and keeps a medium reasoning floor. Routine
# quality repair, code review, and CI repair are bounded further by deterministic
# findings/check failures and always flow back through verification/re-review, so low
# effort avoids spending maximum thinking allowance on every iteration. General action
# stays medium because its scope is not necessarily represented by a validated diff.
_REASONING_EFFORT_BY_PHASE: dict[AgentPhase, str] = {
    AgentPhase.SECURITY_REVIEW: "medium",
    AgentPhase.QUALITY_REPAIR: "low",
    AgentPhase.CODE_REVIEW: "low",
    AgentPhase.CI_REPAIR: "low",
    AgentPhase.GENERAL_ACTION: "medium",
}
_DEFAULT_REASONING_EFFORT = "max"


class CodexProvider(CLIProvider):
    name = "codex"
    default_command = "codex"
    default_model = "gpt-5.6-sol"
    default_credential_paths = (".codex",)
    default_runtime_paths = (".local/bin", ".npm-global")

    @staticmethod
    def _full_prompt(request: AgentRequest) -> str:
        """Keep trusted policy in Codex's developer-instruction channel."""

        return request.prompt

    def auth_probe(self) -> tuple[Sequence[str], ProviderStatus]:
        return ([*self._prefix(), "login", "status"], ProviderStatus.HEALTHY)

    def interpret_auth_probe(
        self,
        result: ProcessResult,
        successful_status: ProviderStatus,
    ) -> ProviderHealth:
        del successful_status
        output = f"{result.stdout}\n{result.stderr}".lower()
        if result.exit_code == 0 and "chatgpt" in output:
            return ProviderHealth(
                self.name,
                ProviderStatus.HEALTHY,
                datetime.now(UTC),
                detail="authenticated with ChatGPT subscription",
            )
        failure = classify_process_failure(result)
        return ProviderHealth(
            self.name,
            ProviderStatus.AUTH_REQUIRED,
            datetime.now(UTC),
            detail=(
                "ChatGPT subscription authentication is required"
                if result.exit_code == 0
                else failure.message
            ),
        )

    def build_command(
        self,
        request: AgentRequest,
        model: str,
        prompt_path: Path | None,
    ) -> Sequence[str]:
        del prompt_path
        reasoning_effort = _REASONING_EFFORT_BY_PHASE.get(
            request.phase,
            _DEFAULT_REASONING_EFFORT,
        )
        command = [
            *self._prefix(),
            "exec",
            "-m",
            model,
            "-c",
            f'model_reasoning_effort="{reasoning_effort}"',
            # Codex applies workspace-write when --approve-for-me is selected.
            # Passing an explicit sandbox as well is rejected by current CLIs.
            "--approve-for-me",
            "-C",
            str(request.cwd),
            "--ephemeral",
            "--ignore-user-config",
            "--ignore-rules",
            "--color",
            "never",
        ]
        if request.system_prompt:
            command.extend(("-c", f"developer_instructions={json.dumps(request.system_prompt)}"))
        return [*command, *self.extra_args, "-"]
