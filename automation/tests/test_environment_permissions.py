import os
from pathlib import Path

import pytest

from openhands_factory.doctor import service_environment_permissions_check


@pytest.mark.parametrize(
    "name", ["common.env", "factory.env", "runtime.env", "factory.env.backup.20261016"]
)
def test_worker_readable_service_environments_and_backups_fail_closed(
    tmp_path: Path, name: str
) -> None:
    path = tmp_path / name
    path.write_text("GITHUB_TOKEN=never-print-this-value\n")
    path.chmod(0o640)
    result = service_environment_permissions_check((tmp_path,), owner_uid=os.getuid())
    assert not result.passed
    assert name in result.detail
    assert "never-print-this-value" not in result.detail
    path.chmod(0o600)
    assert service_environment_permissions_check((tmp_path,), owner_uid=os.getuid()).passed


def test_wrong_owner_is_rejected_without_reading_values(tmp_path: Path) -> None:
    (tmp_path / "common.env").touch(mode=0o600)
    assert not service_environment_permissions_check((tmp_path,), owner_uid=os.getuid() + 1).passed


def test_public_provider_policy_and_instance_config_are_not_secret_files(tmp_path: Path) -> None:
    (tmp_path / "agents.json").touch(mode=0o640)
    (tmp_path / "instances").mkdir()
    (tmp_path / "instances/hellotalk.env").touch(mode=0o644)
    assert service_environment_permissions_check((tmp_path,)).passed


def test_installers_preserve_private_service_environment_boundaries() -> None:
    repository = Path(__file__).parents[2]
    neutral = (repository / "scripts/install-repo-factory-instance.sh").read_text()
    assert 'chmod 0600 "$CONFIG_ROOT/common.env"' in neutral
    assert 'chown root:root "$CONFIG_ROOT/common.env"' in neutral
    assert 'chmod 0600 "$temporary"' in neutral
    deploy = (repository / "scripts/deploy-and-start-factory.sh").read_text()
    assert "chmod 0600 /etc/hellotalk-factory/runtime.env" in deploy
    setup = (repository / "setup-debian.sh").read_text()
    assert 'chmod 0600 "$FACTORY_CONFIG/runtime.env"' in setup
    repair = (repository / "scripts/repair-factory-host.sh").read_text()
    assert 'chmod 0600 "$backup"' in repair
