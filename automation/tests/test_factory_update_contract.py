from pathlib import Path

REPOSITORY_ROOT = Path(__file__).parents[2]


def test_factory_updater_bounds_network_git_and_preserves_repository_ownership() -> None:
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text(
        encoding="utf-8"
    )

    assert updater.count('timeout "${GIT_TIMEOUT}s"') == 2
    # 2 git operations (fetch, pull) + uv sync + uv cache prune - every
    # network/package operation the updater performs must run as the
    # unprivileged factory user via runuser, never bare as root. Running
    # `uv sync` unwrapped (even with HOME overridden to the dev user's home)
    # left root-owned cache files under ~dev/.cache/uv that the dev-run
    # factory service couldn't read, silently consuming disk until it
    # tripped the reserve that gates scheduling.
    assert updater.count('runuser -u "$FACTORY_USER" -- env') == 4
    assert "GIT_TIMEOUT=${FACTORY_UPDATE_GIT_TIMEOUT:-120}" in updater
    assert "git -c safe.directory=" not in updater
    assert 'git -C "$REPOSITORY" reset --hard' not in updater
    assert "maintain-factory-host-storage.sh" in updater
