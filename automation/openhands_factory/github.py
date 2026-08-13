"""Typed GitHub CLI boundary for issue and pull request automation."""

from __future__ import annotations

import json
import os
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Task
from openhands_factory.repository_guard import ProcessResult, run_process


class GitHubRunner(Protocol):
    def __call__(
        self, arguments: Sequence[str], cwd: Path, timeout: int = 300
    ) -> ProcessResult: ...


@dataclass(frozen=True)
class PullRequestStatus:
    number: int
    state: str
    is_draft: bool
    mergeable: str
    review_decision: str
    head_sha: str
    checks_passed: bool
    checks_pending: bool


class GitHubClient:
    def __init__(
        self,
        repository: str,
        workspace: Path,
        token: str,
        runner: GitHubRunner = run_process,
        base_branch: str = "main",
        require_ready_label: bool = False,
        ready_label: str = "factory-ready",
    ) -> None:
        self.repository = repository
        self.workspace = workspace
        self.base_branch = base_branch
        self.require_ready_label = require_ready_label
        self.ready_label = ready_label
        self.runner = runner
        self.environment = {"GH_TOKEN": token}

    def _run(self, arguments: Sequence[str], timeout: int = 300) -> str:
        for attempt in range(3):
            previous = os.environ.get("GH_TOKEN")
            os.environ["GH_TOKEN"] = self.environment["GH_TOKEN"]
            try:
                result = self.runner(arguments, self.workspace, timeout)
            finally:
                if previous is None:
                    os.environ.pop("GH_TOKEN", None)
                else:
                    os.environ["GH_TOKEN"] = previous
            if result.returncode == 0:
                return result.stdout
            failure = result.stderr[-2000:]
            transient = any(marker in failure for marker in ("HTTP 5", "502", "503", "504"))
            if not transient or attempt == 2:
                raise FactoryError(f"GitHub command failed: {failure}")
            time.sleep(2**attempt)
        raise FactoryError("GitHub command failed without a result")

    def collect_open_issues(self, limit: int = 10_000) -> list[Task]:
        output = self._run(
            (
                "gh",
                "issue",
                "list",
                "--repo",
                self.repository,
                "--state",
                "open",
                "--limit",
                str(limit),
                "--json",
                "number,title,body,labels",
            )
        )
        payload = json.loads(output)

        # Several issues can share an identical title (bulk-generated in the same batch).
        # Only the lowest-numbered copy is eligible; the rest are marked duplicates so they
        # are never attempted in parallel with their canonical sibling.
        canonical_by_title: dict[str, int] = {}
        for item in payload:
            normalized_title = " ".join(str(item["title"]).split()).lower()
            number = int(item["number"])
            existing = canonical_by_title.get(normalized_title)
            if existing is None or number < existing:
                canonical_by_title[normalized_title] = number

        tasks: list[Task] = []
        for item in payload:
            labels = {
                label.get("name", "") for label in item.get("labels", []) if isinstance(label, dict)
            }
            if labels.intersection(
                {
                    "factory-skip",
                    "duplicate",
                    "needs-human",
                    "factory-epic",
                    "factory-planning",
                    "factory-quality-blocked",
                    "factory-quarantined",
                    # The separate GitHub Actions "AI Swarm" pipeline claims this label while
                    # it works an issue. Skip it to avoid two systems implementing it at once.
                    "swarm-active",
                }
            ):
                continue
            number = int(item["number"])
            normalized_title = " ".join(str(item["title"]).split()).lower()
            canonical = canonical_by_title.get(normalized_title)
            if canonical != number:
                self.add_comment(
                    number,
                    f"Closing as a duplicate of #{canonical}. Both share an identical "
                    "title, and implementing them separately would waste factory capacity "
                    "on the same work. Reopen if this issue actually covers distinct scope.",
                )
                self.close_issue(number)
                self.add_issue_labels(number, ("duplicate",))
                continue
            if self.require_ready_label and not labels.intersection(
                {self.ready_label, "factory-active", "guardian-alert"}
            ):
                continue
            priority = 0 if "guardian-alert" in labels else 10
            tasks.append(
                Task(
                    identifier=str(number),
                    title=str(item["title"]),
                    body=str(item.get("body") or ""),
                    source="github-issue",
                    priority=priority,
                )
            )
        return tasks

    def collect_open_pull_requests(self, limit: int = 10_000) -> list[Task]:
        """List externally-created pull requests eligible for independent review.

        Excludes the factory's own pull requests (identified by their factory/*
        branch, since those are already tracked by the issue that created them),
        drafts, and anything already reviewed or explicitly skipped.
        """
        output = self._run(
            (
                "gh",
                "pr",
                "list",
                "--repo",
                self.repository,
                "--state",
                "open",
                "--limit",
                str(limit),
                "--json",
                "number,title,body,headRefName,isDraft,labels",
            )
        )
        payload = json.loads(output)
        tasks: list[Task] = []
        for item in payload:
            if item.get("isDraft"):
                continue
            head_ref = str(item.get("headRefName") or "")
            if not head_ref or head_ref.startswith("factory/"):
                continue
            labels = {
                label.get("name", "") for label in item.get("labels", []) if isinstance(label, dict)
            }
            if labels.intersection({"factory-reviewed", "factory-skip"}):
                continue
            tasks.append(
                Task(
                    identifier=str(int(item["number"])),
                    title=str(item["title"]),
                    body=str(item.get("body") or ""),
                    source="github-pull-request",
                    priority=10,
                    pr_branch=head_ref,
                )
            )
        return tasks

    def list_all_open_issue_titles(self, limit: int = 10_000) -> set[str]:
        """List every open issue title, regardless of label, for duplicate checking.

        Unlike collect_open_issues, nothing is excluded here - a proposed issue must
        not duplicate a quarantined or blocked one either, not just an eligible one.
        """
        output = self._run(
            (
                "gh",
                "issue",
                "list",
                "--repo",
                self.repository,
                "--state",
                "open",
                "--limit",
                str(limit),
                "--json",
                "title",
            )
        )
        return {str(item["title"]) for item in json.loads(output)}

    def create_issue(self, title: str, body: str, labels: Sequence[str] = ()) -> int:
        arguments = [
            "gh",
            "issue",
            "create",
            "--repo",
            self.repository,
            "--title",
            title,
            "--body",
            body,
        ]
        for label in labels:
            arguments.extend(("--label", label))
        output = self._run(tuple(arguments))
        url = output.strip().rstrip("/")
        try:
            return int(url.rsplit("/", 1)[-1])
        except ValueError as error:
            raise FactoryError(f"Could not parse issue URL: {url}") from error

    def ensure_factory_labels(self) -> None:
        labels = {
            "factory-ready": "1d76db",
            "factory-active": "0052cc",
            "factory-review": "5319e7",
            "factory-reviewed": "0e8a16",
            "factory-quarantined": "b60205",
            "factory-skip": "cfd3d7",
            "needs-human": "d93f0b",
            "architect-proposed": "5319e7",
        }
        for name, colour in labels.items():
            self._run(
                (
                    "gh",
                    "label",
                    "create",
                    name,
                    "--repo",
                    self.repository,
                    "--color",
                    colour,
                    "--force",
                )
            )

    def add_issue_labels(self, issue: int, labels: Sequence[str]) -> None:
        arguments = [
            "gh",
            "issue",
            "edit",
            str(issue),
            "--repo",
            self.repository,
        ]
        for label in labels:
            arguments.extend(("--add-label", label))
        self._run(tuple(arguments))

    def remove_issue_labels(self, issue: int, labels: Sequence[str]) -> None:
        arguments = [
            "gh",
            "issue",
            "edit",
            str(issue),
            "--repo",
            self.repository,
        ]
        for label in labels:
            arguments.extend(("--remove-label", label))
        self._run(tuple(arguments))

    def list_quarantined_issues(self, limit: int = 10_000) -> list[int]:
        output = self._run(
            (
                "gh",
                "issue",
                "list",
                "--repo",
                self.repository,
                "--state",
                "open",
                "--label",
                "factory-quarantined",
                "--limit",
                str(limit),
                "--json",
                "number",
            )
        )
        return sorted(int(item["number"]) for item in json.loads(output))

    def requeue_quarantined_issues(self) -> list[int]:
        """Clear a resolved-cause quarantine so an issue is eligible for a clean retry.

        Quarantine is a circuit breaker: it exists so a genuinely broken task cannot
        loop forever, not to permanently withhold work. Once the operator has fixed the
        systemic cause (a bug, a stale collision with another pipeline), the affected
        issues need to be moved back into the pool by hand, since only a human can judge
        that the cause is actually resolved.
        """
        requeued: list[int] = []
        for issue in self.list_quarantined_issues():
            self.remove_issue_labels(
                issue,
                ("factory-quarantined", "needs-human", "swarm-active", "factory-active"),
            )
            self.add_comment(
                issue,
                "Clearing the quarantine labels on this issue after an operator "
                "confirmed the underlying cause is resolved. It is eligible for a "
                "clean retry.",
            )
            requeued.append(issue)
        return requeued

    def add_comment(self, number: int, body: str) -> None:
        """Publish a bounded lifecycle update on an issue or pull request."""
        self._run(
            (
                "gh",
                "issue",
                "comment",
                str(number),
                "--repo",
                self.repository,
                "--body",
                body[:10_000],
            )
        )

    def create_pull_request(self, branch: str, title: str, body: str) -> int:
        output = self._run(
            (
                "gh",
                "pr",
                "create",
                "--repo",
                self.repository,
                "--base",
                self.base_branch,
                "--head",
                branch,
                "--draft",
                "--title",
                title,
                "--body",
                body,
            )
        )
        url = output.strip().rstrip("/")
        try:
            return int(url.rsplit("/", 1)[-1])
        except ValueError as error:
            raise FactoryError(f"Could not parse pull request URL: {url}") from error

    def mark_ready(self, pull_request: int) -> None:
        self._run(
            (
                "gh",
                "pr",
                "ready",
                str(pull_request),
                "--repo",
                self.repository,
            )
        )

    def request_review(self, pull_request: int) -> None:
        self.add_issue_labels(pull_request, ("factory-review",))

    def publish_review_status(self, head_sha: str, *, approved: bool, detail: str) -> None:
        self._run(
            (
                "gh",
                "api",
                "--method",
                "POST",
                f"repos/{self.repository}/statuses/{head_sha}",
                "-f",
                f"state={'success' if approved else 'failure'}",
                "-f",
                "context=factory/independent-review",
                "-f",
                f"description={detail[:140]}",
            )
        )

    def enable_auto_merge(self, pull_request: int) -> None:
        self._run(
            (
                "gh",
                "pr",
                "merge",
                str(pull_request),
                "--repo",
                self.repository,
                "--squash",
                "--delete-branch",
                "--auto",
            )
        )

    def close_issue(self, issue: int) -> None:
        self._run(
            (
                "gh",
                "issue",
                "close",
                str(issue),
                "--repo",
                self.repository,
                "--reason",
                "completed",
            )
        )

    def pull_request_status(self, pull_request: int) -> PullRequestStatus:
        output = self._run(
            (
                "gh",
                "pr",
                "view",
                str(pull_request),
                "--repo",
                self.repository,
                "--json",
                "number,state,isDraft,mergeable,reviewDecision,headRefOid,statusCheckRollup",
            )
        )
        item = json.loads(output)
        conclusions: list[str] = []
        pending = False
        for check in item.get("statusCheckRollup", []):
            conclusion = check.get("conclusion")
            status = check.get("status")
            if isinstance(conclusion, str) and conclusion:
                conclusions.append(conclusion)
            if status in {"QUEUED", "IN_PROGRESS", "PENDING", "WAITING"}:
                pending = True
        passed = bool(conclusions) and all(
            conclusion in {"SUCCESS", "NEUTRAL", "SKIPPED"} for conclusion in conclusions
        )
        return PullRequestStatus(
            number=int(item["number"]),
            state=str(item["state"]),
            is_draft=bool(item["isDraft"]),
            mergeable=str(item.get("mergeable") or "UNKNOWN"),
            review_decision=str(item.get("reviewDecision") or ""),
            head_sha=str(item["headRefOid"]),
            checks_passed=passed,
            checks_pending=pending,
        )
