"""Single-owner invariants for the OpenHands Agent Canvas factory."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

EXPECTED_FACTORY_ARCHITECTURE = "openhands-agent-canvas-v1"

# These were part of the retired GitHub Actions swarm. Git history is the archive;
# an active checkout containing one of them risks a second autonomous issue owner.
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

# Provider selection belongs inside bounded OpenHands conversations. These paths
# represent the direct-provider router that briefly created a second execution
# plane around OpenHands. Keeping the paths explicit makes accidental resurrection
# fail closed while still allowing provider health/configuration code elsewhere.
FORBIDDEN_DIRECT_PROVIDER_PATHS = (
    "automation/openhands_factory/agents/router.py",
    "automation/openhands_factory/agents/claude.py",
    "automation/openhands_factory/agents/codex.py",
    "automation/openhands_factory/agents/google.py",
    "automation/openhands_factory/agents/opencode.py",
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
    return ArchitectureCheck(
        False,
        "retired autonomous workflows present: " + ", ".join(present),
    )


def check_direct_provider_router(repository: Path) -> ArchitectureCheck:
    """Fail when direct provider adapters recreate an execution plane around OpenHands."""
    present = [
        path for path in FORBIDDEN_DIRECT_PROVIDER_PATHS if (repository / path).is_file()
    ]
    if not present:
        return ArchitectureCheck(True, "no direct-provider router paths present")
    return ArchitectureCheck(
        False,
        "direct-provider execution paths present: " + ", ".join(present),
    )


def assert_single_owner(repository: Path) -> None:
    """Refuse daemon startup if a retired or alternate repository automation owner is active."""
    checks = (check_retired_swarm(repository), check_direct_provider_router(repository))
    failed = [check.detail for check in checks if not check.passed]
    if failed:
        raise RuntimeError(
            "OpenHands Factory single-owner invariant violated: " + "; ".join(failed)
        )
