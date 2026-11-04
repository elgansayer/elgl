"""Per-instance merge review policy: ci-gated merges buy no review conversation."""

import json
from datetime import timedelta
from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.github import (
    CI_GATED_MERGE_CHECKS,
    REQUIRED_FACTORY_MERGE_CHECKS,
    GitHubClient,
    PullRequestStatus,
    required_merge_checks,
)
from openhands_factory.models import Job, JobState, Task
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.pr_convergence import PullRequestRecord
from openhands_factory.repository_guard import ProcessResult
from tests.test_config import environment
from tests.test_github import Runner
from tests.test_pipeline import GitHub, config

HEAD = "abcdef1234567"


def status_payload(*checks: dict[str, str]) -> dict[str, object]:
    return {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "mergeStateStatus": "CLEAN",
        "reviewDecision": "",
        "headRefOid": HEAD,
        "statusCheckRollup": list(checks),
    }


CI_SUCCESS = {"name": "CI / required", "status": "COMPLETED", "conclusion": "SUCCESS"}
CI_FAILED = {"name": "CI / required", "status": "COMPLETED", "conclusion": "FAILURE"}
CI_RUNNING = {"name": "CI / required", "status": "IN_PROGRESS", "conclusion": ""}
REVIEW_PENDING = {"context": "factory/independent-review", "state": "PENDING"}


def client(tmp_path: Path, payload: dict[str, object], policy: str) -> GitHubClient:
    runner = Runner([ProcessResult(0, json.dumps(payload), "")])
    return GitHubClient("owner/repo", tmp_path, "secret", runner, merge_review_policy=policy)


def test_policy_selection_and_default(tmp_path: Path) -> None:
    assert required_merge_checks("independent-review") == REQUIRED_FACTORY_MERGE_CHECKS
    assert required_merge_checks("ci-gated") == CI_GATED_MERGE_CHECKS == {"CI / required"}
    with pytest.raises(ValueError):
        required_merge_checks("none")
    assert config(tmp_path).merge_review_policy == "independent-review"


def test_environment_selects_policy_and_rejects_unknown_values() -> None:
    assert FactoryConfig.from_environment(environment()).merge_review_policy == "independent-review"
    selected = FactoryConfig.from_environment(environment(FACTORY_MERGE_REVIEW_POLICY="ci-gated"))
    assert selected.merge_review_policy == "ci-gated"
    assert not selected.tests_only_merging
    with pytest.raises(ConfigurationError):
        FactoryConfig.from_environment(environment(FACTORY_MERGE_REVIEW_POLICY="skip"))


def test_ci_gated_ignores_a_retired_pending_review_status(tmp_path: Path) -> None:
    payload = status_payload(CI_SUCCESS, REVIEW_PENDING)
    gated = client(tmp_path, payload, "ci-gated").pull_request_status(42)
    assert gated.checks_passed and not gated.checks_pending
    assert gated.failed_checks == frozenset()
    reviewed = client(tmp_path, payload, "independent-review").pull_request_status(42)
    assert not reviewed.checks_passed and reviewed.checks_pending


@pytest.mark.parametrize(
    ("checks", "pending", "failed"),
    [
        ((CI_FAILED,), False, {"CI / required"}),
        ((CI_RUNNING,), True, set()),
        (
            ({"name": "backend / unit", "status": "COMPLETED", "conclusion": "SUCCESS"},),
            True,
            set(),
        ),
    ],
    ids=["failed-ci", "running-ci", "missing-ci"],
)
def test_ci_gated_still_blocks_failed_pending_or_missing_ci(
    tmp_path: Path, checks: tuple[dict[str, str], ...], pending: bool, failed: set[str]
) -> None:
    status = client(tmp_path, status_payload(*checks), "ci-gated").pull_request_status(42)
    assert not status.checks_passed
    assert status.checks_pending is pending
    # An observed but unsuccessful required check is unsuccessful under both policies.
    assert failed <= set(status.failed_checks)


