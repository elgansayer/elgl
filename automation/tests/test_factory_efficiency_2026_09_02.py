from __future__ import annotations

import json
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_pi_security_fallback_uses_sonnet_without_downgrading_build_phases() -> None:
    agents = json.loads(
        (REPOSITORY_ROOT / "config" / "factory" / "agents.production.json").read_text(
            encoding="utf-8"
        )
    )
    phase_models = agents["providers"]["pi"]["phase_models"]

    assert phase_models["planning"] == "github-copilot/claude-opus-5"
    assert phase_models["architecture"] == "github-copilot/claude-opus-5"
    assert phase_models["implementation"] == "github-copilot/claude-sonnet-5"
    assert phase_models["security_review"] == "github-copilot/claude-sonnet-5"


def test_self_healing_schedule_is_a_six_hour_backstop_with_event_recovery() -> None:
    workflow = (REPOSITORY_ROOT / ".github" / "workflows" / "on-failure.yml").read_text(
        encoding="utf-8"
    )

    assert "push:" in workflow
    assert "workflow_run:" in workflow
    assert "cron: '17 */6 * * *'" in workflow
    assert "17 */3 * * *" not in workflow
