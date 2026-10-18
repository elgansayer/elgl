import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.jobs import RECOVERABLE_ACTIVE_STATES, JobStore
from openhands_factory.models import FailureKind, Job, JobState, Task
from openhands_factory.state import atomic_write_json


def _store(tmp_path: Path) -> JobStore:
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    return JobStore(state_dir / "jobs.json")


def _job(state: JobState, updated_at: datetime) -> Job:
    job = Job(Task("42", "Recover worker", "", "github-issue", 0), state)
    job.updated_at = updated_at
    return job


def _in_flight(state: JobState, started_at: datetime, *, identifier: str = "42") -> Job:
    """A job whose worker began at ``started_at`` and never committed an outcome."""

    job = Job(Task(identifier, "Recover worker", "", "github-issue", 0), state)
    job.updated_at = started_at
    job.attempt_started_at = started_at
    job.attempt_generation = "generation-a"
    return job


def test_abandoned_worker_attempt_enters_durable_timeout_backoff(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)
    store.save({"42": _in_flight(JobState.IMPLEMENTING, now - timedelta(hours=3))})

    recovered = store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

    assert recovered == ["42"]
    restored = store.load()["42"]
    assert restored.state is JobState.IMPLEMENTING
    assert restored.attempts == 1
    assert restored.last_failure_kind == FailureKind.TASK_TIMEOUT.value
    assert restored.failure_counts == {FailureKind.TASK_TIMEOUT.value: 1}
    assert restored.repeated_failure_count == 1
    assert restored.updated_at == now
    assert restored.next_attempt_at is not None
    assert restored.next_attempt_at > now
    assert restored.next_attempt_at <= now + timedelta(minutes=15)
    assert restored.attempt_started_at is None
    assert restored.attempt_generation is None


