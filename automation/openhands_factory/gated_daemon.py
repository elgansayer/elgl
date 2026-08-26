"""Factory daemon variant that serializes merges behind current-main CI."""

from __future__ import annotations

from datetime import datetime
from typing import Callable

from openhands_factory import daemon as daemon_module
from openhands_factory.config import FactoryConfig
from openhands_factory.main_merge_gate import MainBranchMergeGate, gate_merge_batch
from openhands_factory.models import Job, JobState

SelectBatch = Callable[..., list[Job]]


class MainCiGatedFactoryDaemon(daemon_module.FactoryDaemon):
    """Run the ordinary daemon with a fail-closed merge scheduler fence.

    The production daemon owns one scheduler process under ``factory.lock``. The
    scheduler hook is installed only for that process and preserves the ordinary
    queue algorithm for every non-merge transition. This keeps the safety change
    isolated from implementation/review concurrency while preventing two green PRs
    from being merged back-to-back against an unverified new ``main`` head.
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
            task_id in jobs and jobs[task_id].state is JobState.MERGE_QUEUED
            for task_id in excluded
        )
        if merge_in_flight:
            return gate_merge_batch(batch, main_ci_green=False)
        return gate_merge_batch(batch, main_ci_green=self.main_merge_gate.is_green())

    def _loop(self) -> int:
        original = daemon_module.select_batch

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
                original,
                jobs,
                limit,
                excluded_task_ids,
                now,
                new_issue_slots,
                review_first,
                review_lane_max_concurrent,
            )

        daemon_module.select_batch = gated_select_batch
        try:
            return super()._loop()
        finally:
            daemon_module.select_batch = original
