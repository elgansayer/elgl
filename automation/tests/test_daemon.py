from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

from openhands_factory.agents.base import ProviderHealth, ProviderStatus
from openhands_factory.daemon import (
    FactoryDaemon,
    provider_status_snapshot,
    queue_snapshot,
    refresh_jobs,
    select_batch,
)
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Job, JobState, Task


def job(identifier: str, priority: int, state: JobState = JobState.DISCOVERED) -> Job:
    return Job(Task(identifier, f"Task {identifier}", "Body", "github-issue", priority), state)


def pull_request_job(
    identifier: str,
    priority: int = 5,
    state: JobState = JobState.DISCOVERED,
) -> Job:
    task = Task(
        identifier,
        f"Pull request {identifier}",
        "Body",
        "github-pull-request",
        priority,
        pr_branch=f"agent/change-{identifier}",
    )
    return Job(task, state)


def test_select_batch_fills_parallel_capacity_by_priority() -> None:
    jobs = {
        "12": job("12", 10),
        "10": job("10", 0),
        "11": job("11", 0),
        "9": job("9", 0, JobState.DONE),
        "8": job("8", 0, JobState.QUARANTINED),
    }

    selected = select_batch(jobs, 3)

    assert [item.task.identifier for item in selected] == ["10", "11", "12"]


def test_select_batch_reserves_one_parallel_slot_for_pull_request_review() -> None:
    jobs = {
        "10": job("10", 0),
        "11": job("11", 0),
        "12": job("12", 0),
        "7348": pull_request_job("7348"),
    }

    selected = select_batch(jobs, 3)

    assert [item.task.identifier for item in selected] == ["10", "11", "7348"]


def test_select_batch_does_not_reserve_a_second_review_slot() -> None:
    jobs = {
        "10": job("10", 0),
        "11": job("11", 0),
        "7347": pull_request_job("7347", state=JobState.REVIEWING),
        "7348": pull_request_job("7348"),
    }

    selected = select_batch(jobs, 2, {"7347"})

    assert [item.task.identifier for item in selected] == ["10", "11"]


def test_select_batch_refills_free_capacity_without_rescheduling_active_jobs() -> None:
    jobs = {
        "10": job("10", 0, JobState.IMPLEMENTING),
        "11": job("11", 0),
        "12": job("12", 1),
        "13": job("13", 2),
    }

    selected = select_batch(jobs, 2, {"10"})

    assert [item.task.identifier for item in selected] == ["11", "12"]


def test_select_batch_skips_jobs_still_backing_off() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    jobs = {
        "10": replace(
            job("10", 0, JobState.IMPLEMENTING), next_attempt_at=now + timedelta(minutes=5)
        ),
        "11": replace(
            job("11", 0, JobState.IMPLEMENTING), next_attempt_at=now - timedelta(minutes=5)
        ),
    }

    selected = select_batch(jobs, 5, now=now)

    assert [item.task.identifier for item in selected] == ["11"]


def test_queue_snapshot_separates_runnable_backoff_active_and_terminal_jobs() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    jobs = {
        "10": job("10", 0, JobState.IMPLEMENTING),
        "11": job("11", 0, JobState.DISCOVERED),
        "12": replace(
            job("12", 0, JobState.IMPLEMENTING), next_attempt_at=now + timedelta(minutes=5)
        ),
        "13": job("13", 0, JobState.DONE),
        "14": job("14", 0, JobState.QUARANTINED),
    }

    snapshot = queue_snapshot(jobs, {"10"}, now=now)

    assert snapshot == {
        "total_jobs": 5,
        "active_count": 1,
        "runnable_count": 1,
        "backing_off_count": 1,
        "quarantined_count": 1,
        "blocked_count": 2,
        "top_failure_fingerprints": [],
        "oldest_blocked_tasks": [
            {
                "task_id": "12",
                "state": "implementing",
                "updated_at": jobs["12"].updated_at.isoformat(),
                "next_attempt_at": (now + timedelta(minutes=5)).isoformat(),
                "quarantined_at": None,
                "failure_fingerprint": None,
            },
            {
                "task_id": "14",
                "state": "quarantined",
                "updated_at": jobs["14"].updated_at.isoformat(),
                "next_attempt_at": None,
                "quarantined_at": None,
                "failure_fingerprint": None,
            },
        ],
        "by_state": {
            "discovered": 1,
            "done": 1,
            "implementing": 2,
            "quarantined": 1,
        },
    }


def test_queue_snapshot_bounds_blocked_tasks_and_aggregates_failure_fingerprints() -> None:
    now = datetime(2026, 1, 10, tzinfo=UTC)
    jobs: dict[str, Job] = {}
    for index in range(1, 8):
        task_id = str(100 + index)
        fingerprint = "validation:same" if index <= 4 else f"failure:{index}"
        jobs[task_id] = replace(
            job(task_id, index, JobState.QUARANTINED),
            last_failure_fingerprint=fingerprint,
            quarantined_at=now - timedelta(days=8 - index),
            updated_at=now - timedelta(days=8 - index),
        )

    snapshot = queue_snapshot(jobs, now=now)

    assert snapshot["quarantined_count"] == 7
    assert snapshot["blocked_count"] == 7
    assert snapshot["top_failure_fingerprints"] == [
        {"fingerprint": "validation:same", "count": 4},
        {"fingerprint": "failure:5", "count": 1},
        {"fingerprint": "failure:6", "count": 1},
        {"fingerprint": "failure:7", "count": 1},
    ]
    oldest = snapshot["oldest_blocked_tasks"]
    assert isinstance(oldest, list)
    assert [item["task_id"] for item in oldest] == ["101", "102", "103", "104", "105"]


