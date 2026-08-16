from pathlib import Path


REPOSITORY_ROOT = Path(__file__).parents[2]

RETIRED_WORKFLOWS = {
    "architect.yml",
    "auto-dispatcher.yml",
    "openhands.yml",
    "pr-reviewer.yml",
}

RETIRED_SYSTEMD_UNITS = {
    "hellotalk-swarm.service",
    "hellotalk-aider.service",
    "hellotalk-swarm-watchdog.service",
    "hellotalk-guardian.service",
    "hellotalk-resolver.service",
    "hellotalk-reviewer.service",
}

RETIRED_EXECUTOR_FILENAMES = {
    "architect.py",
    "auto_dispatcher.py",
    "swarm.py",
    "aider.py",
    "guardian.py",
    "resolver.py",
    "reviewer.py",
    "pr_reviewer.py",
}


def test_retired_autonomous_entrypoints_cannot_reappear() -> None:
    workflows = REPOSITORY_ROOT / ".github" / "workflows"
    systemd = REPOSITORY_ROOT / "config" / "systemd"
    factory_sources = REPOSITORY_ROOT / "automation" / "openhands_factory"
    scripts = REPOSITORY_ROOT / "scripts"

    offenders: list[str] = []

    for name in RETIRED_WORKFLOWS:
        if (workflows / name).exists():
            offenders.append(str((workflows / name).relative_to(REPOSITORY_ROOT)))

    for name in RETIRED_SYSTEMD_UNITS:
        if (systemd / name).exists():
            offenders.append(str((systemd / name).relative_to(REPOSITORY_ROOT)))

    for root in (factory_sources, scripts):
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.name in RETIRED_EXECUTOR_FILENAMES:
                offenders.append(str(path.relative_to(REPOSITORY_ROOT)))

    assert offenders == [], f"retired autonomous executor entrypoints reappeared: {offenders}"
