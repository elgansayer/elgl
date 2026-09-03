from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import (
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
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
        )


def _usage(metrics: MetricsStore) -> dict[str, object]:
    providers = metrics.snapshot()["providers"]
    assert isinstance(providers, list)
    assert len(providers) == 1
    usage = providers[0]
    assert isinstance(usage, dict)
    return usage


def test_router_records_normalized_request_prompt_characters(tmp_path: Path) -> None:
    metrics = MetricsStore(tmp_path / "metrics.json")
    task = Task("42", "Measure prompt", "body", "github-issue", 0)
    request = AgentRequest(
        AgentPhase.IMPLEMENTATION,
        task,
        "task-payload",
        tmp_path,
        system_prompt="control",
    )
    router = AgentRouter(
        [SuccessfulProvider()],
        metrics_store=metrics,
        same_provider_retries=0,
    )

    result = router.run(request, Job(task))

    assert result.success
    usage = _usage(metrics)
    expected = len(request.prompt) + len(request.system_prompt)
    assert usage["prompt_measured_calls"] == 1
    assert usage["total_request_prompt_chars"] == expected
    assert usage["max_request_prompt_chars"] == expected


def test_metrics_aggregate_prompt_size_without_estimating_tokens(tmp_path: Path) -> None:
    metrics = MetricsStore(tmp_path / "metrics.json")

    for prompt_chars in (1200, 300):
        metrics.record(
            "codex",
            "gpt-5.6-sol",
            phase="code-review",
            successful=True,
            request_prompt_chars=prompt_chars,
        )

    usage = _usage(metrics)
    assert usage["calls"] == 2
    assert usage["prompt_measured_calls"] == 2
    assert usage["total_request_prompt_chars"] == 1500
    assert usage["max_request_prompt_chars"] == 1200
    assert "estimated_tokens" not in usage


def test_metrics_restore_legacy_records_without_prompt_fields(tmp_path: Path) -> None:
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
