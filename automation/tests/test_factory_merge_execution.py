from collections.abc import Sequence
from pathlib import Path

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


def test_merge_pull_request_matches_the_reviewed_head_and_does_not_bypass_rules(
    tmp_path: Path,
) -> None:
    runner = Runner([ProcessResult(0, "", "")])
    client = GitHubClient("owner/repo", tmp_path, "token", runner)

    client.merge_pull_request(77, "reviewed-head")

    assert runner.calls == [
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
    assert "--admin" not in runner.calls[0]
    assert "--auto" not in runner.calls[0]
