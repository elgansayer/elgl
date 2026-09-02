from pathlib import Path

ROOT = Path(__file__).parents[2]


def _read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_host_maintenance_covers_the_actual_container_runtime() -> None:
    script = _read("scripts/maintain-factory-host-storage.sh")

    assert "--prune-containers|--prune-docker" in script
    assert 'arguments=(image prune --force --filter "until=$PRUNE_AGE")' in script
    assert "--build-cache" in script
    assert 'run_as_factory_user "$podman"' in script
    assert 'docker" builder prune' in script
    assert "--keep-storage" in script
    assert "docker system prune" not in script
    assert "--volumes" not in script


def test_host_maintenance_is_serialized_and_missing_engines_are_nonfatal() -> None:
    script = _read("scripts/maintain-factory-host-storage.sh")

    assert "flock -n 9" in script
    assert "Docker not installed; skipping Docker cleanup" in script
    assert "Podman not installed; skipping rootless Podman cleanup" in script
    assert "Docker daemon unavailable; skipping Docker cleanup" in script
    assert "Rootless Podman unavailable; skipping Podman cleanup" in script


def test_journald_is_restarted_only_when_its_policy_changes() -> None:
    script = _read("scripts/maintain-factory-host-storage.sh")

    comparison = script.index('cmp -s "$JOURNAL_POLICY_SOURCE" "$JOURNAL_POLICY_TARGET"')
    restart = script.index("systemctl restart systemd-journald.service")
    conditional_end = script.index("  fi\n  journalctl --vacuum-size", restart)

    assert comparison < restart < conditional_end


def test_watchdog_runs_storage_cleanup_independently_of_daily_update() -> None:
    watchdog = _read("config/systemd/hellotalk-factory-watchdog.sh")

    assert "FACTORY_STORAGE_MAINTENANCE_INTERVAL_SECONDS:-3600" in watchdog
    assert "FACTORY_STORAGE_MAINTENANCE_TIMEOUT_SECONDS:-75" in watchdog
    assert '"$STORAGE_MAINTENANCE" --apply --prune-containers' in watchdog
    assert "hellotalk-factory-update.service" in watchdog
    assert watchdog.index("maintain_storage\n") < watchdog.index("if healthy; then")


def test_provider_home_relocation_uses_the_attached_secondary_volume() -> None:
    script = _read("scripts/relocate-home-cache-to-second-disk.sh")

    assert "/mnt/HC_Volume_106574422" in script
    assert "RELOCATE_CACHE_DEVICE_BY_ID:-}" in script
    assert ".claude" in script
    assert "rsync -aHAXnci --delete" in script
    assert "SERVICE_WAS_ACTIVE" in script
    assert "x-systemd.requires-mounts-for" in script


def test_storage_limits_are_visible_in_production_configuration() -> None:
    example = _read("config/systemd/factory.env.example")

    assert "FACTORY_RECOVERY_MAX_TOTAL_GIB=2" in example
    assert "FACTORY_RECOVERY_FREE_HEADROOM_GIB=1" in example
    assert "FACTORY_STORAGE_MAINTENANCE_INTERVAL_SECONDS=3600" in example
    assert "FACTORY_STORAGE_MAINTENANCE_TIMEOUT_SECONDS=75" in example


def test_daily_update_atomically_refreshes_runtime_watchdog() -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")

    assert "install_runtime_script()" in updater
    assert 'mv -fT -- "$temporary" "$destination"' in updater
    assert (
        '"$REPOSITORY/config/systemd/hellotalk-factory-watchdog.sh"'
        in updater
    )
    assert '"$RUNTIME_ROOT/hellotalk-factory-watchdog.sh"' in updater
    assert '"$REPOSITORY/config/systemd/hellotalk-factory-update.sh"' in updater
