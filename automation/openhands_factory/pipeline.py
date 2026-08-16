"""Recoverable issue-to-merge pipeline for one bounded job transition at a time."""

from __future__ import annotations

import dataclasses
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Semaphore

from openhands_factory.architect_report import ArchitectProposal, load_architect_report
from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationRunner, sdk_conversation_factory
from openhands_factory.exceptions import FactoryError, RepositorySafetyError
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.github import GitHubClient, PullRequestStatus
from openhands_factory.jobs import JobStore
from openhands_factory.models import Job, JobState, Task
from openhands_factory.prompts import build_phase_prompt, build_task_prompt
from openhands_factory.quality_gate import check_quality_gate
from openhands_factory.review_report import validate_review_report
from openhands_factory.state import atomic_write_json, read_json
from openhands_factory.task_source import TaskStore
from openhands_factory.verification import commands_for, run_verification

LOGGER = logging.getLogger(__name__)
TERMINAL_STATES = {JobState.DONE, JobState.QUARANTINED}
PRE_PULL_REQUEST_STATES = {
    JobState.DISCOVERED,
    JobState.IMPLEMENTING,
    JobState.SECURITY_REVIEW,
    JobState.VERIFYING,
    JobState.QUALITY_REPAIRING,
    JobState.PR_DRAFT,
}


