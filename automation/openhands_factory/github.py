"""Typed GitHub CLI boundary for issue and pull request automation."""

from __future__ import annotations

import json
import os
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
    ) -> None:
        self.repository = repository
        self.workspace = workspace
        self.runner = runner
        self.environment = {"GH_TOKEN": token}

    def _run(self, arguments: Sequence[str], timeout: int = 300) -> str:
        previous = os.environ.get("GH_TOKEN")
        os.environ["GH_TOKEN"] = self.environment["GH_TOKEN"]
        try:
            result = self.runner(arguments, self.workspace, timeout)
        finally:
            if previous is None:
                os.environ.pop("GH_TOKEN", None)
            else:
                os.environ["GH_TOKEN"] = previous
        if result.returncode != 0:
            raise FactoryError(f"GitHub command failed: {result.stderr[-2000:]}")
        return result.stdout

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
        tasks: list[Task] = []
        for item in payload:
            labels = {
                label.get("name", "")
                for label in item.get("labels", [])
                if isinstance(label, dict)
            }
            if labels.intersection({"factory-skip", "duplicate", "needs-human"}):
                continue
            priority = 0 if "guardian-alert" in labels else 10
            tasks.append(
                Task(
                    identifier=str(item["number"]),
                    title=str(item["title"]),
                    body=str(item.get("body") or ""),
                    source="github-issue",
                    priority=priority,
                )
            )
        return tasks

    def ensure_factory_labels(self) -> None:
        labels = {
            "factory-active": "0052cc",
            "factory-review": "5319e7",
            "factory-reviewed": "0e8a16",
            "factory-quarantined": "b60205",
            "factory-skip": "cfd3d7",
            "needs-human": "d93f0b",
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

    def create_pull_request(self, branch: str, title: str, body: str) -> int:
        output = self._run(
            (
                "gh",
                "pr",
                "create",
                "--repo",
                self.repository,
                "--base",
                "main",
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
