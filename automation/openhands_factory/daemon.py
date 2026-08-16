"""Continuously supervised, pause-aware factory loop."""

from __future__ import annotations

import logging
import signal
import time
from collections import Counter
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from threading import Semaphore

from filelock import FileLock, Timeout

from openhands_factory.config import FactoryConfig
from openhands_factory.generation import (
    FACTORY_RUNTIME_VERSION,
    FactoryGeneration,
    activate_generation,
    assert_generation_current,
)
from openhands_factory.models import Job
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.state import atomic_write_json, read_json
from openhands_factory.task_source import TaskStore

LOGGER = logging.getLogger(__name__)


def select_batch(
    jobs: dict[str, Job],
    limit: int,
    excluded_task_ids: set[str] | None = None,
    now: datetime | None = None,
) -> list[Job]:
    excluded = excluded_task_ids or set()
    current = now or datetime.now(UTC)
    candidates = [
        job
        for job in jobs.values()
        if job.task.identifier not in excluded
        and job.state.value not in {"done", "quarantined"}
        and (job.next_attempt_at is None or job.next_attempt_at <= current)
    ]
    candidates.sort(key=lambda item: (item.task.priority, int(item.task.identifier)))
    return candidates[:limit]


def queue_snapshot(
    jobs: dict[str, Job],
    active_task_ids: set[str] | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    """Summarize the queue into restart-safe operator-facing daemon state."""

    active = active_task_ids or set()
    current = now or datetime.now(UTC)
    state_counts = Counter(job.state.value for job in jobs.values())
    non_terminal = [
        job for job in jobs.values() if job.state.value not in {"done", "quarantined"}
    ]
    backing_off = [
        job
        for job in non_terminal
        if job.task.identifier not in active
        and job.next_attempt_at is not None
        and job.next_attempt_at > current
    ]
    runnable = [
        job
        for job in non_terminal
        if job.task.identifier not in active
        and (job.next_attempt_at is None or job.next_attempt_at <= current)
    ]
    return {
        "total_jobs": len(jobs),
        "active_count": len(active),
        "runnable_count": len(runnable),
        "backing_off_count": len(backing_off),
        "by_state": dict(sorted(state_counts.items())),
    }


class FactoryDaemon:
    def __init__(self, config: FactoryConfig) -> None:
        self.config = config
        self.stopping = False
        self.generation: FactoryGeneration | None = None
        self.tasks = TaskStore(config.state_dir)
        self.pipeline = FactoryPipeline(config)
        self.verification_slots = Semaphore(1)

    @property
    def control_path(self) -> Path:
        return self.config.state_dir / "control.json"

    def request_stop(self, signum: int, frame: object) -> None:
        self.stopping = True

    def paused(self) -> bool:
        return bool(read_json(self.control_path, {"paused": False}).get("paused", False))

    def _activate_generation(self) -> None:
        generation = FactoryGeneration.create()
        activate_generation(self.config.state_dir, generation)
        self.generation = generation
        self.config = self.config.model_copy(update={"factory_generation": generation.identifier})
        self.tasks = TaskStore(self.config.state_dir)
        self.pipeline = FactoryPipeline(self.config)
        LOGGER.info(
            "Activated Factory generation %s runtime=%s",
            generation.identifier,
            FACTORY_RUNTIME_VERSION,
        )

    def _assert_owner(self) -> None:
        if self.generation is None:
            raise RuntimeError("Factory generation was not activated")
        assert_generation_current(self.config.state_dir, self.generation)

    def run(self) -> int:
        signal.signal(signal.SIGTERM, self.request_stop)
        signal.signal(signal.SIGINT, self.request_stop)
        lock = FileLock(str(self.config.state_dir / "factory.lock"))
        try:
            with lock.acquire(timeout=0):
                self._activate_generation()
                return self._loop()
        except Timeout:
            LOGGER.error("Another factory daemon owns the repository lock")
            return 2
        except Exception:
            # Do not page here. systemd is responsible for automatic restart and the
            # separate watchdog only pages after repeated restart attempts fail.
            LOGGER.exception("Factory daemon reached an ultimate failure")
            return 1

    def _loop(self) -> int:
        active: dict[Future[Job | None], str] = {}
        next_refresh_at = 0.0
        architect_future: Future[None] | None = None
        with (
            ThreadPoolExecutor(
                max_workers=self.config.max_parallel_jobs,
                thread_name_prefix="factory-worker",
            ) as workers,
            ThreadPoolExecutor(max_workers=1, thread_name_prefix="factory-architect") as architect,
        ):
            while not self.stopping:
                self._assert_owner()
                for future, task_id in list(active.items()):
                    if not future.done():
                        continue
                    del active[future]
                    try:
                        job = future.result()
                    except Exception:
                        LOGGER.exception("Factory worker for task %s crashed", task_id)
                        continue
                    if job is not None:
                        LOGGER.info("Advanced task %s to %s", task_id, job.state.value)
                active_task_ids = set(active.values())
                capacity = self.config.max_parallel_jobs - len(active)
                if not self.paused() and capacity > 0:
                    now = time.monotonic()
                    if now >= next_refresh_at:
                        jobs = self.pipeline.refresh(active_task_ids)
                        next_refresh_at = now + self.config.cooldown_seconds
                    else:
                        jobs = self.pipeline.jobs.load()
                    for job in select_batch(jobs, capacity, active_task_ids):
                        self._assert_owner()
                        worker = FactoryPipeline(
                            self.config,
                            verification_slots=self.verification_slots,
                        )
                        future = workers.submit(worker.run_job, job.task.identifier)
                        active[future] = job.task.identifier
                        LOGGER.info("Scheduled task %s", job.task.identifier)
                if not self.paused() and (architect_future is None or architect_future.done()):
                    if architect_future is not None:
                        try:
                            architect_future.result()
                        except Exception:
                            LOGGER.exception("Architect cycle crashed")
                    if self.pipeline.architect_due():
                        self._assert_owner()
                        LOGGER.info("Scheduling weekly architect cycle")
                        architect_worker = FactoryPipeline(self.config)
                        architect_future = architect.submit(architect_worker.run_architect_cycle)
                self._write_daemon_state("running", active)
                time.sleep(min(self.config.cooldown_seconds, 10))
        self._write_daemon_state("stopped", active)
        return 0

    def _write_daemon_state(self, status: str, active: dict[Future[Job | None], str]) -> None:
        self._assert_owner()
        active_task_ids = set(active.values())
        jobs = self.pipeline.jobs.load()
        generation = self.generation
        if generation is None:
            raise RuntimeError("Factory generation was not activated")
        atomic_write_json(
            self.config.state_dir / "daemon.json",
            {
                "status": status,
                "updated_at": datetime.now(UTC).isoformat(),
                "generation": generation.identifier,
                "runtime_version": generation.runtime_version,
                "schema_version": generation.schema_version,
                "pid": generation.pid,
                "hostname": generation.hostname,
                "active_jobs": sorted(active_task_ids, key=int),
                "queue": queue_snapshot(jobs, active_task_ids),
            },
        )


def set_paused(config: FactoryConfig, paused: bool) -> None:
    atomic_write_json(config.state_dir / "control.json", {"paused": paused})
