"""Lifecycle evidence must not depend on filtered intake or optional CI status."""

import json
from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.github import GitHubClient, RemoteTaskState
from openhands_factory.repository_guard import ProcessResult


class Runner:
    def __init__(self, payload: object, failure: str | None = None):
        self.payload = payload
        self.failure = failure
        self.calls = []

    def __call__(self, arguments, cwd, timeout=300):
        self.calls.append(tuple(arguments))
        return (
            ProcessResult(1, "", self.failure)
            if self.failure
            else ProcessResult(0, json.dumps(self.payload), "")
        )


def native_merge_payload():
    # Public minimal response recorded from the actual natively merged PR9729.
    return json.loads((Path(__file__).parent / "fixtures/native-auto-merged-9729.json").read_text())


def test_actual_native_merge_receipt_is_recognised_without_check_or_review_queries(tmp_path):
    payload = native_merge_payload()
    runner = Runner(payload)
    client = GitHubClient("elgansayer/elgl", tmp_path, "unused-secret", runner)

    state = client.remote_task_state(9729, pull_request=True)

    assert state == RemoteTaskState(9729, "MERGED", payload["head_sha"])
    assert len(runner.calls) == 1
    assert runner.calls[0][2] == "repos/elgansayer/elgl/pulls/9729"
    assert "unused-secret" not in str(runner.calls)


@pytest.mark.parametrize("state", ["open", "closed"])
def test_unmerged_pull_request_state_is_explicit(tmp_path, state):
    payload = {**native_merge_payload(), "state": state, "merged": False}
    runner = Runner(payload)
    result = GitHubClient("owner/repo", tmp_path, "unused", runner).remote_task_state(
        9729, pull_request=True
    )
    assert result.state == state.upper()


@pytest.mark.parametrize("state", ["open", "closed"])
def test_issue_state_and_kind_are_confirmed(tmp_path, state):
    runner = Runner({"number": 42, "state": state, "is_pull_request": False})
    result = GitHubClient("owner/repo", tmp_path, "unused", runner).remote_task_state(42)
    assert result == RemoteTaskState(42, "OPEN" if state == "open" else "CLOSED")


@pytest.mark.parametrize(
    "changes",
    [
        {"number": 1},
        {"number": True},
        {"number": None},
        {"state": "unknown"},
        {"state": []},
        {"state": "open"},
        {"merged": None},
        {"merged": 1},
        {"head_sha": ""},
        {"head_sha": "abc"},
        {"head_sha": "z" * 40},
    ],
)
def test_ambiguous_or_mismatching_merge_evidence_fails_closed(tmp_path, changes):
    runner = Runner({**native_merge_payload(), **changes})
    with pytest.raises(FactoryError, match="malformed"):
        GitHubClient("owner/repo", tmp_path, "unused", runner).remote_task_state(
            9729, pull_request=True
        )


@pytest.mark.parametrize(
    "payload",
    [
        None,
        [],
        True,
        {"number": 42, "state": "closed"},
        {"number": 42, "state": "closed", "is_pull_request": True},
    ],
)
def test_missing_or_wrong_issue_kind_cannot_prove_closure(tmp_path, payload):
    with pytest.raises(FactoryError):
        GitHubClient("owner/repo", tmp_path, "unused", Runner(payload)).remote_task_state(42)


@pytest.mark.parametrize("failure", ["HTTP 401", "HTTP 403", "HTTP 404", "connection reset"])
def test_api_failure_is_not_a_closed_or_merged_state(tmp_path, failure):
    with pytest.raises(FactoryError, match=failure):
        GitHubClient("owner/repo", tmp_path, "unused", Runner(None, failure)).remote_task_state(42)
