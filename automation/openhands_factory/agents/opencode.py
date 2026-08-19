"""OpenCode Go subscription provider."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import (
    AgentFailureKind,
    AgentRequest,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.cli import CLIProvider, classify_process_failure, secure_prompt_file
from openhands_factory.agents.process import ProcessResult


class OpenCodeProvider(CLIProvider):
    name = "opencode"
    default_command = "opencode"
    default_model = "opencode-go/kimi-k3"
    default_credential_paths = (".config/opencode", ".local/share/opencode")
    default_runtime_paths = (".local/bin", ".npm-global", ".opencode")

    def preflight_health(self, cwd: Path) -> ProviderHealth | None:
        try:
            result = self._run_process(
                [*self._prefix(), "models", "opencode-go"],
                cwd=cwd,
                stdin_text=None,
                timeout_seconds=15,
                max_output_bytes=64_000,
            )
        except OSError as error:
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail=f"model catalogue probe could not start: {type(error).__name__}",
            )
        if result.exit_code != 0:
            failure = classify_process_failure(result)
            status = {
                AgentFailureKind.PROVIDER_AUTH: ProviderStatus.AUTH_REQUIRED,
                AgentFailureKind.PROVIDER_RATE_LIMIT: ProviderStatus.RATE_LIMITED,
                AgentFailureKind.PROVIDER_QUOTA: ProviderStatus.QUOTA_EXHAUSTED,
            }.get(failure.kind, ProviderStatus.UNAVAILABLE)
            return ProviderHealth(
                self.name,
                status,
                datetime.now(UTC),
                detail=failure.message,
            )
        output = f"{result.stdout}\n{result.stderr}"
        configured_models = {model for model in {self.model, *self.phase_models.values()} if model}
        missing_models = sorted(model for model in configured_models if model not in output)
        if missing_models:
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail=(
                    "configured model is absent from the OpenCode Go catalogue: "
                    + ", ".join(missing_models)
                ),
            )
        return None

    def auth_probe(self) -> tuple[Sequence[str], ProviderStatus]:
        return ([*self._prefix(), "auth", "list"], ProviderStatus.HEALTHY)

    def interpret_auth_probe(
        self,
        result: ProcessResult,
        successful_status: ProviderStatus,
    ) -> ProviderHealth:
        del successful_status
        output = f"{result.stdout}\n{result.stderr}".lower()
        if result.exit_code == 0 and "opencode go" in output:
            return ProviderHealth(
                self.name,
                ProviderStatus.HEALTHY,
                datetime.now(UTC),
                detail="authenticated with OpenCode Go",
            )
        failure = classify_process_failure(result)
        return ProviderHealth(
            self.name,
            ProviderStatus.AUTH_REQUIRED,
            datetime.now(UTC),
            detail=(
                "OpenCode Go authentication is required"
                if result.exit_code == 0
                else failure.message
            ),
        )

    @contextmanager
    def prompt_file(self, prompt: str, directory: Path) -> Iterator[Path | None]:
        with secure_prompt_file(prompt, directory=directory) as path:
            yield path

    def prompt_for_stdin(self, prompt: str, prompt_path: Path | None) -> str | None:
        del prompt, prompt_path
        return None

    def build_command(
        self,
        request: AgentRequest,
        model: str,
        prompt_path: Path | None,
    ) -> Sequence[str]:
        if prompt_path is None:
            raise RuntimeError("OpenCode requires a secure prompt attachment")
        return [
            *self._prefix(),
            "run",
            "Follow the complete Factory instructions in the attached file.",
            "--file",
            str(prompt_path),
            "--model",
            model,
            "--format",
            "default",
            "--dir",
            str(request.cwd),
            "--pure",
            "--auto",
            "--title",
            f"Factory {request.phase.value} {request.task.identifier}",
            *self.extra_args,
        ]
