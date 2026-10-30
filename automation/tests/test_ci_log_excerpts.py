import json
from pathlib import Path

from openhands_factory.github import GitHubClient, failed_log_excerpt
from openhands_factory.repository_guard import ProcessResult

LOG = """2026-10-29T06:33:20.1839545Z  * [new branch]          old-topic -> origin/old-topic
2026-10-29T06:33:21.0000000Z ##[group]Run npm run check:design-sync-drift
2026-10-29T06:33:22.0000000Z # pass 5
2026-10-29T06:33:22.1000000Z Design sync drift verification failed:
2026-10-29T06:33:22.2000000Z - screen.chat: mapped implementation changed
2026-10-29T06:33:22.3000000Z ##[error]Process completed with exit code 1.
2026-10-29T06:33:23.0000000Z Post job cleanup.
"""


def test_excerpt_keeps_lines_up_to_the_error_without_fetch_noise() -> None:
    excerpt = failed_log_excerpt(LOG)
    assert excerpt.splitlines()[-1] == "##[error]Process completed with exit code 1."
    assert "Design sync drift verification failed:" in excerpt
    assert "new branch" not in excerpt
    assert "Post job cleanup" not in excerpt
    assert "2026-10-29T" not in excerpt


def test_excerpt_keeps_failing_test_names_printed_far_above_the_exit_line() -> None:
    log = (
        "\x1b[41m FAIL \x1b[49m src/chat/search.spec.ts > preserves privacy filters\n"
        + "\n".join(f"source line {n}" for n in range(200))
        + "\n##[error]AssertionError: expected query to match\n"
        + "\n".join(f"summary {n}" for n in range(50))
        + "\n##[error]Process completed with exit code 1."
    )
    excerpt = failed_log_excerpt(log)
    assert excerpt.startswith(" FAIL  src/chat/search.spec.ts > preserves privacy filters")
    assert "##[error]AssertionError: expected query to match" in excerpt
    assert excerpt.endswith("##[error]Process completed with exit code 1.")
    assert "source line 10\n" not in excerpt


def test_excerpt_is_bounded() -> None:
    log = "\n".join(f"line {n}" for n in range(500)) + "\n##[error]boom"
    excerpt = failed_log_excerpt(log, lines=10, limit=60)
    assert len(excerpt) <= 60
    assert excerpt.endswith("##[error]boom")


def test_client_reads_specific_failed_jobs_not_the_aggregate_gate(tmp_path: Path) -> None:
    calls: list[tuple[str, ...]] = []

    def run(arguments, cwd, timeout=300):
        calls.append(tuple(arguments))
        if tuple(arguments[:3]) == ("gh", "run", "list"):
            return ProcessResult(0, json.dumps([{"databaseId": 7}]), "")
        if arguments[-1].endswith("/runs/7/jobs?filter=latest&per_page=100"):
            return ProcessResult(
                0,
                json.dumps(
                    {
                        "jobs": [
                            {"id": 1, "name": "constitution", "conclusion": "failure"},
                            {"id": 2, "name": "CI / required", "conclusion": "failure"},
                            {"id": 3, "name": "frontend / unit", "conclusion": "success"},
                        ]
                    }
                ),
                "",
            )
        return ProcessResult(0, LOG, "")

    client = GitHubClient("owner/repo", tmp_path, "secret", run)
    excerpts = client.failed_check_excerpts("abc123")

    assert excerpts.startswith("### constitution\n")
    assert "Design sync drift verification failed:" in excerpts
    assert ("gh", "api", "repos/owner/repo/actions/jobs/1/logs") in calls
    assert not any(call[-1].endswith("jobs/2/logs") for call in calls)
    assert calls[0][5:7] == ("--commit", "abc123")
