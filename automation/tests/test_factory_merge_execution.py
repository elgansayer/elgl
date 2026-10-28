import json
from collections.abc import Sequence
from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.github import GitHubClient
from openhands_factory.repository_guard import ProcessResult


class Runner:
    def __init__(self, results: list[ProcessResult]) -> None:
        self.results = results
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, arguments: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        del cwd, timeout
        self.calls.append(tuple(arguments))
        return self.results.pop(0)


def queue_state(
    *,
    queue: bool = True,
    queued: bool = False,
    removed_head: str | None = None,
    removed_at: str = "2026-10-28T12:00:00Z",
    main_committed_at: str = "2026-10-28T11:00:00Z",
) -> ProcessResult:
    removals = (
        [
            {
                "createdAt": removed_at,
                "reason": "failed checks",
                "beforeCommit": {"oid": removed_head},
            }
        ]
        if removed_head is not None
        else []
    )
    repository = {
        "mergeQueue": {"id": "queue"} if queue else None,
        "ref": {"target": {"committedDate": main_committed_at}},
        "pullRequest": {
            "id": "PR_77",
            "isInMergeQueue": queued,
            "timelineItems": {"nodes": removals},
        },
    }
    return ProcessResult(0, json.dumps({"data": {"repository": repository}}), "")


def test_merge_pull_request_matches_the_reviewed_head_and_does_not_bypass_rules(
    tmp_path: Path,
) -> None:
    runner = Runner([queue_state(queue=False), ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "token", runner)

    client.merge_pull_request(77, "reviewed-head")

    assert runner.calls[1:] == [
        (
            "gh",
            "pr",
            "merge",
            "77",
            "--repo",
            "owner/repo",
            "--squash",
            "--delete-branch",
            "--match-head-commit",
            "reviewed-head",
        )
    ]
    assert "--admin" not in runner.calls[1]
    assert "--auto" not in runner.calls[1]


def test_merge_queue_enqueues_only_the_exact_reviewed_head(tmp_path: Path) -> None:
    runner = Runner([queue_state(), ProcessResult(0, "{}", "")])
    client = GitHubClient("owner/repo", tmp_path, "token", runner)

    client.merge_pull_request(77, "reviewed-head")

    enqueue = runner.calls[1]
    assert any("enqueuePullRequest" in argument for argument in enqueue)
    assert "id=PR_77" in enqueue
    assert "head=reviewed-head" in enqueue
    assert not any(call[:3] == ("gh", "pr", "merge") for call in runner.calls)


def test_merge_queue_leaves_an_already_queued_pull_request_alone(tmp_path: Path) -> None:
    runner = Runner([queue_state(queued=True)])
    client = GitHubClient("owner/repo", tmp_path, "token", runner)

    client.merge_pull_request(77, "reviewed-head")

    assert len(runner.calls) == 1


def test_merge_queue_removal_waits_for_main_to_move(tmp_path: Path) -> None:
    runner = Runner([queue_state(removed_head="reviewed-head")])
    client = GitHubClient("owner/repo", tmp_path, "token", runner)

    with pytest.raises(FactoryError, match="waiting for main to move"):
        client.merge_pull_request(77, "reviewed-head")
    assert len(runner.calls) == 1


@pytest.mark.parametrize(
    ("removed_head", "main_committed_at"),
    [
        ("reviewed-head", "2026-10-28T13:00:00Z"),
        ("older-head", "2026-10-28T11:00:00Z"),
    ],
)
def test_merge_queue_requeues_after_main_moves_or_for_a_new_head(
    tmp_path: Path, removed_head: str, main_committed_at: str
) -> None:
    runner = Runner(
        [
            queue_state(removed_head=removed_head, main_committed_at=main_committed_at),
            ProcessResult(0, "{}", ""),
        ]
    )
    client = GitHubClient("owner/repo", tmp_path, "token", runner)

    client.merge_pull_request(77, "reviewed-head")

    assert any("enqueuePullRequest" in argument for argument in runner.calls[1])
