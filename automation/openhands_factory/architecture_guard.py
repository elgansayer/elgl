"""Single-owner invariants for the OpenHands Agent Canvas factory."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

EXPECTED_FACTORY_ARCHITECTURE = "openhands-agent-canvas-v1"

RETIRED_SWARM_WORKFLOWS = (
    ".github/workflows/architect.yml",
    ".github/workflows/auto-dispatcher.yml",
    ".github/workflows/openhands.yml",
    ".github/workflows/pr-reviewer.yml",
    ".github/workflows/resolver-fast.yml",
    ".github/workflows/reviewer-fast.yml",
    ".github/workflows/dispatcher-batch.yml",
    ".github/workflows/guardian.yml",
)


@dataclass(frozen=True)
class ArchitectureCheck:
    passed: bool
    detail: str


def check_factory_architecture(architecture: str) -> ArchitectureCheck:
    """Report whether configuration belongs to the active control-plane architecture."""
    if architecture == EXPECTED_FACTORY_ARCHITECTURE:
        return ArchitectureCheck(True, architecture)
    return ArchitectureCheck(
        False,
        f"configured architecture={architecture!r}; expected {EXPECTED_FACTORY_ARCHITECTURE!r}",
    )


def check_retired_swarm(repository: Path) -> ArchitectureCheck:
    """Fail when retired autonomous workflows are present in the active checkout."""
    present = [path for path in RETIRED_SWARM_WORKFLOWS if (repository / path).is_file()]
    if not present:
        return ArchitectureCheck(True, "no retired swarm workflows present")
    return ArchitectureCheck(False, "retired autonomous workflows present: " + ", ".join(present))


def assert_single_owner(repository: Path) -> None:
    """Refuse daemon startup if a retired repository automation owner is active."""
    check = check_retired_swarm(repository)
    if not check.passed:
        raise RuntimeError("OpenHands Factory single-owner invariant violated: " + check.detail)
