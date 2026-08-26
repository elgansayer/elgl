import json
from pathlib import Path
from typing import Sequence

from openhands_factory.main_merge_gate import MainBranchMergeGate, gate_merge_batch
from openhands_factory.models import Job, JobState, Task
from openhands_factory.repository_guard import ProcessResult


class Runner:
    def __init__(self, results: list[ProcessResult]) -> None:
        self.results = results
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, arguments: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        del cwd, timeout
        self.calls.append(tuple(arguments))
        return self.results.pop(0)


def _job(identifier: str, state: JobState) -> Job:
    return Job(Task(identifier, f"Task {identifier}", "Body", "github-pull-request", 5), state=state)


def test_current_main_ci_requires_success_for_exact_head(tmp_path: Path) -> None:
    runner = Runner(
        [
            ProcessResult(0, "main-head\n", ""),
            ProcessResult(
                0,
                json.dumps(
                    [
                        {
                            "headSha": "older-head",
                            "status": "completed",
                            "conclusion": "success",
                        },
                        {
                            "headSha": "main-head",
                            "status": "completed",
                            "conclusion": "success",
                        },
                    ]
                ),
                "",
            ),
        ]
    )
    gate = MainBranchMergeGate("owner/repo", tmp_path, "secret", runner)

    status = gate.current_main_ci()

    assert status.head_sha == "main-head"
    assert status.green is True
    assert "--workflow" in runner.calls[1]
    assert "ci.yml" in runner.calls[1]
    assert "--event" in runner.calls[1]
    assert "push" in runner.calls[1]


def test_current_main_ci_fails_closed_when_exact_head_has_no_run(tmp_path: Path) -> None:
    runner = Runner(
        [
            ProcessResult(0, "main-head\n", ""),
            ProcessResult(
                0,
                json.dumps(
                    [
                        {
                            "headSha": "older-head",
                            "status": "completed",
                            "conclusion": "success",
                        }
                    ]
                ),
                "",
            ),
        ]
    )
    gate = MainBranchMergeGate("owner/repo", tmp_path, "secret", runner)

    assert gate.is_green() is False


def test_current_main_ci_fails_closed_when_run_is_pending(tmp_path: Path) -> None:
    runner = Runner(
        [
            ProcessResult(0, "main-head\n", ""),
            ProcessResult(
                0,
                json.dumps(
                    [
                        {
                            "headSha": "main-head",
                            "status": "in_progress",
                            "conclusion": "",
                        }
                    ]
                ),
                "",
            ),
        ]
    )
    gate = MainBranchMergeGate("owner/repo", tmp_path, "secret", runner)

    assert gate.is_green() is False


def test_merge_batch_blocks_all_merges_while_main_is_unverified() -> None:
    merge_one = _job("1", JobState.MERGE_QUEUED)
    repair = _job("2", JobState.REPAIRING)
    merge_two = _job("3", JobState.MERGE_QUEUED)

    gated = gate_merge_batch([merge_one, repair, merge_two], main_ci_green=False)

    assert gated == [repair]


def test_merge_batch_allows_only_one_merge_from_green_main() -> None:
    merge_one = _job("1", JobState.MERGE_QUEUED)
    review = _job("2", JobState.REVIEWING)
    merge_two = _job("3", JobState.MERGE_QUEUED)

    gated = gate_merge_batch([merge_one, review, merge_two], main_ci_green=True)

    assert gated == [merge_one, review]