def test_provider_status_snapshot_exposes_no_provider_detail_or_credentials() -> None:
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    snapshot = provider_status_snapshot(
        {
            "claude": ProviderHealth(
                provider="claude",
                status=ProviderStatus.RATE_LIMITED,
                checked_at=now,
                retry_after=now + timedelta(minutes=5),
                detail="secret-looking diagnostic that must stay private",
            )
        }
    )

    assert snapshot == [
        {
            "name": "claude",
            "status": "rate_limited",
            "checked_at": now.isoformat(),
            "retry_after": (now + timedelta(minutes=5)).isoformat(),
        }
    ]
    assert "detail" not in snapshot[0]


def test_refresh_jobs_preserves_durable_queue_after_control_plane_failure() -> None:
    durable = {"42": job("42", 0)}
    pipeline = SimpleNamespace(
        refresh=lambda protected: (_ for _ in ()).throw(FactoryError("HTTP 503")),
        jobs=SimpleNamespace(load=lambda: durable),
    )

    refreshed, retry_at = refresh_jobs(pipeline, set(), 10.0, 5)  # type: ignore[arg-type]

    assert refreshed == durable
    assert retry_at == 40.0


def test_daemon_remains_running_when_all_providers_are_temporarily_unusable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    daemon = FactoryDaemon.__new__(FactoryDaemon)
    daemon.config = SimpleNamespace(  # type: ignore[assignment]
        state_dir=tmp_path,
        repository=tmp_path,
    )
    daemon.pipeline = SimpleNamespace(  # type: ignore[assignment]
        router=SimpleNamespace(has_usable_provider=lambda: False)
    )
    daemon.stopping = False
    loop_calls: list[bool] = []
    monkeypatch.setattr("openhands_factory.daemon.signal.signal", lambda signum, handler: None)
    monkeypatch.setattr("openhands_factory.daemon.assert_single_owner", lambda repository: None)
    monkeypatch.setattr("openhands_factory.doctor.startup_security_checks", lambda config: [])
    monkeypatch.setattr(daemon, "_activate_generation", lambda: None)
    monkeypatch.setattr(daemon, "_loop", lambda: loop_calls.append(True) or 0)

    result = daemon.run()

    assert result == 0
    assert loop_calls == [True]


def test_daemon_publishes_heartbeat_before_first_scheduling_cycle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    daemon = FactoryDaemon.__new__(FactoryDaemon)
    daemon.config = SimpleNamespace(max_parallel_jobs=1)  # type: ignore[assignment]
    daemon.stopping = False
    writes: list[str] = []

    def record_state(
        status: str,
        active: object,
        active_started_at: object | None = None,
    ) -> None:
        writes.append(status)
        if status == "running":
            daemon.stopping = True

    monkeypatch.setattr(daemon, "_write_daemon_state", record_state)

    assert daemon._loop() == 0
    assert writes == ["running", "stopped"]


def test_storage_reserve_blocks_and_recovers_scheduling(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    daemon = FactoryDaemon.__new__(FactoryDaemon)
    daemon.config = SimpleNamespace()  # type: ignore[assignment]
    daemon.storage_blocked = False
    checks = [SimpleNamespace(passed=False, detail="root: 2.0 GiB available")]
    monkeypatch.setattr("openhands_factory.daemon.disk_space_checks", lambda config: checks)

    assert not daemon._storage_ready()
    assert daemon.storage_blocked

    checks[:] = [SimpleNamespace(passed=True, detail="root: 8.0 GiB available")]

    assert daemon._storage_ready()
    assert not daemon.storage_blocked


def test_daemon_refuses_to_schedule_when_a_security_boundary_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    daemon = FactoryDaemon.__new__(FactoryDaemon)
    daemon.config = SimpleNamespace(state_dir=tmp_path, repository=tmp_path)  # type: ignore[assignment]
    daemon.pipeline = SimpleNamespace(router=SimpleNamespace(has_usable_provider=lambda: True))  # type: ignore[assignment]
    daemon.stopping = False
    activated: list[bool] = []
    monkeypatch.setattr("openhands_factory.daemon.signal.signal", lambda signum, handler: None)
    monkeypatch.setattr("openhands_factory.daemon.assert_single_owner", lambda repository: None)
    monkeypatch.setattr(
        "openhands_factory.doctor.startup_security_checks",
        lambda config: [SimpleNamespace(name="verification-isolation", passed=False)],
    )
    monkeypatch.setattr(daemon, "_activate_generation", lambda: activated.append(True))

    result = daemon.run()

    assert result == 1
    assert activated == []


def test_stop_blocks_new_agent_starts_before_terminating_children(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from openhands_factory import repository_guard
    from openhands_factory.agents.process import AgentProcessRunner
    from openhands_factory.conversation_runner import ConversationRunner

    calls: list[str] = []
    daemon = FactoryDaemon.__new__(FactoryDaemon)
    daemon.stopping = False
    daemon.pipeline = SimpleNamespace(  # type: ignore[assignment]
        router=SimpleNamespace(shutdown=lambda: calls.append("router"))
    )
    monkeypatch.setattr(
        AgentProcessRunner,
        "request_shutdown",
        lambda: calls.append("cli-processes"),
    )
    monkeypatch.setattr(
        ConversationRunner,
        "request_shutdown",
        lambda: calls.append("sdk-processes"),
    )
    monkeypatch.setattr(
        repository_guard,
        "request_process_shutdown",
        lambda: calls.append("repository-processes"),
    )

    daemon.request_stop(15, None)

    assert daemon.stopping
    assert calls == ["router", "cli-processes", "sdk-processes", "repository-processes"]
