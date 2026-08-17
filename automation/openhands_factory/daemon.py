"""Continuously supervised, pause-aware factory loop."""

from __future__ import annotations

import logging
import signal
import time
from collections import Counter
from collections.abc import Mapping
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Semaphore

from filelock import FileLock, Timeout

from openhands_factory.agents.base import ProviderHealth
from openhands_factory.architecture_guard import assert_single_owner
from openhands_factory.config import FactoryConfig
from openhands_factory.controlled_recovery import recover_due_quarantines
from openhands_factory.doctor import disk_space_checks
from openhands_factory.exceptions import FactoryError
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
MAX_ACTIONABLE_BLOCKED_TASKS = 5
MAX_ACTIONABLE_FAILURE_FINGERPRINTS = 5


def provider_status_snapshot(
    health: Mapping[str, ProviderHealth],
) -> list[dict[str, object]]:
    """Return the non-secret provider fields suitable for operator status."""

    return [
        {
            "name": name,
            "status": item.status.value,
            "checked_at": item.checked_at.isoformat(),
            "retry_after": item.retry_after.isoformat() if item.retry_after is not None else None,
        }
        for name, item in sorted(health.items())
    ]


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
    selected = candidates[:limit]
    if limit <= 1 or any(item.task.source == "github-pull-request" for item in selected):
        return selected

    review_is_active = any(
        item.task.identifier in excluded and item.task.source == "github-pull-request"
        for item in jobs.values()
    )
    if review_is_active:
        return selected

    review = next(
        (item for item in candidates if item.task.source == "github-pull-request"),
        None,
    )
    if review is not None:
        # Keep one of multiple worker slots moving the merge queue even when a
        # large critical-issue backlog would otherwise starve every PR review.
        selected[-1] = review
    return selected


def refresh_jobs(
    pipeline: FactoryPipeline,
    protected_task_ids: set[str],
    now: float,
    cooldown_seconds: int,
) -> tuple[dict[str, Job], float]:
    """Refresh GitHub work without turning a control-plane outage into a crash."""

    try:
        return pipeline.refresh(protected_task_ids), now + cooldown_seconds
    except FactoryError as error:
        LOGGER.warning("Factory refresh deferred after control-plane failure: %s", error)
        return pipeline.jobs.load(), now + max(cooldown_seconds, 30)


