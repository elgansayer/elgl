"""Deterministic pull-request identity, convergence, stacking, and WIP policy."""

from __future__ import annotations

import hashlib
import re
from collections import Counter, defaultdict
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

from openhands_factory.models import Task, logical_task_key

_MARKER = re.compile(r"(?im)^\s*Factory-(?P<name>[A-Za-z-]+):\s*(?P<value>[^\r\n]+?)\s*$")
_ISSUE_REFERENCE = re.compile(
    r"(?i)\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+#(?P<number>\d+)\b"
)
_STACK_REFERENCE = re.compile(
    r"(?im)^\s*(?:Factory-Stack-Parent|Depends-On):\s*#?(?P<number>\d+)\s*$"
)
_WORKFLOW_RUN = re.compile(r"/actions/runs/(?P<run>\d+)(?:/|$)")
_PENDING_CHECK_STATES = frozenset({"EXPECTED", "IN_PROGRESS", "PENDING", "QUEUED", "WAITING"})
_SUCCESSFUL_CHECK_STATES = frozenset({"NEUTRAL", "SKIPPED", "SUCCESS"})
_REQUIRED_CHECKS = frozenset({"CI / required", "factory/independent-review"})


def _markers(body: str) -> dict[str, str]:
    return {
        match.group("name").casefold(): match.group("value").strip()
        for match in _MARKER.finditer(body)
    }


def _fingerprint(values: Collection[str]) -> str:
    digest = hashlib.sha256()
    for value in sorted(set(values)):
        digest.update(value.encode("utf-8"))
        digest.update(b"\0")
    return digest.hexdigest()


def fingerprint_paths(paths: Collection[Path | str]) -> str:
    """Return a stable identity for a set of touched repository paths."""

    return _fingerprint(
        {path.as_posix() if isinstance(path, Path) else Path(path).as_posix() for path in paths}
    )


def stack_parent(body: str) -> int | None:
    match = _STACK_REFERENCE.search(body)
    return int(match.group("number")) if match else None


def automation_lane(branch: str) -> str:
    if branch.startswith("factory/architect-"):
        return "architect"
    if branch.startswith("factory/"):
        return "factory"
    if branch.startswith("dependabot/"):
        return "dependency"
    prefix, separator, _remainder = branch.partition("/")
    return prefix.casefold() if separator and prefix else "external"


def component_for_paths(paths: Collection[Path | str]) -> str:
    components: set[str] = set()
    for value in paths:
        path = value if isinstance(value, Path) else Path(value)
        first = path.parts[0] if path.parts else ""
        component = {
            ".github": "ci",
            "admin-portal": "admin-portal",
            "automation": "automation",
            "backend": "backend",
            "config": "automation",
            "docs": "docs",
            "frontend": "frontend",
            "scripts": "automation",
            "supabase": "database",
        }.get(first, "repository")
        components.add(component)
    if not components:
        return "unknown"
    if len(components) == 1:
        return next(iter(components))
    return "multi"


