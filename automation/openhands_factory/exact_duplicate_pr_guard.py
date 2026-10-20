"""Autonomously supersede byte-identical external pull requests before Factory review."""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import cast

_FACTORY_SKIP_LABELS = frozenset({"duplicate", "factory-skip", "superseded"})
_REVIEWED_LABEL = "factory-reviewed"

_OPEN_PULL_REQUESTS_QUERY = """
query($owner: String!, $name: String!, $base: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      first: 100
      after: $after
      states: [OPEN]
      baseRefName: $base
      orderBy: {field: CREATED_AT, direction: ASC}
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        baseRefName
        headRefName
        headRefOid
        isDraft
        headRepository { nameWithOwner }
        labels(first: 100) {
          pageInfo { hasNextPage }
          nodes { name }
        }
        commits(last: 1) { nodes { commit { tree { oid } } } }
      }
    }
  }
}
"""

_PULL_REQUEST_QUERY = """
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      state
      baseRefName
      headRefName
      headRefOid
      isDraft
      headRepository { nameWithOwner }
      labels(first: 100) {
        pageInfo { hasNextPage }
        nodes { name }
      }
      commits(last: 1) { nodes { commit { tree { oid } } } }
    }
  }
}
"""


@dataclass(frozen=True)
class PullRequestSnapshot:
    """The immutable fields needed to prove two open PR heads are equivalent."""

    number: int
    state: str
    base_ref: str
    head_ref: str
    head_sha: str
    tree_oid: str
    head_repository: str
    is_draft: bool
    labels: frozenset[str]
    labels_complete: bool

    def is_factory_review_candidate(self, repository: str, base_branch: str) -> bool:
        """Mirror the conservative subset of PRs that can consume Factory review allowance."""

        return (
            self.state == "OPEN"
            and self.base_ref == base_branch
            and self.head_repository == repository
            and not self.is_draft
            and bool(self.tree_oid)
            and self.labels_complete
            and not self.head_ref.startswith("factory/")
            and not self.labels.intersection(_FACTORY_SKIP_LABELS)
        )


@dataclass(frozen=True)
class DuplicateGroup:
    canonical: PullRequestSnapshot
    duplicates: tuple[PullRequestSnapshot, ...]


def _mapping(value: object, *, field: str) -> Mapping[str, object]:
    if not isinstance(value, dict):
        raise RuntimeError(f"GitHub response field {field!r} was not an object")
    return cast(dict[str, object], value)


def _items(value: object, *, field: str) -> list[object]:
    if not isinstance(value, list):
        raise RuntimeError(f"GitHub response field {field!r} was not a list")
    return cast(list[object], value)


def _string(value: object) -> str:
    return value if isinstance(value, str) else ""


def _snapshot(node_value: object, *, state: str = "OPEN") -> PullRequestSnapshot:
    node = _mapping(node_value, field="pull request")
    labels_container = _mapping(node.get("labels", {}), field="labels")
    labels = frozenset(
        name
        for label_value in _items(labels_container.get("nodes", []), field="labels.nodes")
        if (name := _string(_mapping(label_value, field="label").get("name")))
    )
    labels_page_info = _mapping(labels_container.get("pageInfo", {}), field="labels.pageInfo")
    labels_complete = labels_page_info.get("hasNextPage") is not True
    commits_container = _mapping(node.get("commits", {}), field="commits")
    commit_nodes = _items(commits_container.get("nodes", []), field="commits.nodes")
    tree_oid = ""
    if commit_nodes:
        commit_node = _mapping(commit_nodes[-1], field="commit node")
        commit = _mapping(commit_node.get("commit", {}), field="commit")
        tree = _mapping(commit.get("tree", {}), field="tree")
        tree_oid = _string(tree.get("oid"))
    head_repository_value = node.get("headRepository")
    head_repository = ""
    if isinstance(head_repository_value, dict):
        head_repository = _string(
            _mapping(head_repository_value, field="headRepository").get("nameWithOwner")
        )
    number = node.get("number")
    if not isinstance(number, int):
        raise RuntimeError("GitHub pull request response did not include an integer number")
    return PullRequestSnapshot(
        number=number,
        state=_string(node.get("state")) or state,
        base_ref=_string(node.get("baseRefName")),
        head_ref=_string(node.get("headRefName")),
        head_sha=_string(node.get("headRefOid")),
        tree_oid=tree_oid,
        head_repository=head_repository,
        is_draft=node.get("isDraft") is True,
        labels=labels,
        labels_complete=labels_complete,
    )


def _canonical_rank(pull_request: PullRequestSnapshot) -> tuple[int, int]:
    """Keep already-reviewed work when possible, then prefer the oldest PR."""

    return (0 if _REVIEWED_LABEL in pull_request.labels else 1, pull_request.number)


def exact_duplicate_groups(
    pull_requests: Sequence[PullRequestSnapshot],
    *,
    repository: str,
    base_branch: str,
) -> tuple[DuplicateGroup, ...]:
    """Group only exact full-tree duplicates that the Factory could independently review."""

    by_tree: dict[str, list[PullRequestSnapshot]] = {}
    for pull_request in pull_requests:
        if pull_request.is_factory_review_candidate(repository, base_branch):
            by_tree.setdefault(pull_request.tree_oid, []).append(pull_request)

    groups: list[DuplicateGroup] = []
    for tree_oid in sorted(by_tree):
        members = by_tree[tree_oid]
        if len(members) < 2:
            continue
        canonical = min(members, key=_canonical_rank)
        duplicates = tuple(
            sorted(
                (item for item in members if item != canonical),
                key=lambda pull_request: pull_request.number,
            )
        )
        groups.append(DuplicateGroup(canonical=canonical, duplicates=duplicates))
    return tuple(groups)


