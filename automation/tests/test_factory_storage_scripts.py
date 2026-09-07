from __future__ import annotations

import os
import subprocess
import textwrap
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).parents[2]
RELOCATION_SCRIPT = ROOT / "scripts/relocate-home-cache-to-second-disk.sh"


@dataclass(frozen=True)
class RelocationFixture:
    environment: dict[str, str]
    home: Path
    target: Path
    destination: Path
    fstab: Path
    service_log: Path
    service_state: Path
    mount_state: Path


def _write_command(directory: Path, name: str, body: str) -> None:
    path = directory / name
    path.write_text(
        "#!/usr/bin/env bash\nset -euo pipefail\n" + textwrap.dedent(body),
        encoding="utf-8",
    )
    path.chmod(0o755)


def _mock_commands(directory: Path) -> None:
    directory.mkdir()
    _write_command(
        directory,
        "id",
        """
        if [ "${1:-}" = "-u" ]; then
          if [ "$#" -gt 1 ]; then
            printf '1000\\n'
          else
            printf '0\\n'
          fi
        fi
        """,
    )
    _write_command(
        directory,
        "install",
        """
        mkdir -p -- "${@: -1}"
        """,
    )
    _write_command(
        directory,
        "mountpoint",
        """
        path=${@: -1}
        if [ "$path" = "$MOCK_VOLUME" ]; then
          exit 0
        fi
        if [ "$path" = "$MOCK_TARGET" ] && [ -e "$MOCK_MOUNT_STATE" ]; then
          exit 0
        fi
        exit 1
        """,
    )
    _write_command(
        directory,
        "findmnt",
        """
        arguments=" $* "
        if [[ "$arguments" == *" UUID "* ]]; then
          printf '%s\\n' "$MOCK_MOUNT_UUID"
          exit 0
        fi
        if [[ "$arguments" == *" SOURCE "* ]]; then
          path=${@: -1}
          if [ "$path" = "$MOCK_TARGET" ] && [ -e "$MOCK_MOUNT_STATE" ]; then
            printf '%s\\n' "$MOCK_DESTINATION"
          else
            printf '%s\\n' "$MOCK_DEVICE"
          fi
          exit 0
        fi
        exit 1
        """,
    )
    _write_command(
        directory,
        "blkid",
        """
        arguments=" $* "
        if [[ "$arguments" == *" UUID "* ]]; then
          printf '%s\\n' "$MOCK_DEVICE_UUID"
        elif [[ "$arguments" == *" TYPE "* ]]; then
          printf 'ext4\\n'
        fi
        """,
    )
    _write_command(
        directory,
        "systemctl",
        """
        printf '%s\\n' "$*" >> "$MOCK_SERVICE_LOG"
        case "${1:-}" in
          is-active)
            [ -e "$MOCK_SERVICE_STATE" ]
            ;;
          stop)
            rm -f "$MOCK_SERVICE_STATE"
            ;;
          start)
            touch "$MOCK_SERVICE_STATE"
            ;;
          *)
            exit 0
            ;;
        esac
        """,
    )
    _write_command(
        directory,
        "mount",
        """
        if [ "${1:-}" = "--bind" ]; then
          touch "$MOCK_MOUNT_STATE"
          exit 0
        fi
        exit 1
        """,
    )
    _write_command(
        directory,
        "umount",
        """
        if [ "${MOCK_UMOUNT_FAIL:-0}" = 1 ]; then
          exit 1
        fi
        rm -f "$MOCK_MOUNT_STATE"
        """,
    )
    _write_command(
        directory,
        "rsync",
        """
        if [[ "${1:-}" == *n* ]]; then
          exit 0
        fi
        source=${@: -2:1}
        destination=${@: -1}
        mkdir -p -- "$destination"
        /bin/cp -a -- "${source%/}/." "${destination%/}/"
        """,
    )
    _write_command(
        directory,
        "chown",
        """
        exit 0
        """,
    )
    _write_command(
        directory,
        "cp",
        """
        if [ "${MOCK_CP_FAIL:-0}" = 1 ]; then
          exit 1
        fi
        exec /bin/cp "$@"
        """,
    )


