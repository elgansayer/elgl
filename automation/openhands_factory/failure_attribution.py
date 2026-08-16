"""Pure helpers for attributing failed CI checks before autonomous repair."""

from __future__ import annotations

from dataclasses import dataclass


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
