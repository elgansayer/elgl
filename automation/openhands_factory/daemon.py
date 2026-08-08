"""Continuously supervised, pause-aware factory loop."""

from __future__ import annotations

import logging
import signal
import time
from concurrent.futures import Future, ThreadPoolExecutor
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


def select_batch(jobs: dict[str, Job], limit: int) -> list[Job]:
    candidates = [
        job for job in jobs.values() if job.state.value not in {"done", "quarantined"}
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

    def _loop(self) -> int:
        atomic_write_json(self.config.state_dir / "daemon.json", {"status": "running"})
        active: dict[Future[Job | None], str] = {}
        with ThreadPoolExecutor(
            max_workers=self.config.max_parallel_jobs,
            thread_name_prefix="factory-worker",
        ) as workers:
            while not self.stopping:
                for future, task_id in list(active.items()):
                    if not future.done():
                        continue
                    del active[future]
                    job = future.result()
                    if job is not None:
                        LOGGER.info("Advanced task %s to %s", task_id, job.state.value)
                if not self.paused() and not active:
                    jobs = self.pipeline.refresh()
                    for job in select_batch(jobs, self.config.max_parallel_jobs):
                        worker = FactoryPipeline(
                            self.config,
                            verification_slots=self.verification_slots,
                        )
                        future = workers.submit(worker.run_job, job.task.identifier)
                        active[future] = job.task.identifier
                        LOGGER.info("Scheduled task %s", job.task.identifier)
                time.sleep(min(self.config.cooldown_seconds, 10))
        atomic_write_json(self.config.state_dir / "daemon.json", {"status": "stopped"})
        return 0


def set_paused(config: FactoryConfig, paused: bool) -> None:
    atomic_write_json(config.state_dir / "control.json", {"paused": paused})
