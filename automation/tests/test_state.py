import json
from pathlib import Path

import pytest

from openhands_factory.state import atomic_write_json, read_json


def test_atomic_write_keeps_previous_valid_generation(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"

    atomic_write_json(path, {"generation": 1})
    atomic_write_json(path, {"generation": 2})

    assert read_json(path, {}) == {"generation": 2}
    assert json.loads((tmp_path / "jobs.json.bak").read_text(encoding="utf-8")) == {"generation": 1}


def test_read_recovers_from_corrupt_primary_using_backup(tmp_path: Path) -> None:
    path = tmp_path / "health.json"
    atomic_write_json(path, {"generation": 1})
    atomic_write_json(path, {"generation": 2})
    path.write_text('{"broken":', encoding="utf-8")

    assert read_json(path, {}) == {"generation": 1}


def test_new_write_does_not_replace_good_backup_with_corrupt_primary(tmp_path: Path) -> None:
    path = tmp_path / "leases.json"
    atomic_write_json(path, {"generation": 1})
    atomic_write_json(path, {"generation": 2})
    path.write_text("not-json", encoding="utf-8")

    atomic_write_json(path, {"generation": 3})

    assert read_json(path, {}) == {"generation": 3}
    assert json.loads((tmp_path / "leases.json.bak").read_text(encoding="utf-8")) == {
        "generation": 1
    }


def test_missing_primary_recovers_from_backup(tmp_path: Path) -> None:
    path = tmp_path / "control.json"
    atomic_write_json(path, {"paused": False})
    atomic_write_json(path, {"paused": True})
    path.unlink()

    assert read_json(path, {}) == {"paused": False}


def test_corrupt_state_without_backup_still_fails_closed(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    path.write_text("not-json", encoding="utf-8")

    with pytest.raises(json.JSONDecodeError):
        read_json(path, {})


def test_schema_invalid_primary_recovers_without_replacing_a_good_backup(
    tmp_path: Path,
) -> None:
    path = tmp_path / "jobs.json"

    def is_job_payload(value: object) -> bool:
        return isinstance(value, dict) and isinstance(value.get("jobs"), list)

    atomic_write_json(path, {"jobs": [{"id": 1}]}, validator=is_job_payload)
    atomic_write_json(path, {"jobs": [{"id": 2}]}, validator=is_job_payload)
    path.write_text('["valid JSON", "wrong schema"]', encoding="utf-8")

    assert read_json(path, {}, validator=is_job_payload) == {"jobs": [{"id": 1}]}

    atomic_write_json(path, {"jobs": [{"id": 3}]}, validator=is_job_payload)

    assert read_json(path, {}, validator=is_job_payload) == {"jobs": [{"id": 3}]}
    assert json.loads(path.with_suffix(".json.bak").read_text(encoding="utf-8")) == {
        "jobs": [{"id": 1}]
    }


def test_atomic_write_rejects_a_new_schema_invalid_value(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"

    def is_job_payload(value: object) -> bool:
        return isinstance(value, dict) and isinstance(value.get("jobs"), list)

    with pytest.raises(ValueError, match="Refusing to write invalid"):
        atomic_write_json(path, {"wrong": []}, validator=is_job_payload)

    assert not path.exists()
