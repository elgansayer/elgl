"""Recoverable issue-to-merge pipeline for one bounded job transition at a time."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Semaphore
from typing import TYPE_CHECKING
from uuid import uuid4

from pydantic import SecretStr

from openhands_factory.alerts import AlertService
from openhands_factory.architect_report import ArchitectProposal, load_architect_report
from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationRunner, sdk_conversation_factory
from openhands_factory.exceptions import (
    AgentTaskFailure,
    FactoryError,
    ProviderCapacityUnavailable,
    RepositorySafetyError,
    VerificationFailed,
)
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.github import GitHubClient, PullRequestMatch, PullRequestStatus
from openhands_factory.jobs import JobStore
from openhands_factory.mechanical_repair import attempt_mechanical_repair
from openhands_factory.metrics import MetricsStore
from openhands_factory.models import Job, JobState, Lease, Task, changed_path_fingerprint
from openhands_factory.pr_lifecycle import (
    PullRequestLifecycleEvent,
    PullRequestLifecycleTracker,
)
from openhands_factory.prompts import build_phase_prompt, build_system_prompt, build_task_prompt
from openhands_factory.quality_gate import check_quality_gate
from openhands_factory.review_report import validate_review_report
from openhands_factory.state import atomic_write_json, read_json
from openhands_factory.task_source import TaskClaimConflict, TaskStore
from openhands_factory.verification import commands_for, run_verification

if TYPE_CHECKING:
    from openhands_factory.agents.router import AgentRouter

LOGGER = logging.getLogger(__name__)
TERMINAL_STATES = {JobState.DONE, JobState.QUARANTINED}
CODE_MUTATING_AGENT_PHASES = {
    "architecture",
    "implementation",
    "security-review",
    "quality-repair",
    "ci-repair",
}

# A path in one of these categories can never introduce the vulnerability
# classes security.md's checklist scans for (hardcoded secrets, webhook/
# payment trust, privileged-state handling, authz, injection, security
# config) - it has no runtime execution surface at all. Translation content
# files are included deliberately: a locale JSON's *values* are rendered
# strings, never executed or trusted as privileged input.
#
# Test files are deliberately NOT exempt: a test fixture can accidentally
# carry a real secret or credential, and no separate deterministic
# secret-scanner gate covers that class of change, so a hardcoded-secrets
# check still needs to run on them.
_SECURITY_EXEMPT_SUFFIXES = (".md", ".txt")
_SECURITY_EXEMPT_DIR_PARTS = ("i18n", "locales")
_SECURITY_EXEMPT_PATH_PREFIXES = (Path(".agents/skills"),)


def _is_security_review_exempt(changed_paths: set[Path]) -> bool:
    """Whether every changed path is provably outside security.md's scope.

    Deliberately conservative: any single path that isn't docs, translation
    content, or a skill file forces a real security-review agent call.
    False negatives here (running the agent when it wasn't strictly needed)
    are cheap; false positives (skipping a review a diff actually needed)
    are not, so this only skips when every path matches.
    """
    if not changed_paths:
        return False
    for path in changed_paths:
        if path.suffix in _SECURITY_EXEMPT_SUFFIXES:
            continue
        if set(path.parts) & set(_SECURITY_EXEMPT_DIR_PARTS):
            continue
        if any(str(path).startswith(str(prefix)) for prefix in _SECURITY_EXEMPT_PATH_PREFIXES):
            continue
        return False
    return True


class FactoryPipeline:
    def __init__(
        self,
        config: FactoryConfig,
        github: GitHubClient | None = None,
        conversations: ConversationRunner | None = None,
        verification_slots: Semaphore | None = None,
        agent_router: AgentRouter | None = None,
    ) -> None:
        self.config = config
        self.github = github or GitHubClient(
            config.github_repository,
            config.repository,
            config.github_token.get_secret_value(),
            base_branch=config.base_branch,
            require_trusted_intake=config.require_trusted_intake,
            trusted_github_actors=config.trusted_github_actors,
            require_ready_label=config.require_ready_label,
            ready_label=config.ready_label,
        )
        self.jobs = JobStore(
            config.state_dir / "jobs.json",
            max_repeated_failures=config.max_consecutive_failures,
        )
        self.tasks = TaskStore(config.state_dir)
        self.pr_lifecycle = PullRequestLifecycleTracker(
            config.state_dir,
            config.github_repository,
            AlertService(config),
        )
        self.prompt_dir = config.repository / "automation/prompts"
        self.system_prompt = build_system_prompt(self.prompt_dir)
        openhands_settings = config.agents.providers["openhands"]
        openhands_runtime_config = config.model_copy(
            update={
                # The spawned SDK provider never needs control-plane or alerting
                # credentials. Keep only provider authentication in its config so
                # a provider process cannot inherit unrelated GitHub or Telegram
                # authority through multiprocessing serialisation.
                "github_token": SecretStr(""),
                "telegram_bot_token": None,
                "telegram_chat_id": None,
                "gemini_api_key": None,
                "openai_model": openhands_settings.model or config.openai_model,
                "max_conversation_turns": openhands_settings.max_turns,
                "planning_model": (
                    openhands_settings.phase_models.get("architecture")
                    or openhands_settings.phase_models.get("planning")
                    or openhands_settings.phase_models.get("code-review")
                    or openhands_settings.phase_models.get("code_review")
                    or config.planning_model
                ),
                "terminal_execution_model": (
                    openhands_settings.phase_models.get("implementation")
                    or config.terminal_execution_model
                ),
                "bulk_ci_repair_model": (
                    openhands_settings.phase_models.get("ci-repair")
                    or openhands_settings.phase_models.get("ci_repair")
                    or config.bulk_ci_repair_model
                ),
            }
        )
        self.conversations = conversations or ConversationRunner(
            openhands_runtime_config,
            sdk_conversation_factory(openhands_runtime_config),
        )
        # Build the new AgentRouter
        from openhands_factory.agents import (
            AgentHealthStore,
            AgentRouter,
            ClaudeCodeProvider,
            CodexProvider,
            ConfigRoutingPolicy,
            GoogleAgentProvider,
            OpenCodeProvider,
            OpenHandsProvider,
            PiProvider,
        )
        from openhands_factory.agents.base import AgentProvider
        from openhands_factory.provider_capacity import (
            ProviderCapacityStore,
            maximum_agent_lease_seconds,
        )

        self.health_store = AgentHealthStore(config.state_dir / "agent_health.json")

        if agent_router is not None:
            self.router = agent_router
            self.labels_ready = False
            self.verification_slots = verification_slots
            return

        claude = config.agents.providers["claude"]
        codex = config.agents.providers["codex"]
        google = config.agents.providers["google"]
        opencode = config.agents.providers["opencode"]
        openhands = config.agents.providers["openhands"]
        pi = config.agents.providers["pi"]

        providers: list[AgentProvider] = [
            ClaudeCodeProvider(
                enabled=claude.enabled,
                command=claude.command,
                wrapper_command=claude.wrapper_command,
                model=claude.model,
                phase_models=claude.phase_models,
                extra_args=claude.extra_args,
                max_turns=claude.max_turns,
                credential_paths=claude.credential_paths,
                runtime_paths=claude.runtime_paths,
            ),
            CodexProvider(
                enabled=codex.enabled,
                command=codex.command,
                wrapper_command=codex.wrapper_command,
                model=codex.model,
                phase_models=codex.phase_models,
                extra_args=codex.extra_args,
                max_turns=codex.max_turns,
                credential_paths=codex.credential_paths,
                runtime_paths=codex.runtime_paths,
            ),
            GoogleAgentProvider(
                enabled=google.enabled,
                command=google.command,
                wrapper_command=google.wrapper_command,
                cli_variant=google.cli_variant,
                model=google.model,
                phase_models=google.phase_models,
                extra_args=google.extra_args,
                max_turns=google.max_turns,
                credential_paths=google.credential_paths,
                runtime_paths=google.runtime_paths,
            ),
            OpenCodeProvider(
                enabled=opencode.enabled,
                command=opencode.command,
                wrapper_command=opencode.wrapper_command,
                model=opencode.model,
                phase_models=opencode.phase_models,
                extra_args=opencode.extra_args,
                max_turns=opencode.max_turns,
                credential_paths=opencode.credential_paths,
                runtime_paths=opencode.runtime_paths,
            ),
            OpenHandsProvider(
                self.conversations,
                openhands_runtime_config,
                enabled=openhands.enabled,
            ),
            PiProvider(
                enabled=pi.enabled,
                command=pi.command,
                wrapper_command=pi.wrapper_command,
                model=pi.model,
                phase_models=pi.phase_models,
                extra_args=pi.extra_args,
                max_turns=pi.max_turns,
                credential_paths=pi.credential_paths,
                runtime_paths=pi.runtime_paths,
            ),
        ]
        provider_limits = {
            name: provider.max_concurrency
            for name, provider in config.agents.providers.items()
            if provider.enabled
        }
        provider_timeouts = {
            name: provider.timeout_seconds for name, provider in config.agents.providers.items()
        }
        provider_output_limits = {
            name: provider.max_output_bytes for name, provider in config.agents.providers.items()
        }
        phase_timeouts = {
            key.replace("_", "-"): int(value)
            for key, value in config.agents.timeouts.model_dump().items()
        }
        breaker_config = config.agents.circuit_breaker
        from openhands_factory.agents.base import AgentFailureKind

        failure_cooldowns = {
            AgentFailureKind.PROVIDER_RATE_LIMIT: breaker_config.rate_limit_cooldown_seconds,
            AgentFailureKind.PROVIDER_QUOTA: breaker_config.quota_cooldown_seconds,
            AgentFailureKind.PROVIDER_AUTH: breaker_config.auth_cooldown_seconds,
            AgentFailureKind.PROVIDER_UNAVAILABLE: (breaker_config.unavailable_cooldown_seconds),
            AgentFailureKind.PROVIDER_TRANSPORT: breaker_config.transport_cooldown_seconds,
            AgentFailureKind.PROVIDER_TIMEOUT: breaker_config.timeout_cooldown_seconds,
            AgentFailureKind.AGENT_CRASH: breaker_config.crash_cooldown_seconds,
            AgentFailureKind.INVALID_AGENT_OUTPUT: (breaker_config.invalid_output_cooldown_seconds),
        }
        self.router = AgentRouter(
            providers=providers,
            policy=ConfigRoutingPolicy(config.agents),
            health_store=self.health_store,
            capacity_store=ProviderCapacityStore(
                config.state_dir,
                factory_generation=(
                    config.factory_generation if config.factory_generation != "unknown" else None
                ),
                max_lease_seconds=maximum_agent_lease_seconds(config),
            ),
            provider_limits=provider_limits,
            provider_timeouts=provider_timeouts,
            provider_output_limits=provider_output_limits,
            phase_timeouts=phase_timeouts,
            failure_threshold=breaker_config.failure_threshold,
            cooldown_seconds=breaker_config.default_cooldown_seconds,
            failure_cooldowns=failure_cooldowns,
            capacity_wait_seconds=config.provider_slot_wait_seconds,
            skip_busy_providers=config.agents.routing.skip_busy_providers,
            same_provider_retries=config.agents.routing.same_provider_retries,
            metrics_store=MetricsStore(config.state_dir / "metrics.json"),
        )
        self.labels_ready = False
        self.active_label_reconciliation_pending = True
        self.verification_slots = verification_slots

    def _workflow(
        self,
        repository: Path,
        *,
        external_branch: str | None = None,
    ) -> GitWorkflow:
        """Construct Git operations with a token scoped only to Git children."""

        return GitWorkflow(
            repository,
            self.config.base_branch,
            external_branch=external_branch,
            github_token=self.config.github_token.get_secret_value(),
        )

    def refresh(self, protected_task_ids: set[str] | None = None) -> dict[str, Job]:
        if not self.labels_ready:
            self.github.ensure_factory_labels()
            self._reconcile_quarantine_labels()
            self.labels_ready = True
        if self.active_label_reconciliation_pending:
            self._reconcile_active_labels(protected_task_ids or set())
        tasks = self.github.collect_open_issues() + self.github.collect_open_pull_requests()
        self.tasks.cache(tasks)
        jobs = self.jobs.reconcile(tasks)
        for job in jobs.values():
            if job.state is JobState.QUARANTINED and job.quarantine_notification_pending:
                self._publish_quarantine(job)
        active_task_ids = {task.identifier for task in tasks}
        protected = protected_task_ids or set()
        retired_jobs: list[Job] = []
        for task_id, job in jobs.items():
            if task_id in active_task_ids or task_id in protected or job.state in TERMINAL_STATES:
                continue
            worktree = self.config.worktree_dir / f"issue-{task_id}"
            if worktree.exists():
                workflow = self._workflow(self.config.repository)
                inspection = self._workflow(worktree)
                try:
                    dirty = inspection.has_changes()
                except RepositorySafetyError:
                    # A damaged or partially-created worktree is not safe to delete silently.
                    dirty = True
                if dirty:
                    recovery = self.config.recovery_dir / (
                        f"issue-{task_id}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
                    )
                    workflow.archive_worktree(worktree, recovery)
                workflow.remove_worktree(worktree, force=dirty)
            self.tasks.release(task_id)
            job.state = JobState.DONE
            # This clause used to be scoped to PRE_PULL_REQUEST_STATES, so a job
            # whose pull request was closed (not merged) while the factory was
            # still reviewing or waiting on CI never got here at all - its
            # worktree, and everything downstream of it, stayed on disk forever.
            # reconcile() only resets a DONE job with this exact message back to
            # DISCOVERED when job.pull_request is still None, which is already
            # never true once a PR-review job reaches this branch (it is set
            # immediately in _discover_pull_request), so this message split does
            # not change that behaviour.
            job.last_error = (
                "Issue closed before pull request creation"
                if job.task.source == "github-issue"
                else "Pull request closed before the factory finished with it"
            )
            retired_jobs.append(job)
        self.jobs.save_reconciled_jobs(retired_jobs)
        return self.jobs.load()

    def _reconcile_quarantine_labels(self) -> None:
        """Clear GitHub quarantine labels no longer backed by durable state.

        Bounded recovery changes a due job back to ``DISCOVERED`` before the next
        GitHub refresh. Discovery deliberately excludes ``factory-quarantined`` and
        ``needs-human``, so an interrupted or older recovery can otherwise hide the
        job forever. Durable state is authoritative. Label cleanup is idempotent and
        intentionally silent because routine circuit recovery is control-plane noise.
        """

        durable_quarantined = {
            int(task_id)
            for task_id, job in self.jobs.load().items()
            if task_id.isdigit() and job.state is JobState.QUARANTINED
        }
        labelled_quarantined = set(self.github.list_quarantined_issues())
        stale_labels = sorted(labelled_quarantined - durable_quarantined)
        if not stale_labels:
            return
        cleared = self.github.requeue_quarantined_issues(stale_labels, announce=False)
        LOGGER.warning(
            "Reconciled stale Factory quarantine labels for tasks: %s",
            ",".join(str(issue) for issue in cleared),
        )

    def request_label_reconciliation(self) -> None:
        """Request one control-label reconciliation before the next discovery read."""

        self.labels_ready = False
        self.active_label_reconciliation_pending = True

    def _reconcile_active_labels(self, protected_task_ids: set[str]) -> None:
        """Repair one bounded batch of stale Factory ownership markers."""

        jobs = self.jobs.load()
        protected_numeric = {int(task_id) for task_id in protected_task_ids if task_id.isdigit()}
        durable_active = protected_numeric | {
            int(task_id)
            for task_id, job in jobs.items()
            if task_id.isdigit()
            and job.task.source == "github-issue"
            and (job.state not in {JobState.DISCOVERED, JobState.DONE, JobState.QUARANTINED})
        }
        labelled_active = set(self.github.list_active_issues())
        stale_labels = sorted(labelled_active - durable_active)
        batch = stale_labels[: self.config.label_reconciliation_batch_size]
        if not batch:
            self.active_label_reconciliation_pending = False
            return

        released = self.github.release_active_issues(batch)
        self.active_label_reconciliation_pending = len(stale_labels) > len(released)
        LOGGER.warning(
            "Reconciled %d stale Factory ownership labels; %d remain in the current snapshot",
            len(released),
            max(len(stale_labels) - len(released), 0),
        )

    def run_once(self) -> Job | None:
        jobs = self.refresh()
        now = datetime.now(UTC)
        candidates = [
            job
            for job in jobs.values()
            if job.state not in TERMINAL_STATES
            and (job.next_attempt_at is None or job.next_attempt_at <= now)
        ]
        if not candidates:
            return None
        job = min(candidates, key=lambda item: (item.task.priority, int(item.task.identifier)))
        return self._run_claimed_job(job.task.identifier)

    def run_job(self, task_id: str) -> Job | None:
        """Advance one scheduler-selected job under a worker-distinct CAS lease."""

        return self._run_claimed_job(task_id)

    def _run_claimed_job(self, task_id: str) -> Job | None:
        snapshot = self.jobs.load().get(task_id)
        if snapshot is None or snapshot.state in TERMINAL_STATES:
            return None
        lease_owner = (
            f"{self.tasks.factory_generation}:{task_id}:{snapshot.state.value}:{uuid4().hex}"
        )
        producer_identity = snapshot.producer_identity or (
            f"{self.tasks.factory_generation}:{task_id}"
        )
        try:
            claim = self.tasks.acquire(
                snapshot.task,
                lease_owner,
                producer_identity=producer_identity,
            )
        except TaskClaimConflict as conflict:
            return self._handle_claim_conflict(snapshot, conflict.claim)

        try:
            # A sibling dispatch may have completed a transition while this worker
            # waited for the claim lock. Reload only after acquisition, so stale
            # in-memory state can never repeat branch or PR creation.
            job = self.jobs.load().get(task_id)
            if job is None or job.state in TERMINAL_STATES:
                return None
            self._copy_claim_metadata(job, claim)
            try:
                self._advance(job, lease_owner)
                job.attempts = 0
                job.last_error = None
                job.next_attempt_at = None
            except ProviderCapacityUnavailable as error:
                job.last_error = str(error)[-2000:]
                retry = error.retry_after_seconds or self.config.provider_cooldown_seconds
                job.next_attempt_at = datetime.now(UTC) + timedelta(seconds=max(retry, 1))
                LOGGER.warning("Factory job %s deferred: %s", job.task.identifier, error)
            except Exception as error:
                job.attempts += 1
                job.last_error = str(error)[-2000:]
                self._record_failure(job)
            job.updated_at = datetime.now(UTC)
            self.jobs.save_job(job)
            if job.last_error and job.last_failure_fingerprint is not None:
                self.tasks.record_failure(
                    job.task.identifier,
                    lease_owner,
                    job.last_failure_fingerprint,
                )
            if job.state is JobState.QUARANTINED and job.quarantine_notification_pending:
                self._publish_quarantine(job)
            return job
        finally:
            try:
                self.tasks.release(task_id, owner=lease_owner)
            except TaskClaimConflict:
                LOGGER.error(
                    "factory.task.lease_release_rejected task=%s owner=%s",
                    task_id,
                    lease_owner,
                )

    def _handle_claim_conflict(self, job: Job, claim: Lease) -> Job | None:
        """Attach an equivalent task to its durable canonical owner without executing it."""

        if claim.task_id == job.task.identifier and claim.completed_at is None:
            LOGGER.info(
                "Skipped duplicate dispatch for task %s; worker %s owns the active claim",
                job.task.identifier,
                claim.owner,
            )
            return None
        self._copy_claim_metadata(job, claim)
        job.state = JobState.DONE
        job.last_error = None
        job.next_attempt_at = None
        job.updated_at = datetime.now(UTC)
        self.jobs.save_job(job)
        if job.task.source == "github-issue" and claim.task_id != job.task.identifier:
            destination = (
                f"pull request #{claim.canonical_pull_request}"
                if claim.canonical_pull_request is not None
                else f"task #{claim.task_id}"
            )
            self.github.add_comment(
                int(job.task.identifier),
                (
                    "OpenHands Factory skipped a sibling implementation because this "
                    f"logical task is already owned by canonical {destination}."
                ),
            )
        return job

    @staticmethod
    def _copy_claim_metadata(job: Job, claim: Lease) -> None:
        job.canonical_task_id = claim.task_id
        job.producer_identity = claim.producer_identity
        job.branch = claim.canonical_branch or job.branch
        job.pull_request = claim.canonical_pull_request or job.pull_request
        job.initial_base_sha = claim.initial_base_sha or job.initial_base_sha
        job.latest_verified_sha = claim.latest_verified_sha or job.latest_verified_sha
        job.predecessor_pull_request = (
            claim.predecessor_pull_request or job.predecessor_pull_request
        )
        job.successor_pull_request = claim.successor_pull_request or job.successor_pull_request
        job.changed_path_fingerprint = (
            claim.changed_path_fingerprint or job.changed_path_fingerprint
        )

    def _record_failure(self, job: Job) -> None:
        LOGGER.exception("Factory job %s failed", job.task.identifier)

    def _publish_quarantine(self, job: Job) -> None:
        """Publish one recoverable, fully autonomous circuit without retry spam.

        This is never a request for a human decision - see AGENTS.md's autonomy
        mandate. It is a bounded cooldown: recover_due_quarantines() automatically
        returns the task to DISCOVERED after quarantine_recovery_minutes, preserving
        failure evidence so an unrelated transient error doesn't get treated as the
        same repeated failure. No "needs-human" label is applied.
        """

        issue = int(job.task.identifier)
        try:
            self.github.remove_issue_labels(issue, ("factory-active", "swarm-active"))
            self.github.add_issue_labels(issue, ("factory-quarantined",))
            self.github.add_comment(
                issue,
                "OpenHands Factory paused this task after the same task-side failure "
                "repeated to its configured safety limit. Provider outages and busy "
                "subscriptions do not trigger this circuit. This is a bounded, "
                "automatic cooldown - the Factory will requeue and retry this task "
                "on its own; no manual action is needed.",
            )
        except FactoryError:
            LOGGER.exception(
                "factory.job.quarantine_notification_failed task=%s",
                job.task.identifier,
            )
            return
        job.quarantine_notification_pending = False
        self.jobs.save_job(job)

    def _run_agent(
        self,
        job: Job,
        worktree: Path,
        phase: str,
        prompt: str,
        *,
        lease_owner: str | None = None,
        prepare_attempt: Callable[[], None] | None = None,
        validate_output: Callable[[], None] | None = None,
        require_repository_change: bool = False,
    ) -> None:
        from openhands_factory.agents.base import AgentPhase, AgentRequest

        if lease_owner is not None:
            self.tasks.renew(job.task.identifier, lease_owner)

        # Map phase string to enum
        phase_map = {
            "planning": AgentPhase.PLANNING,
            "architecture": AgentPhase.ARCHITECTURE,
            "implementation": AgentPhase.IMPLEMENTATION,
            "security": AgentPhase.SECURITY_REVIEW,
            "quality_repair": AgentPhase.QUALITY_REPAIR,
            "review": AgentPhase.CODE_REVIEW,
            "repair": AgentPhase.CI_REPAIR,
            "architect": AgentPhase.ARCHITECTURE,
        }
        agent_phase = phase_map.get(phase, AgentPhase.GENERAL_ACTION)
        if job.pull_request is not None:
            # A previous review label can survive an interrupted state transition.
            # Clear every merge-eligibility marker before any new AI-backed phase,
            # including a nominally read-only review which may still edit code.
            # The label and SHA-scoped status are published again only after a
            # fresh, valid report approves the resulting head.
            self.github.remove_issue_labels(
                job.pull_request,
                ("factory-reviewed", "factory-review"),
            )
            if job.head_sha is not None:
                self.github.publish_review_pending(
                    job.head_sha,
                    detail=f"Factory {agent_phase.value} in progress",
                )
        baseline_fingerprint: str | None = None
        workflow = self._workflow(worktree)

        def prepare() -> None:
            nonlocal baseline_fingerprint
            if prepare_attempt is not None:
                prepare_attempt()
            if require_repository_change:
                baseline_fingerprint = workflow.change_fingerprint()

        def validate() -> None:
            if validate_output is not None:
                validate_output()
            if not require_repository_change:
                return
            if baseline_fingerprint is None:
                raise RuntimeError("Repository-change validation was not prepared")
            try:
                current_fingerprint = workflow.change_fingerprint()
            except RepositorySafetyError as error:
                raise RuntimeError("Repository-change validation failed internally") from error
            if current_fingerprint == baseline_fingerprint:
                raise AgentTaskFailure(f"{phase.replace('_', ' ').title()} produced no changes")

        request = AgentRequest(
            phase=agent_phase,
            task=job.task,
            prompt=prompt,
            cwd=worktree,
            system_prompt=self.system_prompt,
            prepare_attempt=(
                prepare if prepare_attempt is not None or require_repository_change else None
            ),
            validate_output=(
                validate if validate_output is not None or require_repository_change else None
            ),
        )

        excluded: set[str] = set()
        if agent_phase in {AgentPhase.CODE_REVIEW, AgentPhase.SECURITY_REVIEW}:
            excluded = {
                str(entry["provider"])
                for entry in job.provider_history
                if (
                    entry.get("phase") in CODE_MUTATING_AGENT_PHASES
                    or entry.get("mutated_code") is True
                )
                and isinstance(entry.get("provider"), str)
            }
        result = self.router.run(request, job, exclude=excluded)

        if agent_phase is AgentPhase.IMPLEMENTATION:
            job.implementation_provider = result.provider
        elif agent_phase is AgentPhase.CODE_REVIEW:
            job.review_provider = result.provider
        elif agent_phase is AgentPhase.SECURITY_REVIEW:
            job.security_provider = result.provider

        if not result.success:
            if result.failure:
                if result.provider == "openhands":
                    raise FactoryError(result.failure.message)
                raise FactoryError(
                    f"Agent provider '{result.provider}' failed: {result.failure.message}"
                )
            raise FactoryError(f"Agent provider '{result.provider}' failed during {phase}")

    def _advance(self, job: Job, lease_owner: str) -> None:
        # Notification delivery is best-effort and never changes merge eligibility.
        # Retry a small number of previously-recorded lifecycle events on ordinary
        # Factory progress so a transient Telegram outage is eventually visible.
        self.pr_lifecycle.flush_pending()
        worktree = self.config.worktree_dir / f"issue-{job.task.identifier}"
        # Control prompts must never come from the agent-modifiable worktree. The
        # dedicated Factory checkout is deployed from main and remains outside every
        # task diff, so an implementation cannot weaken its own security or review phase.
        prompt_dir = self.prompt_dir
        self.tasks.renew(job.task.identifier, lease_owner)
        if job.state is JobState.DISCOVERED:
            if job.task.source == "github-pull-request":
                self._discover_pull_request(job, worktree, lease_owner)
                return
            if worktree.exists():
                stale_workflow = self._workflow(self.config.repository)
                if self._workflow(worktree).has_changes():
                    recovery = self.config.recovery_dir / (
                        f"issue-{job.task.identifier}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
                    )
                    stale_workflow.archive_worktree(worktree, recovery)
                stale_workflow.remove_worktree(worktree, force=True)
            workflow = self._workflow(self.config.repository)
            claim = self.tasks.claims()[job.task.logical_key]
            matches = self.github.find_equivalent_pull_requests(
                job.task,
                known_branch=claim.canonical_branch,
                known_path_fingerprint=claim.changed_path_fingerprint,
            )
            active_match = next((match for match in matches if match.is_open_canonical), None)
            if active_match is not None:
                self._attach_pull_request(job, worktree, active_match, lease_owner)
                return
            merged_match = next(
                (
                    match
                    for match in matches
                    if match.state == "MERGED" and match.has_strong_identity
                ),
                None,
            )
            if merged_match is not None:
                self._bind_matched_pull_request(job, merged_match, lease_owner)
                job.state = JobState.MERGED
                return
            predecessor = next(
                (
                    match
                    for match in matches
                    if match.has_strong_identity
                    and (
                        match.state == "CLOSED"
                        or match.labels.intersection({"duplicate", "factory-skip", "superseded"})
                    )
                ),
                None,
            )
            if predecessor is not None:
                job.predecessor_pull_request = predecessor.number
            if claim.canonical_branch is None:
                job.branch = workflow.prepare_worktree(
                    worktree,
                    job.task.identifier,
                    job.task.title,
                )
            else:
                workflow.prepare_claimed_worktree(
                    worktree,
                    claim.canonical_branch,
                    claim.initial_base_sha,
                )
                job.branch = claim.canonical_branch
            job.initial_base_sha = self._workflow(worktree).head_sha()
            bound = self.tasks.bind_branch(
                job.task.identifier,
                lease_owner,
                job.branch,
                job.initial_base_sha,
                predecessor_pull_request=job.predecessor_pull_request,
            )
            self._copy_claim_metadata(job, bound)
            self.github.add_issue_labels(int(job.task.identifier), ("factory-active",))
            self.github.add_comment(
                int(job.task.identifier),
                (
                    "OpenHands factory started this issue. It is using an isolated worktree, "
                    "parallel capacity is controlled by the factory configuration, and the "
                    "implementation will be verified before a pull request is opened."
                ),
            )
            job.state = JobState.IMPLEMENTING
            return

        workflow = self._workflow(
            worktree,
            external_branch=job.branch if job.pull_request is not None else None,
        )
        if job.state is JobState.IMPLEMENTING:
            context_files = self._context_files(worktree)
            prompt = build_task_prompt(
                prompt_dir,
                job.task,
                context_files,
                self._verification_descriptions(worktree),
                [],
            )
            self._run_agent(
                job,
                worktree,
                "implementation",
                prompt,
                lease_owner=lease_owner,
                require_repository_change=True,
            )
            job.state = JobState.SECURITY_REVIEW
            return

        if job.state is JobState.SECURITY_REVIEW:
            try:
                exempt = _is_security_review_exempt(workflow.changed_paths())
            except RepositorySafetyError:
                # Can't prove the diff is out of scope, so fall through to a
                # real review rather than crash the job or skip it blind.
                exempt = False
            if exempt:
                job.state = JobState.VERIFYING
                return
            self._run_agent(
                job,
                worktree,
                "security",
                build_phase_prompt(prompt_dir, "security", job.task),
                lease_owner=lease_owner,
            )
            job.state = JobState.VERIFYING
            return

        if job.state is JobState.VERIFYING:
            if self._refresh_pull_request_if_changed(job, worktree, lease_owner):
                return
            verified_paths = self._verify_or_schedule_quality_repair(job, workflow)
            if verified_paths is None:
                return
            findings = check_quality_gate(workflow, self.config.base_branch)
            if findings:
                if job.quality_repairs >= 2:
                    raise FactoryError(f"Quality gate blocked: {findings[0].code}")
                job.state = JobState.QUALITY_REPAIRING
                return
            workflow.stage_all()
            workflow.commit(f"fix: resolve issue {job.task.identifier}")
            if job.branch is None:
                raise FactoryError("Job branch is missing")
            workflow.push(job.branch)
            job.head_sha = workflow.head_sha()
            job.latest_verified_sha = job.head_sha
            job.changed_path_fingerprint = changed_path_fingerprint(
                str(path) for path in verified_paths
            )
            bound = self.tasks.record_verification(
                job.task.identifier,
                lease_owner,
                job.head_sha,
                job.changed_path_fingerprint,
            )
            self._copy_claim_metadata(job, bound)
            if job.pull_request is None:
                job.state = JobState.PR_DRAFT
            else:
                self.github.add_comment(
                    job.pull_request,
                    (
                        "OpenHands factory verified and pushed a repair to the existing "
                        "pull request branch. Independent review is running again."
                    ),
                )
                job.state = JobState.REVIEWING
            return

        if job.state is JobState.QUALITY_REPAIRING:
            if self._refresh_pull_request_if_changed(job, worktree, lease_owner):
                return
            findings = check_quality_gate(workflow, self.config.base_branch)
            if not findings and not job.review_findings:
                job.state = JobState.VERIFYING
                return
            if job.quality_repairs >= 2:
                raise FactoryError("Quality repair limit exceeded")

            quality_finding_text = "\n".join(
                f"- {f.code} in {f.path}: {f.summary}\n  Evidence: {f.evidence}" for f in findings
            )
            review_finding_text = "\n".join(f"- {finding}" for finding in job.review_findings)
            sections = []
            if quality_finding_text:
                sections.append(f"Quality gate findings:\n\n{quality_finding_text}")
            if review_finding_text:
                sections.append(f"Repair evidence:\n\n{review_finding_text}")
            extra = "\n\n".join(sections)

            self._run_agent(
                job,
                worktree,
                "quality_repair",
                build_phase_prompt(prompt_dir, "quality_repair", job.task, extra=extra),
                lease_owner=lease_owner,
                require_repository_change=True,
            )

            job.review_findings.clear()
            job.quality_repairs += 1
            job.state = JobState.VERIFYING
            return

        if job.state is JobState.PR_DRAFT:
            if job.branch is None:
                raise FactoryError("Job branch is missing")
            claim = self.tasks.claims()[job.task.logical_key]
            if claim.canonical_pull_request is not None:
                self._copy_claim_metadata(job, claim)
                job.state = JobState.REVIEWING
                return
            matches = self.github.find_equivalent_pull_requests(
                job.task,
                known_branch=job.branch,
                known_path_fingerprint=(
                    job.changed_path_fingerprint or claim.changed_path_fingerprint
                ),
            )
            existing = next(
                (match for match in matches if match.is_open_canonical),
                None,
            )
            if existing is not None:
                if existing.branch == job.branch:
                    self._bind_matched_pull_request(job, existing, lease_owner)
                    job.state = JobState.REVIEWING
                else:
                    self._attach_pull_request(job, worktree, existing, lease_owner)
                return
            job.pull_request = self.github.create_pull_request(
                job.branch,
                f"Fixes #{job.task.identifier}: {job.task.title}",
                self._pull_request_body(job),
            )
            bound = self.tasks.bind_pull_request(
                job.task.identifier,
                lease_owner,
                job.pull_request,
                job.branch,
                predecessor_pull_request=job.predecessor_pull_request,
            )
            self._copy_claim_metadata(job, bound)
            job.successor_pull_request = bound.successor_pull_request
            self.github.add_comment(
                job.pull_request,
                (
                    "OpenHands factory created this pull request. The factory will review the "
                    "same branch, repair verification failures, wait for required checks, and "
                    "merge only after the reviewed commit is still current."
                ),
            )
            job.state = JobState.REVIEWING
            return

        if job.state is JobState.REVIEWING:
            if self._refresh_pull_request_if_changed(job, worktree, lease_owner):
                return

            # The worktree persists across retries of this state, so a review report
            # left behind by an earlier failed attempt (crashed conversation, hit its
            # turn budget, etc.) must not be re-validated as if it were fresh: remove
            # it before running the conversation, so a conversation that fails to
            # (re)write a valid report is reported as missing one, not judged against
            # someone else's stale output.
            def clear_review_report() -> None:
                (worktree / ".factory-review.json").unlink(missing_ok=True)

            def require_valid_review_report() -> None:
                validate_review_report(worktree, job.task.body, require_approval=False)

            self._run_agent(
                job,
                worktree,
                "review",
                build_phase_prompt(prompt_dir, "review", job.task),
                lease_owner=lease_owner,
                prepare_attempt=clear_review_report,
                validate_output=require_valid_review_report,
            )
            report = validate_review_report(
                worktree,
                job.task.body,
                require_approval=False,
            )
            (worktree / ".factory-review.json").unlink(missing_ok=True)
            if workflow.has_changes():
                if job.repair_attempts >= 5:
                    raise FactoryError("Review repair limit exceeded")
                self._mark_latest_review_as_mutating(job)
                verified_paths = self._verify(workflow)
                workflow.stage_all()
                subject = self._subject(job)
                workflow.commit(f"fix: address review for {subject} {job.task.identifier}")
                if job.branch is None:
                    raise FactoryError("Job branch is missing")
                workflow.push(job.branch)
                job.head_sha = workflow.head_sha()
                job.latest_verified_sha = job.head_sha
                job.changed_path_fingerprint = changed_path_fingerprint(
                    str(path) for path in verified_paths
                )
                bound = self.tasks.record_verification(
                    job.task.identifier,
                    lease_owner,
                    job.head_sha,
                    job.changed_path_fingerprint,
                )
                self._copy_claim_metadata(job, bound)
                job.repair_attempts += 1
                job.state = JobState.REVIEWING
                return
            failed_criteria = [
                f"Acceptance criterion failed: {criterion.get('criterion')}"
                for criterion in report.acceptance_criteria
                if criterion.get("passed") is not True
            ]
            blocking_findings = [
                str(finding.get("summary"))
                for finding in report.blocking_findings
                if finding.get("summary")
            ]
            if not report.approved or failed_criteria or blocking_findings:
                job.review_findings = [
                    *failed_criteria,
                    *blocking_findings,
                    *([] if report.approved else [f"Review rejected: {report.summary}"]),
                ]
                job.state = JobState.QUALITY_REPAIRING
                return
            job.review_findings.clear()
            if job.pull_request is None:
                raise FactoryError("Pull request number is missing")
            if job.head_sha is None:
                job.head_sha = workflow.head_sha()
            self.github.publish_review_status(
                job.head_sha,
                approved=True,
                detail=report.summary[:140],
            )
            self.github.add_issue_labels(job.pull_request, ("factory-reviewed",))
            self.github.mark_ready(job.pull_request)
            self.github.request_review(job.pull_request)
            self.github.add_comment(
                job.pull_request,
                (
                    "OpenHands factory review passed. Local verification completed and the "
                    "reviewed head SHA is recorded as a required status. Waiting for GitHub "
                    "checks before merge."
                ),
            )
            self._record_pr_lifecycle(
                job,
                "reviewed",
                (
                    "Factory independent review accepted this exact commit, published the "
                    "factory/independent-review success status, and applied factory-reviewed. "
                    "Required GitHub checks must still pass before merge."
                ),
            )
            job.state = JobState.CI_PENDING
            return

        if job.state is JobState.CI_PENDING:
            status = self._status(job)
            if status.state == "MERGED":
                self._record_pr_lifecycle(
                    job,
                    "merged",
                    "GitHub already reports the reviewed pull request as merged.",
                )
                job.state = JobState.MERGED
            elif job.head_sha != status.head_sha:
                self._refresh_pull_request_for_review(job, worktree, lease_owner)
            elif status.merge_state_status == "BEHIND":
                self._update_pull_request_branch(job, status)
            elif (
                status.checks_pending
                or status.mergeable == "UNKNOWN"
                or status.merge_state_status in {"UNKNOWN", "BLOCKED", "HAS_HOOKS", "DRAFT"}
            ):
                return
            elif (
                status.checks_passed
                and status.mergeable == "MERGEABLE"
                and status.merge_state_status == "CLEAN"
            ):
                # Persist a visible queue transition before the merge attempt. The
                # MERGE_QUEUED worker re-reads GitHub immediately before using an
                # exact-head merge. The scheduled workflow remains a recovery fallback
                # if the daemon stops after review. Native auto-merge stays disabled so
                # a later CHANGES_REQUESTED review cannot race the Factory gate.
                self._record_pr_lifecycle(
                    job,
                    "merge-queued",
                    (
                        "All required checks passed, GitHub reports the reviewed head as clean "
                        "and mergeable, and the Factory queued an exact-head squash merge."
                    ),
                )
                job.state = JobState.MERGE_QUEUED
            else:
                job.state = JobState.REPAIRING
            return

        if job.state is JobState.REPAIRING:
            if job.repair_attempts >= 5:
                raise FactoryError("Repair limit exceeded")
            status = self._status(job)
            if status.state == "MERGED":
                job.state = JobState.MERGED
                return
            if job.head_sha != status.head_sha:
                self._refresh_pull_request_for_review(job, worktree, lease_owner)
                return
            if (
                status.checks_pending
                or (status.checks_passed and status.mergeable == "MERGEABLE")
                or status.mergeable == "UNKNOWN"
            ):
                job.state = JobState.CI_PENDING
                return
            failed_checks = "\n".join(f"- {name}" for name in sorted(status.failed_checks))
            evidence = failed_checks or "- No terminal failed check name was reported by GitHub."
            repair_context = (
                "GitHub evidence for the current reviewed head:\n\n"
                f"Failed checks:\n{evidence}\n"
                f"Mergeability: {status.mergeable}"
            )
            # A large share of CI repairs are a workspace's own formatter or
            # auto-fixable lint rule drifting, not something that needs an
            # agent's judgement. Try that for free first; only spend an LLM
            # call if the worktree is still unchanged afterwards.
            attempt_mechanical_repair(worktree)
            mechanically_repaired = workflow.has_changes()
            if not mechanically_repaired:
                self._run_agent(
                    job,
                    worktree,
                    "repair",
                    build_phase_prompt(prompt_dir, "repair", job.task, extra=repair_context),
                    lease_owner=lease_owner,
                    require_repository_change=True,
                )
            verified_paths = self._verify(workflow)
            workflow.stage_all()
            commit_subject = (
                "fix: apply automatic formatting for"
                if mechanically_repaired
                else "fix: repair CI for"
            )
            workflow.commit(f"{commit_subject} {self._subject(job)} {job.task.identifier}")
            if job.branch is None:
                raise FactoryError("Job branch is missing")
            workflow.push(job.branch)
            job.head_sha = workflow.head_sha()
            job.latest_verified_sha = job.head_sha
            job.changed_path_fingerprint = changed_path_fingerprint(
                str(path) for path in verified_paths
            )
            bound = self.tasks.record_verification(
                job.task.identifier,
                lease_owner,
                job.head_sha,
                job.changed_path_fingerprint,
            )
            self._copy_claim_metadata(job, bound)
            job.repair_attempts += 1
            if job.pull_request is not None:
                self.github.add_comment(
                    job.pull_request,
                    (
                        "OpenHands factory repaired the branch after verification or CI "
                        "feedback. The branch is returning to review before merge."
                    ),
                )
            job.state = JobState.REVIEWING
            return

        if job.state is JobState.MERGE_QUEUED:
            # Backfill lifecycle evidence for jobs that were already queued before
            # this Factory version, and make retries/restarts idempotently visible.
            self._record_pr_lifecycle(
                job,
                "merge-queued",
                (
                    "All required checks passed, GitHub reports the reviewed head as clean "
                    "and mergeable, and the Factory queued an exact-head squash merge."
                ),
            )
            status = self._status(job)
            if status.state == "MERGED":
                self._record_pr_lifecycle(
                    job,
                    "merged",
                    "GitHub confirmed that the reviewed pull request was merged.",
                )
                job.state = JobState.MERGED
            elif job.head_sha != status.head_sha:
                self._refresh_pull_request_for_review(job, worktree, lease_owner)
            elif status.merge_state_status == "BEHIND":
                self._update_pull_request_branch(job, status)
            elif (
                status.checks_pending
                or status.mergeable == "UNKNOWN"
                or status.merge_state_status in {"UNKNOWN", "BLOCKED", "HAS_HOOKS", "DRAFT"}
            ):
                return
            elif (
                not status.checks_passed
                or status.mergeable != "MERGEABLE"
                or status.merge_state_status != "CLEAN"
            ):
                job.state = JobState.REPAIRING
            else:
                if job.pull_request is None or job.head_sha is None:
                    raise FactoryError("Merge-queued job is missing pull request provenance")
                # The queue state was established on an earlier transition. Re-read
                # status above, then ask GitHub to merge only this exact reviewed SHA.
                # No --admin or auto-merge bypass is used, so GitHub rules remain
                # authoritative and a changed head is rejected server-side.
                self.github.merge_pull_request(job.pull_request, job.head_sha)
                confirmed = self._status(job)
                if confirmed.state == "MERGED":
                    self._record_pr_lifecycle(
                        job,
                        "merged",
                        "GitHub confirmed the Factory exact-head squash merge completed.",
                    )
                    job.state = JobState.MERGED
                elif confirmed.head_sha != job.head_sha:
                    self._refresh_pull_request_for_review(job, worktree, lease_owner)
            return

        if job.state is JobState.MERGED:
            self._record_pr_lifecycle(
                job,
                "merged",
                "GitHub confirmed that the reviewed pull request is merged.",
            )
            if job.pull_request is not None:
                self.github.add_comment(
                    job.pull_request,
                    "OpenHands factory confirmed that GitHub merged this pull request.",
                )
            if job.task.source == "github-issue":
                issue = int(job.task.identifier)
                self.github.remove_issue_labels(issue, ("factory-active", "swarm-active"))
                self.github.close_issue(issue)
            if worktree.exists():
                self._workflow(self.config.repository).remove_worktree(worktree)
            self.tasks.complete(job.task.identifier, lease_owner)
            job.state = JobState.DONE

    def _record_pr_lifecycle(
        self,
        job: Job,
        event: PullRequestLifecycleEvent,
        detail: str,
    ) -> None:
        """Persist and notify significant PR lifecycle transitions idempotently."""

        if job.pull_request is None or job.head_sha is None:
            return
        self.pr_lifecycle.record(
            event,
            pull_request=job.pull_request,
            head_sha=job.head_sha,
            title=job.task.title,
            detail=detail,
        )

    def _discover_pull_request(
        self,
        job: Job,
        worktree: Path,
        lease_owner: str,
    ) -> None:
        """Start independently reviewing a pull request the factory did not create.

        Checks out and verifies the current head before entering REVIEWING, then
        reuses the normal repair, CI polling and merge-safety states. The only
        difference from an issue-driven job is that the branch and pull request
        already exist.
        """
        if job.task.pr_branch is None:
            raise FactoryError("Pull request branch is missing")
        self._prepare_pull_request_for_review(
            job,
            worktree,
            pull_request=int(job.task.identifier),
            branch=job.task.pr_branch,
            lease_owner=lease_owner,
            comment=(
                "OpenHands factory is independently reviewing this pull request. It will "
                "run verification, repair failures if needed, and merge once its checks "
                "pass and the reviewed commit is still current."
            ),
        )

    def _attach_pull_request(
        self,
        job: Job,
        worktree: Path,
        match: PullRequestMatch,
        lease_owner: str,
    ) -> None:
        """Attach issue work to an existing canonical PR instead of creating a sibling."""

        self._prepare_pull_request_for_review(
            job,
            worktree,
            pull_request=match.number,
            branch=match.branch,
            lease_owner=lease_owner,
            comment=(
                "OpenHands Factory attached this issue to the existing canonical pull "
                "request after matching its durable logical-task evidence. Verification "
                "and independent review continue on this branch."
            ),
        )

    def _prepare_pull_request_for_review(
        self,
        job: Job,
        worktree: Path,
        *,
        pull_request: int,
        branch: str,
        lease_owner: str,
        comment: str,
    ) -> None:
        if worktree.exists():
            stale_workflow = self._workflow(self.config.repository)
            if self._workflow(worktree).has_changes():
                recovery = self.config.recovery_dir / (
                    f"issue-{job.task.identifier}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
                )
                stale_workflow.archive_worktree(worktree, recovery)
            stale_workflow.remove_worktree(worktree, force=True)
        workflow = self._workflow(self.config.repository)
        workflow.prepare_pull_request_worktree(worktree, branch)
        job.branch = branch
        job.pull_request = pull_request
        job.head_sha = self._workflow(worktree).head_sha()
        bound = self.tasks.bind_pull_request(
            job.task.identifier,
            lease_owner,
            pull_request,
            branch,
            predecessor_pull_request=job.predecessor_pull_request,
        )
        self._copy_claim_metadata(job, bound)
        self.github.publish_review_pending(
            job.head_sha,
            detail="Factory pull request verification in progress",
        )
        self.github.add_comment(job.pull_request, comment)
        verified_paths = self._verify_or_schedule_quality_repair(
            job,
            self._workflow(worktree),
        )
        if verified_paths is None:
            return
        self._record_verified_head(job, lease_owner, verified_paths)
        job.state = JobState.REVIEWING

    def _bind_matched_pull_request(
        self,
        job: Job,
        match: PullRequestMatch,
        lease_owner: str,
    ) -> None:
        job.branch = match.branch
        job.pull_request = match.number
        job.head_sha = match.head_sha or job.head_sha
        bound = self.tasks.bind_pull_request(
            job.task.identifier,
            lease_owner,
            match.number,
            match.branch,
            predecessor_pull_request=job.predecessor_pull_request,
        )
        self._copy_claim_metadata(job, bound)

    def _record_verified_head(
        self,
        job: Job,
        lease_owner: str,
        verified_paths: set[Path],
    ) -> None:
        if job.head_sha is None:
            raise FactoryError("Verified job is missing its head SHA")
        job.latest_verified_sha = job.head_sha
        job.changed_path_fingerprint = changed_path_fingerprint(
            str(path) for path in verified_paths
        )
        bound = self.tasks.record_verification(
            job.task.identifier,
            lease_owner,
            job.head_sha,
            job.changed_path_fingerprint,
        )
        self._copy_claim_metadata(job, bound)

    def _refresh_pull_request_for_review(
        self,
        job: Job,
        worktree: Path,
        lease_owner: str,
    ) -> None:
        """Invalidate stale review provenance and rebuild at the current remote head."""
        if job.pull_request is None:
            raise FactoryError("Pull request number is missing")
        if job.branch is None:
            raise FactoryError("Pull request branch is missing")

        # Remove the merge-eligibility label before touching the worktree. The
        # independent-review status is SHA-scoped too, but clearing both labels
        # makes the invalidation explicit to every merge path and operator.
        self.github.remove_issue_labels(
            job.pull_request,
            ("factory-reviewed", "factory-review"),
        )

        workflow = self._workflow(self.config.repository)
        if worktree.exists():
            inspection = self._workflow(worktree)
            try:
                dirty = inspection.has_changes()
            except RepositorySafetyError:
                dirty = True
            if dirty:
                recovery = self.config.recovery_dir / (
                    f"issue-{job.task.identifier}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
                )
                workflow.archive_worktree(worktree, recovery)
            workflow.remove_worktree(worktree, force=dirty)

        workflow.prepare_pull_request_worktree(worktree, job.branch)
        job.head_sha = self._workflow(worktree).head_sha()
        self.github.publish_review_pending(
            job.head_sha,
            detail="Factory pull request refresh in progress",
        )
        job.review_findings.clear()
        verified_paths = self._verify_or_schedule_quality_repair(
            job,
            self._workflow(worktree),
        )
        if verified_paths is None:
            return
        self._record_verified_head(job, lease_owner, verified_paths)
        job.state = JobState.REVIEWING

    def _refresh_pull_request_if_changed(
        self,
        job: Job,
        worktree: Path,
        lease_owner: str,
    ) -> bool:
        """Refresh PR evidence before using or pushing it against a changed head."""
        if job.pull_request is None:
            return False

        status = self._status(job)
        if status.state == "MERGED":
            job.state = JobState.MERGED
            return True
        if job.head_sha == status.head_sha:
            return False

        self._refresh_pull_request_for_review(job, worktree, lease_owner)
        return True

    def _update_pull_request_branch(self, job: Job, status: PullRequestStatus) -> None:
        """Refresh a behind head without weakening reviewed-SHA protection."""

        if job.pull_request is None:
            raise FactoryError("Pull request number is missing")
        self.github.remove_issue_labels(
            job.pull_request,
            ("factory-reviewed", "factory-review"),
        )
        if job.head_sha is not None:
            self.github.publish_review_pending(
                job.head_sha,
                detail="Factory base branch update in progress",
            )
        self.github.update_pull_request_branch(job.pull_request, status.head_sha)

    @staticmethod
    def _mark_latest_review_as_mutating(job: Job) -> None:
        for entry in reversed(job.provider_history):
            if entry.get("phase") == "code-review" and entry.get("success") is True:
                entry["mutated_code"] = True
                return

    @staticmethod
    def _subject(job: Job) -> str:
        return "pull request" if job.task.source == "github-pull-request" else "issue"

    def _status(self, job: Job) -> PullRequestStatus:
        if job.pull_request is None:
            raise FactoryError("Pull request number is missing")
        return self.github.pull_request_status(job.pull_request)

    def _verify(self, workflow: GitWorkflow) -> set[Path]:
        changed = workflow.changed_paths()
        if not changed:
            raise FactoryError("No changed paths were found")
        commands = commands_for(workflow.repository, changed)
        # Only commands that bind a fixed host port (frontend-e2e's dev server)
        # need to be serialized across workers; everything else - lint, build,
        # unit tests, backend-test:e2e (ephemeral-port supertest, not a bound
        # port) - is safe to run at full worker parallelism. Running the shared
        # commands first also means a cheap, fast-failing check (lint, a broken
        # build) is judged before spending minutes on the exclusive one.
        shared = [command for command in commands if not command.exclusive]
        exclusive = [command for command in commands if command.exclusive]
        run_verification(shared)
        if not exclusive:
            return changed
        if self.verification_slots is None:
            run_verification(exclusive)
            return changed
        with self.verification_slots:
            run_verification(exclusive)
        return changed

    def _verify_or_schedule_quality_repair(
        self,
        job: Job,
        workflow: GitWorkflow,
    ) -> set[Path] | None:
        """Route deterministic verification failures into bounded agent repair."""
        try:
            changed = self._verify(workflow)
        except VerificationFailed as error:
            if job.quality_repairs >= 2:
                raise
            evidence = str(error)[-1800:]
            job.review_findings = [
                "Local verification failed. Repair the repository and keep all "
                f"Factory safety controls intact:\n{evidence}"
            ]
            job.state = JobState.QUALITY_REPAIRING
            return None
        return changed

    def _context_files(self, worktree: Path) -> list[tuple[Path, str]]:
        # README.md deliberately excluded: it embeds the full feature-spec
        # document (tens of KB), sent unconditionally on every implementation
        # call regardless of task scope. AGENTS.md carries the actual
        # enforceable constraints (i18n, RTL, Spartan, British English) that
        # every task needs; the issue body already carries whatever
        # task-specific scope README.md would otherwise repeat.
        context: list[tuple[Path, str]] = []
        for relative in (Path("AGENTS.md"), Path("TODO.md")):
            path = worktree / relative
            if path.is_file():
                context.append((relative, path.read_text(encoding="utf-8")))
        return context

    def _verification_descriptions(self, worktree: Path) -> list[str]:
        del worktree
        return [
            "npm run check:constitution",
            "npm run check:agent-ui-governance",
            "npm run check:design-sync",
            "npm run check:spartan-boundaries",
            "npm run check:spartan-full-tree",
            "npm run check:component-system",
            "npm run check:design-sync-drift",
            "npm run check:legacy-primitive-delta",
            "node scripts/check-conflict-markers.mjs",
            "node scripts/check-admin-audit-integrity.mjs",
            "node scripts/check-migration-delta.mjs",
            "cd automation && uv run --frozen ruff format --check .",
            "cd automation && uv run --frozen ruff check .",
            "cd automation && uv run --frozen mypy",
            "cd automation && uv run --frozen pytest",
            "cd frontend && npm run lint:check && npm run build && npm run test",
            "cd frontend && npm run e2e when frontend or e2e files changed",
            "cd backend && npm run lint:check && npm run build && npm run test && npm run test:e2e",
            "cd admin-portal && npm run lint:check && npm run build && npm run test",
        ]

    def _pull_request_body(self, job: Job) -> str:
        successful = [entry for entry in job.provider_history if entry.get("success") is True]
        provenance = "\n".join(
            "- "
            f"{entry.get('phase')}: {entry.get('provider')} "
            f"({entry.get('transport')}, {entry.get('model') or 'default model'})"
            for entry in successful
        )
        if not provenance:
            provenance = "- Provider provenance will be recorded before review."
        predecessor = (
            f"Supersedes #{job.predecessor_pull_request}\n"
            if job.predecessor_pull_request is not None
            else ""
        )
        return (
            f"Fixes #{job.task.identifier}\n\n"
            f"Logical-Task-Key: {job.task.logical_key}\n"
            f"Canonical-Branch: {job.branch or 'pending'}\n"
            f"Initial-Base-SHA: {job.initial_base_sha or 'pending'}\n"
            f"Changed-Path-Fingerprint: {job.changed_path_fingerprint or 'pending'}\n"
            f"{predecessor}\n"
            "## Factory execution\n\n"
            "This pull request was implemented, security reviewed, and locally verified by "
            "the bounded OpenHands factory. Independent review runs on this same branch before "
            "merge, and GitHub required checks remain authoritative.\n\n"
            "## Agent provenance\n\n"
            f"{provenance}\n\n"
            f"Reviewed head SHA: `{job.head_sha or 'pending'}`\n"
        )

    def architect_due(self) -> bool:
        """Whether enough time has passed to run another weekly gap-analysis cycle."""
        state = read_json(self._architect_state_path(), {})
        if not isinstance(state, dict):
            return True
        now = datetime.now(UTC)
        next_attempt_at = self._restore_architect_timestamp(state.get("next_attempt_at"))
        if next_attempt_at is not None and next_attempt_at > now:
            return False
        last_run_at = self._restore_architect_timestamp(state.get("last_run_at"))
        if last_run_at is None:
            return True
        elapsed = now - last_run_at
        return elapsed.total_seconds() / 3600 >= self.config.architect_interval_hours

    def run_architect_cycle(self) -> None:
        """Best-effort weekly gap analysis: propose new issues and roadmap updates.

        Unlike issue and pull request work, this is not modeled as a durable retried
        Job - a single bounded conversation either finds something worth proposing or
        it does not. If it fails or times out, the cooldown already recorded below
        means it simply tries again next interval rather than hot-looping.
        """
        attempted_at = datetime.now(UTC)
        self._write_architect_state(
            {
                "last_attempt_at": attempted_at.isoformat(),
                "next_attempt_at": (
                    attempted_at + timedelta(seconds=self.config.provider_cooldown_seconds)
                ).isoformat(),
            }
        )
        worktree = self.config.worktree_dir / "architect"
        prompt_dir = self.prompt_dir
        date_id = datetime.now(UTC).strftime("%G-W%V")
        cycle_id = f"architect-{date_id}-{attempted_at.strftime('%Y%m%dT%H%M%SZ')}"
        workflow = self._workflow(self.config.repository)
        task = Task(
            identifier=cycle_id,
            title="Weekly gap analysis",
            body=(
                "Compare AGENTS.md, FEATURES_SPEC.md, README.md and ROADMAP.md against the "
                "current codebase."
            ),
            source="github-architect",
            priority=10,
        )
        job = Job(task=task)

        def clear_architect_report() -> None:
            (worktree / ".factory-architect.json").unlink(missing_ok=True)

        def validate_architect_report() -> None:
            load_architect_report(worktree)

        def defer_after(error: Exception) -> None:
            retry_seconds = (
                error.retry_after_seconds
                if isinstance(error, ProviderCapacityUnavailable)
                and error.retry_after_seconds is not None
                else self.config.provider_cooldown_seconds
            )
            self._write_architect_state(
                {
                    "last_attempt_at": attempted_at.isoformat(),
                    "next_attempt_at": (
                        datetime.now(UTC) + timedelta(seconds=max(retry_seconds, 1))
                    ).isoformat(),
                    "last_error": f"{type(error).__name__}: {error}"[-1000:],
                    "provider_history": job.provider_history,
                }
            )

        try:
            self._recover_architect_worktree(worktree)
            branch = workflow.prepare_worktree(
                worktree,
                cycle_id,
                "weekly gap analysis",
            )
            self._run_agent(
                job,
                worktree,
                "architect",
                build_phase_prompt(prompt_dir, "architect", task),
                prepare_attempt=clear_architect_report,
                validate_output=validate_architect_report,
            )
            review_workflow = self._workflow(worktree)
            proposals = load_architect_report(worktree)
            (worktree / ".factory-architect.json").unlink(missing_ok=True)
            if proposals:
                self._create_deduplicated_issues(proposals)
            if review_workflow.has_changes():
                self._verify(review_workflow)
                review_workflow.stage_all()
                review_workflow.commit(f"docs: weekly architect gap analysis ({date_id})")
                review_workflow.push(branch)
                pull_request = self.github.create_pull_request(
                    branch,
                    f"docs: weekly gap analysis ({date_id})",
                    "Automated ROADMAP/spec update from the weekly architect cycle. "
                    "Independently reviewed like any other pull request before merging.",
                )
                self.github.add_comment(
                    pull_request,
                    (
                        "OpenHands factory architect opened this pull request from its weekly "
                        "gap analysis. It will be independently reviewed like any other pull "
                        "request before merging."
                    ),
                )
                self.jobs.save_job(
                    Job(
                        task=Task(
                            identifier=str(pull_request),
                            title=f"docs: weekly gap analysis ({date_id})",
                            body="Automated ROADMAP/spec update from the weekly architect cycle.",
                            source="github-pull-request",
                            priority=10,
                            pr_branch=branch,
                        ),
                        provider_history=list(job.provider_history),
                    )
                )
        except Exception as error:
            defer_after(error)
            self._recover_architect_worktree(worktree)
            raise
        else:
            self._workflow(self.config.repository).remove_worktree(worktree)
            self._write_architect_state(
                {
                    "last_attempt_at": attempted_at.isoformat(),
                    "last_run_at": datetime.now(UTC).isoformat(),
                    "next_attempt_at": None,
                    "provider_history": job.provider_history,
                }
            )

    def run_stall_investigation(self, reason: str, diagnostics: str) -> None:
        """Best-effort: alert immediately with deterministic evidence, then add an AI diagnosis.

        Two Telegram sends, not one, because the first must never depend on a healthy agent
        provider - the exact thing a stall may itself have taken down. The AI pass is a
        strictly-optional addition that reasons over the already-gathered evidence; it has no
        tool access and cannot make the situation worse by touching the repository or host.
        Never raises - this always runs from a background thread and must not affect scheduling.
        """
        from openhands_factory.agents.base import AgentPhase, AgentRequest

        alerts = AlertService(self.config)
        started_at = datetime.now(UTC)
        alerts.send(
            f"OpenHands factory alert: scheduling stalled\n\n{reason}\n\n{diagnostics}",
            category="factory-scheduling-stalled",
        )

        cycle_id = f"stall-investigation-{started_at.strftime('%Y%m%dT%H%M%SZ')}"
        task = Task(
            identifier=cycle_id,
            title="Factory stall investigation",
            body=diagnostics,
            source="factory-internal",
            priority=0,
        )
        job = Job(task=task)
        prompt = (
            (self.prompt_dir / "stall_investigation.md").read_text(encoding="utf-8")
            + "\n\n## Diagnostic snapshot\n\n"
            + diagnostics
        )
        # A plain empty directory, not a git worktree - this call never reads or
        # writes repository files, only reasons over the diagnostics text above.
        scratch = self.config.worktree_dir / "stall-investigation"
        scratch.mkdir(parents=True, exist_ok=True)
        request = AgentRequest(
            phase=AgentPhase.GENERAL_ACTION,
            task=task,
            prompt=prompt,
            cwd=scratch,
            system_prompt=self.system_prompt,
        )
        try:
            result = self.router.run(request, job)
            findings = (result.summary or "").strip() if result.success else None
        except Exception as error:
            LOGGER.warning("factory.stall_investigation.agent_failed error=%s", error)
            findings = None

        if findings:
            alerts.send(
                f"OpenHands factory alert: stall investigation findings\n\n{findings}",
                category="factory-scheduling-stalled-findings",
            )

    def _create_deduplicated_issues(self, proposals: list[ArchitectProposal]) -> list[int]:
        """Create proposed issues, skipping anything that already exists.

        This check is deliberately not delegated to the LLM: bulk-created near-
        duplicate issues from an earlier, unchecked version of this idea are what
        caused the swarm/factory collision quarantine spike this factory recovered
        from, so the dedup is enforced here in trusted code.
        """
        existing = {
            " ".join(title.split()).lower() for title in self.github.list_all_open_issue_titles()
        }
        created: list[int] = []
        for proposal in proposals[: self.config.architect_max_new_issues]:
            normalized = " ".join(proposal.title.split()).lower()
            if normalized in existing:
                continue
            number = self.github.create_issue(
                proposal.title, proposal.body, ("architect-proposed",)
            )
            created.append(number)
            existing.add(normalized)
        return created

    def _architect_state_path(self) -> Path:
        return self.config.state_dir / "architect_state.json"

    def _write_architect_state(self, value: dict[str, object]) -> None:
        atomic_write_json(self._architect_state_path(), value)

    @staticmethod
    def _restore_architect_timestamp(value: object) -> datetime | None:
        if not isinstance(value, str):
            return None
        try:
            restored = datetime.fromisoformat(value)
        except ValueError:
            return None
        return restored if restored.tzinfo is not None else restored.replace(tzinfo=UTC)

    def _recover_architect_worktree(self, worktree: Path) -> None:
        if not worktree.exists():
            return
        workflow = self._workflow(self.config.repository)
        inspection = self._workflow(worktree)
        try:
            dirty = inspection.has_changes()
        except RepositorySafetyError:
            dirty = True
        if not dirty:
            try:
                dirty = bool(inspection.changed_paths())
            except RepositorySafetyError:
                dirty = True
        if dirty:
            recovery = self.config.recovery_dir / (
                f"architect-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%fZ')}"
            )
            workflow.archive_worktree(worktree, recovery)
        workflow.remove_worktree(worktree, force=dirty)

    def _triage_task(self, task: Task) -> frozenset[str]:
        """Classify worker sizing deterministically without bypassing AgentRouter."""
        content = f"{task.title}\n{task.body}".lower()
        if any(marker in content for marker in ("ci", "pipeline", "build failure", "lint")):
            return frozenset({"ci-fix"})
        if any(
            marker in content for marker in ("refactor", "architecture", "migration", "redesign")
        ):
            return frozenset({"deep-refactor"})
        return frozenset({"terminal-task"})
