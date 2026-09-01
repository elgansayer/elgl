import json
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _workflow(name: str) -> str:
    return (REPOSITORY_ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")


def test_primary_security_review_keeps_opus_for_open_ended_work_only() -> None:
    config_path = REPOSITORY_ROOT / "config" / "factory" / "agents.production.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    claude = config["providers"]["claude"]
    phase_models = claude["phase_models"]

    assert config["routing"]["security_review"][0] == "claude"
    assert phase_models["planning"] == "opus"
    assert phase_models["architecture"] == "opus"
    assert phase_models["implementation"] == "sonnet"
    assert phase_models["security_review"] == phase_models["implementation"]


def test_branch_hygiene_is_daily_and_retains_short_lived_evidence() -> None:
    workflow = _workflow("branch-pr-hygiene.yml")

    assert "cron: '17 3 * * *'" in workflow
    assert "retention-days: 7" in workflow
    assert "workflow_dispatch:" in workflow


def test_self_healing_schedule_is_only_a_backstop_to_event_driven_checks() -> None:
    workflow = _workflow("on-failure.yml")

    assert "cron: '17 */3 * * *'" in workflow
    assert "  push:\n    branches: [main]\n" in workflow
    assert "  workflow_run:\n" in workflow
    assert "      - CI\n" in workflow
    assert "      - Deploy\n" in workflow
    assert "      - Admin portal CI\n" in workflow


def test_static_product_contracts_only_run_when_their_inputs_change() -> None:
    expected_inputs = {
        "simplify-text-contract.yml": (
            "frontend/src/app/services/nlp.service.ts",
            "backend/src/nlp/nlp.controller.ts",
            "scripts/verify-simplify-text-contract.test.mjs",
        ),
        "translation-cache-contract.yml": (
            "frontend/src/app/services/translation-cache.service.ts",
            "frontend/src/app/components/moments-feed/moments-feed.component.ts",
            "scripts/translation-cache-contract.test.mjs",
        ),
        "draft-persistence-contract.yml": (
            "frontend/src/app/services/draft.service.ts",
            "frontend/src/app/components/chat-room/chat-room.component.ts",
            "scripts/draft-persistence-contract.test.mjs",
        ),
    }

    for workflow_name, inputs in expected_inputs.items():
        workflow = _workflow(workflow_name)
        assert "  pull_request:\n    branches: [main]\n    paths:\n" in workflow
        for path in inputs:
            assert f"      - '{path}'\n" in workflow
