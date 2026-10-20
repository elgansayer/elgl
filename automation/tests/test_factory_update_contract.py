import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPOSITORY_ROOT = Path(__file__).parents[2]


@pytest.mark.parametrize(
    "evidence,allowed",
    [
        ([{"status": "completed", "conclusion": "success"}], True),
        ([{"status": "completed", "conclusion": "failure"}], False),
        ([{"status": "in_progress", "conclusion": ""}], False),
        ([{"status": "completed", "conclusion": "cancelled"}], False),
        ([], False),
        ("malformed", False),
        ("network-error", False),
        ({"status": "completed", "conclusion": "success"}, False),
        ([None, "invalid"], False),
        ([{"headSha": "b" * 40, "status": "completed", "conclusion": "success"}], False),
        (
            [
                {"status": "in_progress", "conclusion": ""},
                {"status": "completed", "conclusion": "success"},
            ],
            False,
        ),
    ],
)
def test_deployment_requires_latest_exact_commit_ci(tmp_path, evidence, allowed):
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text()
    function = updater.split("candidate_ci_green() {", 1)[1].split("\n}\n", 1)[0]
    probe = function.split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
    commit = "a" * 40
    if isinstance(evidence, list):
        evidence = [
            {"headSha": commit, **item} if isinstance(item, dict) else item for item in evidence
        ]
    fake_gh = tmp_path / "gh"
    expected_arguments = [
        "run",
        "list",
        "--repo",
        "owner/repo",
        "--workflow",
        "ci.yml",
        "--branch",
        "main",
        "--event",
        "push",
        "--commit",
        commit,
        "--limit",
        "20",
        "--json",
        "headSha,status,conclusion",
    ]
    output = "{" if evidence == "malformed" else json.dumps(evidence)
    fake_gh.write_text(
        f"#!{sys.executable}\nimport json, os, sys\n"
        "assert os.environ['GH_TOKEN'] == 'fixture-token'\n"
        "assert 'fixture-token' not in ' '.join(sys.argv)\n"
        f"assert sys.argv[1:] == {expected_arguments!r}\n"
        f"print({output!r})\n"
        f"sys.exit({1 if evidence == 'network-error' else 0})\n"
    )
    fake_gh.chmod(0o700)
    result = subprocess.run(
        [sys.executable, "-", "owner/repo", commit, "main"],
        input=probe,
        env={**os.environ, "PATH": str(tmp_path), "GH_TOKEN": "fixture-token"},
        text=True,
        capture_output=True,
        check=False,
        timeout=5,
    )
    assert result.returncode == (0 if allowed else 1), result.stderr
    assert result.stdout == ""  # Remote bodies/errors must not enter privileged logs.


def test_deployment_ci_gate_precedes_pause_and_rechecks_before_service_stop():
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text()
    first = updater.index('if ! candidate_ci_green "$remote_sha"; then')
    pause = updater.index("log 'Pausing new Factory scheduling while active jobs drain'")
    second = updater.index('if ! candidate_ci_green "$remote_sha"; then', first + 1)
    stop = updater.index("log 'Stopping factory service'")
    pull = updater.index("log 'Fast-forwarding main to the verified candidate'")
    assert first < updater.index("log 'Refreshing verified current service units before drain'")
    assert first < pause < second < stop < pull


def test_maintenance_runtime_prefers_completed_deployment_without_network():
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text()
    function = updater.split("trusted_runtime_commit() {", 1)[1].split("\n}\n", 1)[0]
    assert function.index('read -r recorded < "$DEPLOYED_RUNTIME_SHA_FILE"') < function.index(
        "branch=$(factory_git_read symbolic-ref"
    )
    assert "candidate_ci_green" not in function


def test_maintenance_refreshes_only_its_helper_without_downgrading_the_guard(tmp_path):
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text()
    function = updater.split("run_storage_maintenance() {", 1)[1].split("\n}\n", 1)[0]
    helper = tmp_path / "maintenance-helper"
    helper.write_text('#!/bin/bash\nprintf "%s\\n" "$*"\n')
    helper.chmod(0o700)
    result = subprocess.run(
        [
            "bash",
            "-ec",
            'trusted_runtime_commit() { echo verified-previous; }; '
            'install_runtime_file_from_commit() { printf "%s\\n" "$*"; }; '
            'install_runtime_bundle() { echo unsafe-bundle-refresh; return 99; }; '
            'RUNTIME_MAINTENANCE="$1"; '
            "run_storage_maintenance() {" + function + "\n}; run_storage_maintenance",
            "_",
            str(helper),
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=5,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == [
        f"verified-previous scripts/maintain-factory-host-storage.sh {helper} 0755",
        "--apply --prune-containers",
    ]


def test_promotion_stays_on_approved_sha_when_main_moves_during_drain(tmp_path):
    def git(*arguments):
        return subprocess.check_output(["git", *arguments], cwd=tmp_path, text=True).strip()

    git("init", "-q")
    git("config", "user.name", "Fixture")
    git("config", "user.email", "fixture@example.test")
    git("commit", "--allow-empty", "-qm", "deployed")
    deployed = git("rev-parse", "HEAD")
    git("commit", "--allow-empty", "-qm", "approved")
    approved = git("rev-parse", "HEAD")
    git("commit", "--allow-empty", "-qm", "new unverified main")
    unverified = git("rev-parse", "HEAD")
    git("update-ref", "refs/remotes/origin/main", unverified)
    git("switch", "--detach", deployed)
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text()
    promotion = next(
        line.strip()
        for line in updater.splitlines()
        if line.strip().startswith("factory_git_read merge --ff-only")
    )
    result = subprocess.run(
        [
            "bash",
            "-ec",
            'factory_git_read() { git "$@"; }; remote_sha="$1"; ' + promotion,
            "_",
            approved,
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert git("rev-parse", "HEAD") == approved
    assert git("rev-parse", "origin/main") == unverified


def test_factory_updater_bounds_network_git_and_preserves_repository_ownership() -> None:
    updater = (REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh").read_text(
        encoding="utf-8"
    )

    assert updater.count('timeout "${GIT_TIMEOUT}s"') == 2
    assert "factory_git_authenticated fetch --quiet origin main" in updater
    assert 'factory_git_read merge --ff-only "$remote_sha"' in updater
    assert "pull --ff-only origin main" not in updater
    # The generic factory_git_read and authenticated Git wrappers, uv sync, uv cache
    # prune, and the rootless worker image build all cross the privilege boundary
    # through runuser. This keeps Git reads and every network/package operation
    # under the unprivileged Factory account instead of leaving root-owned state
    # in the repository or ~dev caches.
    assert updater.count('runuser -u "$FACTORY_USER" -- env') == 4
    assert updater.count('runuser -u "$FACTORY_USER" --preserve-environment -- env') == 2
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
