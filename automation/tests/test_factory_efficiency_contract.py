from pathlib import Path


REPOSITORY_ROOT = Path(__file__).parents[2]


def test_factory_merge_workflow_is_an_hourly_recovery_fallback() -> None:
    workflow = (REPOSITORY_ROOT / ".github" / "workflows" / "factory-merge.yml").read_text(
        encoding="utf-8"
    )

    assert "- cron: '16 * * * *'" in workflow
    assert "*/10 * * * *" not in workflow
    assert "--match-head-commit" in workflow
    assert "factory/independent-review" in workflow
    assert "CI / required" in workflow


def test_self_healing_monitor_does_not_start_recovery_jobs_for_pull_requests() -> None:
    workflow = (REPOSITORY_ROOT / ".github" / "workflows" / "on-failure.yml").read_text(
        encoding="utf-8"
    )

    exclusion = "github.event.workflow_run.event != 'pull_request'"
    assert workflow.count(exclusion) == 2
    assert "conclusion == 'failure'" in workflow
    assert "conclusion == 'success'" in workflow
