import subprocess
from pathlib import Path

import pytest

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
    assert updater.index("log 'Refreshing verified current service units before drain'") < (
        updater.index("log 'Pausing new Factory scheduling while active jobs drain'")
    )
    assert updater.index('systemctl start "$SECONDARY_SERVICE"') < updater.rindex(
        "resume_factories"
    )


@pytest.mark.parametrize(
    ("changed_path", "runtime_change"),
    [
        ("frontend/src/app.ts", False),
        ("backend/package-lock.json", False),
        ("docs/guide.md", False),
        ("automation/openhands_factory/pipeline.py", True),
        ("automation/uv.lock", True),
        ("config/factory/agents.production.json", True),
        ("config/systemd/repo-factory.service", True),
        ("scripts/maintain-factory-host-storage.sh", True),
    ],
)
def test_update_scope_compares_immutable_runtime_inputs(
    tmp_path: Path, changed_path: str, runtime_change: bool
) -> None:
    def git(*arguments: str) -> str:
        return subprocess.check_output(["git", *arguments], cwd=tmp_path, text=True).strip()

    git("init", "-q")
    git("config", "user.email", "factory@example.test")
    git("config", "user.name", "Factory test")
    git("commit", "--allow-empty", "-qm", "initial")
    original = git("rev-parse", "HEAD")
    changed = tmp_path / changed_path
    changed.parent.mkdir(parents=True, exist_ok=True)
    changed.write_text("test\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-qm", "change")
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text()
    function = (
        "runtime_inputs_match() {"
        + updater.split("runtime_inputs_match() {", 1)[1].split("\n}", 1)[0]
        + "\n}"
    )
    command = function + '\nfactory_git_read() { git "$@"; }\nruntime_inputs_match "$1" HEAD'
    result = subprocess.run(["bash", "-c", command, "_", original], cwd=tmp_path, check=False)
    assert result.returncode == int(runtime_change)
    invalid = subprocess.run(
        ["bash", "-c", command, "_", "missing-commit"],
        cwd=tmp_path,
        capture_output=True,
        check=False,
    )
    assert invalid.returncode != 0
    assert 'runtime_inputs_match "$runtime_source_sha" "$remote_sha"' in updater
    assert "Application-only update: preserving running factories" in updater
