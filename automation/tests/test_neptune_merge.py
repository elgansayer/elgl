"""Neptune policy contracts; mocked API evidence is not a live factory job."""

import base64
import copy
import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.github import GitHubClient
from openhands_factory.neptune_merge import (
    NEPTUNE_GATE,
    NEPTUNE_REPOSITORY,
    neptune_gate,
    validate_neptune_protection,
)
from openhands_factory.repository_guard import ProcessResult

HEAD = "a" * 40
BASE = "b" * 40


def check(**changes: object) -> dict[str, Any]:
    return {
        "name": NEPTUNE_GATE,
        "app": {"id": 15368},
        "head_sha": HEAD,
        "status": "completed",
        "conclusion": "success",
        **changes,
    }


def pr(**changes: object) -> dict[str, Any]:
    return {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "mergeStateStatus": "CLEAN",
        "reviewDecision": "",
        "headRefOid": HEAD,
        "baseRefName": "main",
        "baseRefOid": BASE,
        "isCrossRepository": False,
        "autoMergeRequest": None,
        **changes,
    }


def settings() -> dict[str, Any]:
    return {"allow_auto_merge": True, "allow_merge_commit": True, "delete_branch_on_merge": False}


def protection() -> dict[str, Any]:
    return {
        "required_status_checks": {
            "strict": True,
            "contexts": [NEPTUNE_GATE],
            "checks": [{"context": NEPTUNE_GATE, "app_id": 15368}],
        },
        "enforce_admins": {"enabled": True},
        "allow_force_pushes": {"enabled": False},
        "allow_deletions": {"enabled": False},
        "required_pull_request_reviews": {
            "required_approving_review_count": 0,
            "require_code_owner_reviews": False,
            "require_last_push_approval": False,
        },
    }


class Runner:
    def __init__(self, values: list[object]) -> None:
        self.values = values
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, args: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        self.calls.append(tuple(args))
        value = self.values.pop(0)
        if tuple(args[:3]) == ("gh", "api", "graphql"):
            value = {"data": {"repository": {"pullRequest": value}}}
        if "--paginate" in args:
            assert "--slurp" not in args
            assert isinstance(value, list)
            output = "\n".join(
                base64.b64encode(json.dumps(item).encode()).decode()
                for page in value
                for item in page["check_runs"]
            )
            return ProcessResult(0, output, "")
        return ProcessResult(0, json.dumps(value), "")


def responses(
    item: object | None = None, checks: list[object] | None = None, comparison: str = "ahead"
) -> list[object]:
    return [
        pr() if item is None else item,
        {"object": {"sha": BASE}},
        {"status": comparison},
        [{"check_runs": [check()] if checks is None else checks}],
    ]


def test_native_merge_preserves_ancestry_and_uses_expected_head(tmp_path: Path) -> None:
    runner = Runner([*responses(), settings(), protection(), {}])
    GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).merge_pull_request(42, HEAD)
    assert runner.calls[-1] == (
        "gh",
        "pr",
        "merge",
        "42",
        "--repo",
        NEPTUNE_REPOSITORY,
        "--auto",
        "--merge",
        "--match-head-commit",
        HEAD,
    )
    assert "--admin" not in repr(runner.calls)
    assert "--squash" not in repr(runner.calls)
    assert "--delete-branch" not in repr(runner.calls)
    assert "secret" not in repr(runner.calls)
    # Older installed gh versions omit baseRefOid from `pr view --json` even
    # though the server GraphQL API supports it. Do not return to that CLI read.
    assert runner.calls[0][:3] == ("gh", "api", "graphql")
    assert any("baseRefOid" in argument for argument in runner.calls[0])


@pytest.mark.parametrize("review", ["", "REVIEW_REQUIRED", "CHANGES_REQUESTED"])
def test_neptune_has_no_mandatory_review_gate(tmp_path: Path, review: str) -> None:
    runner = Runner(responses(pr(reviewDecision=review)))
    status = GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).pull_request_status(42)
    assert status.checks_passed
    assert status.ci_required_passed
    assert not status.checks_pending
    assert status.head_sha == HEAD
    assert status.base_sha == BASE
    assert not status.failed_checks


def test_pending_gate_waits_even_when_github_reports_blocked(tmp_path: Path) -> None:
    runner = Runner(responses(pr(mergeStateStatus="BLOCKED"), [check(status="in_progress")]))
    status = GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).pull_request_status(42)
    assert status.checks_pending
    assert status.ci_required_pending
    assert not status.ci_required_failed
    assert not status.failed_checks


@pytest.mark.parametrize(
    "conclusion",
    [
        "skipped",
        "neutral",
        "failure",
        "cancelled",
        "timed_out",
        "action_required",
        "",
        None,
    ],
)
def test_required_non_success_never_queues(tmp_path: Path, conclusion: object) -> None:
    runner = Runner(responses(checks=[check(conclusion=conclusion)]))
    client = GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner)
    with pytest.raises(FactoryError, match="passing exact-head/current-base"):
        client.merge_pull_request(42, HEAD)
    assert len(runner.calls) == 4
    assert not any(call[:3] == ("gh", "pr", "merge") for call in runner.calls)