def test_legacy_abandoned_worker_backoff_is_clamped_on_load(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime.now(UTC)
    job = _job(JobState.REVIEWING, now - timedelta(hours=3))
    job.last_error = "Watchdog recovered abandoned reviewing attempt after maximum task duration"
    job.next_attempt_at = now + timedelta(hours=23)
    store.save({"42": job})

    restored = store.load()["42"]

    assert restored.next_attempt_at is not None
    assert restored.next_attempt_at <= datetime.now(UTC) + timedelta(minutes=15)


def test_watchdog_never_recovers_a_live_future(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)
    started_at = now - timedelta(hours=4)
    store.save({"42": _in_flight(JobState.REVIEWING, started_at)})

    recovered = store.recover_abandoned_attempts({"42"}, timedelta(hours=2), now=now)

    assert recovered == []
    restored = store.load()["42"]
    assert restored.attempts == 0
    assert restored.last_error is None
    assert restored.next_attempt_at is None
    assert restored.attempt_started_at == started_at


def test_polling_states_are_not_treated_as_abandoned_workers(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)
    started_at = now - timedelta(hours=6)
    store.save(
        {
            "42": _in_flight(JobState.CI_PENDING, started_at, identifier="42"),
            "43": _in_flight(JobState.MERGE_QUEUED, started_at, identifier="43"),
            "44": _in_flight(JobState.READY_TO_MERGE, started_at, identifier="44"),
        }
    )

    recovered = store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

    assert recovered == []
    restored = store.load()
    assert {identifier: job.attempts for identifier, job in restored.items()} == {
        "42": 0,
        "43": 0,
        "44": 0,
    }
    assert all(job.attempt_started_at == started_at for job in restored.values())


def test_future_retry_deadline_is_not_an_abandoned_attempt(tmp_path: Path) -> None:
    """Regression: a backed-off job was recovered, re-timed-out and rescheduled earlier."""

    store = _store(tmp_path)
    now = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    deadline = now + timedelta(hours=6)
    job = _job(JobState.QUALITY_REPAIRING, now - timedelta(hours=3))
    job.attempts = 7
    job.last_error = "Validation failed: quality gate reported 3 blocking findings"
    job.next_attempt_at = deadline
    job.failure_counts = {FailureKind.VALIDATION.value: 7}
    job.last_failure_kind = FailureKind.VALIDATION.value
    job.last_failure_fingerprint = "validation:quality-gate"
    job.repeated_failure_count = 7
    store.save_reconciled_jobs([job])
    before = store.load()["42"]

    recovered = store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

    assert recovered == []
    after = store.load()["42"]
    assert after == before
    assert after.state is JobState.QUALITY_REPAIRING
    assert after.attempts == 7
    assert after.last_error == "Validation failed: quality gate reported 3 blocking findings"
    assert after.next_attempt_at == deadline
    assert after.failure_counts == {FailureKind.VALIDATION.value: 7}
    assert after.repeated_failure_count == 7


@pytest.mark.parametrize("state", sorted(RECOVERABLE_ACTIVE_STATES, key=lambda item: item.value))
def test_queued_work_never_manufactures_a_timeout_incident_by_age(
    tmp_path: Path, state: JobState
) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    waiting = _job(state, now - timedelta(hours=30))
    waiting.next_attempt_at = now - timedelta(hours=29)
    unscheduled = Job(Task("43", "Never admitted", "", "github-issue", 0), state)
    unscheduled.updated_at = now - timedelta(hours=30)
    store.save({"42": waiting, "43": unscheduled})
    before = store.load()

    for _ in range(2):
        recovered = store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

        assert recovered == []
    assert store.load() == before
    assert all(job.attempts == 0 and job.last_error is None for job in before.values())


def test_unfinished_attempt_never_overrides_an_explicit_future_deadline(
    tmp_path: Path,
) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    job = _in_flight(JobState.VERIFYING, now - timedelta(hours=5))
    job.attempts = 2
    job.last_error = "Verification failed: unit tests"
    job.next_attempt_at = now + timedelta(hours=1)
    store.save_reconciled_jobs([job])
    before = store.load()["42"]

    recovered = store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

    assert recovered == []
    assert store.load()["42"] == before


def test_recent_unfinished_attempt_is_not_yet_abandoned(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    store.save({"42": _in_flight(JobState.IMPLEMENTING, now - timedelta(minutes=90))})

    assert store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now) == []

    restored = store.load()["42"]
    assert restored.attempts == 0
    assert restored.attempt_started_at == now - timedelta(minutes=90)
    boundary = now - timedelta(hours=2)
    assert store.recover_abandoned_attempts(set(), timedelta(hours=2), now=boundary) == []
    assert store.recover_abandoned_attempts(
        set(), timedelta(hours=2), now=now + timedelta(hours=1)
    ) == ["42"]


def test_prior_generation_attempt_is_recovered_once_and_preserves_evidence(
    tmp_path: Path,
) -> None:
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    path = state_dir / "jobs.json"
    generation = state_dir / "generation.json"
    started = datetime(2026, 10, 16, 6, 0, tzinfo=UTC)
    atomic_write_json(generation, {"identifier": "generation-a"})
    previous = JobStore(path, factory_generation="generation-a")
    job = Job(Task("42", "Recover worker", "", "github-issue", 0), JobState.REPAIRING)
    job.branch = "factory/issue-42-recover-worker"
    job.pull_request = 900
    job.head_sha = "abc1234"
    job.latest_verified_sha = "abc1234"
    job.review_findings = ["Handle the empty queue"]
    job.provider_history = [{"provider": "codex", "phase": "repair", "success": False}]
    job.attempts = 2
    job.last_error = "Verification failed: unit tests"
    job.failure_counts = {FailureKind.VALIDATION.value: 2}
    job.last_failure_kind = FailureKind.VALIDATION.value
    job.updated_at = started - timedelta(hours=1)
    # The earlier failure's retry deadline elapsed before this attempt began.
    job.next_attempt_at = started - timedelta(minutes=30)
    previous.save_reconciled_jobs([job])
    began = previous.begin_attempt("42", now=started)
    assert began is not None
    assert began.attempt_generation == "generation-a"

    # The daemon is replaced while the worker is mid-attempt: its process is gone and
    # the new generation never started an attempt for this job.
    atomic_write_json(generation, {"identifier": "generation-b"})
    current = JobStore(path, factory_generation="generation-b")
    now = started + timedelta(hours=3)

    recovered = current.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

    assert recovered == ["42"]
    restored = current.load()["42"]
    assert restored.state is JobState.REPAIRING
    assert restored.attempts == 3
    assert restored.last_error == (
        "Watchdog recovered abandoned repairing attempt after maximum task duration"
    )
    assert restored.last_failure_kind == FailureKind.TASK_TIMEOUT.value
    assert restored.failure_counts == {
        FailureKind.VALIDATION.value: 2,
        FailureKind.TASK_TIMEOUT.value: 1,
    }
    assert restored.next_attempt_at is not None
    assert now < restored.next_attempt_at <= now + timedelta(minutes=15)
    assert restored.attempt_started_at is None
    assert restored.attempt_generation is None
    # The worktree identity and diagnostic history survive recovery untouched.
    assert restored.branch == "factory/issue-42-recover-worker"
    assert restored.pull_request == 900
    assert restored.head_sha == "abc1234"
    assert restored.latest_verified_sha == "abc1234"
    assert restored.review_findings == ["Handle the empty queue"]
    assert restored.provider_history == [{"provider": "codex", "phase": "repair", "success": False}]
    # Recovery is bounded: the attempt is accounted for exactly once.
    assert current.recover_abandoned_attempts(set(), timedelta(hours=2), now=now) == []
    assert (
        current.recover_abandoned_attempts(set(), timedelta(hours=2), now=now + timedelta(days=2))
        == []
    )
    assert current.load()["42"].attempts == 3


def test_begin_attempt_marks_the_attempt_without_disturbing_scheduling_state(
    tmp_path: Path,
) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    queued = _job(JobState.VERIFYING, now - timedelta(hours=2))
    queued.next_attempt_at = now - timedelta(minutes=5)
    sibling = Job(Task("43", "Sibling", "", "github-issue", 0), JobState.REVIEWING)
    store.save({"42": queued, "43": sibling})

    began = store.begin_attempt("42", now=now)

    assert began is not None
    assert began.attempt_started_at == now
    assert began.attempt_generation == "unknown"
    restored = store.load()
    assert restored["42"].attempt_started_at == now
    assert restored["42"].attempt_generation == "unknown"
    assert restored["42"].updated_at == queued.updated_at
    assert restored["42"].next_attempt_at == queued.next_attempt_at
    assert restored["42"].state is JobState.VERIFYING
    assert restored["43"].attempt_started_at is None


@pytest.mark.parametrize(
    "state",
    [
        JobState.DISCOVERED,
        JobState.CI_PENDING,
        JobState.READY_TO_MERGE,
        JobState.MERGE_QUEUED,
        JobState.MERGED,
    ],
)
def test_begin_attempt_leaves_unrecoverable_polling_states_unmarked_and_unwritten(
    tmp_path: Path, state: JobState
) -> None:
    store = _store(tmp_path)
    store.save({"42": _job(state, datetime(2026, 10, 16, 6, 0, tzinfo=UTC))})
    before = store.path.read_bytes()

    began = store.begin_attempt("42", now=datetime(2026, 10, 16, 12, 0, tzinfo=UTC))

    assert began is not None
    assert began.state is state
    assert began.attempt_started_at is None
    assert began.attempt_generation is None
    assert store.path.read_bytes() == before


def test_begin_attempt_inherits_the_start_of_an_uncommitted_attempt(tmp_path: Path) -> None:
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    path = state_dir / "jobs.json"
    generation = state_dir / "generation.json"
    first = datetime(2026, 10, 16, 6, 0, tzinfo=UTC)
    atomic_write_json(generation, {"identifier": "generation-a"})
    JobStore(path, factory_generation="generation-a").save_job(
        _job(JobState.IMPLEMENTING, first - timedelta(hours=1))
    )
    previous = JobStore(path, factory_generation="generation-a")
    previous.begin_attempt("42", now=first)

    atomic_write_json(generation, {"identifier": "generation-b"})
    current = JobStore(path, factory_generation="generation-b")
    restarted = current.begin_attempt("42", now=first + timedelta(minutes=10))

    assert restarted is not None
    # A job that keeps killing its worker still ages towards recovery.
    assert restarted.attempt_started_at == first
    assert restarted.attempt_generation == "generation-b"
    assert current.recover_abandoned_attempts(
        set(), timedelta(hours=2), now=first + timedelta(hours=2, minutes=1)
    ) == ["42"]


def test_begin_attempt_discards_a_future_dated_marker(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 10, 16, 12, 0, tzinfo=UTC)
    store.save({"42": _in_flight(JobState.IMPLEMENTING, now + timedelta(days=30))})

    began = store.begin_attempt("42", now=now)

    assert began is not None
    assert began.attempt_started_at == now


def test_begin_attempt_ignores_unknown_and_finished_jobs(tmp_path: Path) -> None:
    store = _store(tmp_path)
    store.save({"42": _job(JobState.DONE, datetime(2026, 10, 16, tzinfo=UTC))})

    assert store.begin_attempt("42") is None
    assert store.begin_attempt("404") is None
    assert store.load()["42"].attempt_started_at is None


def test_superseded_generation_can_neither_begin_nor_recover_an_attempt(
    tmp_path: Path,
) -> None:
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    path = state_dir / "jobs.json"
    generation = state_dir / "generation.json"
    started = datetime(2026, 10, 16, 6, 0, tzinfo=UTC)
    atomic_write_json(generation, {"identifier": "generation-a"})
    stale = JobStore(path, factory_generation="generation-a")
    stale.save_job(_in_flight(JobState.IMPLEMENTING, started))
    atomic_write_json(generation, {"identifier": "generation-b"})

    with pytest.raises(FactoryError, match="Stale Factory generation"):
        stale.begin_attempt("42", now=started + timedelta(hours=1))
    with pytest.raises(FactoryError, match="Stale Factory generation"):
        stale.recover_abandoned_attempts(set(), timedelta(hours=2), now=started + timedelta(days=1))

    untouched = JobStore(path, factory_generation="generation-b").load()["42"]
    assert untouched.attempts == 0
    assert untouched.attempt_started_at == started
    assert untouched.attempt_generation == "generation-a"


def test_in_flight_marker_round_trips_and_tolerates_corrupt_state(tmp_path: Path) -> None:
    store = _store(tmp_path)
    started = datetime(2026, 10, 16, 6, 0, tzinfo=UTC)
    store.save({"42": _in_flight(JobState.IMPLEMENTING, started)})

    payload = json.loads(store.path.read_text(encoding="utf-8"))
    assert payload["jobs"][0]["attempt_started_at"] == started.isoformat()
    assert payload["jobs"][0]["attempt_generation"] == "generation-a"
    restored = store.load()["42"]
    assert restored.attempt_started_at == started
    assert restored.attempt_generation == "generation-a"

    for corrupt in ("not-a-timestamp", 12, ["2026-10-16T06:00:00+00:00"], None):
        payload["jobs"][0]["attempt_started_at"] = corrupt
        payload["jobs"][0]["attempt_generation"] = 99
        atomic_write_json(store.path, payload)
        tolerated = store.load()["42"]
        assert tolerated.attempt_started_at is None
        assert tolerated.attempt_generation is None

    for corrupt_generation in (99, "", None):
        payload["jobs"][0]["attempt_started_at"] = started.isoformat()
        payload["jobs"][0]["attempt_generation"] = corrupt_generation
        atomic_write_json(store.path, payload)
        partial = store.load()["42"]
        assert partial.attempt_started_at == started
        assert partial.attempt_generation is None

    del payload["jobs"][0]["attempt_started_at"]
    del payload["jobs"][0]["attempt_generation"]
    atomic_write_json(store.path, payload)
    legacy = store.load()["42"]
    assert legacy.attempt_started_at is None
    assert legacy.attempt_generation is None


def test_reopened_job_does_not_inherit_a_stale_marker(tmp_path: Path) -> None:
    store = _store(tmp_path)
    task = Task("42", "Recover worker", "", "github-issue", 0)
    finished = _in_flight(JobState.DONE, datetime(2026, 10, 16, 6, 0, tzinfo=UTC))
    finished.last_error = "Issue closed before pull request creation"
    store.save({"42": finished})

    reopened = store.reconcile([task])["42"]

    assert reopened.state is JobState.DISCOVERED
    assert reopened.attempt_started_at is None
    assert store.load()["42"].attempt_generation is None
