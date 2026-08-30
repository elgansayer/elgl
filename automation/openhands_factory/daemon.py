"""Continuously supervised, pause-aware factory loop."""

from __future__ import annotations

import logging
import signal
import time
from collections import Counter
from collections.abc import Callable, Mapping
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from datetime import UTC, datetime, timedelta
from functools import partial
from pathlib import Path
from threading import Semaphore, Thread

from filelock import FileLock, Timeout

from openhands_factory.agents.base import ProviderHealth
from openhands_factory.agents.router import AgentRouter
from openhands_factory.architecture_guard import assert_single_owner
from openhands_factory.config import FactoryConfig
from openhands_factory.controlled_recovery import recover_due_quarantines
from openhands_factory.doctor import disk_space_checks, no_pr_progress_check
from openhands_factory.exceptions import FactoryError, ProviderCapacityUnavailable
from openhands_factory.generation import (
    FACTORY_RUNTIME_VERSION,
    FactoryGeneration,
    activate_generation,
    assert_generation_current,
)
from openhands_factory.host_diagnostics import gather_diagnostics
from openhands_factory.issue_admission import IssueAdmissionGate
from openhands_factory.models import Job, JobState
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.recovery_retention import prune_recovery_archives
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


def release_review_capacity_after(
    router: AgentRouter,
    task_id: str,
    _future: Future[Job | None],
) -> None:
    """Release a review reservation regardless of worker completion outcome."""

    router.release_review_capacity(task_id)


def is_review_lane_job(job: Job) -> bool:
    """Return whether a job is advancing an existing or immediately ready PR."""

    return (
        job.task.source == "github-pull-request"
        or job.pull_request is not None
        or job.state is JobState.PR_DRAFT
    )


def is_new_github_issue(job: Job) -> bool:
    """Return whether the job is entering the Factory from issue discovery."""

    return job.state is JobState.DISCOVERED and job.task.source == "github-issue"


# Lower value = closer to merged. Within a review-lane priority tier, jobs
# nearer the end of the pipeline are scheduled first so PRs that are already
# clean (no conflicts, no repair needed) merge and clear out ahead of PRs
# still stuck earlier in review/repair.
_REVIEW_STATE_ORDER = {
    JobState.MERGE_QUEUED: 0,
    JobState.READY_TO_MERGE: 1,
    JobState.CI_PENDING: 2,
    JobState.REVIEWING: 3,
    JobState.QUALITY_REPAIRING: 4,
    JobState.REPAIRING: 5,
    JobState.PR_DRAFT: 6,
}


def select_issue_admitted(
    candidates: list[Job],
    limit: int,
    new_issue_slots: int | None,
) -> list[Job]:
    """Fill capacity with progressing work before bounded new issue intake."""

    if limit <= 0:
        return []
    if new_issue_slots is None:
        return candidates[:limit]

    progressing = [job for job in candidates if not is_new_github_issue(job)]
    discovered_issues = [job for job in candidates if is_new_github_issue(job)]
    selected = progressing[:limit]
    remaining = max(0, limit - len(selected))
    selected.extend(discovered_issues[: min(remaining, max(0, new_issue_slots))])
    return selected


def select_batch(
    jobs: dict[str, Job],
    limit: int,
    excluded_task_ids: set[str] | None = None,
    now: datetime | None = None,
    new_issue_slots: int | None = None,
    review_first: bool = True,
    review_lane_max_concurrent: int = 1,
) -> list[Job]:
    if limit <= 0:
        return []
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

    active_review_count = sum(
        1 for item in jobs.values() if item.task.identifier in excluded and is_review_lane_job(item)
    )
    review_capacity = max(0, review_lane_max_concurrent - active_review_count)

    remaining = [item for item in candidates if not is_review_lane_job(item)]
    review_ready = sorted(
        (item for item in candidates if is_review_lane_job(item)),
        key=lambda item: (
            item.task.priority,
            _REVIEW_STATE_ORDER.get(item.state, len(_REVIEW_STATE_ORDER)),
            int(item.task.identifier),
        ),
    )[:review_capacity]

    if not review_ready:
        return select_issue_admitted(remaining, limit, new_issue_slots)

    if review_first:
        # Submit the merge-queue lane first, up to review_lane_max_concurrent jobs
        # in flight at once. The router reserves provider capacity for these jobs
        # before issue workers can consume every healthy subscription.
        issue_capacity = max(0, limit - len(review_ready))
        return [*review_ready, *select_issue_admitted(remaining, issue_capacity, new_issue_slots)]

    selected = select_issue_admitted(remaining, limit, new_issue_slots)
    free_capacity = limit - len(selected)
    if free_capacity <= 0:
        return selected
    selected.extend(review_ready[:free_capacity])
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


