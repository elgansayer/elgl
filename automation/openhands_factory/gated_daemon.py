"""Factory daemon variant that serializes merges behind current-main CI."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from openhands_factory import daemon as daemon_module
from openhands_factory.config import FactoryConfig
from openhands_factory.main_merge_gate import MainBranchMergeGate, gate_merge_batch
from openhands_factory.models import Job, JobState, Task

SelectBatch = Callable[..., list[Job]]
MergePullRequest = Callable[[int, str], None]
CollectOpenIssues = Callable[[int], list[Task]]


class MainCiGatedFactoryDaemon(daemon_module.FactoryDaemon):
    """Run the ordinary daemon with fail-closed scheduling and execution fences.

    The production daemon owns one scheduler process under ``factory.lock``. The
    scheduler hook is installed only for that process and preserves the ordinary
    queue algorithm for every non-merge transition. A second guard is installed at
    the actual merge call so a job selected from a green base cannot merge after
    another actor changes ``main`` and makes the current head unverified.
    """

    def __init__(self, config: FactoryConfig) -> None:
        super().__init__(config)
        self.main_merge_gate = MainBranchMergeGate(
            config.github_repository,
            config.repository,
            config.github_token.get_secret_value(),
            base_branch=config.base_branch,
        )

    def _gated_select_batch(
        self,
        original: SelectBatch,
        jobs: dict[str, Job],
        limit: int,
        excluded_task_ids: set[str] | None = None,
        now: datetime | None = None,
        new_issue_slots: int | None = None,
        review_first: bool = True,
        review_lane_max_concurrent: int = 1,
    ) -> list[Job]:
        batch = original(
            jobs,
            limit,
            excluded_task_ids,
            now,
            new_issue_slots,
            review_first,
            review_lane_max_concurrent,
        )
        if not any(job.state is JobState.MERGE_QUEUED for job in batch):
            return batch

        excluded = excluded_task_ids or set()
        merge_in_flight = any(
            task_id in jobs and jobs[task_id].state is JobState.MERGE_QUEUED for task_id in excluded
        )
        if merge_in_flight:
            return gate_merge_batch(batch, main_ci_green=False)
        return gate_merge_batch(batch, main_ci_green=self.main_merge_gate.is_green())

    def _gated_merge_pull_request(
        self,
        original: MergePullRequest,
        pull_request: int,
        expected_head_sha: str,
    ) -> None:
        """Re-check exact current-main CI immediately before a merge side effect.

        Selection-time gating is insufficient when a worker waits behind other
        work or another merge actor changes ``main`` after scheduling. A missing,
        pending, failed, or unreadable exact-main CI run therefore turns this merge
        attempt into a no-op. The pipeline keeps the job MERGE_QUEUED and retries it
        after the current main head has completed canonical CI.
        """

        if not self.main_merge_gate.is_green():
            return
        original(pull_request, expected_head_sha)

    def _collect_open_issues_for_refresh(
        self,
        original: CollectOpenIssues,
        limit: int = 10_000,
        *,
        now: datetime | None = None,
    ) -> list[Task]:
        """Refresh the large issue backlog only when admission can consume it.

        Pull requests still refresh on every normal control-plane cycle. While the
        new-issue admission window is full, durable cached issue tasks are sufficient
        because the scheduler cannot admit another discovered issue anyway. The first
        refresh with an available admission performs a full GitHub issue scan before
        scheduling, so stale or closed backlog entries cannot consume the newly-opened
        slot. Disabling issue admission limits preserves the original full-scan behavior.
        """

        available = self.issue_admission.available_slots(now or datetime.now(UTC))
        if available is None or available > 0:
            return original(limit)
        return [task for task in self.pipeline.tasks.cached() if task.source == "github-issue"]

    def _loop(self) -> int:
        original_select = daemon_module.select_batch
        original_merge = self.pipeline.github.merge_pull_request
        original_collect_issues = self.pipeline.github.collect_open_issues

        def gated_select_batch(
            jobs: dict[str, Job],
            limit: int,
            excluded_task_ids: set[str] | None = None,
            now: datetime | None = None,
            new_issue_slots: int | None = None,
            review_first: bool = True,
            review_lane_max_concurrent: int = 1,
        ) -> list[Job]:
            return self._gated_select_batch(
                original_select,
                jobs,
                limit,
                excluded_task_ids,
                now,
                new_issue_slots,
                review_first,
                review_lane_max_concurrent,
            )

        def gated_merge_pull_request(pull_request: int, expected_head_sha: str) -> None:
            self._gated_merge_pull_request(
                original_merge,
                pull_request,
                expected_head_sha,
            )

        def admission_aware_collect_open_issues(limit: int = 10_000) -> list[Task]:
            return self._collect_open_issues_for_refresh(original_collect_issues, limit)

        daemon_module.select_batch = gated_select_batch
        self.pipeline.github.merge_pull_request = gated_merge_pull_request  # type: ignore[method-assign]
        self.pipeline.github.collect_open_issues = admission_aware_collect_open_issues  # type: ignore[method-assign]
        try:
            return super()._loop()
        finally:
            daemon_module.select_batch = original_select
            self.pipeline.github.merge_pull_request = original_merge  # type: ignore[method-assign]
            self.pipeline.github.collect_open_issues = original_collect_issues  # type: ignore[method-assign]