def _run_gh(arguments: Sequence[str], *, attempts: int = 3) -> str:
    failure = ""
    for attempt in range(attempts):
        result = subprocess.run(
            ["gh", *arguments],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return result.stdout
        failure = (result.stderr or result.stdout)[-2000:]
        if attempt + 1 < attempts:
            time.sleep(2**attempt)
    raise RuntimeError(f"GitHub command failed after {attempts} attempts: {failure}")


def _run_gh_json(arguments: Sequence[str]) -> Mapping[str, object]:
    raw = _run_gh(arguments)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("GitHub command returned invalid JSON") from error
    return _mapping(payload, field="response")


def _split_repository(repository: str) -> tuple[str, str]:
    owner, separator, name = repository.partition("/")
    if not separator or not owner or not name or "/" in name:
        raise ValueError("repository must be in owner/name form")
    return owner, name


def load_open_pull_requests(repository: str, base_branch: str) -> tuple[PullRequestSnapshot, ...]:
    owner, name = _split_repository(repository)
    after: str | None = None
    snapshots: list[PullRequestSnapshot] = []
    while True:
        arguments = [
            "api",
            "graphql",
            "-f",
            f"query={_OPEN_PULL_REQUESTS_QUERY}",
            "-F",
            f"owner={owner}",
            "-F",
            f"name={name}",
            "-F",
            f"base={base_branch}",
        ]
        if after is not None:
            arguments.extend(("-F", f"after={after}"))
        payload = _run_gh_json(arguments)
        data = _mapping(payload.get("data", {}), field="data")
        repo = _mapping(data.get("repository", {}), field="repository")
        connection = _mapping(repo.get("pullRequests", {}), field="pullRequests")
        for node in _items(connection.get("nodes", []), field="pullRequests.nodes"):
            snapshots.append(_snapshot(node))
        page_info = _mapping(connection.get("pageInfo", {}), field="pageInfo")
        if page_info.get("hasNextPage") is not True:
            break
        after = _string(page_info.get("endCursor"))
        if not after:
            raise RuntimeError("GitHub pagination reported another page without an end cursor")
    return tuple(snapshots)


def load_pull_request(repository: str, number: int) -> PullRequestSnapshot | None:
    owner, name = _split_repository(repository)
    payload = _run_gh_json(
        (
            "api",
            "graphql",
            "-f",
            f"query={_PULL_REQUEST_QUERY}",
            "-F",
            f"owner={owner}",
            "-F",
            f"name={name}",
            "-F",
            f"number={number}",
        )
    )
    data = _mapping(payload.get("data", {}), field="data")
    repo = _mapping(data.get("repository", {}), field="repository")
    node = repo.get("pullRequest")
    if node is None:
        return None
    return _snapshot(node)


def _still_duplicate(
    repository: str,
    base_branch: str,
    canonical: PullRequestSnapshot,
    duplicate: PullRequestSnapshot,
) -> bool:
    """Re-read both heads immediately before mutation so a synchronize race fails open."""

    fresh_canonical = load_pull_request(repository, canonical.number)
    fresh_duplicate = load_pull_request(repository, duplicate.number)
    if fresh_canonical is None or fresh_duplicate is None:
        return False
    if not fresh_canonical.is_factory_review_candidate(repository, base_branch):
        return False
    if not fresh_duplicate.is_factory_review_candidate(repository, base_branch):
        return False
    if fresh_canonical.tree_oid != fresh_duplicate.tree_oid:
        return False
    if fresh_canonical.tree_oid != canonical.tree_oid:
        return False
    return _canonical_rank(fresh_canonical) <= _canonical_rank(fresh_duplicate)


def close_exact_duplicate(
    repository: str,
    base_branch: str,
    canonical: PullRequestSnapshot,
    duplicate: PullRequestSnapshot,
) -> bool:
    """Close one freshly revalidated duplicate without weakening any merge gate."""

    if not _still_duplicate(repository, base_branch, canonical, duplicate):
        return False
    comment = (
        f"OpenHands Factory automatically superseded this PR with #{canonical.number}. "
        f"Both open heads resolve to the exact same repository tree `{canonical.tree_oid[:12]}`. "
        "The canonical PR remains subject to normal verification, security review, independent "
        "review, reviewed-SHA protection, CI, and merge checks. No check was bypassed."
    )
    _run_gh(
        (
            "pr",
            "close",
            str(duplicate.number),
            "--repo",
            repository,
            "--comment",
            comment,
        )
    )
    # Closed PRs are already outside Factory intake. This label also prevents accidental
    # rediscovery if another automation reopens the superseded PR before the next scan.
    _run_gh(
        (
            "issue",
            "edit",
            str(duplicate.number),
            "--repo",
            repository,
            "--add-label",
            "factory-skip",
        )
    )
    return True


def run_guard(repository: str, base_branch: str, focus_pull_request: int | None = None) -> int:
    snapshots = load_open_pull_requests(repository, base_branch)
    groups = exact_duplicate_groups(
        snapshots,
        repository=repository,
        base_branch=base_branch,
    )
    if focus_pull_request is not None:
        groups = tuple(
            group
            for group in groups
            if focus_pull_request
            in {group.canonical.number, *(item.number for item in group.duplicates)}
        )

    closed = 0
    for group in groups:
        for duplicate in group.duplicates:
            if close_exact_duplicate(repository, base_branch, group.canonical, duplicate):
                closed += 1
    return closed


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True, help="Repository in owner/name form")
    parser.add_argument("--base", default="main", help="Target base branch")
    parser.add_argument(
        "--pull-request", type=int, help="Limit an event run to one duplicate group"
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    closed = run_guard(args.repository, args.base, args.pull_request)
    print(json.dumps({"closed_exact_duplicates": closed}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