def await_refresh(
    future: Future[tuple[dict[str, Job], float]],
    publish_heartbeat: Callable[[], None],
    heartbeat_seconds: float = 10.0,
) -> tuple[dict[str, Job], float]:
    """Keep daemon liveness current while control-plane reconciliation blocks."""

    while True:
        try:
            return future.result(timeout=heartbeat_seconds)
        except FutureTimeoutError:
            if future.done():
                # A completed refresh may itself have raised TimeoutError. Do not
                # misreport that failure as an ordinary heartbeat interval.
                return future.result()
            publish_heartbeat()


def stall_alert_decision(
    *,
    storage_blocked: bool,
    no_pr_progress_warning: bool,
    no_pr_progress_detail: str,
    stall_since: datetime | None,
    now: datetime,
    stall_alert_minutes: float,
    already_dispatched: bool,
) -> tuple[datetime | None, str | None]:
    """Pure decision: is this a stall, how long has it run, should it alert now.

    Returns (updated_stall_since, alert_reason). alert_reason is non-None only
    once the stall has persisted at least stall_alert_minutes and no alert has
    already been dispatched for this continuous episode (already_dispatched) -
    the caller tracks that flag and must reset it once stall_since comes back
    None, so a later, distinct episode can alert again.
    """
    stalled = storage_blocked or no_pr_progress_warning
    if not stalled:
        return None, None
    since = stall_since or now
    elapsed_minutes = (now - since).total_seconds() / 60
    if elapsed_minutes < stall_alert_minutes or already_dispatched:
        return since, None
    reasons = []
    if storage_blocked:
        reasons.append("storage reserve blocked")
    if no_pr_progress_warning:
        reasons.append(no_pr_progress_detail)
    reason = f"Scheduling has been stalled for {elapsed_minutes:.0f} minutes: " + "; ".join(reasons)
    return since, reason


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
        self.issue_admission = self._issue_admission_gate(config)
        self.verification_slots = Semaphore(1)
        self.provider_health: dict[str, ProviderHealth] = {}
        self.storage_blocked = False
        self.stall_since: datetime | None = None
        self.stall_investigation_dispatched = False

    @staticmethod
    def _issue_admission_gate(config: FactoryConfig) -> IssueAdmissionGate:
        return IssueAdmissionGate(
            config.state_dir / "issue-admissions.json",
            interval_seconds=config.new_issue_interval_seconds,
            max_admissions=config.new_issues_per_interval,
        )

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

    def _check_stall(self) -> None:
        """Notice a stall that has persisted past stall_alert_minutes and
        dispatch a best-effort Telegram alert plus AI investigation.

        Two independent signals, either sufficient on its own: storage_blocked
        (this daemon's own scheduling gate) and no_pr_progress_check (whether
        any job with an open PR has moved in max_no_pr_hours) - the latter
        catches stall causes this daemon has no specific detector for. Neither
        signal was previously evaluated proactively; both were only checkable
        on demand via `hellotalk-factory doctor`, so a real stall produced no
        notification until an operator happened to look.
        """
        no_pr_progress = no_pr_progress_check(self.config)
        self.stall_since, reason = stall_alert_decision(
            storage_blocked=self.storage_blocked,
            no_pr_progress_warning=no_pr_progress.warning,
            no_pr_progress_detail=no_pr_progress.detail,
            stall_since=self.stall_since,
            now=datetime.now(UTC),
            stall_alert_minutes=self.config.stall_alert_minutes,
            already_dispatched=self.stall_investigation_dispatched,
        )
        if self.stall_since is None:
            self.stall_investigation_dispatched = False
        if reason is None:
            return
        self.stall_investigation_dispatched = True
        LOGGER.warning("factory.stall_detected reason=%s", reason)
        diagnostics = gather_diagnostics(self.config.state_dir)
        Thread(
            target=self.pipeline.run_stall_investigation,
            args=(reason, diagnostics),
            daemon=True,
            name="factory-stall-investigation",
        ).start()

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
        self.issue_admission = self._issue_admission_gate(self.config)
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
        next_prune_at = 0.0
        architect_future: Future[None] | None = None
        architect_retry_not_before: datetime | None = None
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
            ThreadPoolExecutor(max_workers=1, thread_name_prefix="factory-control") as control,
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
                # storage_ready and everything in this block must run
                # unconditionally, before the scheduling gate below and
                # regardless of pause/capacity state: pruning is what's
                # supposed to correct a low-disk state, and the stall check
                # is what's supposed to notice when it or anything else
                # hasn't. Gating either behind storage_ready/scheduling (as
                # an earlier version of the pruning fix did) deadlocks -
                # once blocked, nothing ever runs to notice or unblock it.
                storage_ready = self._storage_ready()
                prune_now = time.monotonic()
                if prune_now >= next_prune_at:
                    next_prune_at = prune_now + self.config.cooldown_seconds
                    pruned = prune_recovery_archives(
                        self.config.recovery_dir,
                        timedelta(hours=self.config.recovery_retention_hours),
                    )
                    if pruned:
                        LOGGER.info(
                            "Pruned %d recovery archive(s) older than %sh",
                            len(pruned),
                            self.config.recovery_retention_hours,
                        )
                    self._check_stall()
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
                        recovered_circuits = recover_due_quarantines(
                            self.pipeline.jobs,
                            recovery_delay=timedelta(
                                minutes=self.config.quarantine_recovery_minutes
                            ),
                        )
                        if recovered_circuits:
                            self.pipeline.request_label_reconciliation()
                        for task_id in recovered_circuits:
                            self.pipeline.tasks.release(task_id)
                            LOGGER.warning(
                                "Released bounded Factory recovery circuit for task %s; "
                                "retry evidence was preserved",
                                task_id,
                            )
                        refresh_future = control.submit(
                            refresh_jobs,
                            self.pipeline,
                            active_task_ids,
                            now,
                            self.config.cooldown_seconds,
                        )
                        jobs, next_refresh_at = await_refresh(
                            refresh_future,
                            lambda: self._write_daemon_state("running", active, active_started_at),
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
                    scheduler_time = datetime.now(UTC)
                    new_issue_slots = self.issue_admission.available_slots(scheduler_time)
                    for job in select_batch(
                        jobs,
                        capacity,
                        active_task_ids,
                        now=scheduler_time,
                        new_issue_slots=new_issue_slots,
                        review_first=self.config.review_lane_first,
                        review_lane_max_concurrent=self.config.review_lane_max_concurrent,
                    ):
                        self._assert_owner()
                        if is_new_github_issue(job) and not self.issue_admission.admit(
                            job.task.identifier, scheduler_time
                        ):
                            LOGGER.info(
                                "New-issue admission interval is full; deferred task %s",
                                job.task.identifier,
                            )
                            continue
                        worker = FactoryPipeline(
                            self.config,
                            verification_slots=self.verification_slots,
                            agent_router=self.pipeline.router,
                        )
                        review_priority = is_review_lane_job(job)
                        reserve_review_slot = (
                            self.config.review_reserve_provider_slot and review_priority
                        )
                        if reserve_review_slot:
                            self.pipeline.router.reserve_review_capacity(job.task.identifier)
                        try:
                            future = workers.submit(worker.run_job, job.task.identifier)
                        except Exception:
                            if reserve_review_slot:
                                self.pipeline.router.release_review_capacity(job.task.identifier)
                            raise
                        if reserve_review_slot:
                            future.add_done_callback(
                                partial(
                                    release_review_capacity_after,
                                    self.pipeline.router,
                                    job.task.identifier,
                                )
                            )
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
                        except ProviderCapacityUnavailable as error:
                            retry = (
                                error.retry_after_seconds or self.config.provider_cooldown_seconds
                            )
                            architect_retry_not_before = datetime.now(UTC) + timedelta(
                                seconds=max(retry, 1)
                            )
                            LOGGER.warning("Architect cycle deferred: %s", error)
                        except Exception:
                            LOGGER.exception("Architect cycle crashed")
                    if (
                        architect_retry_not_before is None
                        or datetime.now(UTC) >= architect_retry_not_before
                    ) and self.pipeline.architect_due():
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
                "issue_admission": self.issue_admission.snapshot(),
                "queue": queue_snapshot(jobs, active_task_ids),
                "providers": provider_status_snapshot(self.provider_health),
            },
        )


def set_paused(config: FactoryConfig, paused: bool) -> None:
    atomic_write_json(config.state_dir / "control.json", {"paused": paused})
