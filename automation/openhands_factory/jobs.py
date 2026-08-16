"""Durable idempotent job state storage."""

from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock

from openhands_factory.models import Job, JobState, Task
from openhands_factory.state import atomic_write_json, read_json


class JobStore:
    _process_lock = Lock()

    def __init__(self, path: Path) -> None:
        self.path = path

    def load(self) -> dict[str, Job]:
        payload = read_json(self.path, {"jobs": []})
        jobs: dict[str, Job] = {}
        now = datetime.now(UTC)
        for item in payload.get("jobs", []):
            task = Task(**item["task"])
            state = JobState(item["state"])
            job = Job(
                task=task,
                state=state,
                branch=item.get("branch"),
                pull_request=item.get("pull_request"),
                head_sha=item.get("head_sha"),
                attempts=int(item.get("attempts", 0)),
                repair_attempts=int(item.get("repair_attempts", 0)),
                quality_repairs=int(item.get("quality_repairs", 0)),
                last_error=item.get("last_error"),
                next_attempt_at=datetime.fromisoformat(item["next_attempt_at"])
                if item.get("next_attempt_at")
                else None,
                updated_at=datetime.fromisoformat(item["updated_at"]),
            )
            # QUARANTINED is retained in JobState only so old durable files remain
            # readable. It is not an operational state. Normalize it immediately on
            # every read so no caller, scheduler path, daemon restart, or doctor run
            # can accidentally preserve an inert job until a later reconcile cycle.
            if job.state is JobState.QUARANTINED:
                self._reset_legacy_quarantine(job, now)
            jobs[task.identifier] = job
        return jobs

    def save(self, jobs: dict[str, Job]) -> None:
        serialised = []
        for job in jobs.values():
            item = asdict(job)
            item["state"] = job.state.value
            item["updated_at"] = job.updated_at.isoformat()
            item["next_attempt_at"] = (
                job.next_attempt_at.isoformat() if job.next_attempt_at else None
            )
            serialised.append(item)
        atomic_write_json(self.path, {"jobs": serialised})

    def save_job(self, job: Job) -> None:
        """Merge one completed worker transition without losing sibling jobs."""
        with self._process_lock:
            jobs = self.load()
            jobs[job.task.identifier] = job
            self.save(jobs)

    @staticmethod
    def _reset_legacy_quarantine(job: Job, now: datetime) -> None:
        """Migrate the removed terminal quarantine state back into the retry pipeline."""
        job.state = JobState.DISCOVERED
        job.attempts = 0
        job.repair_attempts = 0
        job.quality_repairs = 0
        job.next_attempt_at = None
        job.last_error = None
        job.updated_at = now

    def reconcile(self, tasks: list[Task]) -> dict[str, Job]:
        with self._process_lock:
            jobs = self.load()
            now = datetime.now(UTC)

            # load() already normalizes every legacy quarantine record. Keep this
            # defensive pass so an in-memory caller can never persist quarantine as
            # terminal during reconciliation either.
            for persisted_job in jobs.values():
                if persisted_job.state is JobState.QUARANTINED:
                    self._reset_legacy_quarantine(persisted_job, now)

            for task in tasks:
                existing = jobs.get(task.identifier)
                if existing is None:
                    jobs[task.identifier] = Job(task=task)
                    continue
                existing.task = task
                if (
                    existing.state is JobState.DONE
                    and existing.pull_request is None
                    and existing.last_error == "Issue closed before pull request creation"
                ):
                    existing.state = JobState.DISCOVERED
                    existing.attempts = 0
                    existing.repair_attempts = 0
                    existing.quality_repairs = 0
                    existing.next_attempt_at = None
                    existing.last_error = None
                    existing.updated_at = now
            self.save(jobs)
            return jobs
