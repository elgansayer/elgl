"""Pure helpers for attributing failed CI checks before autonomous repair."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

_PASSING_CONCLUSIONS = frozenset({"SUCCESS", "NEUTRAL", "SKIPPED"})
_PENDING_STATES = frozenset({"QUEUED", "IN_PROGRESS", "PENDING", "WAITING"})


@dataclass(frozen=True)
class FailureAttribution:
    """Partition PR failures into inherited base failures and PR-introduced failures."""

    base_failures: tuple[str, ...]
    introduced_failures: tuple[str, ...]

    @property
    def has_base_failures(self) -> bool:
        return bool(self.base_failures)

    @property
    def has_introduced_failures(self) -> bool:
        return bool(self.introduced_failures)


def failed_check_names(checks: Iterable[Mapping[str, object]]) -> frozenset[str]:
    """Return stable identities for completed, non-passing GitHub check-rollup entries.

    GitHub mixes check runs (``name``/``conclusion``) and commit statuses
    (``context``/``state``) in a pull request rollup. Pending entries are excluded so
    attribution is only based on terminal evidence.
    """

    failed: set[str] = set()
    for check in checks:
        raw_name = check.get("name") or check.get("context")
        if not isinstance(raw_name, str) or not raw_name.strip():
            continue
        name = raw_name.strip()

        status = str(check.get("status") or "").upper()
        state = str(check.get("state") or "").upper()
        if status in _PENDING_STATES or state in _PENDING_STATES:
            continue

        conclusion = str(check.get("conclusion") or "").upper()
        terminal_result = conclusion or state
        if terminal_result and terminal_result not in _PASSING_CONCLUSIONS:
            failed.add(name)

    return frozenset(failed)


def attribute_failed_checks(
    pr_failed_checks: set[str] | frozenset[str],
    base_failed_checks: set[str] | frozenset[str],
) -> FailureAttribution:
    """Classify failed PR checks by whether the same named check fails on the base."""

    inherited = pr_failed_checks.intersection(base_failed_checks)
    introduced = pr_failed_checks.difference(base_failed_checks)
    return FailureAttribution(
        base_failures=tuple(sorted(inherited)),
        introduced_failures=tuple(sorted(introduced)),
    )
