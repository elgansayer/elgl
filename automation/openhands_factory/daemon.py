"""Continuously supervised, pause-aware factory loop."""

from __future__ import annotations

import logging
import signal
import time
from pathlib import Path

from filelock import FileLock, Timeout

from openhands_factory.alerts import AlertService
from openhands_factory.config import FactoryConfig
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.state import atomic_write_json, read_json
from openhands_factory.task_source import TaskStore

LOGGER = logging.getLogger(__name__)


class FactoryDaemon:
    def __init__(self, config: FactoryConfig) -> None:
        self.config = config
        self.stopping = False
        self.tasks = TaskStore(config.state_dir)
        self.alerts = AlertService(config)
        self.pipeline = FactoryPipeline(config)

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
        while not self.stopping:
            if self.paused():
                time.sleep(min(self.config.cooldown_seconds, 30))
                continue
            job = self.pipeline.run_once()
            if job is not None:
                LOGGER.info("Advanced task %s to %s", job.task.identifier, job.state.value)
            time.sleep(self.config.cooldown_seconds)
        atomic_write_json(self.config.state_dir / "daemon.json", {"status": "stopped"})
        return 0


def set_paused(config: FactoryConfig, paused: bool) -> None:
    atomic_write_json(config.state_dir / "control.json", {"paused": paused})
