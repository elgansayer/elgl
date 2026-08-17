"""Read-only classification for remote branch hygiene.

This module intentionally never mutates remote branches or opens pull requests. It gives
operators and later garbage-collection code a deterministic inventory first, so cleanup
can be enabled only after branch intent has been classified and tested.
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

    def to_json(self) -> str:
        return json.dumps(
            {
                "repository": self.repository,
                "base_branch": self.base_branch,
                "generated_at": self.generated_at,
                "counts": self.counts,
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
    grouped: dict[str, list[Mapping[str, object]]] = defaultdict(list)
    for item in json.loads(output):
        if not isinstance(item, dict):
            continue
        head = item.get("headRefName")
        if isinstance(head, str) and head:
            grouped[head].append(item)
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
    return {
        str(label.get("name"))
        for label in labels
        if isinstance(label, dict) and label.get("name")
    }


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
    numbers = tuple(
        sorted(
            int(item["number"])
            for item in pull_requests
            if isinstance(item.get("number"), int)
        )
    )
    if name == base_branch or name in {"main", "master", "develop"} or any(
        name.startswith(prefix) for prefix in protected_prefixes
    ):
        return BranchRecord(
            name,
            sha,
            BranchClassification.PROTECTED,
            ahead_by,
            numbers,
            "protected branch or prefix",
        )
    if name.startswith("dependabot/"):
        return BranchRecord(
            name,
            sha,
            BranchClassification.DEPENDABOT,
            ahead_by,
            numbers,
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
        return BranchRecord(name, sha, classification, ahead_by, numbers, reason)

    if any(item.get("mergedAt") for item in pull_requests):
        return BranchRecord(
            name,
            sha,
            BranchClassification.MERGED,
            ahead_by,
            numbers,
            "branch belongs to a merged PR",
        )
    if pull_requests:
        return BranchRecord(
            name,
            sha,
            BranchClassification.CLOSED,
            ahead_by,
            numbers,
            "branch belongs only to closed, unmerged PRs",
        )
    if integrated or ahead_by == 0:
        return BranchRecord(
            name,
            sha,
            BranchClassification.INTEGRATED,
            ahead_by,
            numbers,
            "branch tip is already reachable from the base branch",
        )
    return BranchRecord(
        name,
        sha,
        BranchClassification.ORPHAN,
        ahead_by,
        numbers,
        "no PR intent was found and commits are not integrated",
    )


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
    parser = argparse.ArgumentParser(description="Audit remote branches without mutating GitHub")
    parser.add_argument("--repository", required=True, help="owner/name repository")
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    parser.add_argument("--base", default="main", dest="base_branch")
    parser.add_argument(
        "--fail-on-orphans",
        action="store_true",
        help="exit non-zero when genuine orphan branches are found",
    )
    arguments = parser.parse_args(argv)
    audit = audit_branches(
        arguments.repository,
        arguments.workspace,
        base_branch=arguments.base_branch,
    )
    print(audit.to_json())
    if arguments.fail_on_orphans and any(
        record.classification is BranchClassification.ORPHAN for record in audit.branches
    ):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
