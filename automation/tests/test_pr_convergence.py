from pathlib import Path

from openhands_factory.models import Task
from openhands_factory.pr_convergence import (
    ConvergenceAction,
    PullRequestIdentity,
    PullRequestRecord,
    calculate_capacity,
    component_for_paths,
    convergence_supersessions,
    fingerprint_paths,
    resolve_pull_request,
)


def record(
    number: int,
    *,
    title: str = "Fixes #42: Bound PR churn",
    state: str = "OPEN",
    branch: str | None = None,
    body: str = "",
    files: tuple[str, ...] = ("automation/x.py",),
    created_at: str | None = None,
    merged_at: str | None = None,
    pending: bool = False,
    is_cross_repository: bool = False,
) -> PullRequestRecord:
    return PullRequestRecord(
        number=number,
        title=title,
        body=body,
        state=state,
        is_draft=False,
        head_ref=branch or f"factory/{number}-bound-pr-churn",
        head_sha=f"head-{number}",
        base_ref="main",
        files=files,
        created_at=created_at,
        merged_at=merged_at,
        checks_pending=pending,
        is_cross_repository=is_cross_repository,
    )


def identity(*, branch: str = "factory/42-bound-pr-churn") -> PullRequestIdentity:
    return PullRequestIdentity.for_task(
        Task("42", "Bound PR churn", "", "github-issue", 0),
        branch=branch,
        base_ref="main",
        change_fingerprint="change-42",
        touched_paths={Path("automation/x.py")},
    )


def marked_body(
    *,
    task_key: str = "title:task-42",
    change: str = "change-42",
    stack_parent: int | None = None,
) -> str:
    lines = [
        f"Factory-Task-Key: {task_key}",
        f"Factory-Change-Fingerprint: {change}",
        f"Factory-Touched-Files: {fingerprint_paths({Path('automation/x.py')})}",
        "Factory-Lane: factory",
        "Factory-Component: automation",
        "Factory-Owner: factory",
    ]
    if stack_parent is not None:
        lines.append(f"Factory-Stack-Parent: #{stack_parent}")
    return "\n".join(lines)


def test_identity_markers_cover_every_deduplication_axis() -> None:
    current = identity()

    markers = current.markers()

    assert f"Factory-Task-Key: {current.task_key}" in markers
    assert "Factory-Change-Fingerprint: change-42" in markers
    assert "Factory-Touched-Files:" in markers
    assert "Factory-Lane: factory" in markers
    assert "Factory-Component: automation" in markers
    assert "Factory-Owner: factory" in markers


def test_existing_open_task_is_reused_and_newer_duplicate_is_superseded() -> None:
    current = identity()
    first = record(
        70,
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
        created_at="2026-08-20T00:00:00Z",
    )
    replay = record(
        71,
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
        created_at="2026-08-21T00:00:00Z",
    )

    resolution = resolve_pull_request(current, [replay, first])

    assert resolution.action is ConvergenceAction.REUSE
    assert resolution.canonical == first
    assert resolution.superseded == (replay,)


def test_equivalent_merged_change_closes_open_replay_instead_of_creating() -> None:
    current = identity()
    merged = record(
        60,
        state="MERGED",
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
        merged_at="2026-08-20T00:00:00Z",
    )
    replay = record(
        61,
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
    )

    resolution = resolve_pull_request(current, [replay, merged])

    assert resolution.action is ConvergenceAction.ALREADY_MERGED
    assert resolution.canonical == merged
    assert resolution.superseded == (replay,)


def test_touched_file_collision_without_shared_identity_blocks_creation() -> None:
    current = identity()
    overlap = record(
        90,
        title="Refactor unrelated automation",
        body=marked_body(task_key="explicit:other-task", change="other-change"),
    )

    resolution = resolve_pull_request(current, [overlap])

    assert resolution.action is ConvergenceAction.BLOCKED
    assert "#90" in resolution.reason


def test_external_pull_request_owns_matching_task_without_branch_replacement() -> None:
    current = identity()
    external = record(
        88,
        branch="contributor/bound-pr-churn",
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
    )

    resolution = resolve_pull_request(current, [external])

    assert resolution.action is ConvergenceAction.BLOCKED
    assert resolution.canonical == external
    assert "external branch" in resolution.reason


def test_explicit_stack_parent_allows_touched_file_overlap() -> None:
    current = PullRequestIdentity(
        **{**identity().__dict__, "stack_parent": 90},
    )
    parent = record(
        90,
        title="Parent automation change",
        body=marked_body(task_key="explicit:parent", change="parent-change"),
    )

    resolution = resolve_pull_request(current, [parent])

    assert resolution.action is ConvergenceAction.CREATE


