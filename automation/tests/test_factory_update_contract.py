from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[2]


def test_factory_updater_bounds_network_git_and_preserves_repository_ownership() -> None:
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text(
        encoding="utf-8"
    )

    assert updater.count('timeout "${GIT_TIMEOUT}s"') == 2
    # The generic factory_git_read wrapper plus fetch, pull, uv sync, uv cache
    # prune, and the rootless worker image build all cross the privilege boundary
    # through runuser. This keeps Git reads and every network/package operation
    # under the unprivileged Factory account instead of leaving root-owned state
    # in the repository or ~dev caches.
    assert updater.count('runuser -u "$FACTORY_USER" -- env') == 6
    assert "GIT_TIMEOUT=${FACTORY_UPDATE_GIT_TIMEOUT:-120}" in updater
    assert "git -c safe.directory=" not in updater
    assert 'git -C "$REPOSITORY" reset --hard' not in updater
    assert "--reinstall-package repo-factory" in updater
    assert 'readlink -f -- "$FACTORY_VENV"' in updater
    assert 'chown -R "$FACTORY_USER:$FACTORY_USER" "$factory_venv_real"' in updater
    assert 'test -x "$FACTORY_VENV/bin/repo-factory"' in updater
    assert "maintain-factory-host-storage.sh" in updater
    assert "restore_services_on_failure" in updater
    assert "Unknown state is not idle" in updater
    assert "raise SystemExit(1)" in updater


def test_factory_updater_drains_continuously_busy_daemons_only_when_needed() -> None:
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text(
        encoding="utf-8"
    )

    assert "ACTIVE_JOB_WAIT_SECONDS=${FACTORY_UPDATE_ACTIVE_JOB_WAIT_SECONDS:-7500}" in updater
    assert "pause_factories" in updater
    assert "resume_factories" in updater
    assert 'json.dump({"paused": paused}, handle)' in updater
    assert "os.fchown(handle.fileno(), uid, gid)" in updater
    assert updater.index("log 'Fetching origin/main'") < updater.index(
        "log 'Pausing new Factory scheduling while active jobs drain'"
    )
    assert updater.index('systemctl start "$SECONDARY_SERVICE"') < updater.rindex(
        "resume_factories"
    )
