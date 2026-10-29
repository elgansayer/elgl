from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.jobs import JobStore
from openhands_factory.models import FailureKind, Job, JobState, Task
from openhands_factory.retry_policy import (
    DRIFT_GUIDED_REPAIR_KEY,
    classify_failure,
    deterministic_backoff,
    is_repair_budget_exhausted,
    record_failure_diagnostics,
    reset_retry_diagnostics,
)


def _job() -> Job:
    return Job(Task("7036", "Bound retries", "Body", "github-issue", 0))


def test_classifies_failure_kinds_from_outer_openhands_diagnostics() -> None:
    assert (
        classify_failure("Conversation exceeded the maximum task duration")
        is FailureKind.TASK_TIMEOUT
    )
    assert classify_failure("OAuth token expired; login required") is FailureKind.AUTHENTICATION
    assert classify_failure("HTTP 429 rate limit exceeded") is FailureKind.RATE_LIMIT
    assert classify_failure("Malformed response: invalid JSON") is FailureKind.MALFORMED_RESPONSE
    assert classify_failure("Quality gate validation failed") is FailureKind.VALIDATION
    assert classify_failure("Repair limit exceeded") is FailureKind.BUDGET
    infrastructure_failures = (
        "getaddrinfo EAI_AGAIN fonts.googleapis.com",
        "The Cypress binary is missing",
        "We expected the binary to be installed here",
        "No space left on device",
        "frontend-build failed with exit 137",
        "frontend-build failed with exit 143",
    )
    for detail in infrastructure_failures:
        assert classify_failure(detail) is FailureKind.INFRASTRUCTURE, detail


@pytest.mark.parametrize(
    "detail",
    (
        "Repair limit exceeded",
        "Repair limit exceeded: backend / lint, frontend / unit",
        "Repair limit exceeded: no failed check reported",
        "Quality repair limit exceeded",
        "Quality repair limit exceeded: review findings",
        "Quality repair limit exceeded: unsafe-type-escape in backend/src/auth/oauth.guard.ts",
        # Wording inside the cause must not move the failure to another class.
        "Repair limit exceeded: backend / authentication-timeout-validation, rate-limit-quota",
        "REPAIR LIMIT EXCEEDED: Frontend / Unit",
    ),
)
def test_spent_repair_budget_stays_in_the_budget_class_whatever_its_cause(detail: str) -> None:
    assert is_repair_budget_exhausted(detail)
    assert classify_failure(detail) is FailureKind.BUDGET


@pytest.mark.parametrize(
    ("detail", "kind"),
    (
        ("Review repair limit exceeded", FailureKind.BUDGET),
        ("Quality gate blocked: credential-artifact in .claude/x", FailureKind.VALIDATION),
    ),
)
def test_only_the_repair_budget_messages_take_the_early_budget_class(
    detail: str, kind: FailureKind
) -> None:
    assert not is_repair_budget_exhausted(detail)
    assert classify_failure(detail) is kind


def test_spent_repair_budget_repeats_one_fingerprint_for_an_identical_cause() -> None:
    job = _job()
    detail = "Repair limit exceeded: backend / lint"

    record_failure_diagnostics(job, detail)
    fingerprint = job.last_failure_fingerprint
    record_failure_diagnostics(job, detail)

    assert job.last_failure_fingerprint == fingerprint
    assert job.repeated_failure_count == 2
    assert job.failure_counts == {FailureKind.BUDGET.value: 2}

    # A different blocker is new evidence, so it starts its own repetition count.
    record_failure_diagnostics(job, "Repair limit exceeded: frontend / unit")
    assert job.last_failure_fingerprint != fingerprint
    assert job.repeated_failure_count == 1


