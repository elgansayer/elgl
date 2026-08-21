"""Configurable Google coding-agent CLI provider."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from openhands_factory.agents.base import (
    AgentFailureKind,
    AgentRequest,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.cli import CLIProvider, classify_process_failure
from openhands_factory.agents.process import (
    AgentProcessRunner,
    ProcessResult,
)


class GoogleAgentProvider(CLIProvider):
    name = "google"
    default_command = "agy"
    default_model = "gemini-3.1-pro-high"
    default_credential_paths = (".gemini",)
    default_runtime_paths = (".local/bin", ".npm-global")
    minimum_antigravity_version = (1, 1, 1)

    def __init__(
        self,
        *,
        cli_variant: Literal["gemini", "antigravity"] | None = None,
        enabled: bool = True,
        command: str | None = None,
        wrapper_command: str | None = None,
        model: str | None = None,
        phase_models: Mapping[str, str] | None = None,
        extra_args: Sequence[str] = (),
        max_turns: int = 100,
        process_runner: AgentProcessRunner | None = None,
        health_cache_seconds: int = 300,
        credential_paths: Sequence[str] | None = None,
        runtime_paths: Sequence[str] | None = None,
    ) -> None:
        executable = Path(command or self.default_command).name
        selected_variant = cli_variant or (
            "antigravity" if executable in {"agy", "antigravity"} else "gemini"
        )
        super().__init__(
            enabled=enabled,
            command=command,
            wrapper_command=wrapper_command,
            model=(
                model
                if model is not None
                else self.default_model
                if selected_variant == "antigravity"
                else "auto"
            ),
            phase_models=phase_models,
            extra_args=extra_args,
            max_turns=max_turns,
            process_runner=process_runner,
            health_cache_seconds=health_cache_seconds,
            credential_paths=credential_paths,
            runtime_paths=runtime_paths,
        )
        self.cli_variant = selected_variant

    def preflight_health(self, cwd: Path) -> ProviderHealth | None:
        if self.cli_variant != "antigravity":
            return None
        try:
            result = self._run_process(
                [*self._prefix(), "--version"],
                cwd=cwd,
                stdin_text=None,
                timeout_seconds=15,
                max_output_bytes=32_000,
            )
        except OSError as error:
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail=f"version probe could not start: {type(error).__name__}",
            )
        if result.exit_code != 0:
            failure = classify_process_failure(result)
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail=failure.message,
            )
        match = re.search(
            r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)",
            f"{result.stdout}\n{result.stderr}",
        )
        if match is None:
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail="Antigravity version could not be verified",
            )
        version = tuple(int(part) for part in match.groups())
        if version < self.minimum_antigravity_version:
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail="Antigravity 1.1.1 or newer is required for reliable headless output",
            )
        return None

    def auth_probe(self) -> tuple[Sequence[str], ProviderStatus]:
        if self.cli_variant == "antigravity":
            return ([*self._prefix(), "models"], ProviderStatus.HEALTHY)
        return super().auth_probe()

    def interpret_auth_probe(
        self,
        result: ProcessResult,
        successful_status: ProviderStatus,
    ) -> ProviderHealth:
        if self.cli_variant != "antigravity":
            return super().interpret_auth_probe(result, successful_status)
        output = f"{result.stdout}\n{result.stderr}"
        if result.exit_code == 0 and output.strip():
            configured_models = {
                model
                for model in {self.model, *self.phase_models.values()}
                if model and model != "auto"
            }
            missing_models = sorted(model for model in configured_models if model not in output)
            if missing_models:
                return ProviderHealth(
                    self.name,
                    ProviderStatus.UNAVAILABLE,
                    datetime.now(UTC),
                    detail=(
                        "configured model is absent from the account catalogue: "
                        + ", ".join(missing_models)
                    ),
                )
            return ProviderHealth(
                self.name,
                ProviderStatus.HEALTHY,
                datetime.now(UTC),
                detail="authenticated; account model catalogue is available",
            )
        if result.exit_code == 0:
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail="model catalogue probe returned no models",
            )
        failure = classify_process_failure(result)
        status = {
            AgentFailureKind.PROVIDER_UNAVAILABLE: ProviderStatus.UNAVAILABLE,
            AgentFailureKind.PROVIDER_RATE_LIMIT: ProviderStatus.RATE_LIMITED,
            AgentFailureKind.PROVIDER_QUOTA: ProviderStatus.QUOTA_EXHAUSTED,
        }.get(failure.kind, ProviderStatus.AUTH_REQUIRED)
        return ProviderHealth(
            self.name,
            status,
            datetime.now(UTC),
            detail=failure.message,
        )

    def prompt_for_stdin(self, prompt: str, prompt_path: Path | None) -> str | None:
        del prompt_path
        if self.cli_variant == "antigravity":
            # --sandbox silently breaks stdin as a prompt channel: with it
            # set, agy ignores whatever text arrives on stdin and responds
            # as if it received no real instruction (verified directly,
            # comparing identical invocations with and without --sandbox).
            # The prompt must go in argv instead; see build_command.
            return None
        return prompt

    def build_command(
        self,
        request: AgentRequest,
        model: str,
        prompt_path: Path | None,
    ) -> Sequence[str]:
        del prompt_path
        if self.cli_variant == "antigravity":
            timeout = request.timeout_seconds or 3600
            print_timeout = max(timeout - 10, 1)
            command = [
                *self._prefix(),
                "-p",
                self._full_prompt(request),
                "--output-format",
                "text",
                "--mode",
                "accept-edits",
                "--sandbox",
                "--dangerously-skip-permissions",
                "--disable-slash-commands",
                "--print-timeout",
                f"{print_timeout}s",
                # Without an explicit workspace, agy does not treat the
                # inherited working directory as its target and silently
                # writes into its own internal scratch directory instead
                # (verified directly: the CLI's own response names that
                # path when --add-dir is omitted). Every real edit then
                # lands outside the task worktree, so change_fingerprint()
                # sees no diff and the phase is wrongly reported as having
                # produced no changes.
                "--add-dir",
                str(request.cwd),
            ]
            # Model names already ending in -high/-medium/-low (every model in
            # agy's own catalogue does) bake their effort tier into the model
            # itself; a separately-passed --effort that disagrees is a hard
            # CLI error ("--model X conflicts with --effort=Y"), not a warning.
            # Only fall back to an explicit --effort for a model with no tier
            # suffix of its own.
            effort_suffixes = ("-high", "-medium", "-low")
            if not (model and model.endswith(effort_suffixes)):
                command.extend(("--effort", "high"))
            if model and model != "auto":
                command.extend(("--model", model))
            return [*command, *self.extra_args]
        return [
            *self._prefix(),
            "-p",
            "Apply the complete Factory instructions provided on standard input.",
            "--model",
            model,
            "--output-format",
            "text",
            "--approval-mode",
            "yolo",
            "--skip-trust",
            *self.extra_args,
        ]
