"""Recoverable issue-to-merge pipeline for one bounded job transition at a time."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from threading import Semaphore

from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationRunner, sdk_conversation_factory
from openhands_factory.exceptions import FactoryError, RepositorySafetyError
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.github import GitHubClient, PullRequestStatus
from openhands_factory.jobs import JobStore
from openhands_factory.models import Job, JobState
from openhands_factory.prompts import build_phase_prompt, build_task_prompt
from openhands_factory.quality_gate import check_quality_gate
from openhands_factory.review_report import validate_review_report
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
    JobState.QUARANTINED,
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
        self.labels_ready = False
        self.verification_slots = verification_slots

    def refresh(self, protected_task_ids: set[str] | None = None) -> dict[str, Job]:
        if not self.labels_ready:
            self.github.ensure_factory_labels()
            self.labels_ready = True
        tasks = self.github.collect_open_issues()
        self.tasks.cache(tasks)
        jobs = self.jobs.reconcile(tasks)
        # A daemon restart or an interrupted worker can leave a lease behind while the
        # durable job is still discovered. Such jobs are safe to reclaim before scheduling.
        for task_id, job in jobs.items():
            if job.state is JobState.DISCOVERED:
                self.tasks.release(task_id)
        active_task_ids = {task.identifier for task in tasks}
        protected = protected_task_ids or set()
        for task_id, job in jobs.items():
            if (
                task_id in active_task_ids
                or task_id in protected
                or job.state not in PRE_PULL_REQUEST_STATES
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
            job.last_error = "Issue closed before pull request creation"
            self.jobs.save_job(job)
        return self.jobs.load()

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
        except Exception as error:
            job.attempts += 1
            job.last_error = str(error)[-2000:]
            LOGGER.exception("Factory job %s failed", job.task.identifier)
            if job.attempts >= self.config.max_consecutive_failures:
                job.state = JobState.QUARANTINED
                self.tasks.release(job.task.identifier)
                self.github.add_issue_labels(
                    int(job.task.identifier), ("factory-quarantined", "needs-human")
                )
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
        except Exception as error:
            job.attempts += 1
            job.last_error = str(error)[-2000:]
            LOGGER.exception("Factory job %s failed", job.task.identifier)
            if job.attempts >= self.config.max_consecutive_failures:
                job.state = JobState.QUARANTINED
                self.tasks.release(job.task.identifier)
                self.github.add_issue_labels(
                    int(job.task.identifier), ("factory-quarantined", "needs-human")
                )
        job.updated_at = datetime.now(UTC)
        self.jobs.save_job(job)
        return job

    def _advance(self, job: Job) -> None:
        worktree = self.config.worktree_dir / f"issue-{job.task.identifier}"
        prompt_dir = self.config.repository / "automation/prompts"
        if job.state is JobState.DISCOVERED:
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

        workflow = GitWorkflow(worktree, self.config.base_branch)
        if job.state is JobState.IMPLEMENTING:
            context_files = self._context_files(worktree)
            prompt = build_task_prompt(
                prompt_dir,
                job.task,
                context_files,
                self._verification_descriptions(worktree),
                [],
            )
            self.conversations.run(job.task, worktree, prompt)
            if not workflow.has_changes():
                raise FactoryError("Implementation produced no repository changes")
            job.state = JobState.SECURITY_REVIEW
            return

        if job.state is JobState.SECURITY_REVIEW:
            self.conversations.run(
                job.task, worktree, build_phase_prompt(prompt_dir, "security", job.task)
            )
            job.state = JobState.VERIFYING
            return

        if job.state is JobState.VERIFYING:
            self._verify(workflow)
            findings = check_quality_gate(workflow, self.config.base_branch)
            if findings:
                if getattr(job, "quality_repairs", 0) >= 1:
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

            self.conversations.run(
                job.task,
                worktree,
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
            self.conversations.run(
                job.task, worktree, build_phase_prompt(prompt_dir, "review", job.task)
            )
            report = validate_review_report(worktree, job.task.body)
            if workflow.has_changes():
                self._verify(workflow)
                workflow.stage_all()
                workflow.commit(f"fix: address review for issue {job.task.identifier}")
                if job.branch is None:
                    raise FactoryError("Job branch is missing")
                workflow.push(job.branch)
                job.head_sha = workflow.head_sha()
                job.repair_attempts += 1
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
            self.conversations.run(
                job.task, worktree, build_phase_prompt(prompt_dir, "repair", job.task)
            )
            if not workflow.has_changes():
                raise FactoryError("Repair conversation produced no changes")
            self._verify(workflow)
            workflow.stage_all()
            workflow.commit(f"fix: repair CI for issue {job.task.identifier}")
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
            self.github.close_issue(int(job.task.identifier))
            GitWorkflow(self.config.repository, self.config.base_branch).remove_worktree(worktree)
            self.tasks.release(job.task.identifier)
            job.state = JobState.DONE

    def _status(self, job: Job) -> PullRequestStatus:
        if job.pull_request is None:
            raise FactoryError("Pull request number is missing")
        return self.github.pull_request_status(job.pull_request)

    def _verify(self, workflow: GitWorkflow) -> None:
        changed = workflow.changed_paths()
        if not changed:
            raise FactoryError("No changed paths were found")
        commands = commands_for(workflow.repository, changed)
        if self.verification_slots is None:
            run_verification(commands)
            return
        with self.verification_slots:
            run_verification(commands)

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
