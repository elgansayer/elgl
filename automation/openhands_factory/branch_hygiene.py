"""Deterministic audit and conservative cleanup for remote branch hygiene.

Auditing is read-only by default. Explicit cleanup deletes only branch tips that are
provably already reachable from the base branch and are not protected, provider-managed,
or attached to an open pull request. Orphans and closed-unmerged work are never deleted.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import cast

from openhands_factory.exceptions import FactoryError
from openhands_factory.repository_guard import ProcessRunner, run_process


class BranchClassification(StrEnum):
    PROTECTED = "protected"
    DEPENDABOT = "dependabot-managed"
    ACTIVE_CANONICAL = "active-canonical-pr"
    ACTIVE_NON_CANONICAL = "active-non-canonical-pr"
    MERGED = "merged-pr"
    CLOSED = "closed-pr"
    INTEGRATED = "integrated"
    ORPHAN = "orphan"


@dataclass(frozen=True)
class BranchRecord:
    name: str
    sha: str
    classification: BranchClassification
    ahead_by: int
    pull_requests: tuple[int, ...] = ()
    reason: str = ""


@dataclass(frozen=True)
class BranchAudit:
    repository: str
    base_branch: str
    generated_at: str
    branches: tuple[BranchRecord, ...]

    @property
    def counts(self) -> dict[str, int]:
        counts = Counter(record.classification.value for record in self.branches)
        return dict(sorted(counts.items()))

    @property
    def safe_deletion_candidates(self) -> tuple[str, ...]:
        return tuple(record.name for record in safe_deletion_candidates(self))

    def to_json(self) -> str:
        return json.dumps(
            {
                "repository": self.repository,
                "base_branch": self.base_branch,
                "generated_at": self.generated_at,
                "counts": self.counts,
                "safe_deletion_candidates": self.safe_deletion_candidates,
                "branches": [asdict(record) for record in self.branches],
            },
            indent=2,
            sort_keys=True,
        )


def _run_checked(
    runner: ProcessRunner,
    arguments: Sequence[str],
    workspace: Path,
) -> str:
    result = runner(arguments, workspace)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()[-2000:]
        raise FactoryError(f"Branch hygiene command failed: {' '.join(arguments)}: {detail}")
    return result.stdout


def _remote_branches(runner: ProcessRunner, workspace: Path) -> dict[str, str]:
    _run_checked(
        runner,
        (
            "git",
            "fetch",
            "--quiet",
            "origin",
            "--prune",
            "--no-tags",
            "+refs/heads/*:refs/remotes/origin/*",
        ),
        workspace,
    )
    output = _run_checked(
        runner,
        (
            "git",
            "for-each-ref",
            "--format=%(refname:short)|%(objectname)",
            "refs/remotes/origin",
        ),
        workspace,
    )
    branches: dict[str, str] = {}
    for line in output.splitlines():
        if "|" not in line:
            continue
        ref, sha = line.split("|", 1)
        if ref == "origin/HEAD" or not ref.startswith("origin/"):
            continue
        branches[ref.removeprefix("origin/")] = sha
    return branches


def _pull_requests(
    runner: ProcessRunner,
    workspace: Path,
    repository: str,
) -> dict[str, list[Mapping[str, object]]]:
    output = _run_checked(
        runner,
        (
            "gh",
            "pr",
            "list",
            "--repo",
            repository,
            "--state",
            "all",
            "--limit",
            "10000",
            "--json",
            "number,state,mergedAt,headRefName,labels,updatedAt,url,title",
        ),
        workspace,
    )
    decoded = cast(list[object], json.loads(output))
    grouped: dict[str, list[Mapping[str, object]]] = defaultdict(list)
    for item in decoded:
        if not isinstance(item, dict):
            continue
        record = cast(dict[str, object], item)
        head = record.get("headRefName")
        if isinstance(head, str) and head:
            grouped[head].append(record)
    return grouped


def _ahead_by(
    runner: ProcessRunner,
    workspace: Path,
    base_ref: str,
    sha: str,
) -> int:
    output = _run_checked(
        runner,
        ("git", "rev-list", "--count", f"{base_ref}..{sha}"),
        workspace,
    )
    try:
        return int(output.strip())
    except ValueError as error:
        raise FactoryError(f"Invalid ahead count for {sha}: {output!r}") from error


def _is_integrated(
    runner: ProcessRunner,
    workspace: Path,
    base_ref: str,
    sha: str,
) -> bool:
    result = runner(("git", "merge-base", "--is-ancestor", sha, base_ref), workspace)
    if result.returncode == 0:
        return True
    if result.returncode == 1:
        return False
    detail = (result.stderr or result.stdout).strip()[-2000:]
    raise FactoryError(f"Unable to compare branch {sha} with {base_ref}: {detail}")


def _labels(item: Mapping[str, object]) -> set[str]:
    labels = item.get("labels")
    if not isinstance(labels, list):
        return set()
    names: set[str] = set()
    for label in cast(list[object], labels):
        if not isinstance(label, dict):
            continue
        name = cast(dict[str, object], label).get("name")
        if isinstance(name, str) and name:
            names.add(name)
    return names


def classify_branch(
    *,
    name: str,
    sha: str,
    base_branch: str,
    ahead_by: int,
    integrated: bool,
    pull_requests: Sequence[Mapping[str, object]],
    protected_prefixes: Sequence[str] = ("release/", "hotfix/"),
) -> BranchRecord:
    numbers: list[int] = []
    for item in pull_requests:
        number = item.get("number")
        if isinstance(number, int):
            numbers.append(number)
    pull_request_numbers = tuple(sorted(numbers))

    if (
        name == base_branch
        or name in {"main", "master", "develop"}
        or any(name.startswith(prefix) for prefix in protected_prefixes)
    ):
        return BranchRecord(
            name,
            sha,
            BranchClassification.PROTECTED,
            ahead_by,
            pull_request_numbers,
            "protected branch or prefix",
        )
    if name.startswith("dependabot/"):
        return BranchRecord(
            name,
            sha,
            BranchClassification.DEPENDABOT,
            ahead_by,
            pull_request_numbers,
            "provider-managed dependency branch",
        )

    open_prs = [item for item in pull_requests if str(item.get("state") or "").upper() == "OPEN"]
    if open_prs:
        explicitly_noncanonical = any(
            _labels(item).intersection({"superseded", "factory-skip", "duplicate"})
            for item in open_prs
        )
        classification = (
            BranchClassification.ACTIVE_NON_CANONICAL
            if explicitly_noncanonical
            else BranchClassification.ACTIVE_CANONICAL
        )
        reason = (
            "open PR is explicitly superseded/non-canonical"
            if explicitly_noncanonical
            else "open PR owns this branch"
        )
        return BranchRecord(
            name,
            sha,
            classification,
            ahead_by,
            pull_request_numbers,
            reason,
        )

    if any(item.get("mergedAt") for item in pull_requests):
        return BranchRecord(
            name,
            sha,
            BranchClassification.MERGED,
            ahead_by,
            pull_request_numbers,
            "branch belongs to a merged PR",
        )
    if pull_requests:
        return BranchRecord(
            name,
            sha,
            BranchClassification.CLOSED,
            ahead_by,
            pull_request_numbers,
            "branch belongs only to closed, unmerged PRs",
        )
    if integrated or ahead_by == 0:
        return BranchRecord(
            name,
            sha,
            BranchClassification.INTEGRATED,
            ahead_by,
            pull_request_numbers,
            "branch tip is already reachable from the base branch",
        )
    return BranchRecord(
        name,
        sha,
        BranchClassification.ORPHAN,
        ahead_by,
        pull_request_numbers,
        "no PR intent was found and commits are not integrated",
    )


def safe_deletion_candidates(audit: BranchAudit) -> tuple[BranchRecord, ...]:
    """Return only branches whose exact tip is already contained in the base.

    A merged PR is not enough on its own because squash/rebase merges can leave commits
    that are not ancestors of the base, and a branch may have received new commits after
    its PR merged. Requiring ``ahead_by == 0`` makes deletion deliberately conservative.
    Closed-unmerged and orphan branches are never cleanup candidates.
    """

    safe_classes = {BranchClassification.MERGED, BranchClassification.INTEGRATED}
    return tuple(
        record
        for record in audit.branches
        if record.classification in safe_classes and record.ahead_by == 0
    )


def _open_pull_request_numbers(
    runner: ProcessRunner,
    workspace: Path,
    repository: str,
    branch: str,
) -> tuple[int, ...]:
    """Re-check live PR ownership immediately before deleting a branch."""

    output = _run_checked(
        runner,
        (
            "gh",
            "pr",
            "list",
            "--repo",
            repository,
            "--state",
            "open",
            "--head",
            branch,
            "--limit",
            "20",
            "--json",
            "number",
        ),
        workspace,
    )
    decoded = cast(list[object], json.loads(output))
    numbers: list[int] = []
    for item in decoded:
        if not isinstance(item, dict):
            continue
        number = cast(dict[str, object], item).get("number")
        if isinstance(number, int):
            numbers.append(number)
    return tuple(sorted(numbers))


def _remote_branch_tip(
    runner: ProcessRunner,
    workspace: Path,
    branch: str,
) -> str | None:
    """Return the current exact remote tip, or None when another actor deleted it."""

    ref = f"refs/heads/{branch}"
    output = _run_checked(
        runner,
        ("git", "ls-remote", "--heads", "origin", ref),
        workspace,
    ).strip()
    if not output:
        return None
    lines = output.splitlines()
    if len(lines) != 1:
        raise FactoryError(f"Unexpected remote branch lookup for {branch}: {output!r}")
    fields = lines[0].split()
    if len(fields) != 2 or fields[1] != ref:
        raise FactoryError(f"Unexpected remote branch lookup for {branch}: {output!r}")
    return fields[0]


def _cleanup_race(detail: str) -> bool:
    normalized = detail.lower()
    return "stale info" in normalized or "remote ref does not exist" in normalized


def delete_safe_branches(
    audit: BranchAudit,
    workspace: Path,
    *,
    runner: ProcessRunner = run_process,
) -> tuple[str, ...]:
    """Delete only still-unowned, unchanged, provably integrated remote branches.

    The audit is a snapshot. A branch can acquire a new PR owner, move to a new commit,
    or disappear between that snapshot and cleanup. Re-check ownership and the remote tip,
    then bind deletion to the audited SHA with ``--force-with-lease`` so stale cleanup can
    never delete commits that arrived after the audit.
    """

    deleted: list[str] = []
    for record in safe_deletion_candidates(audit):
        if _open_pull_request_numbers(
            runner,
            workspace,
            audit.repository,
            record.name,
        ):
            continue
        remote_tip = _remote_branch_tip(runner, workspace, record.name)
        if remote_tip is None or remote_tip != record.sha:
            continue

        ref = f"refs/heads/{record.name}"
        arguments = (
            "git",
            "push",
            f"--force-with-lease={ref}:{record.sha}",
            "origin",
            f":{ref}",
        )
        result = runner(arguments, workspace)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()[-2000:]
            if _cleanup_race(detail):
                continue
            raise FactoryError(f"Branch hygiene command failed: {' '.join(arguments)}: {detail}")
        deleted.append(record.name)
    return tuple(deleted)


def audit_branches(
    repository: str,
    workspace: Path,
    *,
    base_branch: str = "main",
    runner: ProcessRunner = run_process,
) -> BranchAudit:
    branches = _remote_branches(runner, workspace)
    pull_requests = _pull_requests(runner, workspace, repository)
    base_ref = f"origin/{base_branch}"
    records: list[BranchRecord] = []
    for name, sha in sorted(branches.items()):
        ahead = _ahead_by(runner, workspace, base_ref, sha)
        integrated = _is_integrated(runner, workspace, base_ref, sha)
        records.append(
            classify_branch(
                name=name,
                sha=sha,
                base_branch=base_branch,
                ahead_by=ahead,
                integrated=integrated,
                pull_requests=pull_requests.get(name, ()),
            )
        )
    return BranchAudit(
        repository=repository,
        base_branch=base_branch,
        generated_at=datetime.now(UTC).isoformat(),
        branches=tuple(records),
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit remote branches and optionally delete only provably integrated tips"
    )
    parser.add_argument("--repository", required=True, help="owner/name repository")
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    parser.add_argument("--base", default="main", dest="base_branch")
    parser.add_argument(
        "--fail-on-orphans",
        action="store_true",
        help="exit non-zero when genuine orphan branches are found",
    )
    parser.add_argument(
        "--delete-safe",
        action="store_true",
        help=(
            "delete only merged/integrated branches whose exact tip has zero commits "
            "ahead of the base; never deletes open-PR, orphan, or closed-unmerged work"
        ),
    )
    arguments = parser.parse_args(argv)
    audit = audit_branches(
        arguments.repository,
        arguments.workspace,
        base_branch=arguments.base_branch,
    )
    print(audit.to_json())
    if arguments.delete_safe:
        deleted = delete_safe_branches(audit, arguments.workspace)
        for branch in deleted:
            print(f"deleted-safe-branch: {branch}")
    if arguments.fail_on_orphans and any(
        record.classification is BranchClassification.ORPHAN for record in audit.branches
    ):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
