import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPOSITORY_ROOT = Path(__file__).parents[2]


def test_factory_updater_bounds_network_git_and_preserves_repository_ownership() -> None:
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text(
        encoding="utf-8"
    )

    assert updater.count('timeout "${GIT_TIMEOUT}s"') == 1
    assert "factory_git_authenticated fetch --quiet origin main" in updater
    assert "factory_git_authenticated pull --ff-only origin main" in updater
    # The generic factory_git_read and authenticated Git wrappers, uv sync, uv cache
    # prune, and the rootless worker image build all cross the privilege boundary
    # through runuser. This keeps Git reads and every network/package operation
    # under the unprivileged Factory account instead of leaving root-owned state
    # in the repository or ~dev caches.
    assert updater.count('runuser -u "$FACTORY_USER" -- env') == 4
    assert updater.count('runuser -u "$FACTORY_USER" --preserve-environment -- env') == 1
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


@pytest.mark.parametrize("operation", ["fetch --quiet", "pull --ff-only"])
def test_authenticated_update_git_keeps_credentials_out_of_argv(
    tmp_path: Path, operation: str
) -> None:
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text()
    function = (
        "factory_git_authenticated() {"
        + updater.split("factory_git_authenticated() {", 1)[1].split("\n}", 1)[0]
        + "\n}"
    )
    fake_runuser = tmp_path / "runuser"
    fake_runuser.write_text(
        f"#!{sys.executable}\n"
        "import json, os, sys, time\n"
        "time.sleep(float(os.environ.get('PROBE_SLEEP', '0')))\n"
        "print(json.dumps({'argv': sys.argv[1:], 'token': os.environ.get('GH_TOKEN')}))\n"
    )
    fake_runuser.chmod(0o700)
    environment = {
        **os.environ,
        "PATH": f"{tmp_path}:{os.environ['PATH']}",
        "FACTORY_USER": "fixture-user",
        "FACTORY_HOME": str(tmp_path),
        "REPOSITORY": str(tmp_path / "repository"),
        "GIT_TIMEOUT": "2",
        "GITHUB_TOKEN": "fixture-only-credential",
        "GH_TOKEN": "caller-token",
    }
    command = (
        function
        + f"\nfactory_git_authenticated {operation} origin main"
        + '\nprintf "%s\\n" "$GH_TOKEN"'
    )
    result = subprocess.run(
        ["bash", "-ec", command], env=environment, text=True, capture_output=True, check=True
    )
    probe, caller = result.stdout.splitlines()
    observed = json.loads(probe)
    assert observed["token"] == "fixture-only-credential"
    assert caller == "caller-token"
    assert not any("fixture-only-credential" in item for item in observed["argv"])
    assert observed["argv"] == [
        "-u",
        "fixture-user",
        "--preserve-environment",
        "--",
        "env",
        f"HOME={tmp_path}",
        "PATH=/usr/local/bin:/usr/bin:/bin",
        "git",
        "-c",
        "credential.helper=!gh auth git-credential",
        "-C",
        str(tmp_path / "repository"),
        *operation.split(),
        "origin",
        "main",
    ]
    bounded = subprocess.run(
        ["bash", "-ec", function + f"\nfactory_git_authenticated {operation} origin main"],
        env={**environment, "GIT_TIMEOUT": "0.05", "PROBE_SLEEP": "2"},
        capture_output=True,
        check=False,
        timeout=5,
    )
    assert bounded.returncode == 124


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