def test_convergence_record_honours_the_selected_policy() -> None:
    payload = {
        **status_payload(CI_SUCCESS),
        "headRefName": "fix/candidate",
        "baseRefName": "main",
        "isCrossRepository": False,
        "labels": [],
        "title": "candidate",
        "body": "",
        "author": {"login": "owner"},
        "createdAt": "2026-11-04T00:00:00Z",
        "updatedAt": "2026-11-04T00:00:00Z",
    }
    assert not PullRequestRecord.from_payload(payload).checks_passed
    assert PullRequestRecord.from_payload(
        payload, required_checks=CI_GATED_MERGE_CHECKS
    ).checks_passed


def ci_status(**changes: object) -> PullRequestStatus:
    values: dict[str, object] = {"ci_required_passed": True}
    values.update(changes)
    return PullRequestStatus(77, "OPEN", False, "MERGEABLE", "", HEAD, False, False, **values)  # type: ignore[arg-type]


def reviewing_job() -> Job:
    return Job(
        Task("77", "CI-gated candidate", "", "github-pull-request", 1),
        state=JobState.REVIEWING,
        branch="fix/candidate",
        pull_request=77,
        head_sha=HEAD,
        latest_verified_sha=HEAD,
    )


def gated_pipeline(tmp_path: Path, github: GitHub) -> FactoryPipeline:
    factory_config = config(tmp_path).model_copy(update={"merge_review_policy": "ci-gated"})
    (factory_config.worktree_dir / "issue-77").mkdir(parents=True)
    pipeline = FactoryPipeline(factory_config, github=github)
    pipeline.jobs.save({"77": reviewing_job()})
    return pipeline


def test_ci_gated_review_phase_buys_no_conversation_and_queues_ci_check(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    github.statuses = [ci_status()]
    pipeline = gated_pipeline(tmp_path, github)
    monkeypatch.setattr(
        pipeline, "_run_agent", lambda *args, **kwargs: pytest.fail("ci-gated bought a review")
    )
    monkeypatch.setattr(GitWorkflow, "head_sha", lambda workflow: HEAD)
    result = pipeline.run_job("77")
    assert result is not None and result.last_error is None
    assert result.state is JobState.CI_PENDING
    assert result.provider_history == []
    assert github.reviewed == []


@pytest.mark.parametrize("case", ["pending", "failed"])
def test_ci_gated_review_phase_waits_or_repairs_without_green_ci(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, case: str
) -> None:
    github = GitHub()
    github.statuses = [
        ci_status(
            ci_required_passed=False,
            ci_required_pending=case == "pending",
            ci_required_failed=case == "failed",
        )
    ]
    pipeline = gated_pipeline(tmp_path, github)
    monkeypatch.setattr(
        pipeline, "_run_agent", lambda *args, **kwargs: pytest.fail("ci-gated bought a review")
    )
    monkeypatch.setattr("openhands_factory.pipeline.CI_POLL_INTERVAL", timedelta(0))
    result = pipeline.run_job("77")
    assert result is not None
    assert result.state is (JobState.REVIEWING if case == "pending" else JobState.REPAIRING)
    assert github.reviewed == []


@pytest.mark.parametrize("policy", ["ci-gated", "independent-review"])
def test_doctor_requires_the_review_ruleset_only_for_independent_review(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, policy: str
) -> None:
    from subprocess import CompletedProcess

    from openhands_factory.doctor import github_merge_policy_check

    # Live Elgl shape after the review-only ruleset was disabled: one baseline
    # ruleset requiring a pull request, CI / required and stale-snapshot.
    rules = [
        {"type": "pull_request", "parameters": {}, "ruleset_id": 42},
        {
            "type": "required_status_checks",
            "ruleset_id": 42,
            "parameters": {
                "required_status_checks": [
                    {"context": "CI / required"},
                    {"context": "stale-snapshot"},
                ]
            },
        },
    ]

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        payload: object = rules
        if arguments[-1].endswith("/rulesets/42"):
            payload = {"enforcement": "active", "bypass_actors": []}
        return CompletedProcess(arguments, 0, json.dumps(payload), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)
    factory_config = config(tmp_path).model_copy(update={"merge_review_policy": policy})
    check = github_merge_policy_check(factory_config)
    assert check.passed is (policy == "ci-gated")
    if policy == "ci-gated":
        assert "required-statuses=CI / required" in check.detail
        assert "review-ruleset=not-required (ci-gated)" in check.detail
    else:
        assert "missing-statuses=factory/independent-review" in check.detail