@dataclass(frozen=True)
class PullRequestRecord:
    number: int
    title: str
    body: str
    state: str
    is_draft: bool
    head_ref: str
    head_sha: str
    base_ref: str
    labels: frozenset[str] = frozenset()
    files: tuple[str, ...] = ()
    created_at: str | None = None
    updated_at: str | None = None
    closed_at: str | None = None
    merged_at: str | None = None
    merge_state_status: str = "UNKNOWN"
    checks_pending: bool = False
    checks_passed: bool = False
    workflow_run_ids: frozenset[str] = frozenset()
    is_cross_repository: bool = False

    @classmethod
    def from_payload(cls, value: Mapping[str, object]) -> PullRequestRecord:
        def text(name: str, default: str = "") -> str:
            item = value.get(name)
            return item if isinstance(item, str) else default

        def optional_text(name: str) -> str | None:
            item = value.get(name)
            return item if isinstance(item, str) and item else None

        labels: set[str] = set()
        raw_labels = value.get("labels")
        if isinstance(raw_labels, list):
            for item in raw_labels:
                if isinstance(item, dict) and isinstance(item.get("name"), str):
                    labels.add(str(item["name"]))

        files: list[str] = []
        raw_files = value.get("files")
        if isinstance(raw_files, list):
            for item in raw_files:
                if isinstance(item, dict) and isinstance(item.get("path"), str):
                    files.append(str(item["path"]))

        pending = False
        observed_checks: set[str] = set()
        successful_checks: set[str] = set()
        terminal_states: list[str] = []
        workflow_runs: set[str] = set()
        raw_checks = value.get("statusCheckRollup")
        if isinstance(raw_checks, list):
            for item in raw_checks:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or item.get("context") or "")
                if name:
                    observed_checks.add(name)
                conclusion = str(item.get("conclusion") or "").upper()
                state = str(item.get("state") or item.get("status") or "").upper()
                if state in _PENDING_CHECK_STATES:
                    pending = True
                result = conclusion or state
                if result:
                    terminal_states.append(result)
                if name and result == "SUCCESS":
                    successful_checks.add(name)
                for field in ("detailsUrl", "targetUrl"):
                    url = item.get(field)
                    if not isinstance(url, str):
                        continue
                    match = _WORKFLOW_RUN.search(url)
                    if match:
                        workflow_runs.add(match.group("run"))

        checks_passed = (
            _REQUIRED_CHECKS.issubset(successful_checks)
            and _REQUIRED_CHECKS.issubset(observed_checks)
            and bool(terminal_states)
            and all(result in _SUCCESSFUL_CHECK_STATES for result in terminal_states)
            and not pending
        )
        number = value.get("number")
        if not isinstance(number, int) or isinstance(number, bool):
            raise ValueError("pull request number must be an integer")
        return cls(
            number=number,
            title=text("title"),
            body=text("body"),
            state=text("state", "UNKNOWN").upper(),
            is_draft=value.get("isDraft") is True,
            head_ref=text("headRefName"),
            head_sha=text("headRefOid"),
            base_ref=text("baseRefName"),
            labels=frozenset(labels),
            files=tuple(sorted(set(files))),
            created_at=optional_text("createdAt"),
            updated_at=optional_text("updatedAt"),
            closed_at=optional_text("closedAt"),
            merged_at=optional_text("mergedAt"),
            merge_state_status=text("mergeStateStatus", "UNKNOWN").upper(),
            checks_pending=pending,
            checks_passed=checks_passed,
            workflow_run_ids=frozenset(workflow_runs),
            is_cross_repository=value.get("isCrossRepository") is True,
        )

    @property
    def marker_values(self) -> dict[str, str]:
        return _markers(self.body)

    @property
    def task_key(self) -> str:
        return logical_task_key(self.title, self.body)

    @property
    def explicit_task_key(self) -> str | None:
        return self.marker_values.get("task-key")

    @property
    def change_fingerprint(self) -> str | None:
        return self.marker_values.get("change-fingerprint")

    @property
    def touched_file_fingerprint(self) -> str | None:
        marker = self.marker_values.get("touched-files")
        return marker or (fingerprint_paths(self.files) if self.files else None)

    @property
    def issue_numbers(self) -> frozenset[int]:
        return frozenset(
            int(match.group("number"))
            for match in _ISSUE_REFERENCE.finditer(f"{self.title}\n{self.body}")
        )

    @property
    def lane(self) -> str:
        return self.marker_values.get("lane") or automation_lane(self.head_ref)

    @property
    def component(self) -> str:
        marker = self.marker_values.get("component")
        return marker or component_for_paths(self.files)

    @property
    def stack_parent(self) -> int | None:
        return stack_parent(self.body)

    @property
    def is_open(self) -> bool:
        return self.state == "OPEN"

    @property
    def is_merged(self) -> bool:
        return self.state == "MERGED" or self.merged_at is not None

    @property
    def factory_owned(self) -> bool:
        # Branch prefix on a same-repository ref only. PR body text (including a
        # copied Factory-Owner or Factory-Change-Fingerprint marker) is
        # attacker-controlled on any external contributor's PR, and a fork can name
        # its own branch `factory/...` to imitate this prefix, so neither alone may
        # grant convergence authority to force-sync, retitle, or delete that branch.
        return self.head_ref.startswith("factory/") and not self.is_cross_repository