def queue_snapshot(
    jobs: dict[str, Job],
    active_task_ids: set[str] | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    """Summarize the queue into restart-safe operator-facing daemon state."""

    active = active_task_ids or set()
    current = now or datetime.now(UTC)
    state_counts = Counter(job.state.value for job in jobs.values())
    non_terminal = [job for job in jobs.values() if job.state.value not in {"done", "quarantined"}]
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
    quarantined = [job for job in jobs.values() if job.state.value == "quarantined"]
    blocked = sorted(
        [*backing_off, *quarantined],
        key=lambda job: (job.updated_at, job.task.identifier),
    )
    failure_fingerprints = Counter(
        job.last_failure_fingerprint for job in blocked if job.last_failure_fingerprint is not None
    )
    top_failure_fingerprints = [
        {"fingerprint": fingerprint, "count": count}
        for fingerprint, count in sorted(
            failure_fingerprints.items(),
            key=lambda item: (-item[1], item[0]),
        )[:MAX_ACTIONABLE_FAILURE_FINGERPRINTS]
    ]
    oldest_blocked_tasks = [
        {
            "task_id": job.task.identifier,
            "state": job.state.value,
            "updated_at": job.updated_at.isoformat(),
            "next_attempt_at": (
                job.next_attempt_at.isoformat() if job.next_attempt_at is not None else None
            ),
            "quarantined_at": (
                job.quarantined_at.isoformat() if job.quarantined_at is not None else None
            ),
            "failure_fingerprint": job.last_failure_fingerprint,
        }
        for job in blocked[:MAX_ACTIONABLE_BLOCKED_TASKS]
    ]
    return {
        "total_jobs": len(jobs),
        "active_count": len(active),
        "runnable_count": len(runnable),
        "backing_off_count": len(backing_off),
        "quarantined_count": len(quarantined),
        "blocked_count": len(blocked),
        "top_failure_fingerprints": top_failure_fingerprints,
        "oldest_blocked_tasks": oldest_blocked_tasks,
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
        self.provider_health: dict[str, ProviderHealth] = {}
        self.storage_blocked = False

    @property
    def control_path(self) -> Path:
        return self.config.state_dir / "control.json"

    def request_stop(self, signum: int, frame: object) -> None:
        self.stopping = True
        from openhands_factory.agents.process import AgentProcessRunner
        from openhands_factory.conversation_runner import ConversationRunner
        from openhands_factory.repository_guard import request_process_shutdown

        self.pipeline.router.shutdown()
        AgentProcessRunner.request_shutdown()
        ConversationRunner.request_shutdown()
        request_process_shutdown()

    def paused(self) -> bool:
        return bool(read_json(self.control_path, {"paused": False}).get("paused", False))

    def _storage_ready(self) -> bool:
        failed = [check for check in disk_space_checks(self.config) if not check.passed]
        blocked = bool(failed)
        if blocked and not self.storage_blocked:
            LOGGER.warning(
                "Factory scheduling paused by storage reserve: %s",
                "; ".join(check.detail for check in failed),
            )
        elif not blocked and self.storage_blocked:
            LOGGER.info("Factory storage reserve recovered; scheduling can resume")
        self.storage_blocked = blocked
        return not blocked

    def _activate_generation(self) -> None:
        from openhands_factory.agents.process import AgentProcessRunner
        from openhands_factory.conversation_runner import ConversationRunner
        from openhands_factory.repository_guard import reset_process_shutdown

        AgentProcessRunner.reset_shutdown()
        ConversationRunner.reset_shutdown()
        reset_process_shutdown()
        generation = FactoryGeneration.create()
        activate_generation(self.config.state_dir, generation)
        self.generation = generation
        # The configured architecture generation has already been validated by
        # FactoryConfig. This runtime identifier is a separate per-daemon ownership
        # token used by JobStore/TaskStore to stop stale processes writing state.
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
                # Fail before durable generation takeover if the active checkout has
                # resurrected a known autonomous swarm workflow.
                assert_single_owner(self.config.repository)
                from openhands_factory.doctor import startup_security_checks

                failed_security = [
                    check for check in startup_security_checks(self.config) if not check.passed
                ]
                if failed_security:
                    for check in failed_security:
                        LOGGER.error("Factory startup security check failed: %s", check.name)
                    return 1
                self._activate_generation()
                if not self.pipeline.router.has_usable_provider():
                    LOGGER.warning(
                        "No configured agent provider is currently usable; "
                        "the daemon will keep jobs recoverable and retry health checks"
                    )
                return self._loop()
        except Timeout:
            LOGGER.error("Another factory daemon owns the repository lock")
            return 2
        except Exception:
            LOGGER.exception("Factory daemon reached an ultimate failure")
            return 1

    def _loop(self) -> int:
        active: dict[Future[Job | None], str] = {}
        active_started_at: dict[str, str] = {}
        next_refresh_at = 0.0
        architect_future: Future[None] | None = None
        # Publish liveness before the first provider probe and GitHub refresh.
        # A large queue can make that first scheduling cycle slower than the
        # watchdog interval, but the daemon already owns its generation here.
        self._write_daemon_state("running", active, active_started_at)
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
                    active_started_at.pop(task_id, None)
                    try:
                        job = future.result()
                    except Exception:
                        LOGGER.exception("Factory worker for task %s crashed", task_id)
                        continue
                    if job is not None:
                        LOGGER.info("Advanced task %s to %s", task_id, job.state.value)
                active_task_ids = set(active.values())
                capacity = self.config.max_parallel_jobs - len(active)
                storage_ready = self._storage_ready()
                if not self.paused() and storage_ready and capacity > 0:
                    now = time.monotonic()
                    if now >= next_refresh_at:
                        health = self.pipeline.router.health_snapshot()
                        self.provider_health = dict(health)
                        LOGGER.info(
                            "Factory provider health: %s",
                            ", ".join(
                                f"{name}={item.status.value}"
                                for name, item in sorted(health.items())
                            ),
                        )
                        recovered_circuits = recover_due_quarantines(self.pipeline.jobs)
                        for task_id in recovered_circuits:
                            self.pipeline.tasks.release(task_id)
                            LOGGER.warning(
                                "Released bounded Factory recovery circuit for task %s; "
                                "retry evidence was preserved",
                                task_id,
                            )
                        jobs, next_refresh_at = refresh_jobs(
                            self.pipeline,
                            active_task_ids,
                            now,
                            self.config.cooldown_seconds,
                        )
                        recovered = self.pipeline.jobs.recover_abandoned_attempts(
                            active_task_ids,
                            timedelta(minutes=self.config.max_task_minutes + 15),
                        )
                        for task_id in recovered:
                            self.pipeline.tasks.release(task_id)
                            LOGGER.warning(
                                "Recovered abandoned Factory attempt for task %s; "
                                "retry is backed off",
                                task_id,
                            )
                        if recovered:
                            jobs = self.pipeline.jobs.load()
                    else:
                        jobs = self.pipeline.jobs.load()
                    for job in select_batch(jobs, capacity, active_task_ids):
                        self._assert_owner()
                        worker = FactoryPipeline(
                            self.config,
                            verification_slots=self.verification_slots,
                            agent_router=self.pipeline.router,
                        )
                        future = workers.submit(worker.run_job, job.task.identifier)
                        active[future] = job.task.identifier
                        active_started_at[job.task.identifier] = datetime.now(UTC).isoformat()
                        LOGGER.info("Scheduled task %s", job.task.identifier)
                if (
                    not self.paused()
                    and storage_ready
                    and (architect_future is None or architect_future.done())
                ):
                    if architect_future is not None:
                        try:
                            architect_future.result()
                        except Exception:
                            LOGGER.exception("Architect cycle crashed")
                    if self.pipeline.architect_due():
                        self._assert_owner()
                        LOGGER.info("Scheduling weekly architect cycle")
                        architect_worker = FactoryPipeline(
                            self.config,
                            agent_router=self.pipeline.router,
                        )
                        architect_future = architect.submit(architect_worker.run_architect_cycle)
                self._write_daemon_state("running", active, active_started_at)
                time.sleep(min(self.config.cooldown_seconds, 10))
        # ThreadPoolExecutor has drained every future before leaving the context.
        # Do not persist stale task identifiers as active in the stopped snapshot.
        self._write_daemon_state("stopped", {}, {})
        return 0

    def _write_daemon_state(
        self,
        status: str,
        active: dict[Future[Job | None], str],
        active_started_at: dict[str, str] | None = None,
    ) -> None:
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
                "paused": self.paused(),
                "storage_blocked": self.storage_blocked,
                "active_jobs": sorted(active_task_ids, key=int),
                "active_started_at": active_started_at or {},
                "queue": queue_snapshot(jobs, active_task_ids),
                "providers": provider_status_snapshot(self.provider_health),
            },
        )


def set_paused(config: FactoryConfig, paused: bool) -> None:
    atomic_write_json(config.state_dir / "control.json", {"paused": paused})
