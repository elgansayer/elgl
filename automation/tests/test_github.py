import base64
import json
import os
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.github import GitHubClient
from openhands_factory.models import Task, changed_path_fingerprint
from openhands_factory.repository_guard import ProcessResult


class Runner:
    def __init__(self, results: list[ProcessResult]) -> None:
        self.results = results
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, arguments: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        self.calls.append(tuple(arguments))
        return self.results.pop(0)


def encoded_api_items(items: list[object]) -> str:
    return "\n".join(
        base64.b64encode(json.dumps(item).encode("utf-8")).decode("ascii") for item in items
    )


def test_collect_prioritises_labels_and_skips_quarantined(tmp_path: Path) -> None:
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
            "number": 13,
            "title": "Urgent workflow failure",
            "body": "Broken",
            "labels": [{"name": "priority:high"}, {"name": "factory-ready"}],
        },
        {
            "number": 14,
            "title": "Low-priority cleanup",
            "body": "Cleanup",
            "labels": [{"name": "priority:low"}, {"name": "factory-ready"}],
        },
        {
            "number": 12,
            "title": "Human decision",
            "body": "Blocked",
            "labels": [{"name": "needs-human"}],
        },
        {
            "number": 15,
            "title": "Factory control panel",
            "body": "Operational status",
            "labels": [{"name": "factory-status"}],
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    tasks = client.collect_open_issues()

    assert [task.identifier for task in tasks] == ["10", "11", "13", "14"]
    assert tasks[0].priority == 10
    assert tasks[1].priority == 0
    assert tasks[2].priority == 2
    assert tasks[3].priority == 20
    assert "10000" in runner.calls[0]
    assert "secret" not in repr(runner.calls)


def test_trusted_intake_accepts_configured_actors_and_admitted_public_issues(
    tmp_path: Path,
) -> None:
    payload = [
        {
            "number": 8,
            "title": "Trusted work",
            "body": "Untrusted title pre-emption",
            "labels": [],
            "author": {"login": "outsider"},
        },
        {
            "number": 9,
            "title": "Trusted work",
            "body": "Owner request",
            "labels": [],
            "author": {"login": "RepoOwner"},
        },
        {
            "number": 10,
            "title": "Admitted contribution",
            "body": "Maintainer reviewed intake",
            "labels": [{"name": "factory-ready"}],
            "author": {"login": "outsider"},
        },
        {
            "number": 11,
            "title": "Untrusted request",
            "body": "Not admitted",
            "labels": [],
            "author": {"login": "outsider"},
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient(
        "owner/repo",
        tmp_path,
        "secret",
        runner,
        require_trusted_intake=True,
        trusted_github_actors={"repoowner"},
    )

    tasks = client.collect_open_issues()

    assert [task.identifier for task in tasks] == ["9", "10"]
    assert "number,title,body,labels,author" in runner.calls[0]


def test_injected_runner_never_receives_token_through_global_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    observed: list[str | None] = []

    class EnvironmentRunner(Runner):
        def __call__(
            self, arguments: Sequence[str], cwd: Path, timeout: int = 300
        ) -> ProcessResult:
            observed.append(os.environ.get("GH_TOKEN"))
            return super().__call__(arguments, cwd, timeout)

    monkeypatch.setenv("GH_TOKEN", "parent-value")
    runner = EnvironmentRunner([ProcessResult(0, "[]", "")])
    client = GitHubClient("owner/repo", tmp_path, "factory-secret", runner)

    client.collect_open_issues()

    assert observed == ["parent-value"]


def test_github_cli_receives_only_scoped_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, str] = {}

    def fake_run_process(
        arguments: Sequence[str],
        cwd: Path,
        timeout: int = 300,
        *,
        environment: Mapping[str, str] | None = None,
    ) -> ProcessResult:
        del arguments, cwd, timeout
        captured.update(environment or {})
        return ProcessResult(0, "[]", "")

    monkeypatch.setenv("DATABASE_URL", "must-not-leak")
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-leak")
    monkeypatch.setenv("GH_TOKEN", "parent-token")
    monkeypatch.setattr("openhands_factory.github.run_process", fake_run_process)

    client = GitHubClient("owner/repo", tmp_path, "factory-secret")
    client.collect_open_issues()

    assert captured["GH_TOKEN"] == "factory-secret"
    assert "DATABASE_URL" not in captured
    assert "OPENAI_API_KEY" not in captured


def test_collect_defers_duplicate_titles_without_mutating_tickets(tmp_path: Path) -> None:
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
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    tasks = client.collect_open_issues()

    assert [task.identifier for task in tasks] == ["20"]
    assert len(runner.calls) == 1


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


def test_requeue_restores_required_intake_label(tmp_path: Path) -> None:
    runner = Runner(
        [
            ProcessResult(0, json.dumps([{"number": 32}]), ""),
            ProcessResult(0, "", ""),
            ProcessResult(0, "", ""),
            ProcessResult(0, "", ""),
        ]
    )
    client = GitHubClient(
        "owner/repo",
        tmp_path,
        "secret",
        runner,
        require_ready_label=True,
        ready_label="factory-ready",
    )

    client.requeue_quarantined_issues()

    assert any(
        "32" in call and "--add-label" in call and "factory-ready" in call for call in runner.calls
    )


def test_requeue_can_silently_clear_automatic_recovery_labels(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    requeued = client.requeue_quarantined_issues([33], announce=False)

    assert requeued == [33]
    assert len(runner.calls) == 1
    assert "--remove-label" in runner.calls[0]
    assert all("comment" not in call for call in runner.calls)


def test_release_active_issues_restores_required_intake_without_comments(
    tmp_path: Path,
) -> None:
    runner = Runner([ProcessResult(0, "", ""), ProcessResult(0, "", "")])
    client = GitHubClient(
        "owner/repo",
        tmp_path,
        "secret",
        runner,
        require_ready_label=True,
        ready_label="factory-ready",
    )

    released = client.release_active_issues([35])

    assert released == [35]
    assert any("--remove-label" in call and "factory-active" in call for call in runner.calls)
    assert any("--add-label" in call and "factory-ready" in call for call in runner.calls)
    assert all("comment" not in call for call in runner.calls)


def test_list_active_issues_unions_current_and_retired_ownership(tmp_path: Path) -> None:
    runner = Runner(
        [
            ProcessResult(0, json.dumps([{"number": 34}]), ""),
            ProcessResult(0, json.dumps([{"number": 34}, {"number": 35}]), ""),
        ]
    )
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    active = client.list_active_issues()

    assert active == [34, 35]
    assert any("factory-active" in call for call in runner.calls)
    assert any("swarm-active" in call for call in runner.calls)


def test_release_active_issues_preserves_admission_when_ready_labels_are_optional(
    tmp_path: Path,
) -> None:
    runner = Runner([ProcessResult(0, "", ""), ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.release_active_issues([36])

    assert any("--add-label" in call and "factory-ready" in call for call in runner.calls)


def test_collect_open_pull_requests_excludes_drafts_own_and_explicitly_skipped(
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
            "title": "Reviewed but still open",
            "body": "Body",
            "headRefName": "sentinel/fix-thing",
            "isDraft": False,
            "labels": [
                {"name": "factory-reviewed"},
                {"name": "priority:critical"},
            ],
        },
        {
            "number": 44,
            "title": "Operator skipped",
            "body": "Body",
            "headRefName": "operator/skip-thing",
            "isDraft": False,
            "labels": [{"name": "factory-skip"}],
        },
        {
            "number": 45,
            "title": "Weekly architecture gap analysis",
            "body": "Body",
            "headRefName": "factory/architect-2026-w34-cycle",
            "isDraft": True,
            "labels": [],
        },
        {
            "number": 46,
            "title": "Fork contribution",
            "body": "Body",
            "headRefName": "contributor/fix",
            "isCrossRepository": True,
            "isDraft": False,
            "labels": [],
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    tasks = client.collect_open_pull_requests()

    assert [task.identifier for task in tasks] == ["40", "43", "45"]
    assert tasks[0].source == "github-pull-request"
    assert tasks[0].pr_branch == "bolt/optimize-quests"
    # Above ordinary issue work (10) so a review-only task doesn't sit behind
    # a long backlog of fresh issue implementations at equal priority, but
    # below guardian-alert issues (0), which stay most urgent.
    assert tasks[0].priority == 5
    assert tasks[1].priority == 1
    assert tasks[2].pr_branch == "factory/architect-2026-w34-cycle"


def test_trusted_intake_gates_external_pull_requests_but_not_architecture_work(
    tmp_path: Path,
) -> None:
    payload = [
        {
            "number": 50,
            "title": "Trusted PR",
            "body": "Body",
            "headRefName": "owner/fix",
            "isDraft": False,
            "labels": [],
            "author": {"login": "repoowner"},
        },
        {
            "number": 51,
            "title": "Admitted PR",
            "body": "Body",
            "headRefName": "contributor/fix",
            "isDraft": False,
            "labels": [{"name": "factory-ready"}],
            "author": {"login": "outsider"},
        },
        {
            "number": 52,
            "title": "Untrusted PR",
            "body": "Body",
            "headRefName": "contributor/untrusted",
            "isDraft": False,
            "labels": [],
            "author": {"login": "outsider"},
        },
        {
            "number": 53,
            "title": "Architecture PR",
            "body": "Body",
            "headRefName": "factory/architect-2026-w34-cycle",
            "isDraft": True,
            "labels": [],
            "author": {"login": "factory-bot"},
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient(
        "owner/repo",
        tmp_path,
        "secret",
        runner,
        require_trusted_intake=True,
        trusted_github_actors={"repoowner"},
    )

    tasks = client.collect_open_pull_requests()

    assert [task.identifier for task in tasks] == ["50", "51", "53"]
    assert (
        "number,title,body,headRefName,isCrossRepository,isDraft,labels,author" in runner.calls[0]
    )


def test_equivalent_pr_search_combines_all_supported_identity_signals(
    tmp_path: Path,
) -> None:
    payload = [
        {
            "number": 90,
            "title": "Different wording",
            "body": "Fixes #42",
            "baseRefName": "main",
            "headRefName": "factory/42-fix-build",
            "headRefOid": "head-90",
            "state": "OPEN",
            "closedAt": None,
            "mergedAt": None,
            "isCrossRepository": False,
            "labels": [],
            "closingIssuesReferences": [{"number": 42}],
            "files": [{"path": "automation/openhands_factory/pipeline.py"}],
        },
        {
            "number": 91,
            "title": "Unrelated title",
            "body": "No issue link",
            "baseRefName": "main",
            "headRefName": "factory/path-overlap",
            "headRefOid": "head-91",
            "state": "OPEN",
            "closedAt": None,
            "mergedAt": None,
            "isCrossRepository": False,
            "labels": [],
            "closingIssuesReferences": [],
            "files": [{"path": "automation/tests/test_pipeline.py"}],
        },
        {
            "number": 92,
            "title": "Replacement",
            "body": "Supersedes #42",
            "baseRefName": "main",
            "headRefName": "factory/replacement",
            "headRefOid": "head-92",
            "state": "OPEN",
            "closedAt": None,
            "mergedAt": None,
            "isCrossRepository": False,
            "labels": [],
            "closingIssuesReferences": [],
            "files": [],
        },
        {
            "number": 80,
            "title": "Fixes #42: Fix build (#80)",
            "body": "",
            "baseRefName": "main",
            "headRefName": "factory/80-fix-build",
            "headRefOid": "head-80",
            "state": "MERGED",
            "closedAt": "2026-08-20T00:00:00Z",
            "mergedAt": "2026-08-20T00:00:00Z",
            "isCrossRepository": False,
            "labels": [],
            "closingIssuesReferences": [],
            "files": [],
        },
        {
            "number": 70,
            "title": "Fix build",
            "body": "",
            "baseRefName": "main",
            "headRefName": "factory/70-old",
            "headRefOid": "head-70",
            "state": "CLOSED",
            "closedAt": "2026-06-01T00:00:00Z",
            "mergedAt": None,
            "isCrossRepository": False,
            "labels": [],
            "closingIssuesReferences": [],
            "files": [],
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)
    task = Task("42", "Fix build", "Body", "github-issue", 0)

    matches = client.find_equivalent_pull_requests(
        task,
        known_branch="factory/42-fix-build",
        known_path_fingerprint=changed_path_fingerprint(["automation/tests/test_pipeline.py"]),
        now=datetime(2026, 8, 24, tzinfo=UTC),
    )

    assert [match.number for match in matches] == [92, 90, 80, 91]
    assert matches[0].reasons == frozenset({"supersession-link"})
    assert matches[1].reasons == frozenset({"issue-link", "branch-metadata"})
    assert matches[2].reasons == frozenset({"logical-title"})
    assert matches[3].reasons == frozenset({"changed-path-fingerprint"})
    assert not matches[3].is_open_canonical
    assert "--state" in runner.calls[0] and "all" in runner.calls[0]
    json_fields = runner.calls[0][runner.calls[0].index("--json") + 1]
    assert "closingIssuesReferences" not in json_fields
    assert json_fields.endswith("author,files")


def test_equivalent_pr_search_omits_files_until_path_fingerprint_is_known(
    tmp_path: Path,
) -> None:
    payload = [
        {
            "number": 90,
            "title": "Different wording",
            "body": "Fixes #42",
            "baseRefName": "main",
            "headRefName": "factory/42-fix-build",
            "headRefOid": "head-90",
            "state": "OPEN",
            "closedAt": None,
            "mergedAt": None,
            "isCrossRepository": False,
            "labels": [],
        }
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    matches = client.find_equivalent_pull_requests(
        Task("42", "Fix build", "Body", "github-issue", 0),
        known_branch="factory/42-fix-build",
        now=datetime(2026, 8, 24, tzinfo=UTC),
    )

    assert [match.number for match in matches] == [90]
    assert matches[0].reasons == frozenset({"issue-link", "branch-metadata"})
    json_fields = runner.calls[0][runner.calls[0].index("--json") + 1]
    assert json_fields.endswith("labels,author")
    assert "files" not in json_fields.split(",")


def test_equivalent_pr_search_does_not_trust_factory_branch_prefix(
    tmp_path: Path,
) -> None:
    def candidate(number: int, author: str) -> dict[str, object]:
        return {
            "number": number,
            "title": "Fix build",
            "body": "Fixes #42",
            "baseRefName": "main",
            "headRefName": f"factory/{number}-fix-build",
            "headRefOid": f"head-{number}",
            "state": "OPEN",
            "closedAt": None,
            "mergedAt": None,
            "isCrossRepository": False,
            "labels": [],
            "author": {"login": author},
            "closingIssuesReferences": [{"number": 42}],
            "files": [],
        }

    runner = Runner(
        [
            ProcessResult(
                0,
                json.dumps(
                    [
                        candidate(90, "outsider"),
                        candidate(91, "repoowner"),
                    ]
                ),
                "",
            )
        ]
    )
    client = GitHubClient(
        "owner/repo",
        tmp_path,
        "secret",
        runner,
        require_trusted_intake=True,
        trusted_github_actors={"repoowner"},
    )

    matches = client.find_equivalent_pull_requests(
        Task("42", "Fix build", "Body", "github-issue", 0),
        now=datetime(2026, 8, 24, tzinfo=UTC),
    )

    assert [match.number for match in matches] == [91]


def test_list_all_open_issue_titles_ignores_labels(tmp_path: Path) -> None:
    payload = [{"title": "Blocked one"}, {"title": "Normal one"}]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    titles = client.list_all_open_issue_titles()

    assert titles == {"Blocked one", "Normal one"}


def test_architect_deduplication_ignores_unadmitted_public_titles(tmp_path: Path) -> None:
    payload = [
        {
            "title": "Public pre-emption",
            "labels": [],
            "author": {"login": "outsider"},
        },
        {
            "title": "Trusted blocked work",
            "labels": [{"name": "needs-human"}],
            "author": {"login": "repoowner"},
        },
        {
            "title": "Admitted public work",
            "labels": [{"name": "factory-ready"}],
            "author": {"login": "outsider"},
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient(
        "owner/repo",
        tmp_path,
        "secret",
        runner,
        require_trusted_intake=True,
        trusted_github_actors={"repoowner"},
    )

    titles = client.list_all_open_issue_titles()

    assert titles == {"Trusted blocked work", "Admitted public work"}
    assert "title,labels,author" in runner.calls[0]


def test_create_issue_parses_number_and_applies_labels(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "https://github.com/owner/repo/issues/55\n", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    number = client.create_issue("Title", "Body", ("architect-proposed",))

    assert number == 55
    assert "--label" in runner.calls[0] and "architect-proposed" in runner.calls[0]


def test_find_control_panel_issue_requires_exact_title_and_status_label(tmp_path: Path) -> None:
    payload = [
        {
            "number": 61,
            "title": "Factory control panel preview",
            "labels": [{"name": "factory-status"}],
        },
        {
            "number": 62,
            "title": "Factory control panel",
            "labels": [{"name": "factory-status"}, {"name": "factory-skip"}],
        },
        {
            "number": 63,
            "title": "Factory control panel",
            "labels": [],
        },
    ]
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    issue = client.find_open_issue_by_title(
        "Factory control panel",
        required_label="factory-status",
    )

    assert issue == 62
    assert '"Factory control panel" in:title label:factory-status' in runner.calls[0]


def test_issue_update_uses_fixed_argv_without_a_shell(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.update_issue(62, title="Factory control panel", body="Status: healthy")

    assert runner.calls[0][:4] == ("gh", "issue", "edit", "62")
    assert "Status: healthy" in runner.calls[0]


def test_issue_comments_are_typed_sorted_and_filtered_after_cursor(tmp_path: Path) -> None:
    payload = [
        {
            "id": 12,
            "body": "/factory pause",
            "created_at": "2026-08-17T12:00:00Z",
            "user": {"login": "owner"},
        },
        {
            "id": 10,
            "body": "older",
            "created_at": "2026-08-17T11:00:00Z",
            "user": {"login": "owner"},
        },
        {"id": "invalid", "body": "ignored", "user": {"login": "owner"}},
    ]
    runner = Runner([ProcessResult(0, encoded_api_items(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    comments = client.list_issue_comments(62, after=10)

    assert [(comment.identifier, comment.author, comment.body) for comment in comments] == [
        (12, "owner", "/factory pause")
    ]
    assert "repos/owner/repo/issues/62/comments" in runner.calls[0]
    assert "--paginate" in runner.calls[0]
    assert "--jq" in runner.calls[0]
    assert "--slurp" not in runner.calls[0]


def test_paginated_issue_comment_records_are_decoded(tmp_path: Path) -> None:
    payload = [
        {
            "id": 20,
            "body": "/factory status",
            "created_at": "2026-08-17T12:00:00Z",
            "user": {"login": "owner"},
        },
        {
            "id": 21,
            "body": "/factory resume",
            "created_at": "2026-08-17T12:01:00Z",
            "user": {"login": "owner"},
        },
    ]
    runner = Runner([ProcessResult(0, encoded_api_items(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    comments = client.list_issue_comments(62)

    assert [comment.identifier for comment in comments] == [20, 21]


def test_malformed_issue_comment_output_fails_closed(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "not-base64", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    with pytest.raises(FactoryError, match="Could not parse GitHub issue comments"):
        client.list_issue_comments(62)


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


def test_pull_request_branch_update_is_bound_to_the_inspected_head(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "{}", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.update_pull_request_branch(42, "abc123")

    assert runner.calls == [
        (
            "gh",
            "api",
            "--method",
            "PUT",
            "repos/owner/repo/pulls/42/update-branch",
            "-f",
            "expected_head_sha=abc123",
        )
    ]


def test_pull_request_status_requires_all_checks_to_pass(tmp_path: Path) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "mergeStateStatus": "BEHIND",
        "reviewDecision": "APPROVED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"context": "factory/independent-review", "state": "SUCCESS"},
            {"name": "CI / required", "status": "COMPLETED", "conclusion": "SUCCESS"},
            {"name": "backend / unit", "status": "COMPLETED", "conclusion": "SUCCESS"},
            {"name": "frontend / build", "status": "COMPLETED", "conclusion": "SKIPPED"},
            {"name": "CI / required", "status": "COMPLETED", "conclusion": "SUCCESS"},
            {"context": "factory/independent-review", "state": "SUCCESS"},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert status.checks_passed
    assert not status.checks_pending
    assert status.failed_checks == frozenset()
    assert status.head_sha == "abc123"
    assert status.merge_state_status == "BEHIND"


def test_pull_request_status_treats_missing_canonical_gate_as_pending(tmp_path: Path) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "reviewDecision": "APPROVED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"name": "backend / unit", "status": "COMPLETED", "conclusion": "SUCCESS"},
            {"context": "factory/independent-review", "state": "SUCCESS"},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert not status.checks_passed
    assert status.checks_pending
    assert status.failed_checks == frozenset()


def test_pull_request_status_requires_independent_review_success(tmp_path: Path) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "reviewDecision": "APPROVED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"name": "CI / required", "status": "COMPLETED", "conclusion": "SUCCESS"},
            {"context": "factory/independent-review", "state": "PENDING"},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert not status.checks_passed
    assert status.checks_pending
    assert status.failed_checks == frozenset({"factory/independent-review"})


@pytest.mark.parametrize("conclusion", ["SKIPPED", "NEUTRAL"])
def test_pull_request_status_requires_success_for_canonical_contexts(
    tmp_path: Path,
    conclusion: str,
) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "reviewDecision": "APPROVED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"context": "factory/independent-review", "state": "SUCCESS"},
            {"name": "CI / required", "status": "COMPLETED", "conclusion": conclusion},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert not status.checks_passed
    assert not status.checks_pending
    assert status.failed_checks == frozenset({"CI / required"})


def test_pull_request_status_exposes_terminal_failed_check_names(tmp_path: Path) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "reviewDecision": "APPROVED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"name": "backend / unit", "status": "COMPLETED", "conclusion": "FAILURE"},
            {"context": "factory/independent-review", "state": "FAILURE"},
            {"name": "frontend / build", "status": "IN_PROGRESS", "conclusion": ""},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert not status.checks_passed
    assert status.checks_pending
    assert status.failed_checks == frozenset({"backend / unit", "factory/independent-review"})


def test_pull_request_status_does_not_mark_terminal_required_failure_as_pending(
    tmp_path: Path,
) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "reviewDecision": "APPROVED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"context": "factory/independent-review", "state": "SUCCESS"},
            {"name": "CI / required", "status": "COMPLETED", "conclusion": "FAILURE"},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert not status.checks_passed
    assert not status.checks_pending
    assert status.failed_checks == frozenset({"CI / required"})


def test_pull_request_status_never_merges_over_requested_human_changes(
    tmp_path: Path,
) -> None:
    payload = {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "reviewDecision": "CHANGES_REQUESTED",
        "headRefOid": "abc123",
        "statusCheckRollup": [
            {"context": "factory/independent-review", "state": "SUCCESS"},
            {"name": "CI / required", "status": "COMPLETED", "conclusion": "SUCCESS"},
        ],
    }
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    status = client.pull_request_status(42)

    assert not status.checks_passed
    assert status.checks_pending
    assert status.review_decision == "CHANGES_REQUESTED"


def test_review_status_is_anchored_to_head_sha(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.publish_review_status("abc123", approved=True, detail="Review passed")

    call = runner.calls[0]
    assert "repos/owner/repo/statuses/abc123" in call
    assert "context=factory/independent-review" in call
    assert "state=success" in call


def test_pending_review_status_invalidates_same_head_approval(tmp_path: Path) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "secret", runner)

    client.publish_review_pending("abc123", detail="Review in progress")

    call = runner.calls[0]
    assert "repos/owner/repo/statuses/abc123" in call
    assert "context=factory/independent-review" in call
    assert "state=pending" in call


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