class FactoryPipeline:
    def __init__(
        self,
        config: FactoryConfig,
        github: GitHubClient | None = None,
        conversations: ConversationRunner | None = None,
        verification_slots: Semaphore | None = None,
    ) -> None:
        self.config = config
        self.github = github or GitHubClient(
            config.github_repository,
            config.repository,
            config.github_token.get_secret_value(),
            base_branch=config.base_branch,
            require_ready_label=config.require_ready_label,
            ready_label=config.ready_label,
        )
        self.jobs = JobStore(config.state_dir / "jobs.json")
        self.tasks = TaskStore(config.state_dir)
        self.conversations = conversations or ConversationRunner(
            config, sdk_conversation_factory(config)
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
        )
        from openhands_factory.agents.base import AgentProvider

        self.health_store = AgentHealthStore(config.state_dir / "agent_health.json")

        def provider_command(name: str, default: str) -> str:
            provider = config.agents.providers.get(name)
            return provider.command if provider and provider.command else default

        providers: list[AgentProvider] = [
            ClaudeCodeProvider(command=provider_command("claude", "claude")),
            CodexProvider(command=provider_command("codex", "codex")),
            GoogleAgentProvider(command=provider_command("google", "gemini")),
            OpenCodeProvider(command=provider_command("opencode", "opencode")),
            OpenHandsProvider(self.conversations),
        ]
        self.router = AgentRouter(
            providers=providers,
            policy=ConfigRoutingPolicy(config.agents),
            health_store=self.health_store,
            failure_threshold=config.max_consecutive_failures,
            cooldown_seconds=config.provider_cooldown_seconds,
        )
        self.labels_ready = False
        self.verification_slots = verification_slots

    def refresh(self, protected_task_ids: set[str] | None = None) -> dict[str, Job]:
        if not self.labels_ready:
            self.github.ensure_factory_labels()
            self.labels_ready = True
        tasks = self.github.collect_open_issues() + self.github.collect_open_pull_requests()
        self.tasks.cache(tasks)
        jobs = self.jobs.reconcile(tasks)
        # A daemon restart or an interrupted worker can leave a lease behind while the
        # durable job is still discovered. Such jobs are safe to reclaim before scheduling.
        for task_id, job in jobs.items():
            if job.state is JobState.DISCOVERED:
                self.tasks.release(task_id)
        active_task_ids = {task.identifier for task in tasks}
        protected = protected_task_ids or set()
        dirty_jobs = False
        for task_id, job in jobs.items():
            if (
                task_id in active_task_ids
                or task_id in protected
                or job.state in TERMINAL_STATES
            ):
                continue
            worktree = self.config.worktree_dir / f"issue-{task_id}"
            if worktree.exists():
                workflow = GitWorkflow(self.config.repository, self.config.base_branch)
                inspection = GitWorkflow(worktree, self.config.base_branch)
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
            dirty_jobs = True
        if dirty_jobs:
            self.jobs.save(jobs)
        return jobs

    def run_once(self) -> Job | None:
        jobs = self.refresh()
        candidates = [job for job in jobs.values() if job.state not in TERMINAL_STATES]
        if not candidates:
            return None
        job = min(candidates, key=lambda item: (item.task.priority, int(item.task.identifier)))
        try:
            self._advance(job)
            job.attempts = 0
            job.last_error = None
            job.next_attempt_at = None
        except Exception as error:
            job.attempts += 1
            job.last_error = str(error)[-2000:]
            self._record_failure(job)
        job.updated_at = datetime.now(UTC)
        jobs[job.task.identifier] = job
        self.jobs.save(jobs)
        return job

    def run_job(self, task_id: str) -> Job | None:
        """Advance one scheduler-selected job and merge only its durable state."""
        job = self.jobs.load().get(task_id)
        if job is None or job.state in TERMINAL_STATES:
            return None
        try:
            self._advance(job)
            job.attempts = 0
            job.last_error = None
            job.next_attempt_at = None
        except Exception as error:
            job.attempts += 1
            job.last_error = str(error)[-2000:]
            self._record_failure(job)
        job.updated_at = datetime.now(UTC)
        self.jobs.save_job(job)
        return job

    def _record_failure(self, job: Job) -> None:
        LOGGER.exception("Factory job %s failed", job.task.identifier)
        self.tasks.release(job.task.identifier)
        if job.attempts < self.config.max_consecutive_failures:
            job.next_attempt_at = datetime.now(UTC) + self._backoff_for(job.attempts)
            return
        if job.last_error and "no repository changes" in job.last_error:
            # Every attempt produced an empty diff. That almost always means the work
            # was already implemented (often by another pipeline racing on the same
            # issue), not that the task is impossible. Close it instead of retrying
            # forever for no reason.
            self._close_as_already_satisfied(job)
            return
        # There is no permanent give-up state. A persistently broken task keeps being
        # retried, with exponential backoff so it does not burn worker capacity or
        # budget while it fails. This is routine, expected self-correction, not an
        # incident: it is not paged. Genuinely exceptional conditions (the daemon
        # crashing, budget exhaustion, no pull request progress for hours) still alert
        # through doctor.py and daemon.py.
        job.next_attempt_at = datetime.now(UTC) + self._backoff_for(job.attempts)

    def _run_agent(self, job: Job, worktree: Path, phase: str, prompt: str) -> None:
        from typing import Any

        from openhands_factory.agents.base import AgentPhase, AgentRequest

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
        request = AgentRequest(phase=agent_phase, task=job.task, prompt=prompt, cwd=worktree)

        excluded: set[str] = set()
        if agent_phase is AgentPhase.CODE_REVIEW:
            excluded = {
                str(entry["provider"])
                for entry in job.provider_history
                if entry.get("phase") == AgentPhase.IMPLEMENTATION.value
                and isinstance(entry.get("provider"), str)
            }
        result = self.router.run(request, job, exclude=excluded)

        # Track history
        for attempt in self.router.last_attempts or [result]:
            history_entry: dict[str, Any] = {
                "provider": attempt.provider,
                "phase": attempt.phase.value,
                "success": attempt.success,
                "started_at": attempt.started_at.isoformat(),
                "finished_at": attempt.finished_at.isoformat(),
            }
            if attempt.exit_code is not None:
                history_entry["exit_code"] = attempt.exit_code
            if attempt.failure:
                history_entry["error"] = attempt.failure.message
                history_entry["kind"] = attempt.failure.kind.value
            job.provider_history.append(history_entry)

        if not result.success:
            if result.failure:
                if result.provider == "openhands":
                    raise FactoryError(result.failure.message)
                raise FactoryError(
                    f"Agent provider '{result.provider}' failed: {result.failure.message}"
                )
            raise FactoryError(f"Agent provider '{result.provider}' failed during {phase}")

    @staticmethod
    def _backoff_for(attempts: int) -> timedelta:
        minutes = min(5 * 2 ** max(attempts - 1, 0), 24 * 60)
        return timedelta(minutes=minutes)

    def _close_as_already_satisfied(self, job: Job) -> None:
        worktree = self.config.worktree_dir / f"issue-{job.task.identifier}"
        self.github.add_comment(
            int(job.task.identifier),
            (
                "OpenHands factory made repeated implementation attempts and produced no "
                "repository changes each time. This usually means the work was already "
                "completed by another pipeline. Closing as already satisfied — reopen if "
                "this is incorrect."
            ),
        )
        self.github.close_issue(int(job.task.identifier))
        GitWorkflow(self.config.repository, self.config.base_branch).remove_worktree(worktree)
        job.state = JobState.DONE

    def _advance(self, job: Job) -> None:
        worktree = self.config.worktree_dir / f"issue-{job.task.identifier}"
        # Read from the task's own worktree, not the shared base checkout: the worktree
        # is always freshly created from origin/main, while the base checkout's working
        # tree is only ever fetched (refs updated), never reset, and can drift stale.
        prompt_dir = worktree / "automation/prompts"
        if job.state is JobState.DISCOVERED:
            if job.task.source == "github-pull-request":
                self._discover_pull_request(job, worktree)
                return
            if worktree.exists():
                stale_workflow = GitWorkflow(self.config.repository, self.config.base_branch)
                if GitWorkflow(worktree, self.config.base_branch).has_changes():
                    recovery = self.config.recovery_dir / (
                        f"issue-{job.task.identifier}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
                    )
                    stale_workflow.archive_worktree(worktree, recovery)
                stale_workflow.remove_worktree(worktree, force=True)
            if job.task.source == "github-issue":
                tags = self._triage_task(job.task)
                if tags:
                    job.task = dataclasses.replace(job.task, triage_tags=tags)
            self.tasks.acquire(job.task, "factory")
            workflow = GitWorkflow(self.config.repository, self.config.base_branch)
            job.branch = workflow.prepare_worktree(worktree, job.task.identifier, job.task.title)
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

        workflow = GitWorkflow(
            worktree,
            self.config.base_branch,
            external_branch=job.branch if job.task.source == "github-pull-request" else None,
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
            self._run_agent(job, worktree, "implementation", prompt)
            if not workflow.has_changes():
                raise FactoryError("Implementation produced no repository changes")
            job.state = JobState.SECURITY_REVIEW
            return

        if job.state is JobState.SECURITY_REVIEW:
            self._run_agent(
                job, worktree, "security", build_phase_prompt(prompt_dir, "security", job.task)
            )
            job.state = JobState.VERIFYING
            return

        if job.state is JobState.VERIFYING:
            self._verify(workflow)
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
            job.state = JobState.PR_DRAFT
            return

        if job.state is JobState.QUALITY_REPAIRING:
            findings = check_quality_gate(workflow, self.config.base_branch)
            if not findings:
                job.state = JobState.VERIFYING
                return

            finding_text = "\n".join(
                f"- {f.code} in {f.path}: {f.summary}\n  Evidence: {f.evidence}" for f in findings
            )
            extra = f"Quality gate findings:\n\n{finding_text}"

            self._run_agent(
                job,
                worktree,
                "quality_repair",
                build_phase_prompt(prompt_dir, "quality_repair", job.task, extra=extra),
            )

            if not workflow.has_changes():
                raise FactoryError("Quality repair produced no changes")

            job.quality_repairs += 1
            job.state = JobState.VERIFYING
            return

        if job.state is JobState.PR_DRAFT:
            if job.branch is None:
                raise FactoryError("Job branch is missing")
            job.pull_request = self.github.create_pull_request(
                job.branch,
                f"Fixes #{job.task.identifier}: {job.task.title}",
                self._pull_request_body(job),
            )
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
            # The worktree persists across retries of this state, so a review report
            # left behind by an earlier failed attempt (crashed conversation, hit its
            # turn budget, etc.) must not be re-validated as if it were fresh: remove
            # it before running the conversation, so a conversation that fails to
            # (re)write a valid report is reported as missing one, not judged against
            # someone else's stale output.
            (worktree / ".factory-review.json").unlink(missing_ok=True)
            self._run_agent(
                job, worktree, "review", build_phase_prompt(prompt_dir, "review", job.task)
            )
            report = validate_review_report(worktree, job.task.body)
            if workflow.has_changes():
                self._verify(workflow)
                workflow.stage_all()
                subject = self._subject(job)
                workflow.commit(f"fix: address review for {subject} {job.task.identifier}")
                if job.branch is None:
                    raise FactoryError("Job branch is missing")
                workflow.push(job.branch)
                job.head_sha = workflow.head_sha()
                job.repair_attempts += 1
                if job.repair_attempts > 5:
                    raise FactoryError("Review repair limit exceeded")
                job.state = JobState.REVIEWING
                return
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
            job.state = JobState.CI_PENDING
            return

        if job.state is JobState.CI_PENDING:
            status = self._status(job)
            if status.state == "MERGED":
                job.state = JobState.MERGED
            elif status.checks_pending:
                return
            elif status.checks_passed and status.mergeable == "MERGEABLE":
                if job.head_sha and status.head_sha != job.head_sha:
                    raise FactoryError("Pull request head differs from the reviewed SHA")
                self.github.enable_auto_merge(status.number)
                job.state = JobState.MERGE_QUEUED
            else:
                job.state = JobState.REPAIRING
            return

        if job.state is JobState.REPAIRING:
            if job.repair_attempts >= 5:
                raise FactoryError("Repair limit exceeded")
            self._run_agent(
                job, worktree, "repair", build_phase_prompt(prompt_dir, "repair", job.task)
            )
            if not workflow.has_changes():
                raise FactoryError("Repair conversation produced no changes")
            self._verify(workflow)
            workflow.stage_all()
            workflow.commit(f"fix: repair CI for {self._subject(job)} {job.task.identifier}")
            if job.branch is None:
                raise FactoryError("Job branch is missing")
            workflow.push(job.branch)
            job.head_sha = workflow.head_sha()
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
            status = self._status(job)
            if status.state == "MERGED":
                job.state = JobState.MERGED
            return

        if job.state is JobState.MERGED:
            if job.pull_request is not None:
                self.github.add_comment(
                    job.pull_request,
                    "OpenHands factory confirmed that GitHub merged this pull request.",
                )
            if job.task.source == "github-issue":
                self.github.close_issue(int(job.task.identifier))
            GitWorkflow(self.config.repository, self.config.base_branch).remove_worktree(worktree)
            self.tasks.release(job.task.identifier)
            job.state = JobState.DONE

    def _discover_pull_request(self, job: Job, worktree: Path) -> None:
        """Start independently reviewing a pull request the factory did not create.

        Skips straight to REVIEWING and reuses the rest of the state machine
        (verification, repair, CI polling, merge) unchanged - the only difference
        from an issue-driven job is that the branch and pull request already exist.
        """
        if job.task.pr_branch is None:
            raise FactoryError("Pull request branch is missing")
        if worktree.exists():
            stale_workflow = GitWorkflow(self.config.repository, self.config.base_branch)
            if GitWorkflow(worktree, self.config.base_branch).has_changes():
                recovery = self.config.recovery_dir / (
                    f"issue-{job.task.identifier}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
                )
                stale_workflow.archive_worktree(worktree, recovery)
            stale_workflow.remove_worktree(worktree, force=True)
        self.tasks.acquire(job.task, "factory")
        workflow = GitWorkflow(self.config.repository, self.config.base_branch)
        workflow.prepare_pull_request_worktree(worktree, job.task.pr_branch)
        job.branch = job.task.pr_branch
        job.pull_request = int(job.task.identifier)
        job.head_sha = GitWorkflow(worktree, self.config.base_branch).head_sha()
        self.github.add_comment(
            job.pull_request,
            (
                "OpenHands factory is independently reviewing this pull request. It will "
                "run verification, repair failures if needed, and merge once its checks "
                "pass and the reviewed commit is still current."
            ),
        )
        job.state = JobState.REVIEWING

    @staticmethod
    def _subject(job: Job) -> str:
        return "pull request" if job.task.source == "github-pull-request" else "issue"

    def _status(self, job: Job) -> PullRequestStatus:
        if job.pull_request is None:
            raise FactoryError("Pull request number is missing")
        return self.github.pull_request_status(job.pull_request)

    def _verify(self, workflow: GitWorkflow) -> None:
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
            return
        if self.verification_slots is None:
            run_verification(exclusive)
            return
        with self.verification_slots:
            run_verification(exclusive)

    def _context_files(self, worktree: Path) -> list[tuple[Path, str]]:
        context: list[tuple[Path, str]] = []
        for relative in (Path("AGENTS.md"), Path("TODO.md"), Path("README.md")):
            path = worktree / relative
            if path.is_file():
                context.append((relative, path.read_text(encoding="utf-8")))
        return context

    def _verification_descriptions(self, worktree: Path) -> list[str]:
        return [
            "npm run check:constitution",
            "npm run lint:check",
            "npm run build",
            "npm test",
            f"python -m pytest {worktree / 'automation/tests'}",
        ]

    def _pull_request_body(self, job: Job) -> str:
        return (
            f"Fixes #{job.task.identifier}\n\n"
            "## Factory execution\n\n"
            "This pull request was planned, implemented, security reviewed, locally verified and "
            "independently reviewed by the bounded OpenHands factory. GitHub required checks "
            "remain authoritative.\n\n"
            f"Reviewed head SHA: `{job.head_sha or 'pending'}`\n"
        )

    def architect_due(self) -> bool:
        """Whether enough time has passed to run another weekly gap-analysis cycle."""
        state = read_json(self._architect_state_path(), {})
        last_run_at = state.get("last_run_at")
        if last_run_at is None:
            return True
        elapsed = datetime.now(UTC) - datetime.fromisoformat(last_run_at)
        return elapsed.total_seconds() / 3600 >= self.config.architect_interval_hours

    def run_architect_cycle(self) -> None:
        """Best-effort weekly gap analysis: propose new issues and roadmap updates.

        Unlike issue and pull request work, this is not modeled as a durable retried
        Job - a single bounded conversation either finds something worth proposing or
        it does not. If it fails or times out, the cooldown already recorded below
        means it simply tries again next interval rather than hot-looping.
        """
        atomic_write_json(
            self._architect_state_path(), {"last_run_at": datetime.now(UTC).isoformat()}
        )
        worktree = self.config.worktree_dir / "architect"
        # See the matching comment in _advance(): read from the worktree, not the
        # shared base checkout, so this always uses the current prompt on origin/main.
        prompt_dir = worktree / "automation/prompts"
        if worktree.exists():
            GitWorkflow(self.config.repository, self.config.base_branch).remove_worktree(
                worktree, force=True
            )
        date_id = datetime.now(UTC).strftime("%G-W%V")
        workflow = GitWorkflow(self.config.repository, self.config.base_branch)
        branch = workflow.prepare_worktree(worktree, f"architect-{date_id}", "weekly gap analysis")
        task = Task(
            identifier=f"architect-{date_id}",
            title="Weekly gap analysis",
            body=(
                "Compare AGENTS.md, FEATURES_SPEC.md, README.md and ROADMAP.md against the "
                "current codebase."
            ),
            source="github-architect",
            priority=10,
        )
        job = Job(task=task)
        self._run_agent(
            job,
            worktree,
            "architect",
            build_phase_prompt(prompt_dir, "architect", task),
        )
        review_workflow = GitWorkflow(worktree, self.config.base_branch)
        proposals = load_architect_report(worktree)
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
                "Automated ROADMAP/spec update from the weekly architect cycle. Independently "
                "reviewed like any other pull request before merging.",
            )
            self.github.add_comment(
                pull_request,
                (
                    "OpenHands factory architect opened this pull request from its weekly gap "
                    "analysis. It will be independently reviewed like any other pull request "
                    "before merging."
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
                    )
                )
            )
            GitWorkflow(self.config.repository, self.config.base_branch).remove_worktree(worktree)
        else:
            GitWorkflow(self.config.repository, self.config.base_branch).remove_worktree(worktree)

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

    def _triage_task(self, task: Task) -> frozenset[str]:
        from openhands_factory.models import ProviderName

        try:
            from openhands.sdk import Message, TextContent

            from openhands_factory.provider_profiles import build_llm

            # Triage uses the configured OpenCode subscription and is optional.
            llm = build_llm(self.config, provider=ProviderName.OPENCODE_GO, role="triage")

            prompt = (
                "Analyze this issue and tag it with ONE of: "
                "[deep-refactor, ci-fix, terminal-task].\n\n"
                f"Title: {task.title}\nBody: {task.body}\n\n"
                "Reply with JUST the tag name and nothing else."
            )

            message = Message(role="user", content=[TextContent(text=prompt)])
            response = llm.completion(messages=[message])

            content = " ".join(
                item.text
                for item in response.message.content
                if isinstance(item, TextContent)
            )
            if content:
                tag = content.strip().lower()
                for valid in ["deep-refactor", "ci-fix", "terminal-task"]:
                    if valid in tag:
                        return frozenset({valid})
        except Exception as e:
            LOGGER.warning("Triage failed for task %s: %s", task.identifier, e)
        return frozenset()
