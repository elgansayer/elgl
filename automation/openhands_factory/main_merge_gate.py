"""Fail-closed main-branch CI gate for serial Factory merges."""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from openhands_factory.exceptions import FactoryError
from openhands_factory.github import GitHubClient, GitHubRunner
from openhands_factory.models import Job, JobState


@dataclass(frozen=True)
class MainCiStatus:
    """Canonical CI evidence for the repository's current base-branch head."""

    head_sha: str
    status: str
    conclusion: str

    @property
    def green(self) -> bool:
        return self.status == "COMPLETED" and self.conclusion == "SUCCESS"


class MainBranchMergeGate(GitHubClient):
    """Read current-main CI through the existing token-scoped GitHub boundary.

    A PR's green checks prove only that its own reviewed head passed. They do not
    prove that the current base is still healthy after another PR merged. The
    Factory therefore requires a successful canonical CI push run for the exact
    current base SHA before it is allowed to start one more merge.
    """

    def __init__(
        self,
        repository: str,
        workspace: Path,
        token: str,
        runner: GitHubRunner | None = None,
        *,
        base_branch: str = "main",
    ) -> None:
        super().__init__(
            repository,
            workspace,
            token,
            runner,
            base_branch=base_branch,
        )

    def current_main_ci(self) -> MainCiStatus:
        """Return canonical CI state for the exact current base SHA.

        Missing or malformed run evidence fails closed. GitHub can create workflow
        runs asynchronously after a push, so an absent run is expected briefly and
        must be treated as unverified rather than green.
        """

        head_sha = self._run(
            (
                "gh",
                "api",
                f"repos/{self.repository}/commits/{self.base_branch}",
                "--jq",
                ".sha",
            )
        ).strip()
        if not head_sha:
            raise FactoryError("GitHub did not return the current base-branch SHA")

        output = self._run(
            (
                "gh",
                "run",
                "list",
                "--repo",
                self.repository,
                "--workflow",
                "ci.yml",
                "--branch",
                self.base_branch,
                "--event",
                "push",
                "--limit",
                "50",
                "--json",
                "headSha,status,conclusion",
            )
        )
        try:
            runs = json.loads(output)
        except json.JSONDecodeError as error:
            raise FactoryError("Could not parse canonical CI run evidence") from error
        if not isinstance(runs, list):
            raise FactoryError("Canonical CI run evidence was not a list")

        for raw in runs:
            if not isinstance(raw, dict) or str(raw.get("headSha") or "") != head_sha:
                continue
            return MainCiStatus(
                head_sha=head_sha,
                status=str(raw.get("status") or "").upper(),
                conclusion=str(raw.get("conclusion") or "").upper(),
            )
        return MainCiStatus(head_sha=head_sha, status="MISSING", conclusion="")

    def is_green(self) -> bool:
        """Fail closed on missing, pending, failed, or unreadable current-main CI."""

        try:
            return self.current_main_ci().green
        except FactoryError:
            return False


def gate_merge_batch(batch: Sequence[Job], *, main_ci_green: bool) -> list[Job]:
    """Allow at most one merge transition, and only from a verified green main.

    Non-merge work is preserved so CI/review/repair throughput can continue while
    main is pending or red. Once a merge lands, the next scheduler cycle observes
    the new main SHA and blocks further merges until canonical CI passes on it.
    """

    gated: list[Job] = []
    merge_selected = False
    for job in batch:
        if job.state is not JobState.MERGE_QUEUED:
            gated.append(job)
            continue
        if not main_ci_green or merge_selected:
            continue
        gated.append(job)
        merge_selected = True
    return gated
