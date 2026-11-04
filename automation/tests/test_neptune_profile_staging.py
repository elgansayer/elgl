"""Execute the updater's real Git/copy/publish functions in owned fixtures."""

import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[2]
UPDATER = ROOT / "config/systemd/hellotalk-factory-update.sh"
PROFILE = "config/factory/instances/neptune.env"


def function(name: str) -> str:
    body = UPDATER.read_text().split(name + "() {", 1)[1].split("\n}\n", 1)[0]
    return name + "() {" + body + "\n}\n"


@pytest.fixture
def staging(tmp_path):
    repository = tmp_path / "repository"
    repository.mkdir()
    destination = tmp_path / "instances/neptune.env"
    destination.parent.mkdir()

    def git(*args):
        return subprocess.check_output(
            ["git", *args],
            cwd=repository,
            env={"PATH": os.defpath, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull},
            text=True,
            timeout=5,
        ).strip()

    git("init", "-q")
    git("config", "user.name", "Staging fixture")
    git("config", "user.email", "fixture@example.invalid")

    def run(content=None, *, scenario="normal", commit=None):
        if commit is None:
            profile = repository / PROFILE
            profile.parent.mkdir(parents=True, exist_ok=True)
            profile.write_text(content if content is not None else (ROOT / PROFILE).read_text())
            git("add", PROFILE)
            git("commit", "-qm", "Private inactive profile fixture", "--allow-empty")
            commit = git("rev-parse", "HEAD")
        # Root ownership operations are checked, but applied as our own UID.
        # Every real file operation stays inside this temporary directory.
        harness = r"""
fixture_repo=$1
fixture_destination=$3
fixture_instance_parent=$(dirname -- "$fixture_destination")
scenario=$4
log() { printf '%s\n' "$*"; }
factory_git_read() {
  if [ "$scenario" = deny-git ]; then return 71; fi
  if [ "$scenario" = tree-error ] && [ "$1" = ls-tree ]; then return 74; fi
  if [ "$scenario" = size-error ] && [ "$1" = cat-file ] && [ "$2" = -s ]; then
    return 75
  fi
  if [ "$scenario" = copy-error ] && [ "$1" = cat-file ] && [ "$2" = blob ]; then
    return 72
  fi
  command git -C "$fixture_repo" "$@"
}
install() {
  [ "$#" = 8 ] && [ "$1" = -d ] && [ "$2" = -o ] && [ "$3" = root ] &&
    [ "$4" = -g ] && [ "$5" = root ] && [ "$6" = -m ] && [ "$7" = 0700 ] || return 90
  case "$8" in "$fixture_instance_parent"/.neptune-stage.*) ;; *) return 91 ;; esac
  command install -d -m "$7" "$8"
}
chown() {
  [ "$#" = 2 ] && [ "$1" = root:root ] || return 92
  case "$2" in
    "$fixture_instance_parent"/.neptune-stage.*/neptune.env.new.*) ;;
    *) return 93 ;;
  esac
}
systemctl() { echo forbidden-service-action >&2; return 94; }
runuser() { echo forbidden-worker-launch >&2; return 95; }
ln() {
  case "$scenario" in
    race-file)
      printf 'operator-race\n' > "$fixture_destination"
      chmod 0600 "$fixture_destination"
      ;;
    race-link) command ln -s "$fixture_repo/operator-target" "$fixture_destination" ;;
    race-directory) mkdir "$fixture_destination" ;;
    publish-error) return 73 ;;
  esac
  command ln "$@"
}
"""
        harness += "\n".join(
            function(name)
            for name in (
                "verify_commit_identity",
                "install_runtime_file_from_commit",
                "stage_inactive_neptune_configuration",
            )
        )
        harness += '\nstage_inactive_neptune_configuration "$2" "$fixture_destination"\n'
        result = subprocess.run(
            [
                "bash",
                "-ec",
                harness,
                "_",
                str(repository),
                commit,
                str(destination),
                scenario,
            ],
            cwd=repository,
            env={
                "PATH": os.defpath,
                "LANG": "C.UTF-8",
                "PYTHONPATH": str(repository),
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_CONFIG_GLOBAL": os.devnull,
            },
            capture_output=True,
            text=True,
            timeout=12,
        )
        assert not list(destination.parent.glob(".neptune-stage.*")), result.stderr
        assert "forbidden-" not in result.stderr
        return result

    return run, destination, repository, git


def test_materialises_exact_committed_profile_not_changed_checkout(staging):
    run, destination, repository, git = staging
    profile = repository / PROFILE
    profile.parent.mkdir(parents=True)
    expected = (ROOT / PROFILE).read_bytes()
    profile.write_bytes(expected)
    git("add", PROFILE)
    git("commit", "-qm", "Accepted disabled blob")
    commit = git("rev-parse", "HEAD")
    profile.write_text("FACTORY_NEPTUNE_ENABLED=true\nGITHUB_TOKEN=checkout-fixture-secret\n")
    result = run(commit=commit)
    assert result.returncode == 0, result.stderr
    assert destination.read_bytes() == expected
    assert destination.stat().st_mode & 0o777 == 0o644
    assert destination.stat().st_nlink == 1
    assert "checkout-fixture-secret" not in result.stdout + result.stderr


