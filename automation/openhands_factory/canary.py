"""One admitted Neptune issue transition through the existing Factory lifecycle."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from openhands_factory.config import FactoryConfig
from openhands_factory.daemon import is_new_github_issue
from openhands_factory.doctor import (
    Check,
    github_merge_policy_check,
    github_repository_access_check,
    run_doctor,
)
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.gated_daemon import MainCiGatedFactoryDaemon
from openhands_factory.models import Job, JobState
from openhands_factory.pipeline import TERMINAL_STATES


class SingleIssueCanary(MainCiGatedFactoryDaemon):
    """Use normal startup ownership/security, then checkpoint exactly one issue.

    This has no scheduling loop, backlog generator or continuity switch. Repeated
    invocations advance durable state without replaying a completed model phase.
    Existing provider deadlines, quotas, CAS leases and failure backoff still apply.
    """

    def __init__(
        self, config: FactoryConfig, issue: int, *, supervised_session: bool = False
    ) -> None:
        super().__init__(config)
        self.issue = str(issue)
        if supervised_session:
            from openhands_factory.session_identity import SessionIdentityJournal

            self.pipeline.router.supervise_sessions(
                SessionIdentityJournal(config.state_dir / "manual-session-identities")
            )

    def _report(self, job: Job, *, advanced: bool) -> int:
        print(
            json.dumps(
                {
                    "schema": "repo-factory.neptune-canary.v1",
                    "issue": self.issue,
                    "state": job.state.value,
                    "advanced": advanced,
                    "pull_request": job.pull_request,
                    "recoverable_error": job.last_error is not None,
                    "next_attempt_at": (
                        job.next_attempt_at.isoformat() if job.next_attempt_at else None
                    ),
                    "continuity_enabled": False,
                }
            )
        )
        return 1 if job.last_error else 0

    def _loop(self) -> int:
        self._assert_owner()
        if self.paused() or not self._storage_ready():
            raise ConfigurationError("Canary is paused or the existing storage reserve is unmet")
        # Admission comes exclusively from the ordinary trusted/ready intake.
        # A cached job alone must never admit a closed, unlabelled or untrusted issue.
        self.pipeline.refresh(protected_task_ids={self.issue})
        job = self.pipeline.jobs.load().get(self.issue)
        if job is None or job.task.source != "github-issue":
            raise ConfigurationError("Canary issue has no reconciled durable issue job")
        if job.state in TERMINAL_STATES:
            return self._report(job, advanced=False)
        tasks = {task.identifier: task for task in self.pipeline.tasks.cached()}
        task = tasks.get(self.issue)
        if task is None or task.source != "github-issue":
            # Native auto-merge can close the issue before the next invocation.
            # Only existing non-model reconciliation states may advance then,
            # after a fresh GitHub read proves the recorded PR really merged.
            reconcile_merged = (
                job.state in {JobState.CI_PENDING, JobState.MERGE_QUEUED, JobState.MERGED}
                and job.pull_request is not None
                and self.pipeline.github.pull_request_status(job.pull_request).state == "MERGED"
            )
            if not reconcile_merged:
                raise ConfigurationError("Canary issue is not admitted by trusted ready intake")
        if job.next_attempt_at is not None and job.next_attempt_at > datetime.now(UTC):
            return self._report(job, advanced=False)
        if is_new_github_issue(job) and (
            self.pipeline.pull_request_capacity.pause_new_dispatch
            or not self.issue_admission.admit(self.issue)
        ):
            raise ConfigurationError(
                "Canary is blocked by the existing WIP or issue admission budget"
            )
        original_merge = self.pipeline.github.merge_pull_request

        def fenced_merge(pull_request: int, expected_head_sha: str) -> None:
            self._gated_merge_pull_request(original_merge, pull_request, expected_head_sha)

        self.pipeline.github.merge_pull_request = fenced_merge  # type: ignore[method-assign]
        try:
            result = self.pipeline.run_job(self.issue)
        finally:
            self.pipeline.github.merge_pull_request = original_merge  # type: ignore[method-assign]
        return self._report(result or job, advanced=result is not None)


def run_canary(
    config: FactoryConfig, issue: int | None, *, supervised_session: bool = False
) -> int:
    """Fail before startup/mutation if this is not the explicit Neptune canary."""
    if not config.tests_only_merging or type(issue) is not int or issue <= 0:
        raise ConfigurationError("Live task run requires an explicit positive Neptune issue")
    checks = [
        *run_doctor(config, online=False, include_runtime=False),
        github_repository_access_check(config),
        github_merge_policy_check(config),
    ]
    if supervised_session:
        from openhands_factory.agents.process import agent_process_isolation_probe

        supported, reason = agent_process_isolation_probe()
        checks.append(Check("manual-session-containment", supported, reason))
    failed = [check.name for check in checks if not check.passed]
    if failed:
        raise ConfigurationError("Canary readiness failed: " + ", ".join(failed))
    if supervised_session:
        return SingleIssueCanary(config, issue, supervised_session=True).run()
    return SingleIssueCanary(config, issue).run()