@pytest.mark.parametrize("checks", [[], [check(app={"id": 999})], [check(head_sha="c" * 40)]])
def test_missing_spoofed_or_stale_required_check_stays_pending(
    tmp_path: Path,
    checks: list[object],
) -> None:
    runner = Runner(responses(checks=checks))
    status = GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).pull_request_status(42)
    assert not status.checks_passed
    assert status.ci_required_pending
    assert not status.ci_required_passed


@pytest.mark.parametrize(
    "changes,comparison",
    [
        ({"baseRefOid": "c" * 40}, "ahead"),
        ({"mergeStateStatus": "BEHIND"}, "diverged"),
        ({}, "behind"),
        ({}, "diverged"),
    ],
)
def test_changed_base_requires_revalidation(
    tmp_path: Path,
    changes: dict[str, object],
    comparison: str,
) -> None:
    runner = Runner(responses(pr(**changes), comparison=comparison))
    status = GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).pull_request_status(42)
    assert not status.checks_passed
    assert not status.ci_required_pending
    assert status.ci_required_failed
    assert "Neptune current base" in status.failed_checks


@pytest.mark.parametrize(
    "changes",
    [
        {"isDraft": True},
        {"state": "CLOSED"},
        {"mergeable": "UNKNOWN"},
        {"mergeStateStatus": "BLOCKED"},
        {"headRefOid": "c" * 40},
    ],
)
def test_ineligible_pr_never_queues(tmp_path: Path, changes: dict[str, object]) -> None:
    runner = Runner(responses(pr(**changes)))
    with pytest.raises(FactoryError):
        GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).merge_pull_request(42, HEAD)
    assert not any(call[:3] == ("gh", "pr", "merge") for call in runner.calls)


@pytest.mark.parametrize("changes", [{"baseRefName": "stack-parent"}, {"isCrossRepository": True}])
def test_stack_and_fork_require_explicit_integration(
    tmp_path: Path,
    changes: dict[str, object],
) -> None:
    runner = Runner([pr(**changes)])
    with pytest.raises(FactoryError):
        GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).merge_pull_request(42, HEAD)
    assert len(runner.calls) == 1


def test_already_enabled_auto_merge_is_idempotent(tmp_path: Path) -> None:
    runner = Runner(
        [*responses(pr(autoMergeRequest={"enabledAt": "2026-10-30"})), settings(), protection()]
    )
    GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).merge_pull_request(42, HEAD)
    assert len(runner.calls) == 6
    assert not any(call[:3] == ("gh", "pr", "merge") for call in runner.calls)


@pytest.mark.parametrize(
    "pages",
    [
        None,
        {},
        [],
        [{}],
        [{"check_runs": None}],
        [{"check_runs": ["bad"]}],
        [{"check_runs": [check(), check()]}],
    ],
)
def test_malformed_or_ambiguous_check_evidence_fails(pages: object) -> None:
    with pytest.raises(FactoryError):
        neptune_gate(pages, HEAD)


def test_paginated_check_evidence_is_not_truncated() -> None:
    result = neptune_gate([{"check_runs": []}, {"check_runs": [check()]}], HEAD)
    assert result.passed


@pytest.mark.parametrize(
    "target,path,value",
    [
        ("settings", "allow_auto_merge", False),
        ("settings", "allow_merge_commit", False),
        ("settings", "delete_branch_on_merge", True),
        ("protection", "required_status_checks.strict", False),
        ("protection", "required_status_checks.checks", []),
        ("protection", "required_status_checks.checks", [{"context": NEPTUNE_GATE, "app_id": -1}]),
        ("protection", "required_status_checks.contexts", [NEPTUNE_GATE, "unhandled check"]),
        ("protection", "enforce_admins.enabled", False),
        ("protection", "allow_force_pushes.enabled", True),
        ("protection", "allow_deletions.enabled", True),
        ("protection", "required_pull_request_reviews.required_approving_review_count", 1),
        ("protection", "required_pull_request_reviews.required_approving_review_count", False),
        ("protection", "required_pull_request_reviews.require_code_owner_reviews", True),
        ("protection", "required_pull_request_reviews.require_last_push_approval", True),
    ],
)
def test_policy_drift_never_queues(tmp_path: Path, target: str, path: str, value: object) -> None:
    config = {"settings": settings(), "protection": protection()}
    node = config[target]
    keys = path.split(".")
    for key in keys[:-1]:
        node = node[key]
    node[keys[-1]] = copy.deepcopy(value)
    runner = Runner([*responses(), config["settings"], config["protection"]])
    with pytest.raises(FactoryError, match="drifted"):
        GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).merge_pull_request(42, HEAD)
    assert len(runner.calls) == 6


def test_existing_zero_review_policy_passes() -> None:
    validate_neptune_protection(settings(), protection())
    without_reviews = protection()
    without_reviews["required_pull_request_reviews"] = None
    validate_neptune_protection(settings(), without_reviews)


def test_neptune_supersession_preserves_source_branch(tmp_path: Path) -> None:
    runner = Runner([{}, {}, {}])
    GitHubClient(NEPTUNE_REPOSITORY, tmp_path, "secret", runner).supersede_pull_request(
        42,
        canonical=41,
        reason="existing canonical task",
    )
    assert runner.calls[-1] == ("gh", "pr", "close", "42", "--repo", NEPTUNE_REPOSITORY)
    assert "--delete-branch" not in repr(runner.calls)
