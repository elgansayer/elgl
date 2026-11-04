"""Manual-session enrolment holds one real shared slot only while its participant lives."""

import json
import subprocess
import sys
import threading
from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.manual_enrolment import enrol_manual_session
from openhands_factory.provider_capacity import ProviderCapacityStore, maximum_agent_lease_seconds
from openhands_factory.session_audit import audit_sessions


def factory_config(tmp_path: Path, limit: int = 1) -> FactoryConfig:
    agents = tmp_path / "agents.json"
    agents.write_text(
        json.dumps(
            {
                "providers": {
                    "claude": {
                        "enabled": True,
                        "command": "claude",
                        "transport": "cli",
                        "auth_mode": "subscription",
                        "max_concurrency": limit,
                    }
                }
            }
        )
    )
    shared = tmp_path / "shared"
    shared.mkdir(mode=0o700)
    return FactoryConfig.from_environment(
        {
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_PROVIDER_CAPACITY_DIR": str(shared),
            "FACTORY_AGENTS_CONFIG": str(agents),
            "GITHUB_TOKEN": "not-a-real-token",
            "GEMINI_ENABLED": "false",
        }
    )


def store(config: FactoryConfig) -> ProviderCapacityStore:
    return ProviderCapacityStore(
        config.provider_capacity_dir, max_lease_seconds=maximum_agent_lease_seconds(config)
    )


def audit(config: FactoryConfig) -> dict[str, object]:
    return audit_sessions(store(config), config.state_dir / "manual-session-identities")


@pytest.fixture
def participant():
    process = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    yield process
    process.kill()
    process.wait()


def test_slot_is_held_audited_and_released_when_the_participant_exits(tmp_path, participant):
    config = factory_config(tmp_path)
    observed: list[dict[str, object]] = []

    def sleep(_seconds: float) -> None:
        if not observed:
            observed.append(audit(config))
            participant.kill()
            participant.wait()

    result = enrol_manual_session(config, "claude", participant.pid, "coordinator", sleep=sleep)
    during = observed[0]
    assert during["reader_compatible_slot_counts"] == {"claude": 1}
    assert [r["status"] for r in during["records"]] == ["live_recorded_guardian_and_lease"]
    assert during["observations_consistent"] is True
    assert result["ended"] == "participant exited"
    assert f"pid={participant.pid}" in str(result["owner"])
    assert store(config).snapshot().get("claude", 0) == 0


def test_enrolment_respects_the_router_limit(tmp_path, participant):
    config = factory_config(tmp_path, limit=1)
    store(config).acquire_renewable("claude", limit=1, owner="factory-job")
    with pytest.raises(ProviderCapacityUnavailable):
        enrol_manual_session(config, "claude", participant.pid, "coordinator")
    assert store(config).snapshot()["claude"] == 1


def test_renewal_keeps_a_long_session_counted_until_stopped(tmp_path, participant):
    config = factory_config(tmp_path)
    stop = threading.Event()
    sleeps: list[float] = []

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        if len(sleeps) == 3:
            stop.set()

    result = enrol_manual_session(
        config, "claude", participant.pid, "coordinator", sleep=sleep, stop=stop.is_set
    )
    assert result["renewals"] == 2 and result["ended"] == "stopped"
    assert all(0 < seconds < 60 for seconds in sleeps)
    assert store(config).snapshot().get("claude", 0) == 0
    assert participant.poll() is None  # the participant is never signalled


@pytest.mark.parametrize(
    ("provider", "label", "message"),
    [
        ("no-such-provider", "coordinator", "Unknown provider"),
        ("claude", "a:b", "Label"),
        ("claude", "", "Label"),
    ],
)
def test_invalid_requests_take_no_slot(tmp_path, participant, provider, label, message):
    config = factory_config(tmp_path)
    with pytest.raises(ValueError, match=message):
        enrol_manual_session(config, provider, participant.pid, label)
    assert store(config).snapshot().get("claude", 0) == 0


def test_dead_participant_takes_no_slot(tmp_path):
    config = factory_config(tmp_path)
    finished = subprocess.run([sys.executable, "-c", "pass"], check=True)
    del finished
    with pytest.raises((ProcessLookupError, OSError, ValueError)):
        enrol_manual_session(config, "claude", 2**22 + 7, "coordinator")
    assert store(config).snapshot().get("claude", 0) == 0
