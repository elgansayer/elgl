"""Typed GitHub CLI boundary for issue and pull request automation."""

from __future__ import annotations

import base64
import binascii
import json
import os
import time
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol

from openhands_factory.exceptions import FactoryError
from openhands_factory.failure_attribution import failed_check_names
from openhands_factory.models import Task
from openhands_factory.repository_guard import ProcessResult, run_process

REQUIRED_FACTORY_MERGE_CHECKS = frozenset({"CI / required", "factory/independent-review"})
_PENDING_CHECK_STATES = frozenset({"QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "EXPECTED"})
_ALLOWED_TERMINAL_CONCLUSIONS = frozenset({"SUCCESS", "NEUTRAL", "SKIPPED"})
_GITHUB_ENVIRONMENT_ALLOWLIST = {
    "GH_CONFIG_DIR",
    "HOME",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "LANG",
    "LC_ALL",
    "NO_PROXY",
    "PATH",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "XDG_CONFIG_HOME",
}


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
    failed_checks: frozenset[str] = frozenset()
    merge_state_status: str = "CLEAN"


@dataclass(frozen=True)
class IssueComment:
    identifier: int
    author: str
    body: str
    created_at: str


def issue_priority(labels: set[str]) -> int:
    """Translate repository priority labels into the Factory queue order."""

    normalized = {label.casefold() for label in labels}
    if "guardian-alert" in normalized:
        return 0
    if "priority:critical" in normalized:
        return 1
    if "priority:high" in normalized:
        return 2
    if "priority:medium" in normalized:
        return 8
    if "priority:low" in normalized:
        return 20
    return 10


class GitHubClient:
    def __init__(
        self,
        repository: str,
        workspace: Path,
        token: str,
        runner: GitHubRunner | None = None,
        base_branch: str = "main",
        require_trusted_intake: bool = False,
        trusted_github_actors: Collection[str] = (),
        require_ready_label: bool = False,
        ready_label: str = "factory-ready",
    ) -> None:
        self.repository = repository
        self.workspace = workspace
        self.base_branch = base_branch
        self.require_trusted_intake = require_trusted_intake
        self.trusted_github_actors = frozenset(actor.casefold() for actor in trusted_github_actors)
        self.require_ready_label = require_ready_label
        self.ready_label = ready_label
        self.runner = runner
        self.environment = {"GH_TOKEN": token}

    def _invoke(self, arguments: Sequence[str], timeout: int) -> ProcessResult:
        if self.runner is not None:
            return self.runner(arguments, self.workspace, timeout)
        environment = {
            key: os.environ[key] for key in _GITHUB_ENVIRONMENT_ALLOWLIST if key in os.environ
        }
        environment.setdefault("HOME", str(Path.home()))
        environment.setdefault("PATH", "/usr/local/bin:/usr/bin:/bin")
        environment.setdefault("LANG", "C.UTF-8")
        environment.update(self.environment)
        return run_process(
            arguments,
            self.workspace,
            timeout,
            environment=environment,
        )

    def _run(self, arguments: Sequence[str], timeout: int = 300) -> str:
        for attempt in range(3):
            result = self._invoke(arguments, timeout)
            if result.returncode == 0:
                return result.stdout
            failure = (result.stderr + result.stdout)[-2000:]
            transient = any(marker in failure for marker in ("HTTP 5", "502", "503", "504"))
            if not transient or attempt == 2:
                raise FactoryError(f"GitHub command failed: {failure}")
            time.sleep(2**attempt)
        raise FactoryError("GitHub command failed without a result")

    def _intake_is_trusted(self, item: object, labels: set[str]) -> bool:
        """Accept configured actors or a maintainer-controlled admission label."""

        if not self.require_trusted_intake:
            return True
        author = item.get("author") if isinstance(item, dict) else None
        login = author.get("login") if isinstance(author, dict) else None
        actor_is_trusted = isinstance(login, str) and login.casefold() in self.trusted_github_actors
        admission_labels = {
            self.ready_label,
            "factory-active",
            "factory-review",
            "factory-reviewed",
            "guardian-alert",
        }
        return actor_is_trusted or bool(labels.intersection(admission_labels))

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
                "number,title,body,labels,author",
            )
        )
        payload = json.loads(output)

        # Several issues can share an identical title (bulk-generated in the same batch).
        # Only the lowest-numbered copy is eligible; the rest are marked duplicates so they
        # are never attempted in parallel with their canonical sibling.
        canonical_by_title: dict[str, int] = {}
        for item in payload:
            labels = {
                label.get("name", "") for label in item.get("labels", []) if isinstance(label, dict)
            }
            # An untrusted public issue must not suppress trusted work merely by
            # pre-empting its title with a lower issue number.
            if not self._intake_is_trusted(item, labels):
                continue
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
                    "factory-status",
                    "duplicate",
                    "needs-human",
                    "factory-epic",
                    "factory-planning",
                    "factory-quality-blocked",
                    "factory-quarantined",
                    # Retired resolver pipelines may have left this lease label behind.
                    # Skip it until backlog governance or an operator clears ownership.
                    "swarm-active",
                }
            ):
                continue
            if not self._intake_is_trusted(item, labels):
                continue
            number = int(item["number"])
            normalized_title = " ".join(str(item["title"]).split()).lower()
            canonical = canonical_by_title.get(normalized_title)
            if canonical != number:
                # Matching titles are a scheduling hint, not proof that issue scope
                # is identical. Defer the later issue while the oldest copy remains
                # open, but never mutate or close tickets during discovery.
                continue
            if self.require_ready_label and not labels.intersection(
                {self.ready_label, "factory-active", "guardian-alert"}
            ):
                continue
            # Pull-request review defaults to priority 5 (see
            # collect_open_pull_requests). Labelled critical and high issues
            # run before ordinary reviews, while ordinary and low-priority
            # backlog work runs afterwards. Lower values run first in
            # select_batch.
            priority = issue_priority(labels)
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

        Excludes ordinary factory-owned pull requests, since those remain tracked
        by the issue that created them, plus drafts and anything explicitly skipped.
        Weekly architect pull requests are the exception: they have no parent issue,
        so their factory/architect-* draft must remain discoverable until independent
        review makes it ready. Reviewed pull requests remain discoverable so a new
        head commit can invalidate the old review after a daemon restart.
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
                "number,title,body,headRefName,isCrossRepository,isDraft,labels,author",
            )
        )
        payload = json.loads(output)
        tasks: list[Task] = []
        for item in payload:
            head_ref = str(item.get("headRefName") or "")
            architect_pull_request = head_ref.startswith("factory/architect-")
            if item.get("isCrossRepository") is True:
                # The Factory cannot safely promise repairs when its repository
                # token cannot push the fork's head branch. Leave those PRs to a
                # future read-only fork-review path instead of retrying forever.
                continue
            if item.get("isDraft") and not architect_pull_request:
                continue
            if not head_ref or (head_ref.startswith("factory/") and not architect_pull_request):
                continue
            labels = {
                label.get("name", "") for label in item.get("labels", []) if isinstance(label, dict)
            }
            if "factory-skip" in labels:
                continue
            if not architect_pull_request and not self._intake_is_trusted(item, labels):
                continue
            tasks.append(
                Task(
                    identifier=str(int(item["number"])),
                    title=str(item["title"]),
                    body=str(item.get("body") or ""),
                    source="github-pull-request",
                    # Normal reviews sit below guardian-alert issues (0) but
                    # above ordinary issue work (10). Trusted urgency labels
                    # can promote a PR within the bounded review lane, which
                    # lets a bootstrap or security repair reach its required
                    # independent review without bypassing merge protection.
                    priority=min(5, issue_priority(labels)),
                    pr_branch=head_ref,
                )
            )
        return tasks

    def list_all_open_issue_titles(self, limit: int = 10_000) -> set[str]:
        """List every admitted open issue title for duplicate checking.

        A proposal must not duplicate quarantined or blocked trusted work. Public
        issues which have not passed intake cannot suppress trusted architecture
        proposals merely by pre-empting a title.
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
                "title,labels,author",
            )
        )
        titles: set[str] = set()
        for item in json.loads(output):
            labels = {
                label.get("name", "") for label in item.get("labels", []) if isinstance(label, dict)
            }
            if self._intake_is_trusted(item, labels):
                titles.add(str(item["title"]))
        return titles

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

    def find_open_issue_by_title(self, title: str, *, required_label: str) -> int | None:
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
                "100",
                "--search",
                f'"{title}" in:title label:{required_label}',
                "--json",
                "number,title,labels",
            )
        )
        matches: list[int] = []
        for item in json.loads(output):
            if not isinstance(item, dict) or item.get("title") != title:
                continue
            labels = item.get("labels")
            label_items = labels if isinstance(labels, list) else []
            label_names = {
                name
                for label in label_items
                if isinstance(label, dict)
                if isinstance((name := label.get("name")), str)
            }
            number = item.get("number")
            if required_label in label_names and isinstance(number, int):
                matches.append(number)
        return min(matches) if matches else None

    def update_issue(self, issue: int, *, title: str, body: str) -> None:
        self._run(
            (
                "gh",
                "issue",
                "edit",
                str(issue),
                "--repo",
                self.repository,
                "--title",
                title,
                "--body",
                body,
            )
        )

    def list_issue_comments(self, issue: int, *, after: int = 0) -> list[IssueComment]:
        output = self._run(
            (
                "gh",
                "api",
                "--method",
                "GET",
                f"repos/{self.repository}/issues/{issue}/comments",
                "-f",
                "per_page=100",
                "--paginate",
                "--jq",
                ".[] | @base64",
            )
        )
        comments: list[IssueComment] = []
        items: list[object] = []
        for encoded in output.splitlines():
            try:
                decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
                items.append(json.loads(decoded))
            except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as error:
                raise FactoryError("Could not parse GitHub issue comments") from error
        for item in items:
            if not isinstance(item, dict):
                continue
            identifier = item.get("id")
            author = item.get("user")
            login = author.get("login") if isinstance(author, dict) else None
            body = item.get("body")
            created_at = item.get("created_at")
            if (
                isinstance(identifier, int)
                and identifier > after
                and isinstance(login, str)
                and isinstance(body, str)
                and isinstance(created_at, str)
            ):
                comments.append(IssueComment(identifier, login, body, created_at))
        return sorted(comments, key=lambda item: item.identifier)

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
            "factory-status": "0969da",
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

    def list_active_issues(self, limit: int = 10_000) -> list[int]:
        """List open issues carrying a current or retired ownership marker."""

        active: set[int] = set()
        for label in ("factory-active", "swarm-active"):
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
                    label,
                    "--limit",
                    str(limit),
                    "--json",
                    "number",
                )
            )
            active.update(int(item["number"]) for item in json.loads(output))
        return sorted(active)

    def release_active_issues(self, issues: list[int]) -> list[int]:
        """Release stale ownership without removing the issue from trusted intake."""

        released: list[int] = []
        for issue in sorted(set(issues)):
            self.remove_issue_labels(issue, ("factory-active", "swarm-active"))
            # factory-active is an admission label as well as an ownership marker.
            # Preserve that admission explicitly when releasing stale ownership,
            # even when labelled intake is not globally mandatory.
            self.add_issue_labels(issue, (self.ready_label,))
            released.append(issue)
        return released

    def requeue_quarantined_issues(
        self,
        issues: list[int] | None = None,
        *,
        announce: bool = True,
    ) -> list[int]:
        """Clear a resolved-cause quarantine so an issue is eligible for a clean retry.

        Quarantine is a circuit breaker: it exists so a genuinely broken task cannot
        loop forever, not to permanently withhold work. Automatic bounded recovery uses
        this operation without comments after its cooldown. Operators can also use it
        for an earlier targeted reset after fixing a known systemic cause.
        """
        requeued: list[int] = []
        for issue in sorted(set(issues if issues is not None else self.list_quarantined_issues())):
            self.remove_issue_labels(
                issue,
                ("factory-quarantined", "needs-human", "swarm-active", "factory-active"),
            )
            if self.require_ready_label:
                self.add_issue_labels(issue, (self.ready_label,))
            if announce:
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

    def update_pull_request_branch(self, pull_request: int, expected_head_sha: str) -> None:
        """Ask GitHub to merge the current base into an inspected PR head.

        GitHub rejects the request if the head changed after inspection. The
        resulting head must pass local verification and independent review again.
        """

        self._run(
            (
                "gh",
                "api",
                "--method",
                "PUT",
                f"repos/{self.repository}/pulls/{pull_request}/update-branch",
                "-f",
                f"expected_head_sha={expected_head_sha}",
            )
        )

    def merge_pull_request(self, pull_request: int, expected_head_sha: str) -> None:
        """Squash-merge only the exact reviewed head without bypassing GitHub rules."""

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
                "--match-head-commit",
                expected_head_sha,
            )
        )

    def request_review(self, pull_request: int) -> None:
        self.add_issue_labels(pull_request, ("factory-review",))

    def publish_review_status(self, head_sha: str, *, approved: bool, detail: str) -> None:
        self._publish_review_status(
            head_sha,
            state="success" if approved else "failure",
            detail=detail,
        )

    def publish_review_pending(self, head_sha: str, *, detail: str) -> None:
        """Invalidate an earlier approval while the same head is being reconsidered."""

        self._publish_review_status(head_sha, state="pending", detail=detail)

    def _publish_review_status(
        self,
        head_sha: str,
        *,
        state: Literal["failure", "pending", "success"],
        detail: str,
    ) -> None:
        self._run(
            (
                "gh",
                "api",
                "--method",
                "POST",
                f"repos/{self.repository}/statuses/{head_sha}",
                "-f",
                f"state={state}",
                "-f",
                "context=factory/independent-review",
                "-f",
                f"description={detail[:140]}",
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
                "number,state,isDraft,mergeable,mergeStateStatus,reviewDecision,"
                "headRefOid,statusCheckRollup",
            )
        )
        item = json.loads(output)
        check_rollup = item.get("statusCheckRollup", [])
        review_decision = str(item.get("reviewDecision") or "")
        human_review_blocked = review_decision.upper() == "CHANGES_REQUESTED"
        conclusions: list[str] = []
        observed_checks: set[str] = set()
        successful_checks: set[str] = set()
        pending = False
        for check in check_rollup:
            name = str(check.get("name") or check.get("context") or "")
            if name:
                observed_checks.add(name)
            conclusion = str(check.get("conclusion") or "").upper()
            status = str(check.get("status") or "").upper()
            state = str(check.get("state") or "").upper()
            if conclusion:
                conclusions.append(conclusion)
            if name and (conclusion == "SUCCESS" or state == "SUCCESS"):
                successful_checks.add(name)
            if status in _PENDING_CHECK_STATES or state in _PENDING_CHECK_STATES:
                pending = True

        failed_checks = failed_check_names(check_rollup)
        missing_required = REQUIRED_FACTORY_MERGE_CHECKS - observed_checks
        if missing_required:
            # GitHub creates workflow check-runs asynchronously. Treat an absent
            # canonical gate as pending rather than allowing a temporary partial
            # rollup to enter the scheduled merge queue.
            pending = True
        required_passed = REQUIRED_FACTORY_MERGE_CHECKS.issubset(successful_checks)
        unsuccessful_required = (
            REQUIRED_FACTORY_MERGE_CHECKS.intersection(observed_checks) - successful_checks
        )
        failed_checks |= frozenset(unsuccessful_required)
        terminal_checks_passed = all(
            conclusion in _ALLOWED_TERMINAL_CONCLUSIONS for conclusion in conclusions
        )
        passed = (
            required_passed
            and terminal_checks_passed
            and not pending
            and not failed_checks
            and not human_review_blocked
        )
        return PullRequestStatus(
            number=int(item["number"]),
            state=str(item["state"]),
            is_draft=bool(item["isDraft"]),
            mergeable=str(item.get("mergeable") or "UNKNOWN"),
            review_decision=str(item.get("reviewDecision") or ""),
            head_sha=str(item["headRefOid"]),
            checks_passed=passed,
            checks_pending=pending or human_review_blocked,
            failed_checks=failed_checks,
            merge_state_status=str(item.get("mergeStateStatus") or "UNKNOWN").upper(),
        )
