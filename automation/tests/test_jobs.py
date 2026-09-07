import json
import multiprocessing
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from multiprocessing.connection import Connection
from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.jobs import JobStore
from openhands_factory.models import MAX_PROVIDER_HISTORY, Job, JobState, Task
from openhands_factory.state import atomic_write_json


def _save_job_in_separate_process(path: str, connection: Connection) -> None:
    store = JobStore(Path(path))
    connection.send("started")
    store.save_job(Job(Task("2", "Second process", "", "github-issue", 0)))
    connection.send("finished")
    connection.close()


def test_reconcile_is_idempotent_and_preserves_progress(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("7", "Fix tests", "Body", "github-issue", 0)

    jobs = store.reconcile([task])
    jobs["7"].state = JobState.IMPLEMENTING
    jobs["7"].branch = "factory/7-fix-tests"
    store.save(jobs)

    restored = store.reconcile([task])

    assert restored["7"].state is JobState.IMPLEMENTING
    assert restored["7"].branch == "factory/7-fix-tests"


def test_reconcile_adds_new_tasks_without_dropping_old_jobs(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    first = Task("1", "First", "", "github-issue", 10)
    second = Task("2", "Second", "", "github-issue", 10)

    store.reconcile([first])
    jobs = store.reconcile([second])

    assert set(jobs) == {"1", "2"}


def test_reconcile_requeues_open_issue_marked_done_without_a_pr(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("9", "Retry issue", "", "github-issue", 0)
    jobs = store.reconcile([task])
    jobs["9"].state = JobState.DONE
    jobs["9"].last_error = "Issue closed before pull request creation"
    jobs["9"].failure_counts = {"transient": 4}
    jobs["9"].last_failure_kind = "transient"
    jobs["9"].last_failure_fingerprint = "abc123"
    jobs["9"].repeated_failure_count = 4
    store.save(jobs)

    restored = store.reconcile([task])

    assert restored["9"].state is JobState.DISCOVERED
    assert restored["9"].last_error is None
    assert restored["9"].failure_counts == {}
    assert restored["9"].last_failure_kind is None
    assert restored["9"].last_failure_fingerprint is None
    assert restored["9"].repeated_failure_count == 0


def test_reconcile_requeues_a_reopened_external_pull_request(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task(
        "10",
        "Reopened PR",
        "",
        "github-pull-request",
        5,
        pr_branch="external/reopened",
    )
    jobs = store.reconcile([task])
    jobs["10"].state = JobState.DONE
    jobs["10"].pull_request = 10
    jobs["10"].last_error = "Pull request closed before the factory finished with it"
    jobs["10"].attempts = 3
    store.save(jobs)

    restored = store.reconcile([task])

    assert restored["10"].state is JobState.DISCOVERED
    assert restored["10"].last_error is None
    assert restored["10"].attempts == 0


def test_save_never_persists_quarantine_and_preserves_failure_evidence(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json", max_repeated_failures=3)
    stale = Task("258", "Historical issue", "", "github-issue", 0)
    jobs = store.reconcile([stale])
    job = jobs["258"]
    job.state = JobState.QUARANTINED
    job.attempts = 12
    job.repair_attempts = 5
    job.last_error = "legacy permanent failure"
    job.failure_counts = {"tool": 7}
    job.last_failure_kind = "tool"
    job.last_failure_fingerprint = "deadbeef"
    job.repeated_failure_count = 7
    job.quarantined_at = datetime.now(UTC)
    job.quarantine_reason = "legacy operator state"
    job.quarantine_notification_pending = True
    store.save(jobs)

    restored = store.load()["258"]

    assert restored.state is JobState.DISCOVERED
    assert restored.attempts == 12
    assert restored.repair_attempts == 5
    assert restored.last_error == "legacy permanent failure"
    assert restored.next_attempt_at is not None
    assert restored.failure_counts == {"tool": 7}
    assert restored.last_failure_kind == "tool"
    assert restored.last_failure_fingerprint == "deadbeef"
    assert restored.repeated_failure_count == 7
    assert restored.quarantine_reason is None
    assert restored.quarantined_at is None
    assert not restored.quarantine_notification_pending


def test_load_normalizes_legacy_quarantine_without_losing_retry_evidence(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    now = datetime.now(UTC)
    atomic_write_json(
        path,
        {
            "jobs": [
                {
                    "task": {
                        "identifier": "259",
                        "title": "Legacy quarantined issue",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                    },
                    "state": "quarantined",
                    "attempts": 8,
                    "repair_attempts": 3,
                    "quality_repairs": 2,
                    "last_error": "legacy terminal state",
                    "failure_counts": {"task-timeout": 4},
                    "last_failure_kind": "task-timeout",
                    "last_failure_fingerprint": "cafebabe",
                    "repeated_failure_count": 4,
                    "quarantine_reason": "legacy circuit",
                    "quarantined_at": now.isoformat(),
                    "quarantine_notification_pending": True,
                    "updated_at": now.isoformat(),
                }
            ]
        },
    )

    restored = JobStore(path, max_repeated_failures=3).load()["259"]

    assert restored.state is JobState.DISCOVERED
    assert restored.attempts == 8
    assert restored.repair_attempts == 3
    assert restored.quality_repairs == 2
    assert restored.last_error == "legacy terminal state"
    assert restored.next_attempt_at is not None
    assert restored.failure_counts == {"task-timeout": 4}
    assert restored.last_failure_kind == "task-timeout"
    assert restored.last_failure_fingerprint == "cafebabe"
    assert restored.repeated_failure_count == 4
    assert restored.quarantine_reason is None
    assert restored.quarantined_at is None
    assert not restored.quarantine_notification_pending


def test_repeated_identical_task_failure_uses_autonomous_chronic_backoff(
    tmp_path: Path,
) -> None:
    path = tmp_path / "jobs.json"
    store = JobStore(path, max_repeated_failures=3)
    job = store.reconcile([Task("266", "Deterministic failure", "", "github-issue", 0)])["266"]
    job.state = JobState.IMPLEMENTING

    for attempt in range(1, 4):
        job.attempts = attempt
        job.last_error = "Repository validation failed with the same deterministic error"
        job.updated_at = datetime.now(UTC)
        store.save_job(job)
        job = store.load()["266"]

    assert job.state is JobState.IMPLEMENTING
    assert job.repeated_failure_count == 3
    assert job.quarantine_reason is None
    assert job.quarantined_at is None
    assert not job.quarantine_notification_pending
    assert job.next_attempt_at is not None
    assert job.next_attempt_at > datetime.now(UTC) + timedelta(minutes=29)

    job.attempts = 4
    job.last_error = "Repository validation failed with the same deterministic error"
    job.updated_at = datetime.now(UTC)
    store.save_job(job)
    repeated = store.load()["266"]

    assert repeated.state is JobState.IMPLEMENTING
    assert repeated.repeated_failure_count == 4
    assert repeated.next_attempt_at is not None
    assert repeated.next_attempt_at > datetime.now(UTC) + timedelta(minutes=59)

    restarted = JobStore(path, max_repeated_failures=3).load()["266"]
    assert restarted.state is JobState.IMPLEMENTING
    assert restarted.next_attempt_at == repeated.next_attempt_at
    assert restarted.last_failure_fingerprint == repeated.last_failure_fingerprint


def test_legacy_operator_requeue_cannot_leave_other_jobs_quarantined(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    now = datetime.now(UTC)
    atomic_write_json(
        path,
        {
            "jobs": [
                {
                    "task": {
                        "identifier": task_id,
                        "title": f"Legacy {task_id}",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                    },
                    "state": "quarantined",
                    "attempts": 1,
                    "last_error": "Deterministic repository failure",
                    "failure_counts": {"tool": 1},
                    "last_failure_kind": "tool",
                    "last_failure_fingerprint": f"fp-{task_id}",
                    "repeated_failure_count": 1,
                    "quarantine_reason": "legacy",
                    "quarantined_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                }
                for task_id in ("267", "268")
            ]
        },
    )
    store = JobStore(path, max_repeated_failures=1)

    requeued = store.requeue_quarantined({"267"})
    restored = store.load()

    assert requeued == ["267"]
    assert restored["267"].state is JobState.DISCOVERED
    assert restored["267"].attempts == 0
    assert restored["267"].last_error is None
    assert restored["268"].state is JobState.DISCOVERED
    assert restored["268"].attempts == 1
    assert restored["268"].last_error == "Deterministic repository failure"
    assert restored["268"].next_attempt_at is not None


def test_retry_diagnostics_round_trip(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("260", "Retry metadata", "", "github-issue", 0)
    jobs = store.reconcile([task])
    job = jobs["260"]
    job.failure_counts = {"rate-limit": 3, "tool": 1}
    job.last_failure_kind = "rate-limit"
    job.last_failure_fingerprint = "4f8d6e2a1b"
    job.repeated_failure_count = 3
    store.save(jobs)

    restored = store.load()["260"]

    assert restored.failure_counts == {"rate-limit": 3, "tool": 1}
    assert restored.last_failure_kind == "rate-limit"
    assert restored.last_failure_fingerprint == "4f8d6e2a1b"
    assert restored.repeated_failure_count == 3


def test_canonical_ownership_provenance_round_trips(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("7033", "Canonical ownership", "", "github-issue", 0)
    job = store.reconcile([task])["7033"]
    job.canonical_task_id = "7033"
    job.producer_identity = "generation:7033"
    job.branch = "factory/7033-canonical-ownership"
    job.pull_request = 8001
    job.initial_base_sha = "base-sha"
    job.latest_verified_sha = "verified-sha"
    job.predecessor_pull_request = 7999
    job.successor_pull_request = 8001
    job.changed_path_fingerprint = "paths:abc123"

    store.save_job(job)
    restored = store.load()["7033"]

    assert restored.canonical_task_id == "7033"
    assert restored.producer_identity == "generation:7033"
    assert restored.branch == "factory/7033-canonical-ownership"
    assert restored.pull_request == 8001
    assert restored.initial_base_sha == "base-sha"
    assert restored.latest_verified_sha == "verified-sha"
    assert restored.predecessor_pull_request == 7999
    assert restored.successor_pull_request == 8001
    assert restored.changed_path_fingerprint == "paths:abc123"


def test_task_triage_tags_round_trip_as_a_frozenset(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task(
        "262",
        "Tagged task",
        "",
        "github-issue",
        0,
        triage_tags=frozenset({"frontend", "security"}),
    )

    store.reconcile([task])
    restored = store.load()["262"]

    assert restored.task.triage_tags == frozenset({"frontend", "security"})
    assert isinstance(restored.task.triage_tags, frozenset)


def test_load_normalises_legacy_provider_metadata_and_missing_timestamp(
    tmp_path: Path,
) -> None:
    path = tmp_path / "jobs.json"
    atomic_write_json(
        path,
        {
            "jobs": [
                {
                    "task": {
                        "identifier": "263",
                        "title": "Legacy metadata",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                        "triage_tags": "frozenset({'backend'})",
                    },
                    "state": "implementing",
                    "provider_history": {"provider": "codex"},
                    "failure_counts": "invalid",
                    "review_findings": "invalid",
                }
            ]
        },
    )

    restored = JobStore(path).load()["263"]

    assert restored.task.triage_tags == frozenset({"backend"})
    assert restored.provider_history == []
    assert restored.failure_counts == {}
    assert restored.review_findings == []
    assert restored.updated_at.tzinfo is UTC


def test_reconciliation_batch_preserves_sibling_worker_transition(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    jobs = store.reconcile(
        [
            Task("270", "Closed task", "", "github-issue", 0),
            Task("271", "Live sibling", "", "github-issue", 0),
        ]
    )
    retired = jobs["270"]
    retired.state = JobState.DONE
    retired.attempts = 2
    retired.last_error = "Issue closed before pull request creation"

    sibling = jobs["271"]
    sibling.state = JobState.IMPLEMENTING
    sibling.branch = "factory/issue-271-live-sibling"
    store.save_job(sibling)
    store.save_reconciled_jobs([retired])

    restored = store.load()
    assert restored["270"].state is JobState.DONE
    assert restored["270"].next_attempt_at is None
    assert restored["271"].state is JobState.IMPLEMENTING
    assert restored["271"].branch == "factory/issue-271-live-sibling"


def test_load_trims_legacy_provider_history_to_the_diagnostic_bound(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    history = [{"sequence": sequence} for sequence in range(MAX_PROVIDER_HISTORY + 10)]
    atomic_write_json(
        path,
        {
            "jobs": [
                {
                    "task": {
                        "identifier": "269",
                        "title": "Bound history",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                    },
                    "state": "implementing",
                    "provider_history": history,
                }
            ]
        },
    )

    restored = JobStore(path).load()["269"]

    assert len(restored.provider_history) == MAX_PROVIDER_HISTORY
    assert restored.provider_history[0]["sequence"] == 10


def test_legacy_job_without_retry_diagnostics_loads_with_safe_defaults(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    atomic_write_json(
        path,
        {
            "jobs": [
                {
                    "task": {
                        "identifier": "261",
                        "title": "Legacy job",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                        "pr_branch": None,
                    },
                    "state": "implementing",
                    "branch": "factory/261-legacy-job",
                    "pull_request": None,
                    "head_sha": None,
                    "attempts": 2,
                    "repair_attempts": 0,
                    "quality_repairs": 0,
                    "last_error": "old failure",
                    "next_attempt_at": None,
                    "factory_generation": "legacy",
                    "updated_at": "2026-08-16T10:00:00+00:00",
                }
            ]
        },
    )

    restored = JobStore(path).load()["261"]

    assert restored.failure_counts == {}
    assert restored.last_failure_kind is None
    assert restored.last_failure_fingerprint is None
    assert restored.repeated_failure_count == 0


def test_load_skips_malformed_entry_without_losing_valid_sibling(
    tmp_path: Path,
    caplog,
) -> None:
    path = tmp_path / "jobs.json"
    valid_task = {
        "identifier": "264",
        "title": "Recoverable sibling",
        "body": "",
        "source": "github-issue",
        "priority": 0,
    }
    path.write_text(
        json.dumps(
            {
                "jobs": [
                    {"task": valid_task, "state": "implementing"},
                    {"task": {"identifier": "broken"}, "state": "not-a-state"},
                    "not-a-mapping",
                ]
            }
        ),
        encoding="utf-8",
    )

    restored = JobStore(path).load()

    assert set(restored) == {"264"}
    assert restored["264"].state is JobState.IMPLEMENTING
    assert caplog.text.count("factory.state.job_skipped") == 2


def test_parallel_job_updates_do_not_lose_sibling_state(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    tasks = [Task(str(identifier), "Task", "", "github-issue", 0) for identifier in range(6)]
    jobs = store.reconcile(tasks)
    for item in jobs.values():
        item.state = JobState.IMPLEMENTING

    with ThreadPoolExecutor(max_workers=6) as workers:
        list(workers.map(store.save_job, jobs.values()))

    restored = store.load()
    assert set(restored) == {task.identifier for task in tasks}
    assert all(item.state is JobState.IMPLEMENTING for item in restored.values())


def test_stale_daemon_generation_cannot_overwrite_job_state(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    atomic_write_json(tmp_path / "generation.json", {"identifier": "generation-a"})
    stale = JobStore(path, factory_generation="generation-a")
    stale.reconcile([Task("1", "Task", "", "github-issue", 0)])

    atomic_write_json(tmp_path / "generation.json", {"identifier": "generation-b"})

    with pytest.raises(FactoryError, match="Stale Factory generation"):
        stale.save_job(Job(Task("1", "Stale", "", "github-issue", 0)))

    current = JobStore(path, factory_generation="generation-b")
    current.save_job(Job(Task("2", "Current", "", "github-issue", 0)))
    assert set(current.load()) == {"1", "2"}


def test_full_state_save_uses_the_same_process_lock_as_worker_merges(
    tmp_path: Path,
) -> None:
    store = JobStore(tmp_path / "jobs.json")
    jobs = store.reconcile([Task("1", "Task", "", "github-issue", 0)])
    started = threading.Event()

    def save() -> None:
        started.set()
        store.save(jobs)

    with ThreadPoolExecutor(max_workers=1) as workers:
        with store._process_lock:
            future = workers.submit(save)
            assert started.wait(timeout=1)
            time.sleep(0.02)
            assert not future.done()

        future.result(timeout=1)


def test_job_merge_waits_for_cross_process_state_lock(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    store = JobStore(path)
    store.reconcile([Task("1", "First process", "", "github-issue", 0)])
    context = multiprocessing.get_context("spawn")
    parent_connection, child_connection = context.Pipe(duplex=True)
    process = context.Process(
        target=_save_job_in_separate_process,
        args=(str(path), child_connection),
    )

    try:
        with store.file_lock:
            process.start()
            child_connection.close()
            assert parent_connection.poll(5)
            assert parent_connection.recv() == "started"
            assert not parent_connection.poll(0.2)

        assert parent_connection.poll(5)
        assert parent_connection.recv() == "finished"
        process.join(timeout=5)
        assert process.exitcode == 0
    finally:
        parent_connection.close()
        if process.is_alive():
            process.terminate()
            process.join(timeout=5)

    assert set(store.load()) == {"1", "2"}


def test_provider_deferral_preserves_deadline_without_consuming_task_attempt(
    tmp_path: Path,
) -> None:
    store = JobStore(tmp_path / "jobs.json")
    job = store.reconcile([Task("265", "Capacity wait", "", "github-issue", 0)])["265"]
    job.state = JobState.IMPLEMENTING
    job.attempts = 3
    job.last_error = "previous repository failure"
    store.save_job(job)

    restored = store.load()["265"]
    deadline = datetime.now(UTC) + timedelta(minutes=2)
    restored.last_error = "No eligible provider is available for phase implementation"
    restored.next_attempt_at = deadline
    store.save_job(restored)

    deferred = store.load()["265"]
    assert deferred.attempts == 3
    assert deferred.next_attempt_at == deadline
    assert deferred.failure_counts == restored.failure_counts
