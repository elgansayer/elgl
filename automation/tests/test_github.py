import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from openhands_factory.github import GitHubClient
from openhands_factory.repository_guard import ProcessResult


class Runner:
    def __init__(self, results: list[ProcessResult]) -> None:
        self.results = results
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, arguments: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        self.calls.append(tuple(arguments))
        return self.results.pop(0)


def test_collect_prioritises_guardian_and_skips_quarantined(tmp_path: Path) -> None:
    payload = [
        {
            "number": 10,
            "title": "Normal",
            "body": "Body",
            "labels": [{"name": "factory-ready"}],
        },
        {
            "number": 11,
            "title": "Build failure",
            "body": "Broken",
            "labels": [{"name": "guardian-alert"}, {"name": "factory-ready"}],
        },
        {
            "number": 12,
            "title": "Human decision",
            "body": "Blocked",
            "labels": [{"name": "needs-human"}],
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    tasks = client.collect_open_issues()

    assert [task.identifier for task in tasks] == ["10", "11"]
    assert tasks[0].priority == 10
    assert tasks[1].priority == 0
    assert "10000" in runner.calls[0]
    assert "secret" not in repr(runner.calls)


def test_collect_skips_swarm_claimed_and_dedupes_titles(tmp_path: Path) -> None:
    payload = [
        {
            "number": 20,
            "title": "Build Widget",
            "body": "Body",
            "labels": [],
        },
        {
            "number": 21,
            "title": "Build Widget",
            "body": "Duplicate copy",
            "labels": [],
        },
        {
            "number": 22,
            "title": "Claimed by swarm",
            "body": "Body",
            "labels": [{"name": "swarm-active"}],
        },
    ]
    runner = Runner(
        [
            ProcessResult(0, json.dumps(payload), ""),
            ProcessResult(0, "", ""),  # comment on the duplicate issue #21
            ProcessResult(0, "", ""),  # close the duplicate issue #21
            ProcessResult(0, "", ""),  # label the duplicate issue #21
        ]
    )
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    tasks = client.collect_open_issues()

    assert [task.identifier for task in tasks] == ["20"]
    assert any("21" in call and "close" in call for call in runner.calls[1:])
    assert any("21" in call and "duplicate" in call for call in runner.calls[1:])


def test_requeue_quarantined_issues_clears_stale_labels(tmp_path: Path) -> None:
    payload = [{"number": 30}, {"number": 31}]
    runner = Runner(
        [
            ProcessResult(0, json.dumps(payload), ""),  # list quarantined
            ProcessResult(0, "", ""),  # remove labels from #30
            ProcessResult(0, "", ""),  # comment on #30
            ProcessResult(0, "", ""),  # remove labels from #31
            ProcessResult(0, "", ""),  # comment on #31
        ]
    )
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    requeued = client.requeue_quarantined_issues()

    assert requeued == [30, 31]
    assert any(
        "30" in call and "--remove-label" in call and "factory-quarantined" in call
        for call in runner.calls
    )
    assert any(
        "31" in call and "--remove-label" in call and "swarm-active" in call
        for call in runner.calls
    )


def test_collect_open_pull_requests_excludes_drafts_and_own_and_reviewed(
    tmp_path: Path,
) -> None:
    payload = [
        {
            "number": 40,
            "title": "Optimize quests",
            "body": "Body",
            "headRefName": "bolt/optimize-quests",
            "isDraft": False,
            "labels": [],
        },
        {
            "number": 41,
            "title": "Still drafting",
            "body": "Body",
            "headRefName": "someone/wip",
            "isDraft": True,
            "labels": [],
        },
        {
            "number": 42,
            "title": "Fixes #10: something",
            "body": "Body",
            "headRefName": "factory/10-something",
            "isDraft": False,
            "labels": [],
        },
        {
            "number": 43,
            "title": "Already reviewed",
            "body": "Body",
            "headRefName": "sentinel/fix-thing",
            "isDraft": False,
            "labels": [{"name": "factory-reviewed"}],
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    tasks = client.collect_open_pull_requests()

    assert [task.identifier for task in tasks] == ["40"]
    assert tasks[0].source == "github-pull-request"
    assert tasks[0].pr_branch == "bolt/optimize-quests"


def test_pull_request_creation_parses_number(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "https://github.com/owner/repo/pull/42\n", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    number = client.create_pull_request("factory/12-fix", "Fix", "Body")

    assert number == 42
    assert "--draft" in runner.calls[0]


def test_pull_request_creation_uses_configured_base_branch(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "https://github.com/owner/repo/pull/42\n", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner, base_branch="develop")

    client.create_pull_request("factory/12-fix", "Fix", "Body")

    assert "develop" in runner.calls[0]


def test_comment_is_published_with_a_bounded_body(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.add_comment(42, "Factory update")

    assert runner.calls[0][:4] == ("gh", "issue", "comment", "42")
    assert "Factory update" in runner.calls[0]


def test_auto_merge_never_uses_admin(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.enable_auto_merge(42)

    call = runner.calls[0]
    assert "--auto" in call
    assert "--admin" not in call


def test_pull_request_status_requires_all_checks_to_pass(tmp_path: Path) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "reviewDecision": "APPROVED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"status": "COMPLETED", "conclusion": "SUCCESS"},
            {"status": "COMPLETED", "conclusion": "SKIPPED"},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert status.checks_passed
    assert not status.checks_pending
    assert status.head_sha == "abc123"


def test_review_status_is_anchored_to_head_sha(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.publish_review_status("abc123", approved=True, detail="Review passed")

    call = runner.calls[0]
    assert "repos/owner/repo/statuses/abc123" in call
    assert "context=factory/independent-review" in call
    assert "state=success" in call


def test_transient_github_failure_is_retried(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    runner = Runner(
        [
            ProcessResult(1, "", "HTTP 503: Service Unavailable"),
            ProcessResult(0, "[]", ""),
        ]
    )
    monkeypatch.setattr("openhands_factory.github.time.sleep", lambda _seconds: None)
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    assert client.collect_open_issues() == []
    assert len(runner.calls) == 2