def test_closed_factory_pr_is_reopened_but_external_closed_pr_blocks() -> None:
    current = identity()
    closed_factory = record(80, state="CLOSED", body=f"Fixes #42\n{marked_body()}")
    closed_external = record(
        81,
        state="CLOSED",
        branch="contributor/churn",
        body=f"Fixes #42\n{marked_body()}",
    )

    reusable = resolve_pull_request(current, [closed_factory])
    blocked = resolve_pull_request(current, [closed_external])

    assert reusable.action is ConvergenceAction.REOPEN
    assert reusable.canonical == closed_factory
    assert blocked.action is ConvergenceAction.BLOCKED


def test_reconciliation_closes_factory_duplicate_and_already_merged_replay() -> None:
    merged = record(
        50,
        state="MERGED",
        body=marked_body(task_key="explicit:landed", change="landed-change"),
        merged_at="2026-08-19T00:00:00Z",
    )
    landed_replay = record(
        51,
        body=marked_body(task_key="explicit:landed", change="landed-change"),
    )
    canonical = record(
        52,
        body=marked_body(task_key="explicit:active", change="active-change"),
        created_at="2026-08-20T00:00:00Z",
    )
    duplicate = record(
        53,
        body=marked_body(task_key="explicit:active", change="active-change"),
        created_at="2026-08-21T00:00:00Z",
    )

    closures = convergence_supersessions([merged, landed_replay, canonical, duplicate])

    assert [(item.pull_request.number, item.canonical) for item in closures] == [
        (51, 50),
        (53, 52),
    ]


def test_forged_change_fingerprint_on_a_non_factory_branch_is_never_superseded() -> None:
    """Factory-Change-Fingerprint is read verbatim from PR body text, so any PR author
    can copy a merged Factory PR's visible fingerprint into their own body. That copy
    must never by itself authorise closing and deleting a branch Factory does not own.
    """

    merged = record(
        50,
        state="MERGED",
        branch="factory/50-bound-pr-churn",
        body=marked_body(task_key="explicit:landed", change="landed-change"),
        merged_at="2026-08-19T00:00:00Z",
    )
    forged = record(
        51,
        branch="contributor/unrelated-work",
        body=marked_body(task_key="explicit:unrelated", change="landed-change"),
    )

    closures = convergence_supersessions([merged, forged])

    assert closures == ()


def test_forged_change_fingerprint_duplicate_pair_spares_the_non_factory_branch() -> None:
    canonical = record(
        60,
        branch="factory/60-bound-pr-churn",
        body=marked_body(task_key="explicit:active", change="shared-change"),
        created_at="2026-08-20T00:00:00Z",
    )
    forged_duplicate = record(
        61,
        branch="contributor/copycat",
        body=marked_body(task_key="explicit:other", change="shared-change"),
        created_at="2026-08-21T00:00:00Z",
    )

    closures = convergence_supersessions([canonical, forged_duplicate])

    assert closures == ()


def test_factory_owned_rejects_a_cross_repository_fork_naming_itself_like_factory() -> None:
    lookalike = record(70, branch="factory/70-imitation", is_cross_repository=True)

    assert not lookalike.factory_owned


def test_capacity_pauses_new_dispatch_at_global_lane_component_or_ci_limit() -> None:
    records = [
        record(
            70,
            body=marked_body(task_key="explicit:first", change="first"),
            pending=True,
        ),
        record(
            71,
            body=marked_body(task_key="explicit:second", change="second"),
            pending=True,
        ),
    ]

    capacity = calculate_capacity(
        records,
        max_open_pull_requests=2,
        max_queued_ci=2,
        lane_limits={"factory": 2},
        component_limits={"automation": 2},
    )

    assert capacity.pause_new_dispatch
    assert capacity.open_count == 2
    assert capacity.queued_ci_count == 2
    assert capacity.active_by_lane == {"factory": 2}
    assert capacity.active_by_component == {"automation": 2}
    assert capacity.blocked_reasons == (
        "open pull requests 2/2",
        "queued CI 2/2",
        "lane factory 2/2",
        "component automation 2/2",
    )


def test_capacity_counts_explicit_downstream_stack_as_deferred() -> None:
    parent = record(90, body=marked_body(task_key="explicit:parent", change="parent"))
    child = record(
        91,
        body=marked_body(task_key="explicit:child", change="child", stack_parent=90),
    )

    capacity = calculate_capacity(
        [parent, child],
        max_open_pull_requests=10,
        max_queued_ci=10,
        lane_limits={},
        component_limits={},
    )

    assert capacity.stacked_deferred_count == 1
    assert not capacity.pause_new_dispatch


