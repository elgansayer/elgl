"""Fail-closed evidence checks for Neptune's distinct tests-only merge policy.

This does not enable a live repository profile or replace other repositories'
independent review. GitHub still enforces protection at the atomic merge step.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from openhands_factory.exceptions import FactoryError

NEPTUNE_REPOSITORY = "elgansayer/Neptune-Bomberman"
NEPTUNE_GATE = "Neptune merge gate"
GITHUB_ACTIONS_APP = 15368


@dataclass(frozen=True)
class NeptuneGate:
    passed: bool
    pending: bool
    failed_checks: frozenset[str] = frozenset()


def neptune_gate(pages: object, head: str) -> NeptuneGate:
    """Read complete REST check-runs, never a spoofable status-context rollup."""

    if not isinstance(pages, list) or not pages:
        raise FactoryError("Neptune check-runs response is empty or malformed")
    checks: list[dict[str, Any]] = []
    for page in pages:
        if not isinstance(page, dict) or not isinstance(page.get("check_runs"), list):
            raise FactoryError("Neptune check-runs response is malformed")
        for check in page["check_runs"]:
            if not isinstance(check, dict):
                raise FactoryError("Neptune check-run is malformed")
            app = check.get("app")
            if (
                check.get("name") == NEPTUNE_GATE
                and isinstance(app, dict)
                and type(app.get("id")) is int
                and app["id"] == GITHUB_ACTIONS_APP
                and check.get("head_sha") == head
            ):
                checks.append(check)
    if not checks:
        return NeptuneGate(False, True)
    # filter=latest already selects the latest run per workflow. Ambiguous
    # publishers/workflows must be diagnosed instead of choosing a green result.
    if len(checks) != 1:
        raise FactoryError("Neptune required check has ambiguous duplicate runs")
    check = checks[0]
    status = check.get("status")
    if status in {"queued", "in_progress", "waiting", "requested", "pending"}:
        return NeptuneGate(False, True)
    if status == "completed" and check.get("conclusion") == "success":
        return NeptuneGate(True, False)
    return NeptuneGate(False, False, frozenset({NEPTUNE_GATE}))


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
