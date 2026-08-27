"""Durable idempotent job state storage."""

from __future__ import annotations

import ast
import logging
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import RLock

from filelock import FileLock

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import MAX_PROVIDER_HISTORY, Job, JobState, Task
from openhands_factory.retry_policy import (
    deterministic_backoff,
    record_failure_diagnostics,
    reset_retry_diagnostics,
)
from openhands_factory.state import atomic_write_json, read_json

MAX_PERSISTED_RETRY_DELAY = timedelta(hours=24)
RECOVERABLE_ACTIVE_STATES = {
    JobState.LEASED,
    JobState.IMPLEMENTING,
    JobState.SECURITY_REVIEW,
    JobState.VERIFYING,
    JobState.PR_DRAFT,
    JobState.REVIEWING,
    JobState.REPAIRING,
    JobState.QUALITY_REPAIRING,
}
logger = logging.getLogger(__name__)


def _is_job_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("jobs"), list)


class JobStore:
    _process_lock = RLock()

    def __init__(
        self,
        path: Path,
        factory_generation: str = "unknown",
        max_repeated_failures: int | None = None,
    ) -> None:
        self.path = path
        if factory_generation == "unknown":
            generation = read_json(path.parent / "generation.json", {})
            factory_generation = str(generation.get("identifier", "unknown"))
        self.factory_generation = factory_generation
        self.max_repeated_failures = max_repeated_failures
        self.file_lock = FileLock(str(path) + ".lock")

    @staticmethod
    def _load_next_attempt_at(value: object, now: datetime) -> datetime | None:
        """Recover a persisted cooldown without letting corrupt state wedge the queue.

        Retry scheduling is capped at 24 hours by policy, so a timestamp farther than
        one full retry window into the future cannot have been produced by the current
        scheduler. Malformed or timezone-naive values are treated as immediately due;
        valid but implausibly distant values are clamped to the maximum retry window.
        Durable failure counters/fingerprints are left intact so recovery does not
        erase the evidence that caused the backoff.
        """

        if not isinstance(value, str) or not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return None
        parsed = parsed.astimezone(UTC)
        maximum = now + MAX_PERSISTED_RETRY_DELAY
        if parsed > maximum:
            return maximum
        return parsed

    def _load(self) -> dict[str, Job]:
        payload = read_json(self.path, {"jobs": []}, validator=_is_job_payload)
        jobs: dict[str, Job] = {}
        now = datetime.now(UTC)
        for index, item in enumerate(payload.get("jobs", [])):
            try:
                job = self._restore_job(item, now)
            except (KeyError, OverflowError, TypeError, ValueError) as error:
                logger.error(
                    "factory.state.job_skipped index=%s error=%s",
                    index,
                    type(error).__name__,
                )
                continue
            if job.state is JobState.QUARANTINED and job.quarantine_reason is None:
                self._reset_legacy_quarantine(job, now)
            jobs[job.task.identifier] = job
        return jobs

    def load(self) -> dict[str, Job]:
        with self._process_lock, self.file_lock:
            return self._load()

    def _assert_generation_current(self) -> None:
        if self.factory_generation == "unknown":
            return
        generation = read_json(self.path.parent / "generation.json", {})
        if generation.get("identifier") != self.factory_generation:
            raise FactoryError("Stale Factory generation cannot mutate durable job state")

    def _restore_job(self, item: object, now: datetime) -> Job:
        if not isinstance(item, dict):
            raise TypeError("job entry is not a mapping")
        task_payload = dict(item["task"])
        task_payload["triage_tags"] = self._restore_triage_tags(task_payload.get("triage_tags", []))
        task = Task(**task_payload)
        failure_counts = item.get("failure_counts", {})
        if not isinstance(failure_counts, dict):
            failure_counts = {}
        restored_failure_counts: dict[str, int] = {}
        for key, value in failure_counts.items():
            try:
                restored_failure_counts[str(key)] = int(value)
            except (TypeError, ValueError):
                continue
        review_findings = item.get("review_findings", [])
        if not isinstance(review_findings, list):
            review_findings = []
        updated_at = self._restore_datetime(item.get("updated_at")) or now
        return Job(
            task=task,
            state=JobState(item["state"]),
            branch=item.get("branch"),
            pull_request=item.get("pull_request"),
            head_sha=item.get("head_sha"),
            canonical_task_id=item.get("canonical_task_id"),
            producer_identity=item.get("producer_identity"),
            initial_base_sha=item.get("initial_base_sha"),
            latest_verified_sha=item.get("latest_verified_sha"),
            predecessor_pull_request=item.get("predecessor_pull_request"),
            successor_pull_request=item.get("successor_pull_request"),
            changed_path_fingerprint=item.get("changed_path_fingerprint"),
            attempts=int(item.get("attempts", 0)),
            repair_attempts=int(item.get("repair_attempts", 0)),
            quality_repairs=int(item.get("quality_repairs", 0)),
            last_error=item.get("last_error"),
            next_attempt_at=self._load_next_attempt_at(item.get("next_attempt_at"), now),
            failure_counts=restored_failure_counts,
            last_failure_kind=item.get("last_failure_kind"),
            last_failure_fingerprint=item.get("last_failure_fingerprint"),
            repeated_failure_count=int(item.get("repeated_failure_count", 0)),
            quarantine_reason=item.get("quarantine_reason"),
            quarantined_at=self._restore_datetime(item.get("quarantined_at")),
            quarantine_notification_pending=bool(
                item.get("quarantine_notification_pending", False)
            ),
            factory_generation=str(item.get("factory_generation", "unknown")),
            implementation_provider=item.get("implementation_provider"),
            review_provider=item.get("review_provider"),
            security_provider=item.get("security_provider"),
            last_provider_failure=item.get("last_provider_failure"),
            provider_failover_count=int(item.get("provider_failover_count", 0)),
            review_findings=[str(value) for value in review_findings],
            provider_history=self._restore_provider_history(item.get("provider_history", [])),
            updated_at=updated_at,
        )

    @staticmethod
    def _restore_triage_tags(value: object) -> frozenset[str]:
        if isinstance(value, list | tuple | set | frozenset):
            return frozenset(str(tag) for tag in value)
        if isinstance(value, str) and value.startswith("frozenset(") and value.endswith(")"):
            inner = value[len("frozenset(") : -1]
            if not inner:
                return frozenset()
            try:
                parsed = ast.literal_eval(inner)
            except (SyntaxError, ValueError):
                return frozenset()
            if isinstance(parsed, list | tuple | set | frozenset):
                return frozenset(str(tag) for tag in parsed)
        return frozenset()

    @staticmethod
    def _restore_datetime(value: object) -> datetime | None:
        if not isinstance(value, str):
            return None
        try:
            restored = datetime.fromisoformat(value)
        except ValueError:
            return None
        return restored if restored.tzinfo is not None else restored.replace(tzinfo=UTC)

    @staticmethod
    def _restore_provider_history(
        value: object,
    ) -> list[dict[str, str | int | float | bool | None]]:
        if not isinstance(value, list):
            return []
        history: list[dict[str, str | int | float | bool | None]] = []
        for entry in value[-MAX_PROVIDER_HISTORY:]:
            if not isinstance(entry, dict):
                continue
            restored: dict[str, str | int | float | bool | None] = {}
            for key, item in entry.items():
                if isinstance(key, str) and (
                    item is None or isinstance(item, str | int | float | bool)
                ):
                    restored[key] = item
            history.append(restored)
        return history

    def _stamp(self, job: Job) -> None:
        if self.factory_generation != "unknown":
            job.factory_generation = self.factory_generation

    def _save_raw(self, jobs: dict[str, Job]) -> None:
        """Persist already-normalized jobs without applying retry policy again."""

        serialised = []
        for job in jobs.values():
            self._stamp(job)
            item = asdict(job)
            item["task"]["triage_tags"] = sorted(job.task.triage_tags)
            item["state"] = job.state.value
            item["updated_at"] = job.updated_at.isoformat()
            item["next_attempt_at"] = (
                job.next_attempt_at.isoformat() if job.next_attempt_at else None
            )
            serialised.append(item)
        atomic_write_json(
            self.path,
            {"jobs": serialised},
            validator=_is_job_payload,
        )

    @staticmethod
    def _retry_transition_changed(previous: Job | None, current: Job) -> bool:
        """Return whether a failure represents a newly completed attempt.

        `save()` is also used by reconciliation and tests to persist whole snapshots.
        Reloading and saving an unchanged failed job must not increment durable failure
        counters or push its cooldown farther into the future. Attempts, error text, or
        the transition timestamp changing are enough evidence that a new attempt was
        completed and should be accounted for exactly once.
        """

        if previous is None:
            return True
        return (
            previous.attempts != current.attempts
            or previous.last_error != current.last_error
            or previous.updated_at != current.updated_at
        )

    def save(self, jobs: dict[str, Job]) -> None:
        """Persist a full snapshot through the canonical retry-policy boundary.

        Historically `run_once()` wrote snapshots through this method while worker
        transitions used `save_job()`. That allowed the former path to persist the
        pipeline's legacy fixed exponential delay without failure classification,
        fingerprinting, or deterministic jitter. Every public JobStore save now
        normalizes a newly failed attempt through the same policy before persistence.
        """

        with self._process_lock, self.file_lock:
            self._assert_generation_current()
            previous_jobs = self._load()
            for task_id, job in jobs.items():
                previous = previous_jobs.get(task_id)
                if job.last_error and job.attempts > 0:
                    if self._retry_transition_changed(previous, job):
                        self._apply_retry_policy(previous, job)
                    continue
                if previous is not None and self._made_meaningful_progress(previous, job):
                    reset_retry_diagnostics(job)
            self._save_raw(jobs)

    @staticmethod
    def _made_meaningful_progress(previous: Job, current: Job) -> bool:
        """Return whether durable execution moved rather than merely being polled.

        CI-pending and merge-queued states can be revisited many times without any
        repository or state change. Those polls must not erase retry diagnostics.
        A state transition, branch change, or reviewed head change is real progress.
        """

        return (
            previous.state is not current.state
            or previous.branch != current.branch
            or previous.head_sha != current.head_sha
        )

    def _apply_retry_policy(
        self,
        previous: Job | None,
        job: Job,
        *,
        now: datetime | None = None,
    ) -> None:
        """Attach restart-safe retry accounting immediately before durable save."""

        if job.state in {JobState.DONE, JobState.QUARANTINED}:
            return
        if (
            previous is not None
            and job.attempts == previous.attempts
            and job.next_attempt_at is not None
        ):
            # Provider exhaustion and capacity pressure deliberately schedule a
            # retry without consuming a task attempt. Preserve that provider-aware
            # deadline instead of reclassifying an older task failure and extending
            # its backoff again.
            return
        if job.last_error and job.attempts > 0:
            class_retry_count = record_failure_diagnostics(job, job.last_error)
            if (
                self.max_repeated_failures is not None
                and job.repeated_failure_count >= self.max_repeated_failures
            ):
                job.state = JobState.QUARANTINED
                job.next_attempt_at = None
                job.quarantine_reason = (
                    f"Repeated {job.last_failure_kind or 'task'} failure reached the "
                    f"configured limit of {self.max_repeated_failures}"
                )
                job.quarantined_at = now or datetime.now(UTC)
                job.quarantine_notification_pending = True
                return
            fingerprint = job.last_failure_fingerprint or "unknown"
            delay = deterministic_backoff(
                class_retry_count,
                jitter_key=f"{job.task.identifier}:{fingerprint}",
            )
            job.next_attempt_at = (now or datetime.now(UTC)) + delay
            return
        if previous is not None and self._made_meaningful_progress(previous, job):
            reset_retry_diagnostics(job)

    def save_job(self, job: Job) -> None:
        """Merge one completed worker transition without losing sibling jobs."""
        with self._process_lock, self.file_lock:
            self._assert_generation_current()
            jobs = self._load()
            previous = jobs.get(job.task.identifier)
            if job.last_error and job.attempts > 0:
                if self._retry_transition_changed(previous, job):
                    self._apply_retry_policy(previous, job)
            elif previous is not None and self._made_meaningful_progress(previous, job):
                reset_retry_diagnostics(job)
            self._stamp(job)
            jobs[job.task.identifier] = job
            self._save_raw(jobs)

    def save_reconciled_jobs(self, reconciled: list[Job]) -> None:
        """Merge inactive jobs retired by one control-plane reconciliation pass.

        The caller excludes live worker identifiers before collecting this batch.
        Loading and writing the full durable queue once preserves concurrent sibling
        transitions without turning a large stale-worktree cleanup into one complete
        queue rewrite per retired job.
        """

        if not reconciled:
            return
        with self._process_lock, self.file_lock:
            self._assert_generation_current()
            jobs = self._load()
            for job in reconciled:
                self._stamp(job)
                jobs[job.task.identifier] = job
            self._save_raw(jobs)

    def recover_abandoned_attempts(
        self,
        protected_task_ids: set[str],
        max_age: timedelta,
        *,
        now: datetime | None = None,
    ) -> list[str]:
        """Back off durable worker states abandoned by a previous daemon generation.

        Live futures are passed as ``protected_task_ids`` and can never be touched by
        the watchdog. Only execution states that require an active worker are
        recoverable; CI-pending and merge-queued jobs are polling states and are left
        alone even when old. Recovery preserves the job state/worktree, records a
        task-timeout diagnostic, and schedules the next attempt through the same
        restart-stable per-failure-class policy as an ordinary worker failure.
        """

        current = now or datetime.now(UTC)
        threshold = current - max_age
        recovered: list[str] = []
        with self._process_lock, self.file_lock:
            self._assert_generation_current()
            jobs = self._load()
            for task_id, job in jobs.items():
                if task_id in protected_task_ids:
                    continue
                if job.state not in RECOVERABLE_ACTIVE_STATES:
                    continue
                if job.updated_at > threshold:
                    continue
                job.attempts += 1
                job.last_error = (
                    f"Watchdog recovered abandoned {job.state.value} attempt after "
                    "maximum task duration"
                )
                job.updated_at = current
                self._apply_retry_policy(None, job, now=current)
                recovered.append(task_id)
            if recovered:
                self._save_raw(jobs)
        return sorted(recovered, key=lambda identifier: (not identifier.isdigit(), identifier))

    @staticmethod
    def _reset_legacy_quarantine(job: Job, now: datetime) -> None:
        """Reset either a legacy quarantine or an operator-approved task circuit."""
        job.state = JobState.DISCOVERED
        job.attempts = 0
        job.repair_attempts = 0
        job.quality_repairs = 0
        job.next_attempt_at = None
        job.last_error = None
        job.failure_counts.clear()
        job.last_failure_kind = None
        job.last_failure_fingerprint = None
        job.repeated_failure_count = 0
        job.quarantine_reason = None
        job.quarantined_at = None
        job.quarantine_notification_pending = False
        job.last_provider_failure = None
        job.review_findings.clear()
        job.updated_at = now

    def reconcile(self, tasks: list[Task]) -> dict[str, Job]:
        with self._process_lock, self.file_lock:
            self._assert_generation_current()
            jobs = self._load()
            now = datetime.now(UTC)

            for persisted_job in jobs.values():
                self._stamp(persisted_job)
                if (
                    persisted_job.state is JobState.QUARANTINED
                    and persisted_job.quarantine_reason is None
                ):
                    self._reset_legacy_quarantine(persisted_job, now)

            for task in tasks:
                existing = jobs.get(task.identifier)
                if existing is None:
                    job = Job(task=task)
                    self._stamp(job)
                    jobs[task.identifier] = job
                    continue
                existing.task = task
                self._stamp(existing)
                closed_issue_reopened = (
                    existing.state is JobState.DONE
                    and existing.pull_request is None
                    and existing.last_error == "Issue closed before pull request creation"
                )
                closed_pull_request_reopened = (
                    existing.state is JobState.DONE
                    and task.source == "github-pull-request"
                    and existing.last_error
                    == "Pull request closed before the factory finished with it"
                )
                if closed_issue_reopened or closed_pull_request_reopened:
                    existing.state = JobState.DISCOVERED
                    existing.attempts = 0
                    existing.repair_attempts = 0
                    existing.quality_repairs = 0
                    existing.next_attempt_at = None
                    existing.last_error = None
                    existing.failure_counts.clear()
                    existing.last_failure_kind = None
                    existing.last_failure_fingerprint = None
                    existing.repeated_failure_count = 0
                    existing.updated_at = now
            self._save_raw(jobs)
            return jobs

    def requeue_quarantined(self, task_ids: set[str]) -> list[str]:
        """Reset durable quarantine state for an explicit operator-selected set."""

        requeued: list[str] = []
        now = datetime.now(UTC)
        with self._process_lock, self.file_lock:
            self._assert_generation_current()
            jobs = self._load()
            for task_id in sorted(task_ids, key=lambda value: (not value.isdigit(), value)):
                job = jobs.get(task_id)
                if job is None or job.state is not JobState.QUARANTINED:
                    continue
                self._reset_legacy_quarantine(job, now)
                requeued.append(task_id)
            if requeued:
                self._save_raw(jobs)
        return requeued