def test_payload_parser_extracts_files_checks_and_workflow_run_ids() -> None:
    parsed = PullRequestRecord.from_payload(
        {
            "number": 42,
            "title": "Fixes #7: Bound churn",
            "body": marked_body(),
            "state": "OPEN",
            "isDraft": False,
            "headRefName": "factory/7-bound-churn",
            "headRefOid": "abc123",
            "baseRefName": "main",
            "labels": [{"name": "factory-reviewed"}],
            "files": [{"path": "automation/x.py"}],
            "statusCheckRollup": [
                {
                    "name": "CI / required",
                    "status": "COMPLETED",
                    "conclusion": "SUCCESS",
                    "detailsUrl": "https://github.com/owner/repo/actions/runs/123/job/456",
                },
                {"context": "factory/independent-review", "state": "SUCCESS"},
            ],
        }
    )

    assert parsed.issue_numbers == frozenset({7})
    assert parsed.files == ("automation/x.py",)
    assert parsed.checks_passed
    assert not parsed.checks_pending
    assert parsed.workflow_run_ids == frozenset({"123"})
    assert parsed.factory_owned
    assert component_for_paths(parsed.files) == "automation"


def test_reuse_never_supersedes_a_pull_request_factory_does_not_own() -> None:
    """Closing a superseded PR deletes its branch. A contributor who writes `Fixes #42`
    for an issue Factory is already implementing must not have their pull request closed
    and their branch deleted as a Factory "duplicate".
    """

    current = identity()
    owned = record(
        70,
        branch="factory/42-bound-pr-churn",
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
        created_at="2026-08-20T00:00:00Z",
    )
    external = record(
        88,
        title="Contributor fix for the same issue",
        branch="contributor/bound-pr-churn",
        body="Fixes #42",
        created_at="2026-08-19T00:00:00Z",
    )

    resolution = resolve_pull_request(current, [external, owned])

    assert resolution.action is ConvergenceAction.REUSE
    assert resolution.canonical == owned
    assert resolution.superseded == ()


def test_already_merged_convergence_only_closes_factory_owned_replays() -> None:
    current = identity()
    merged = record(
        60,
        state="MERGED",
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
        merged_at="2026-08-20T00:00:00Z",
    )
    owned_replay = record(61, body=f"Fixes #42\n{marked_body(task_key=current.task_key)}")
    external = record(
        88,
        title="Contributor fix for the same issue",
        branch="contributor/bound-pr-churn",
        body="Fixes #42",
    )

    resolution = resolve_pull_request(current, [merged, external, owned_replay])

    assert resolution.action is ConvergenceAction.ALREADY_MERGED
    assert resolution.canonical == merged
    assert resolution.superseded == (owned_replay,)


def test_fork_branch_named_like_the_factory_branch_cannot_capture_convergence() -> None:
    """A fork may name its head branch `factory/...`, so matching the Factory branch name
    proves nothing. Treating the lookalike as canonical would force-sync and retitle a
    branch Factory does not own, and would close the real Factory pull request behind it.
    """

    current = identity()
    lookalike = record(
        88,
        branch="factory/42-bound-pr-churn",
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
        created_at="2026-08-19T00:00:00Z",
        is_cross_repository=True,
    )
    owned = record(
        70,
        branch="factory/42-bound-pr-churn",
        body=f"Fixes #42\n{marked_body(task_key=current.task_key)}",
        created_at="2026-08-20T00:00:00Z",
    )

    resolution = resolve_pull_request(current, [lookalike, owned])

    assert resolution.action is ConvergenceAction.BLOCKED
    assert resolution.canonical == lookalike
    assert resolution.superseded == ()


def test_reconciliation_ignores_an_older_unowned_pull_request_for_the_same_issue() -> None:
    external = record(
        88,
        title="Contributor fix for the same issue",
        branch="contributor/bound-pr-churn",
        body="Fixes #42",
        created_at="2026-08-19T00:00:00Z",
    )
    owned = record(
        70,
        body=f"Fixes #42\n{marked_body()}",
        created_at="2026-08-20T00:00:00Z",
    )

    closures = convergence_supersessions([external, owned])

    assert closures == ()


def test_reconciliation_ignores_a_forged_task_key_on_an_unowned_branch() -> None:
    """A copied Factory-Task-Key marker must not let an unowned pull request nominate
    itself as the canonical owner of a task and have the real Factory branch deleted.
    """

    forged = record(
        88,
        title="Unrelated contributor change",
        branch="contributor/copycat",
        body=marked_body(task_key="explicit:active", change="active-change"),
        created_at="2026-08-19T00:00:00Z",
    )
    owned = record(
        70,
        body=marked_body(task_key="explicit:active", change="active-change"),
        created_at="2026-08-20T00:00:00Z",
    )

    closures = convergence_supersessions([forged, owned])

    assert closures == ()
