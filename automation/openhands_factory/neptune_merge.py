"""Fail-closed evidence checks for Neptune's distinct tests-only merge policy.

This does not enable a live repository profile or replace other repositories'
independent review. GitHub still enforces protection at the atomic merge step.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath, PureWindowsPath
from typing import Any

from openhands_factory.exceptions import FactoryError

NEPTUNE_REPOSITORY = "elgansayer/Neptune-Bomberman"
NEPTUNE_GATE = "Neptune merge gate"
PROVISIONING_GATE = "Pinned Godot and Saturn installation"
GITHUB_ACTIONS_APP = 15368


@dataclass(frozen=True)
class NeptuneGate:
    passed: bool
    pending: bool
    failed_checks: frozenset[str] = frozenset()


def required_neptune_checks(comparison: object) -> frozenset[str]:
    """Derive applicability from the exact current-base comparison, not issue text.

    GitHub caps comparison file listings at 300. Reject that boundary rather than
    risk classifying a truncated list as ordinary metadata. Jobs are bounded well
    below it. A rename must retain its old path for recipe-change classification.
    """

    files = comparison.get("files") if isinstance(comparison, dict) else None
    if not isinstance(files, list) or not 0 < len(files) < 300:
        raise FactoryError("Neptune changed-file evidence is missing, empty or possibly truncated")
    paths: list[str] = []
    for entry in files:
        if not isinstance(entry, dict):
            raise FactoryError("Neptune changed-file evidence is malformed")
        candidates = [entry.get("filename")]
        if "previous_filename" in entry or entry.get("status") == "renamed":
            candidates.append(entry.get("previous_filename"))
        for value in candidates:
            if not isinstance(value, str) or not value or len(value) > 1024:
                raise FactoryError("Neptune changed-file path is missing or invalid")
            path = PurePosixPath(value)
            if (
                path.is_absolute()
                or not path.parts
                or PureWindowsPath(value).drive
                or ".." in path.parts
                or path.as_posix() != value
                or "\\" in value
                or any(ord(char) < 32 or ord(char) == 127 for char in value)
            ):
                raise FactoryError("Neptune changed-file path is not portable")
            paths.append(value)
    required = {NEPTUNE_GATE}
    if any(
        path.startswith("tools/factory/provision")
        or path
        in {
            "tools/factory/tests/test_provision.py",
            "tools/godot/install.py",
            "tools/godot/toolchain.json",
            ".github/workflows/tool-provisioning.yml",
        }
        for path in paths
    ):
        required.add(PROVISIONING_GATE)
    return frozenset(required)


def neptune_gate(
    pages: object, head: str, required: frozenset[str] = frozenset({NEPTUNE_GATE})
) -> NeptuneGate:
    """Read complete REST check-runs, never a spoofable status-context rollup."""

    if not isinstance(pages, list) or not pages:
        raise FactoryError("Neptune check-runs response is empty or malformed")
    if NEPTUNE_GATE not in required or not required <= {NEPTUNE_GATE, PROVISIONING_GATE}:
        raise FactoryError("Neptune required check selection is empty or unsupported")
    checks: dict[str, list[dict[str, Any]]] = {name: [] for name in required}
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get("check_runs"), list):
            raise FactoryError("Neptune check-runs response is malformed")
        for check in page["check_runs"]:
            if not isinstance(check, dict):
                raise FactoryError("Neptune check-run is malformed")
            app = check.get("app")
            if (
                isinstance(check.get("name"), str)
                and check["name"] in required
                and isinstance(app, dict)
                and type(app.get("id")) is int
                and app["id"] == GITHUB_ACTIONS_APP
                and check.get("head_sha") == head
            ):
                checks[check["name"]].append(check)
    # filter=latest already selects the latest run per workflow. Ambiguous
    # publishers/workflows must be diagnosed instead of choosing a green result.
    pending = False
    failed: set[str] = set()
    for name, candidates in checks.items():
        if not candidates:
            pending = True
            continue
        if len(candidates) != 1:
            raise FactoryError("Neptune required check has ambiguous duplicate runs")
        check = candidates[0]
        status = check.get("status")
        if isinstance(status, str) and status in {
            "queued",
            "in_progress",
            "waiting",
            "requested",
            "pending",
        }:
            pending = True
        elif status != "completed" or check.get("conclusion") != "success":
            failed.add(name)
    return NeptuneGate(not pending and not failed, pending, frozenset(failed))


def validate_neptune_protection(settings: object, protection: object) -> None:
    """Check existing settings; never weaken or configure protection here."""

    if not isinstance(settings, dict) or not isinstance(protection, dict):
        raise FactoryError("Neptune merge settings are malformed")
    required = protection.get("required_status_checks")
    if not isinstance(required, dict):
        raise FactoryError("Neptune requires app-pinned current-base branch protection")
    expected = [{"context": NEPTUNE_GATE, "app_id": GITHUB_ACTIONS_APP}]
    reviews = protection.get("required_pull_request_reviews")
    admins = protection.get("enforce_admins")
    force_pushes = protection.get("allow_force_pushes")
    deletions = protection.get("allow_deletions")
    if (
        settings.get("allow_auto_merge") is not True
        or settings.get("allow_merge_commit") is not True
        or settings.get("delete_branch_on_merge") is not False
        or required.get("strict") is not True
        or required.get("checks") != expected
        or required.get("contexts") != [NEPTUNE_GATE]
        or not isinstance(admins, dict)
        or admins.get("enabled") is not True
        or not isinstance(force_pushes, dict)
        or force_pushes.get("enabled") is not False
        or not isinstance(deletions, dict)
        or deletions.get("enabled") is not False
        or (
            reviews is not None
            and (
                not isinstance(reviews, dict)
                or type(reviews.get("required_approving_review_count")) is not int
                or reviews["required_approving_review_count"] != 0
                or reviews.get("require_code_owner_reviews") is not False
                or reviews.get("require_last_push_approval") is not False
            )
        )
    ):
        raise FactoryError("Neptune tests-only merge protection/settings have drifted")
