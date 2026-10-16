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
    store.record_repair_invocations(10, 2, now=first_observation)
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
        "rolling_throughput": {
            f"{hours}h": {
                "merged_pr_count": 1,
                "merges_per_hour": round(1 / hours, 3),
                "merged_pr_count_by_component": {"automation": 1},
            }
            for hours in (1, 6, 24)
        },
        "active_pr_count_by_lane": {},
        "merged_pr_count": 1,
        "superseded_pr_count": 1,
        "replay_pr_count": 1,
        "superseded_prs_per_merged_pr": 1.0,
        "replay_prs_per_merged_pr": 1.0,
        "ci_workflow_runs_per_merged_pr": 3.0,
        "reviewer_model_invocations_per_merged_pr": 3.0,
        "repair_model_invocations_per_merged_pr": 2.0,
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


def test_lightweight_inventory_does_not_erase_known_component(tmp_path: Path) -> None:
    from dataclasses import replace

    store = PullRequestMetricsStore(tmp_path / "metrics.json")
    detailed = pull_request(10)
    store.observe_inventory([detailed], capacity([detailed]))
    lightweight = replace(detailed, files=())
    snapshot = store.observe_inventory([lightweight], capacity([lightweight]))
    assert snapshot["pull_requests"][0]["component"] == "automation"


def test_rolling_throughput_excludes_future_and_expired_merges(tmp_path: Path) -> None:
    from dataclasses import replace

    store = PullRequestMetricsStore(tmp_path / "metrics.json")
    now = datetime(2026, 8, 24, 12, tzinfo=UTC)
    records = [
        replace(
            pull_request(1, state="MERGED", merged_at="2026-08-24T11:30:00Z"),
            files=("frontend/a.ts",),
        ),
        pull_request(2, state="MERGED", merged_at="2026-08-24T10:00:00Z"),
        pull_request(3, state="MERGED", merged_at="2026-08-23T11:00:00Z"),
        pull_request(4, state="MERGED", merged_at="2026-08-24T13:00:00Z"),
    ]
    summary = store.observe_inventory(records, capacity(records), now=now)["summary"]
    assert summary["rolling_throughput"]["1h"]["merged_pr_count_by_component"] == {"frontend": 1}
    assert summary["rolling_throughput"]["6h"]["merged_pr_count"] == 2
    assert summary["rolling_throughput"]["24h"]["merged_pr_count"] == 2
