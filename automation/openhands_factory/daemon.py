"""Continuously supervised, pause-aware factory loop."""

from __future__ import annotations

import logging
import signal
import time
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from threading import Semaphore

from filelock import FileLock, Timeout

from openhands_factory.alerts import AlertService
from openhands_factory.config import FactoryConfig
from openhands_factory.models import Job
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.state import atomic_write_json, read_json
from openhands_factory.task_source import TaskStore

LOGGER = logging.getLogger(__name__)


def select_batch(
    jobs: dict[str, Job], limit: int, excluded_task_ids: set[str] | None = None
) -> list[Job]:
    excluded = excluded_task_ids or set()
    candidates = [
        job
        for job in jobs.values()
        if job.task.identifier not in excluded and job.state.value not in {"done", "quarantined"}
    ]
    candidates.sort(key=lambda item: (item.task.priority, int(item.task.identifier)))
    return candidates[:limit]


class FactoryDaemon:
    def __init__(self, config: FactoryConfig) -> None:
        self.config = config
        self.stopping = False
        self.tasks = TaskStore(config.state_dir)
        self.alerts = AlertService(config)
        self.pipeline = FactoryPipeline(config)
        self.verification_slots = Semaphore(1)

    @property
    def control_path(self) -> Path:
        return self.config.state_dir / "control.json"

    def request_stop(self, signum: int, frame: object) -> None:
        self.stopping = True

    def paused(self) -> bool:
        return bool(read_json(self.control_path, {"paused": False}).get("paused", False))

    def run(self) -> int:
        signal.signal(signal.SIGTERM, self.request_stop)
        signal.signal(signal.SIGINT, self.request_stop)
        lock = FileLock(str(self.config.state_dir / "factory.lock"))
        try:
            with lock.acquire(timeout=0):
                return self._loop()
        except Timeout:
            LOGGER.error("Another factory daemon owns the repository lock")
            return 2
        except Exception as error:
            LOGGER.exception("Factory daemon reached an ultimate failure")
            self.alerts.send(f"OpenHands factory ultimate failure: daemon stopped: {error}")
            return 1

    def _loop(self) -> int:
        active: dict[Future[Job | None], str] = {}
        next_refresh_at = 0.0
        with ThreadPoolExecutor(
            max_workers=self.config.max_parallel_jobs,
            thread_name_prefix="factory-worker",
        ) as workers:
            while not self.stopping:
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
                        worker = FactoryPipeline(
                            self.config,
                            verification_slots=self.verification_slots,
                        )
                        future = workers.submit(worker.run_job, job.task.identifier)
                        active[future] = job.task.identifier
                        LOGGER.info("Scheduled task %s", job.task.identifier)
                self._write_daemon_state("running", active)
                time.sleep(min(self.config.cooldown_seconds, 10))
        self._write_daemon_state("stopped", active)
        return 0

    def _write_daemon_state(self, status: str, active: dict[Future[Job | None], str]) -> None:
        atomic_write_json(
            self.config.state_dir / "daemon.json",
            {
                "status": status,
                "updated_at": datetime.now(UTC).isoformat(),
                "active_jobs": sorted(active.values(), key=int),
            },
        )


def set_paused(config: FactoryConfig, paused: bool) -> None:
    atomic_write_json(config.state_dir / "control.json", {"paused": paused})