def _fixture(tmp_path: Path, *, mounted_uuid: str = "provider-volume") -> RelocationFixture:
    command_directory = tmp_path / "bin"
    _mock_commands(command_directory)

    home = tmp_path / "home"
    target = home / ".gemini"
    target.mkdir(parents=True)
    (target / "oauth.json").write_text("credential", encoding="utf-8")

    volume = tmp_path / "provider-volume"
    destination = volume / "home-dev/.gemini"
    volume.mkdir()
    device = tmp_path / "device"
    device.touch()
    fstab = tmp_path / "fstab"
    fstab.write_text("# test fstab\n", encoding="utf-8")
    service_log = tmp_path / "systemctl.log"
    service_state = tmp_path / "service-active"
    service_state.touch()
    mount_state = tmp_path / "target-mounted"

    environment = os.environ.copy()
    environment.update(
        {
            "PATH": f"{command_directory}:{environment['PATH']}",
            "RELOCATE_CACHE_USER": "dev",
            "RELOCATE_CACHE_HOME": str(home),
            "RELOCATE_CACHE_SERVICE": "factory-test.service",
            "RELOCATE_CACHE_DEVICE_BY_ID": str(device),
            "RELOCATE_CACHE_MOUNT_POINT": str(volume),
            "RELOCATE_CACHE_ROOT": str(volume / "home-dev"),
            "RELOCATE_CACHE_FSTAB_PATH": str(fstab),
            "RELOCATE_CACHE_LOCK_FILE": str(tmp_path / "relocation.lock"),
            "RELOCATE_CACHE_DIRECTORIES": ".gemini",
            "MOCK_DEVICE": str(device),
            "MOCK_DEVICE_UUID": "provider-volume",
            "MOCK_MOUNT_UUID": mounted_uuid,
            "MOCK_VOLUME": str(volume),
            "MOCK_TARGET": str(target),
            "MOCK_DESTINATION": str(destination),
            "MOCK_MOUNT_STATE": str(mount_state),
            "MOCK_SERVICE_LOG": str(service_log),
            "MOCK_SERVICE_STATE": str(service_state),
        }
    )
    return RelocationFixture(
        environment=environment,
        home=home,
        target=target,
        destination=destination,
        fstab=fstab,
        service_log=service_log,
        service_state=service_state,
        mount_state=mount_state,
    )


def _run(fixture: RelocationFixture) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(RELOCATION_SCRIPT), "--apply"],
        check=False,
        capture_output=True,
        text=True,
        env=fixture.environment,
        timeout=20,
    )


def _service_actions(fixture: RelocationFixture) -> list[str]:
    if not fixture.service_log.exists():
        return []
    return fixture.service_log.read_text(encoding="utf-8").splitlines()


def test_relocation_refuses_a_different_mounted_device(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path, mounted_uuid="some-other-volume")

    result = _run(fixture)

    assert result.returncode != 0
    assert "is not" in result.stderr
    assert fixture.target.joinpath("oauth.json").read_text(encoding="utf-8") == "credential"
    assert not fixture.destination.exists()
    assert not any(action.startswith("stop ") for action in _service_actions(fixture))


def test_relocation_persists_mount_before_removing_the_root_copy(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)

    result = _run(fixture)

    assert result.returncode == 0, result.stderr
    assert fixture.destination.joinpath("oauth.json").read_text(encoding="utf-8") == "credential"
    assert fixture.mount_state.exists()
    assert not fixture.target.with_name(".gemini.factory-relocation-backup").exists()
    fstab = fixture.fstab.read_text(encoding="utf-8")
    assert f"{fixture.destination} {fixture.target} none bind" in fstab
    actions = _service_actions(fixture)
    assert any(action.startswith("stop ") for action in actions)
    assert any(action.startswith("start ") for action in actions)
    assert fixture.service_state.exists()


def test_failed_persistence_with_busy_mount_leaves_factory_stopped(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    fixture.environment["MOCK_CP_FAIL"] = "1"
    fixture.environment["MOCK_UMOUNT_FAIL"] = "1"

    result = _run(fixture)

    assert result.returncode != 0
    assert "leaving Factory stopped" in result.stdout
    backup = fixture.target.with_name(".gemini.factory-relocation-backup")
    assert backup.joinpath("oauth.json").read_text(encoding="utf-8") == "credential"
    assert fixture.destination.joinpath("oauth.json").read_text(encoding="utf-8") == "credential"
    actions = _service_actions(fixture)
    assert any(action.startswith("stop ") for action in actions)
    assert not any(action.startswith("start ") for action in actions)
    assert not fixture.service_state.exists()
