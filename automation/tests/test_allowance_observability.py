from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import (
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.cli import CLIProvider
from openhands_factory.agents.process import AgentProcessRunner, ProcessResult, ProviderHomeMount
from openhands_factory.agents.router import AgentRouter
from openhands_factory.metrics import MetricsStore
from openhands_factory.models import Job, Task


class SuccessfulProvider:
    name = "claude"

    def health(self) -> ProviderHealth:
        return ProviderHealth(self.name, ProviderStatus.HEALTHY, datetime.now(UTC))

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        now = datetime.now(UTC)
        return AgentResult(
            provider=self.name,
            phase=request.phase,
            success=True,
            started_at=now,
            finished_at=now,
            exit_code=0,
            summary="done",
            output_path=None,
            failure=None,
            transport="cli",
            model="sonnet",
            captured_output_chars=2048,
            output_truncated=True,
        )


class OutputProcessRunner(AgentProcessRunner):
    def run(
        self,
        command: Sequence[str],
        *,
        cwd: Path,
        env: Mapping[str, str],
        stdin_text: str | None,
        timeout_seconds: int,
        max_output_bytes: int,
        home_mounts: Sequence[ProviderHomeMount] = (),
    ) -> ProcessResult:
        del command, cwd, env, stdin_text, timeout_seconds, max_output_bytes, home_mounts
        return ProcessResult(
            command=("fake",),
            exit_code=0,
            stdout="abc",
            stderr="de",
            timed_out=False,
            output_truncated=True,
            duration_seconds=0.1,
        )


class OutputProvider(CLIProvider):
    name = "output-provider"
    default_command = "fake"
    default_model = "test-model"

    def build_command(
        self,
        request: AgentRequest,
        model: str,
        prompt_path: Path | None,
    ) -> Sequence[str]:
        del request, model, prompt_path
        return ["fake"]


def _usage(metrics: MetricsStore) -> dict[str, object]:
    providers = metrics.snapshot()["providers"]
    assert isinstance(providers, list)
    assert len(providers) == 1
    usage = providers[0]
    assert isinstance(usage, dict)
    return usage


def test_cli_provider_reports_retained_output_volume_without_content(tmp_path: Path) -> None:
    task = Task("41", "Measure output", "body", "github-issue", 0)
    provider = OutputProvider(process_runner=OutputProcessRunner())

    result = provider.run(AgentRequest(AgentPhase.CODE_REVIEW, task, "prompt", tmp_path))

    assert result.success
    assert result.captured_output_chars == 5
    assert result.output_truncated is True


def test_router_records_content_free_allowance_volume(tmp_path: Path) -> None:
    metrics = MetricsStore(tmp_path / "metrics.json")
    task = Task("42", "Measure prompt", "body", "github-issue", 0)
    request = AgentRequest(
        AgentPhase.IMPLEMENTATION,
        task,
        "task-payload",
        tmp_path,
        system_prompt="control",
    )
    job = Job(task)
    router = AgentRouter(
        [SuccessfulProvider()],
        metrics_store=metrics,
        same_provider_retries=0,
    )

    result = router.run(request, job)

    assert result.success
    usage = _usage(metrics)
    expected = len(request.prompt) + len(request.system_prompt)
    assert usage["prompt_measured_calls"] == 1
    assert usage["total_request_prompt_chars"] == expected
    assert usage["max_request_prompt_chars"] == expected
    assert usage["output_measured_calls"] == 1
    assert usage["total_captured_output_chars"] == 2048
    assert usage["max_captured_output_chars"] == 2048
    assert usage["output_truncated_calls"] == 1
    assert job.provider_history[-1]["captured_output_chars"] == 2048
    assert job.provider_history[-1]["output_truncated"] is True


def test_metrics_aggregate_prompt_and_output_size_without_estimating_tokens(tmp_path: Path) -> None:
    metrics = MetricsStore(tmp_path / "metrics.json")

    for prompt_chars, output_chars, truncated in (
        (1200, 900, False),
        (300, 1500, True),
    ):
        metrics.record(
            "codex",
            "gpt-5.6-sol",
            phase="code-review",
            successful=True,
            request_prompt_chars=prompt_chars,
            captured_output_chars=output_chars,
            output_truncated=truncated,
        )

    usage = _usage(metrics)
    assert usage["calls"] == 2
    assert usage["prompt_measured_calls"] == 2
    assert usage["total_request_prompt_chars"] == 1500
    assert usage["max_request_prompt_chars"] == 1200
    assert usage["output_measured_calls"] == 2
    assert usage["total_captured_output_chars"] == 2400
    assert usage["max_captured_output_chars"] == 1500
    assert usage["output_truncated_calls"] == 1
    assert "estimated_tokens" not in usage
    assert "estimated_output_tokens" not in usage


def test_metrics_restore_legacy_records_without_volume_fields(tmp_path: Path) -> None:
    path = tmp_path / "metrics.json"
    path.write_text(
        json.dumps(
            {
                "providers": [
                    {
                        "provider": "claude",
                        "model": "sonnet",
                        "phase": "implementation",
                        "calls": 7,
                        "successes": 6,
                        "failures": 1,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    usage = _usage(MetricsStore(path))

    assert usage["calls"] == 7
    assert usage["prompt_measured_calls"] == 0
    assert usage["total_request_prompt_chars"] == 0
    assert usage["max_request_prompt_chars"] == 0
    assert usage["output_measured_calls"] == 0
    assert usage["total_captured_output_chars"] == 0
    assert usage["max_captured_output_chars"] == 0
    assert usage["output_truncated_calls"] == 0
