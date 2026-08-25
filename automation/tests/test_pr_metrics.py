from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.pr_convergence import (
    PullRequestCapacity,
    PullRequestRecord,
    calculate_capacity,
)
from openhands_factory.pr_metrics import PullRequestMetricsStore


def pull_request(
    number: int,
    *,
    state: str = "OPEN",
    title: str = "Bound PR churn",
    body: str = "Factory-Task-Key: explicit:churn",
    checks_passed: bool = False,
    merge_state_status: str = "CLEAN",
    workflow_runs: frozenset[str] = frozenset(),
    merged_at: str | None = None,
    closed_at: str | None = None,
) -> PullRequestRecord:
    return PullRequestRecord(
        number=number,
        title=title,
        body=body,
        state=state,
        is_draft=False,
        head_ref=f"factory/{number}-churn",
        head_sha=f"head-{number}",
        base_ref="main",
        files=("automation/x.py",),
        created_at="2026-08-24T08:00:00+00:00",
        closed_at=closed_at,
        merged_at=merged_at,
        merge_state_status=merge_state_status,
        checks_passed=checks_passed,
        workflow_run_ids=workflow_runs,
    )


def capacity(records: list[PullRequestRecord]) -> PullRequestCapacity:
    return calculate_capacity(
        records,
        max_open_pull_requests=10,
        max_queued_ci=10,
        lane_limits={},
        component_limits={},
    )


def test_metrics_track_requested_ratios_across_restart(tmp_path: Path) -> None:
    path = tmp_path / "pull-request-metrics.json"
    store = PullRequestMetricsStore(path)
    green = pull_request(
        10,
        checks_passed=True,
        workflow_runs=frozenset({"100", "101"}),
    )
    replay = pull_request(
        11,
        title="ci(factory): current-main replay",
        body="Factory-Task-Key: explicit:replay\nSupersedes #9",
        merge_state_status="BEHIND",
    )
    first_observation = datetime(2026, 8, 24, 9, tzinfo=UTC)

    store.observe_inventory([green, replay], capacity([green, replay]), now=first_observation)
    store.record_reviewer_invocations(10, 3, now=first_observation)
    store.record_supersession(11, 10, "duplicate active task", now=first_observation)

    merged = pull_request(
        10,
        state="MERGED",
        checks_passed=True,
        workflow_runs=frozenset({"101", "102"}),
        merged_at="2026-08-24T10:00:00+00:00",
        closed_at="2026-08-24T10:00:00+00:00",
    )
    closed_replay = pull_request(
        11,
        state="CLOSED",
        title=replay.title,
        body=replay.body,
        merge_state_status="BEHIND",
        closed_at="2026-08-24T09:30:00+00:00",
    )
    store = PullRequestMetricsStore(path)
    snapshot = store.observe_inventory(
        [merged, closed_replay],
        capacity([merged, closed_replay]),
        now=datetime(2026, 8, 24, 10, 5, tzinfo=UTC),
    )

    assert snapshot["summary"] == {
        "active_pr_count_by_lane": {},
        "merged_pr_count": 1,
        "superseded_pr_count": 1,
        "replay_pr_count": 1,
        "superseded_prs_per_merged_pr": 1.0,
        "replay_prs_per_merged_pr": 1.0,
        "ci_workflow_runs_per_merged_pr": 3.0,
        "reviewer_model_invocations_per_merged_pr": 3.0,
        "average_green_wait_seconds": 3600.0,
        "stale_conflicting_pr_rate": 0.5,
        "duplicate_task_fingerprints": 0,
        "duplicate_change_fingerprints": 0,
    }


def test_metrics_retain_every_open_pr_beyond_closed_history_limit(tmp_path: Path) -> None:
    store = PullRequestMetricsStore(tmp_path / "metrics.json", max_records=1)
    open_first = pull_request(1)
    open_second = pull_request(2, body="Factory-Task-Key: explicit:second")
    closed = pull_request(3, state="CLOSED")

    snapshot = store.observe_inventory(
        [open_first, open_second, closed],
        capacity([open_first, open_second, closed]),
    )

    records = snapshot["pull_requests"]
    assert isinstance(records, list)
    assert {record["number"] for record in records} == {1, 2}


def test_non_positive_reviewer_increment_is_ignored(tmp_path: Path) -> None:
    store = PullRequestMetricsStore(tmp_path / "metrics.json")

    store.record_reviewer_invocations(10, 0)

    assert not store.path.exists()
