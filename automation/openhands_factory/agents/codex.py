"""OpenAI Codex CLI provider using ChatGPT subscription authentication."""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import AgentPhase, AgentRequest, ProviderHealth, ProviderStatus
from openhands_factory.agents.cli import CLIProvider, classify_process_failure
from openhands_factory.agents.process import ProcessResult

# Keep maximum reasoning for quality-critical work where broader exploration can
# materially improve the implementation or security outcome. Review/repair phases
# are intentionally bounded by an existing diff, failed checks, or validated Factory
# artefacts, and run inside deterministic verification/re-review loops. Medium effort
# preserves a strong reasoning floor there without spending the maximum reasoning
# budget on every routine iteration.
_REASONING_EFFORT_BY_PHASE: dict[AgentPhase, str] = {
    AgentPhase.QUALITY_REPAIR: "medium",
    AgentPhase.CODE_REVIEW: "medium",
    AgentPhase.CI_REPAIR: "medium",
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
