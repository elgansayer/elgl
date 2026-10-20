from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[2]


def test_factory_merge_workflow_is_event_driven_with_sparse_recovery_polling() -> None:
    workflow = (REPOSITORY_ROOT / ".github" / "workflows" / "factory-merge.yml").read_text(
        encoding="utf-8"
    )

    assert "workflow_run:" in workflow
    assert "workflows: [CI]" in workflow
    assert "types: [completed]" in workflow
    assert "branches: [main]" in workflow
    assert "github.event.workflow_run.event == 'push'" in workflow
    assert "github.event.workflow_run.conclusion == 'success'" in workflow
    assert "github.event.workflow_run.head_branch == 'main'" in workflow
    assert "- cron: '16 */6 * * *'" in workflow
    assert "- cron: '16 * * * *'" not in workflow
    assert "*/10 * * * *" not in workflow
    assert "actions: read" in workflow
    assert "gh run list" in workflow
    assert "--workflow ci.yml" in workflow
    assert "--event push" in workflow
    assert "Current main" in workflow
    assert "has no successful canonical CI push run" in workflow
    assert "] | .[0] // empty" in workflow
    assert "--match-head-commit" in workflow
    assert "factory/independent-review" in workflow
    assert "CI / required" in workflow


def test_self_healing_monitor_avoids_pull_request_and_issue_list_churn() -> None:
    workflow = (REPOSITORY_ROOT / ".github" / "workflows" / "on-failure.yml").read_text(
        encoding="utf-8"
    )

    exclusion = "github.event.workflow_run.event != 'pull_request'"
    assert workflow.count(exclusion) == 2
    assert "conclusion == 'failure'" in workflow
    assert "conclusion == 'success'" in workflow
    assert workflow.count('--search "\\"${INCIDENT_TITLE}\\" in:title"') == 2
    assert workflow.count("--limit 10") == 2
    assert "--limit 1000" not in workflow