def test_repeated_stage_preserves_operator_bytes_and_metadata_without_source_read(staging):
    run, destination, _, _ = staging
    assert run().returncode == 0
    destination.write_text("FACTORY_NEPTUNE_ENABLED=true\noperator-private-fixture\n")
    destination.chmod(0o600)
    before = destination.stat()
    result = run(scenario="deny-git", commit="invalid-even-before-git")
    assert result.returncode == 0, result.stderr
    after = destination.stat()
    assert (before.st_ino, before.st_mode, before.st_mtime_ns, before.st_ctime_ns) == (
        after.st_ino,
        after.st_mode,
        after.st_mtime_ns,
        after.st_ctime_ns,
    )
    assert destination.read_text().endswith("operator-private-fixture\n")
    assert "operator-private-fixture" not in result.stdout + result.stderr


def test_template_validation_does_not_import_modules_from_checkout_or_pythonpath(staging):
    run, destination, repository, _ = staging
    (repository / "pathlib.py").write_text("raise RuntimeError('untrusted-checkout-import')\n")
    result = run()
    assert result.returncode == 0, result.stderr
    assert destination.read_bytes() == (ROOT / PROFILE).read_bytes()
    assert "untrusted-checkout-import" not in result.stdout + result.stderr


def test_preserves_existing_dangling_link_without_following_it(staging):
    run, destination, repository, _ = staging
    target = repository / "absent-target"
    destination.symlink_to(target)
    result = run(scenario="deny-git", commit="not-used")
    assert result.returncode == 0, result.stderr
    assert destination.is_symlink() and destination.readlink() == target
    assert not target.exists()


@pytest.mark.parametrize("scenario", ["race-file", "race-link", "race-directory"])
def test_atomic_publication_preserves_concurrent_file_link_or_directory(staging, scenario):
    run, destination, repository, _ = staging
    result = run(scenario=scenario)
    assert result.returncode == 0, result.stderr
    if scenario == "race-file":
        assert destination.read_text() == "operator-race\n"
        assert destination.stat().st_mode & 0o777 == 0o600
    elif scenario == "race-link":
        assert destination.is_symlink()
        assert not (repository / "operator-target").exists()
    else:
        assert destination.is_dir() and list(destination.iterdir()) == []


@pytest.mark.parametrize(
    "edit",
    [
        lambda s: s.replace("FACTORY_NEPTUNE_ENABLED=false", "FACTORY_NEPTUNE_ENABLED=true"),
        lambda s: s + "FACTORY_NEPTUNE_ENABLED=false\n",
        lambda s: s.replace(
            "FACTORY_REPOSITORY_PROFILE=neptune", "FACTORY_REPOSITORY_PROFILE=elgl"
        ),
        lambda s: s.replace(
            "FACTORY_MONTHLY_VARIABLE_BUDGET_USD=0", "FACTORY_MONTHLY_VARIABLE_BUDGET_USD=1"
        ),
        lambda s: s.replace(
            "FACTORY_PROVIDER_CAPACITY_DIR=/var/lib/repo-factory/shared",
            "FACTORY_PROVIDER_CAPACITY_DIR=/tmp/new-allowance",
        ),
        lambda s: s + "FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS=3\n",
        lambda s: s + "GITHUB_TOKEN=never-log-fixture-secret\n",
        lambda s: s + "malformed-line\n",
        lambda s: "",
        lambda s: "x" * 32769,
    ],
)
def test_invalid_active_funded_or_secret_template_never_publishes(staging, edit):
    run, destination, _, _ = staging
    result = run(edit((ROOT / PROFILE).read_text()))
    assert result.returncode != 0
    assert not destination.exists() and not destination.is_symlink()
    assert "never-log-fixture-secret" not in result.stdout + result.stderr


@pytest.mark.parametrize("scenario", ["tree-error", "size-error", "copy-error", "publish-error"])
def test_copy_or_publication_failure_cleans_only_owned_stage(staging, scenario):
    run, destination, _, _ = staging
    unrelated = destination.parent / "unrelated"
    unrelated.write_text("preserve me")
    result = run(scenario=scenario)
    assert result.returncode != 0
    assert not destination.exists()
    assert unrelated.read_text() == "preserve me"


def test_invalid_commit_rejects_before_materialisation(staging):
    run, destination, _, _ = staging
    assert run(commit="invalid").returncode != 0
    assert not destination.exists()


def test_bootstrap_from_verified_historical_commit_without_profile_defers(staging):
    run, destination, _, git = staging
    git("commit", "-qm", "Historical runtime before Neptune", "--allow-empty")
    result = run(commit=git("rev-parse", "HEAD"))
    assert result.returncode == 0, result.stderr
    assert not destination.exists()
    assert "deferring preparation" in result.stdout


def test_service_configuration_calls_staging_without_neptune_service_actions(tmp_path):
    script = r"""
verify_commit_identity() { [ "$1" = fixture-commit ]; }
install_runtime_file_from_commit() { printf 'existing:%s\n' "$3"; }
stage_inactive_neptune_configuration() { [ "$1" = fixture-commit ]; echo stage-neptune; }
systemctl() { [ "$#" = 1 ] && [ "$1" = daemon-reload ]; echo daemon-reload; }
"""
    result = subprocess.run(
        [
            "bash",
            "-ec",
            script
            + function("install_service_configuration")
            + "\ninstall_service_configuration fixture-commit\n",
        ],
        cwd=tmp_path,
        env={"PATH": os.defpath},
        text=True,
        capture_output=True,
        timeout=5,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines()[-2:] == ["stage-neptune", "daemon-reload"]
