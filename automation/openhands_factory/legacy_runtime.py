"""Detect runtime artifacts from the retired pre-OpenHands automation stack."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from subprocess import CompletedProcess, TimeoutExpired, run


LEGACY_SYSTEMD_UNITS = (
    "hellotalk-swarm.service",
    "hellotalk-aider.service",
    "hellotalk-swarm-watchdog.service",
    "hellotalk-guardian.service",
    "hellotalk-resolver.service",
    "hellotalk-reviewer.service",
)

LEGACY_TMUX_SESSIONS = (
    "swarm",
    "aider",
    "guardian",
    "resolver",
    "reviewer",
)

LEGACY_STATE_PATHS = (
    Path("/var/lib/hellotalk-swarm"),
    Path("/var/log/hellotalk-swarm"),
    Path("/etc/hellotalk-swarm"),
    Path("/opt/hellotalk-swarm"),
    Path("/var/lib/ai-swarm"),
    Path("/opt/ai-swarm"),
)


@dataclass(frozen=True)
class LegacyFinding:
    kind: str
    identifier: str
    active: bool
    detail: str


def _run(arguments: tuple[str, ...]) -> CompletedProcess[str]:
    return run(arguments, capture_output=True, text=True, check=False, timeout=10)


def detect_legacy_systemd_units() -> list[LegacyFinding]:
    findings: list[LegacyFinding] = []
    for unit in LEGACY_SYSTEMD_UNITS:
        try:
            active = _run(("systemctl", "is-active", unit))
            enabled = _run(("systemctl", "is-enabled", unit))
        except (OSError, TimeoutExpired) as error:
            findings.append(
                LegacyFinding(
                    "systemd",
                    unit,
                    False,
                    f"inspection failed: {error}",
                )
            )
            continue
        is_active = active.returncode == 0 and active.stdout.strip() == "active"
        is_enabled = enabled.returncode == 0 and enabled.stdout.strip() in {
            "enabled",
            "enabled-runtime",
        }
        if is_active or is_enabled:
            findings.append(
                LegacyFinding(
                    "systemd",
                    unit,
                    is_active or is_enabled,
                    f"active={is_active} enabled={is_enabled}",
                )
            )
    return findings


def detect_legacy_tmux_sessions() -> list[LegacyFinding]:
    try:
        result = _run(("tmux", "list-sessions", "-F", "#{session_name}"))
    except (OSError, TimeoutExpired):
        return []
    if result.returncode != 0:
        return []
    sessions = {line.strip() for line in result.stdout.splitlines() if line.strip()}
    return [
        LegacyFinding("tmux", session, True, "retired orchestration session is running")
        for session in sorted(sessions.intersection(LEGACY_TMUX_SESSIONS))
    ]


def detect_legacy_state_paths(
    paths: tuple[Path, ...] = LEGACY_STATE_PATHS,
) -> list[LegacyFinding]:
    findings: list[LegacyFinding] = []
    for path in paths:
        if path.exists():
            findings.append(
                LegacyFinding(
                    "state",
                    str(path),
                    False,
                    "legacy state exists; archive read-only or remove after operator review",
                )
            )
    return findings


def detect_legacy_runtime() -> list[LegacyFinding]:
    """Return retired runtime/state findings without mutating the host."""

    return [
        *detect_legacy_systemd_units(),
        *detect_legacy_tmux_sessions(),
        *detect_legacy_state_paths(),
    ]