@dataclass(frozen=True)
class PullRequestIdentity:
    task_key: str
    issue_number: int | None
    branch: str
    base_ref: str
    change_fingerprint: str
    touched_file_fingerprint: str
    lane: str
    component: str
    stack_parent: int | None = None

    @classmethod
    def for_task(
        cls,
        task: Task,
        *,
        branch: str,
        base_ref: str,
        change_fingerprint: str,
        touched_paths: Collection[Path | str],
    ) -> PullRequestIdentity:
        issue_number = (
            int(task.identifier)
            if task.source == "github-issue" and task.identifier.isdigit()
            else None
        )
        return cls(
            task_key=task.logical_key,
            issue_number=issue_number,
            branch=branch,
            base_ref=base_ref,
            change_fingerprint=change_fingerprint,
            touched_file_fingerprint=fingerprint_paths(touched_paths),
            lane=automation_lane(branch),
            component=component_for_paths(touched_paths),
            stack_parent=stack_parent(task.body),
        )

    def markers(self) -> str:
        values = [
            "<!-- factory-convergence:v1 -->",
            f"Factory-Task-Key: {self.task_key}",
            f"Factory-Change-Fingerprint: {self.change_fingerprint}",
            f"Factory-Touched-Files: {self.touched_file_fingerprint}",
            f"Factory-Lane: {self.lane}",
            f"Factory-Component: {self.component}",
            "Factory-Owner: factory",
        ]
        if self.stack_parent is not None:
            values.append(f"Factory-Stack-Parent: #{self.stack_parent}")
        values.append("<!-- /factory-convergence -->")
        return "\n".join(values)


class ConvergenceAction(StrEnum):
    CREATE = "create"
    REUSE = "reuse"
    REOPEN = "reopen"
    ALREADY_MERGED = "already-merged"
    BLOCKED = "blocked"


@dataclass(frozen=True)
class PullRequestResolution:
    action: ConvergenceAction
    canonical: PullRequestRecord | None = None
    # Only Factory-owned branches are ever listed here. The caller closes and deletes
    # every superseded branch, and neither a shared issue reference nor a copied body
    # marker on somebody else's pull request may authorise that.
    superseded: tuple[PullRequestRecord, ...] = ()
    reason: str = ""


def _stack_related(first: PullRequestRecord, second: PullRequestRecord) -> bool:
    return first.stack_parent == second.number or second.stack_parent == first.number


def _match_reasons(
    identity: PullRequestIdentity,
    record: PullRequestRecord,
) -> frozenset[str]:
    if record.base_ref and record.base_ref != identity.base_ref:
        return frozenset()
    reasons: set[str] = set()
    if record.head_ref == identity.branch:
        reasons.add("branch")
    if identity.issue_number is not None and identity.issue_number in record.issue_numbers:
        reasons.add("issue")
    if record.task_key == identity.task_key:
        reasons.add("task-key")
    if record.change_fingerprint == identity.change_fingerprint:
        reasons.add("change-fingerprint")
    if record.touched_file_fingerprint == identity.touched_file_fingerprint:
        reasons.add("touched-files")
    return frozenset(reasons)


def _canonical_key(
    identity: PullRequestIdentity,
    record: PullRequestRecord,
) -> tuple[int, int, str, int]:
    reasons = _match_reasons(identity, record)
    return (
        0 if "branch" in reasons else 1,
        0 if not record.factory_owned else 1,
        record.created_at or "9999",
        record.number,
    )


