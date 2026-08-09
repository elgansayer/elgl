"""Durable idempotent job state storage."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
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
        for item in payload.get("jobs", []):
            task = Task(**item["task"])
            jobs[task.identifier] = Job(
                task=task,
                state=JobState(item["state"]),
                branch=item.get("branch"),
                pull_request=item.get("pull_request"),
                head_sha=item.get("head_sha"),
                attempts=int(item.get("attempts", 0)),
                repair_attempts=int(item.get("repair_attempts", 0)),
                last_error=item.get("last_error"),
                updated_at=datetime.fromisoformat(item["updated_at"]),
            )
        return jobs

    def save(self, jobs: dict[str, Job]) -> None:
        serialised = []
        for job in jobs.values():
            item = asdict(job)
            item["state"] = job.state.value
            item["updated_at"] = job.updated_at.isoformat()
            serialised.append(item)
        atomic_write_json(self.path, {"jobs": serialised})

    def save_job(self, job: Job) -> None:
        """Merge one completed worker transition without losing sibling jobs."""
        with self._process_lock:
            jobs = self.load()
            jobs[job.task.identifier] = job
            self.save(jobs)

    def reconcile(self, tasks: list[Task]) -> dict[str, Job]:
        with self._process_lock:
            jobs = self.load()
            for task in tasks:
                jobs.setdefault(task.identifier, Job(task=task))
            self.save(jobs)
            return jobs
