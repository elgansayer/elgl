from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _environment(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key] = value
    return values


def test_production_instances_use_bounded_github_refresh_cadence() -> None:
    instances = REPOSITORY_ROOT / "config" / "factory" / "instances"

    for name in ("hellotalk.env", "workout-agent.env"):
        environment = _environment(instances / name)
        refresh_seconds = int(environment["FACTORY_COOLDOWN_SECONDS"])
        issue_interval = int(environment["FACTORY_NEW_ISSUE_INTERVAL_SECONDS"])

        assert refresh_seconds == 300, name
        assert issue_interval >= refresh_seconds, name


def test_fresh_install_template_matches_production_refresh_cadence() -> None:
    template = _environment(REPOSITORY_ROOT / "config" / "systemd" / "factory.env.example")

    refresh_seconds = int(template["FACTORY_COOLDOWN_SECONDS"])
    issue_interval = int(template["FACTORY_NEW_ISSUE_INTERVAL_SECONDS"])

    assert refresh_seconds == 300
    assert issue_interval >= refresh_seconds