def resolve_pull_request(
    identity: PullRequestIdentity,
    records: Sequence[PullRequestRecord],
) -> PullRequestResolution:
    """Choose one existing PR or permit one creation without guessing at overlap."""

    matched = [(record, _match_reasons(identity, record)) for record in records]
    strong = [
        (record, reasons)
        for record, reasons in matched
        if reasons.intersection({"branch", "issue", "task-key", "change-fingerprint"})
    ]

    merged = [
        record
        for record, reasons in strong
        if record.is_merged
        and (
            "change-fingerprint" in reasons
            or "branch" in reasons
            or {"issue", "task-key"}.issubset(reasons)
        )
    ]
    if merged:
        canonical = sorted(merged, key=lambda item: (item.merged_at or "", item.number))[-1]
        superseded = tuple(
            sorted(
                (record for record, _reasons in strong if record.is_open and record.factory_owned),
                key=lambda item: item.number,
            )
        )
        return PullRequestResolution(
            ConvergenceAction.ALREADY_MERGED,
            canonical,
            superseded,
            "an equivalent change is already merged",
        )

    open_matches = [record for record, _reasons in strong if record.is_open]
    if open_matches:
        canonical = min(open_matches, key=lambda item: _canonical_key(identity, item))
        # A cross-repository fork may name its head branch `factory/...`, so branch-name
        # equality alone never proves Factory owns the pull request it is about to
        # force-sync, retitle, and adopt. Only factory_owned settles that.
        if not canonical.factory_owned:
            return PullRequestResolution(
                ConvergenceAction.BLOCKED,
                canonical,
                reason=(
                    "an equivalent open pull request is owned by an external branch; "
                    "Factory will not replace or compete with it"
                ),
            )
        superseded = tuple(
            sorted(
                (
                    record
                    for record in open_matches
                    if record.number != canonical.number and record.factory_owned
                ),
                key=lambda item: item.number,
            )
        )
        return PullRequestResolution(
            ConvergenceAction.REUSE,
            canonical,
            superseded,
            "an equivalent open pull request already owns the task",
        )

    touched_only = [
        record
        for record, reasons in matched
        if record.is_open and reasons == frozenset({"touched-files"})
    ]
    if touched_only and not any(record.number == identity.stack_parent for record in touched_only):
        numbers = ", ".join(
            f"#{record.number}" for record in sorted(touched_only, key=lambda x: x.number)
        )
        return PullRequestResolution(
            ConvergenceAction.BLOCKED,
            reason=(
                "touched-file overlap is ambiguous without a shared task key or explicit "
                f"stack dependency: {numbers}"
            ),
        )

    closed = [record for record, _reasons in strong if not record.is_open and not record.is_merged]
    # factory_owned rather than an inlined copy of its branch/fork test: reopening a PR
    # hands it the same in-place update, force-sync, and delete authority as REUSE, so
    # this must not drift if that ownership boundary is ever tightened.
    reusable_closed = [record for record in closed if record.factory_owned]
    if reusable_closed:
        canonical = min(reusable_closed, key=lambda item: _canonical_key(identity, item))
        return PullRequestResolution(
            ConvergenceAction.REOPEN,
            canonical,
            reason="a closed Factory pull request can be updated and reopened",
        )
    if closed:
        numbers = ", ".join(
            f"#{record.number}" for record in sorted(closed, key=lambda x: x.number)
        )
        return PullRequestResolution(
            ConvergenceAction.BLOCKED,
            reason=f"equivalent closed pull-request ownership is not safely reusable: {numbers}",
        )
    return PullRequestResolution(
        ConvergenceAction.CREATE, reason="no equivalent pull request exists"
    )


@dataclass(frozen=True)
class Supersession:
    pull_request: PullRequestRecord
    canonical: int | None
    reason: str


def convergence_supersessions(
    records: Sequence[PullRequestRecord],
) -> tuple[Supersession, ...]:
    """Find open Factory PRs that are provably merged or duplicate another open PR."""

    open_records = [record for record in records if record.is_open]
    merged_records = [record for record in records if record.is_merged]
    closures: dict[int, Supersession] = {}

    for current in open_records:
        for merged in merged_records:
            exact_change = (
                current.change_fingerprint is not None
                and current.change_fingerprint == merged.change_fingerprint
            )
            same_explicit_task = (
                current.explicit_task_key is not None
                and current.explicit_task_key == merged.explicit_task_key
                and bool(current.issue_numbers.intersection(merged.issue_numbers))
            )
            # change_fingerprint is read verbatim from PR body text, so it is exactly
            # as forgeable as any other marker (an unrelated PR's author can copy a
            # merged PR's visible fingerprint string into their own body). Requiring
            # factory_owned regardless of exact_change means that forgery can never by
            # itself authorise closing and deleting someone else's branch.
            if (exact_change or same_explicit_task) and current.factory_owned:
                closures[current.number] = Supersession(
                    current,
                    merged.number,
                    "equivalent change already merged",
                )
                break

    groups: defaultdict[tuple[str, str], list[PullRequestRecord]] = defaultdict(list)
    for record in open_records:
        # Every grouping signal below is attacker-controlled on a pull request Factory
        # does not own: body markers can be copied verbatim from a Factory PR, and any
        # contributor may write `Fixes #123` for an issue Factory is already working.
        # Group membership decides which record becomes canonical, so admitting an
        # unowned record here would let a stranger's pull request nominate itself as the
        # owner of a task and have Factory close and delete the real branch behind it.
        if not record.factory_owned:
            continue
        if record.explicit_task_key is not None:
            groups[("task", record.explicit_task_key)].append(record)
        else:
            groups[("title", record.task_key)].append(record)
        if record.change_fingerprint is not None:
            groups[("change", record.change_fingerprint)].append(record)
        for issue in record.issue_numbers:
            groups[("issue", str(issue))].append(record)

    for group in groups.values():
        unique = {record.number: record for record in group}
        if len(unique) < 2:
            continue
        ordered = sorted(unique.values(), key=lambda item: (item.created_at or "9999", item.number))
        canonical = ordered[0]
        for duplicate in ordered[1:]:
            if _stack_related(canonical, duplicate):
                continue
            # Redundant with the grouping filter above, and deliberately kept: closing a
            # pull request deletes its branch, so the last gate before that stays local
            # to the decision rather than depending on how the group was assembled.
            if not duplicate.factory_owned:
                continue
            closures.setdefault(
                duplicate.number,
                Supersession(duplicate, canonical.number, "duplicate active task or change"),
            )
    return tuple(closures[number] for number in sorted(closures))


