"""Read-only production readiness checks."""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from openhands_factory.config import FactoryConfig


@dataclass(frozen=True)
class Check:
    name: str
    passed: bool
    detail: str


def run_doctor(config: FactoryConfig, *, online: bool = False) -> list[Check]:
    checks: list[Check] = []
    checks.append(
        Check("repository", (config.repository / ".git").exists(), str(config.repository))
    )
    checks.append(Check("podman", config.podman_path.is_file(), str(config.podman_path)))
    for executable in ("git", "node", "npm", "python"):
        path = shutil.which(executable)
        checks.append(Check(executable, path is not None, path or "not found"))
    for directory in (config.state_dir, config.log_dir, config.profile_store, config.worktree_dir):
        exists_and_writable = directory.exists() and os.access(directory, os.W_OK)
        checks.append(
            Check(
                f"writable:{directory}",
                exists_and_writable,
                "ready" if exists_and_writable else "missing or not writable",
            )
        )
    usage = shutil.disk_usage(config.state_dir if config.state_dir.exists() else Path("/"))
    free_gib = usage.free / 1024**3
    checks.append(
        Check(
            "disk-free",
            free_gib >= config.minimum_free_disk_gib,
            f"{free_gib:.1f} GiB available, {config.minimum_free_disk_gib:.1f} GiB required",
        )
    )
    for script in (
        config.repository / "scripts/verify-constitution.mjs",
        config.repository / "scripts/check-conflict-markers.mjs",
    ):
        checks.append(Check(f"script:{script.name}", script.is_file(), str(script)))
    if online:
        from openhands_factory.provider_profiles import validate_gemini, validate_opencode

        try:
            validate_opencode(config)
            checks.append(Check("opencode-go", True, config.opencode_model))
        except (RuntimeError, ValueError) as error:
            checks.append(Check("opencode-go", False, str(error)))
        try:
            profile = validate_gemini(config)
            checks.append(Check("gemini", profile is not None, config.gemini_model))
        except (RuntimeError, ValueError) as error:
            checks.append(Check("gemini", False, str(error)))
    systemd = subprocess.run(
        (
            "systemd-analyze",
            "verify",
            str(config.repository / "config/systemd/hellotalk-factory.service"),
        ),
        capture_output=True,
        text=True,
        check=False,
    )
    checks.append(Check("systemd-unit", systemd.returncode == 0, systemd.stderr.strip() or "valid"))
    return checks