def test_job_at_its_budget_keeps_its_backoff_when_the_error_gains_a_cause(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json", max_repeated_failures=3)
    job = _job()
    job.state = JobState.QUALITY_REPAIRING
    job.failure_counts = {FailureKind.BUDGET.value: 6}
    job.last_failure_kind = FailureKind.BUDGET.value
    job.last_failure_fingerprint = "bare-message"
    job.repeated_failure_count = 6
    store.save({job.task.identifier: job})

    failed = store.load()[job.task.identifier]
    failed.attempts = 7
    # The path mentions "oauth", which would otherwise restart the class count as
    # an authentication failure and with it the 5 minute ordinary backoff.
    failed.last_error = (
        "Quality repair limit exceeded: unsafe-type-escape in backend/src/auth/oauth.guard.ts"
    )
    failed.updated_at = datetime.now(UTC)
    store.save_job(failed)

    restored = store.load()[job.task.identifier]
    assert restored.failure_counts == {FailureKind.BUDGET.value: 7}
    assert restored.last_failure_kind == FailureKind.BUDGET.value
    # A new cause is new evidence: the repetition count restarts, the class count does not.
    assert restored.last_failure_fingerprint != "bare-message"
    assert restored.repeated_failure_count == 1
    assert restored.next_attempt_at is not None
    # Seventh failure of the class: 5 minutes * 2**6, less at most 20% jitter.
    assert restored.next_attempt_at - restored.updated_at >= timedelta(minutes=256)


def test_agent_failure_context_is_persisted_in_stable_fingerprint() -> None:
    job = _job()
    detail = "HTTP 429 rate limit exceeded"
    job.provider_history.append(
        {
            "provider": "openhands",
            "phase": "implementation",
            "success": False,
            "error": detail,
            "kind": "internal_factory_failure",
        }
    )

    count = record_failure_diagnostics(job, detail)

    assert count == 1
    assert job.failure_counts == {FailureKind.RATE_LIMIT.value: 1}
    assert job.last_failure_kind == FailureKind.RATE_LIMIT.value
    assert job.last_failure_fingerprint is not None
    assert job.repeated_failure_count == 1


def test_router_failure_classification_drives_durable_retry_class() -> None:
    job = _job()
    detail = "Agent CLI exited before completing the request"
    job.provider_history.append(
        {
            "provider": "claude",
            "phase": "implementation",
            "success": False,
            "error": detail,
            "failure_classification": "provider_auth",
        }
    )

    count = record_failure_diagnostics(job, detail)

    assert count == 1
    assert job.failure_counts == {FailureKind.AUTHENTICATION.value: 1}
    assert job.last_failure_kind == FailureKind.AUTHENTICATION.value


def test_identical_failure_shape_collapses_across_high_cardinality_values() -> None:
    job = _job()
    first = "Task timeout at 2026-08-16T22:00:01Z for request 123456"
    second = "Task timeout at 2026-08-16T22:05:44Z for request 987654"

    first_count = record_failure_diagnostics(job, first)
    first_fingerprint = job.last_failure_fingerprint
    second_count = record_failure_diagnostics(job, second)

    assert first_count == 1
    assert second_count == 2
    assert job.last_failure_fingerprint == first_fingerprint
    assert job.repeated_failure_count == 2


def test_retry_budgets_are_counted_independently_by_failure_class() -> None:
    job = _job()

    assert record_failure_diagnostics(job, "maximum task duration exceeded") == 1
    assert record_failure_diagnostics(job, "OAuth token expired") == 1
    assert record_failure_diagnostics(job, "maximum task duration exceeded") == 2
    assert job.failure_counts == {
        FailureKind.TASK_TIMEOUT.value: 2,
        FailureKind.AUTHENTICATION.value: 1,
    }


def test_retry_reset_requires_explicit_meaningful_progress() -> None:
    job = _job()
    record_failure_diagnostics(job, "maximum task duration exceeded")
    job.failure_counts[DRIFT_GUIDED_REPAIR_KEY] = 1

    reset_retry_diagnostics(job)

    assert job.failure_counts == {DRIFT_GUIDED_REPAIR_KEY: 1}
    assert job.last_failure_kind is None
    assert job.last_failure_fingerprint is None
    assert job.repeated_failure_count == 0


def test_backoff_is_deterministic_jittered_exponential_and_capped() -> None:
    first = deterministic_backoff(1, jitter_key="7036:abc")
    repeated = deterministic_backoff(1, jitter_key="7036:abc")
    second = deterministic_backoff(2, jitter_key="7036:abc")
    capped = deterministic_backoff(20, jitter_key="7036:abc")

    assert first == repeated
    assert timedelta(minutes=4) <= first <= timedelta(minutes=6)
    assert timedelta(minutes=8) <= second <= timedelta(minutes=12)
    assert capped <= timedelta(hours=24)
    assert capped >= timedelta(hours=19, minutes=12)


def test_job_store_persists_class_budget_and_jittered_next_attempt(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    job = _job()
    job.state = JobState.IMPLEMENTING
    store.save({job.task.identifier: job})

    failed = store.load()[job.task.identifier]
    failed.attempts = 1
    failed.last_error = "Conversation exceeded the maximum task duration"
    failed.updated_at = datetime.now(UTC)
    store.save_job(failed)

    restored = store.load()[job.task.identifier]
    assert restored.failure_counts == {FailureKind.TASK_TIMEOUT.value: 1}
    assert restored.last_failure_kind == FailureKind.TASK_TIMEOUT.value
    assert restored.last_failure_fingerprint is not None
    assert restored.repeated_failure_count == 1
    assert restored.next_attempt_at is not None
    delay = restored.next_attempt_at - restored.updated_at
    assert timedelta(minutes=3, seconds=59) <= delay <= timedelta(minutes=6, seconds=1)


@pytest.mark.parametrize(
    "diagnostic",
    (
        "getaddrinfo EAI_AGAIN fonts.googleapis.com",
        "The Cypress binary is missing",
    ),
    ids=("dns", "missing-cypress"),
)
def test_new_infrastructure_failure_does_not_inherit_transient_retry_debt(
    tmp_path: Path,
    diagnostic: str,
) -> None:
    store = JobStore(tmp_path / "jobs.json")
    job = _job()
    job.state = JobState.VERIFYING
    job.failure_counts = {FailureKind.TRANSIENT.value: 23}
    store.save({job.task.identifier: job})

    failed = store.load()[job.task.identifier]
    failed.attempts = 24
    failed.last_error = f"frontend verification failed: {diagnostic}"
    failed.updated_at = datetime.now(UTC)
    store.save_job(failed)

    restored = store.load()[job.task.identifier]
    assert restored.failure_counts == {
        FailureKind.TRANSIENT.value: 23,
        FailureKind.INFRASTRUCTURE.value: 1,
    }
    assert restored.last_failure_kind == FailureKind.INFRASTRUCTURE.value
    assert restored.next_attempt_at is not None
    delay = restored.next_attempt_at - restored.updated_at
    assert timedelta(minutes=3, seconds=59) <= delay <= timedelta(minutes=6, seconds=1)


def test_job_store_keeps_retry_budget_on_poll_and_resets_on_progress(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    job = _job()
    job.state = JobState.CI_PENDING
    job.failure_counts = {FailureKind.TRANSIENT.value: 2}
    job.last_failure_kind = FailureKind.TRANSIENT.value
    job.last_failure_fingerprint = "stable"
    job.repeated_failure_count = 2
    store.save({job.task.identifier: job})

    polled = store.load()[job.task.identifier]
    polled.attempts = 0
    polled.last_error = None
    polled.next_attempt_at = None
    store.save_job(polled)
    still_pending = store.load()[job.task.identifier]
    assert still_pending.failure_counts == {FailureKind.TRANSIENT.value: 2}

    progressed = store.load()[job.task.identifier]
    progressed.state = JobState.MERGE_QUEUED
    store.save_job(progressed)
    restored = store.load()[job.task.identifier]
    assert restored.failure_counts == {}
    assert restored.last_failure_kind is None
    assert restored.last_failure_fingerprint is None
    assert restored.repeated_failure_count == 0