@dataclass(frozen=True)
class PullRequestCapacity:
    open_count: int
    queued_ci_count: int
    active_by_lane: Mapping[str, int]
    active_by_component: Mapping[str, int]
    blocked_reasons: tuple[str, ...]
    duplicate_task_fingerprints: int
    duplicate_change_fingerprints: int
    stacked_deferred_count: int

    @property
    def pause_new_dispatch(self) -> bool:
        return bool(self.blocked_reasons)

    def to_dict(self) -> dict[str, object]:
        return {
            "open_count": self.open_count,
            "queued_ci_count": self.queued_ci_count,
            "active_by_lane": dict(sorted(self.active_by_lane.items())),
            "active_by_component": dict(sorted(self.active_by_component.items())),
            "blocked_reasons": list(self.blocked_reasons),
            "pause_new_dispatch": self.pause_new_dispatch,
            "duplicate_task_fingerprints": self.duplicate_task_fingerprints,
            "duplicate_change_fingerprints": self.duplicate_change_fingerprints,
            "stacked_deferred_count": self.stacked_deferred_count,
        }


def _duplicate_excess(records: Sequence[PullRequestRecord], attribute: str) -> int:
    counts: Counter[str] = Counter()
    for record in records:
        value = getattr(record, attribute)
        if isinstance(value, str) and value:
            counts[value] += 1
    return sum(count - 1 for count in counts.values() if count > 1)


def calculate_capacity(
    records: Sequence[PullRequestRecord],
    *,
    max_open_pull_requests: int,
    max_queued_ci: int,
    lane_limits: Mapping[str, int],
    component_limits: Mapping[str, int],
) -> PullRequestCapacity:
    open_records = [record for record in records if record.is_open]
    lanes = Counter(record.lane for record in open_records)
    components = Counter(record.component for record in open_records)
    queued = sum(record.checks_pending for record in open_records)
    open_numbers = {record.number for record in open_records}
    stacked_deferred = sum(
        record.stack_parent in open_numbers for record in open_records if record.stack_parent
    )
    reasons: list[str] = []
    if len(open_records) >= max_open_pull_requests:
        reasons.append(f"open pull requests {len(open_records)}/{max_open_pull_requests}")
    if queued >= max_queued_ci:
        reasons.append(f"queued CI {queued}/{max_queued_ci}")
    for lane, limit in sorted(lane_limits.items()):
        if lanes[lane] >= limit:
            reasons.append(f"lane {lane} {lanes[lane]}/{limit}")
    for component, limit in sorted(component_limits.items()):
        if components[component] >= limit:
            reasons.append(f"component {component} {components[component]}/{limit}")
    return PullRequestCapacity(
        open_count=len(open_records),
        queued_ci_count=queued,
        active_by_lane=dict(lanes),
        active_by_component=dict(components),
        blocked_reasons=tuple(reasons),
        duplicate_task_fingerprints=_duplicate_excess(open_records, "task_key"),
        duplicate_change_fingerprints=_duplicate_excess(open_records, "change_fingerprint"),
        stacked_deferred_count=stacked_deferred,
    )
