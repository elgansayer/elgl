"""Real owned pipes/processes; content-free metadata is not model progress."""

import logging
import queue
import subprocess
import sys
import threading
import time

import pytest

from openhands_factory.agents import process as module
from openhands_factory.agents.process import (
    AgentProcessRunner,
    _CaptureBuffer,
    provider_environment,
)


def test_small_flushed_output_is_captured_before_owned_process_exits(tmp_path):
    marker = tmp_path / "flushed"
    child = subprocess.Popen(
        [
            sys.executable,
            "-c",
            "import sys,time;from pathlib import Path;"
            f"print('owned bytes',flush=True);Path({str(marker)!r}).touch();time.sleep(5)",
        ],
        stdout=subprocess.PIPE,
    )
    capture = _CaptureBuffer(100)
    reader = threading.Thread(
        target=AgentProcessRunner._read_stream, args=(child.stdout, "stdout", capture)
    )
    reader.start()
    try:
        deadline = time.monotonic() + 2
        while not marker.exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert marker.exists() and child.poll() is None
        deadline = time.monotonic() + 0.5
        while capture.size == 0 and time.monotonic() < deadline:
            time.sleep(0.01)
        assert capture.size == len(b"owned bytes\n")
        assert child.poll() is None
    finally:
        child.terminate()
        child.wait(timeout=5)
        reader.join(timeout=5)
        assert not reader.is_alive()


class Observations(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records = queue.Queue()

    def emit(self, record):
        if record.msg.startswith("factory.provider.process_observation "):
            self.records.put(record)


def fields(record):
    return dict(part.split("=", 1) for part in record.getMessage().split()[1:])


def next_observation(handler, predicate):
    deadline = time.monotonic() + 5
    while True:
        record = handler.records.get(timeout=max(0.001, deadline - time.monotonic()))
        if predicate(fields(record)):
            return record
        if time.monotonic() >= deadline:
            raise AssertionError("No matching owned-process observation")


@pytest.fixture
def observations(monkeypatch):
    monkeypatch.setattr(module, "_OBSERVATION_INTERVAL_SECONDS", 0.05)
    handler = Observations()
    logger = logging.getLogger(module.__name__)
    old_level = logger.level
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    try:
        yield handler
    finally:
        logger.removeHandler(handler)
        logger.setLevel(old_level)


@pytest.mark.parametrize("guarded", [False, True])
@pytest.mark.parametrize("exit_code", [0, 7])
def test_live_counts_idle_age_capture_cap_and_terminal_status(
    tmp_path, observations, guarded, exit_code
):
    release = tmp_path / "release"
    script = (
        "import sys,time;from pathlib import Path;"
        "print('private-output-'+sys.stdin.read(),flush=True);"
        "print('private-stderr',file=sys.stderr,flush=True);"
        f"release=Path({str(release)!r})\n"
        "while not release.exists():time.sleep(0.01)\n"
        f"raise SystemExit({exit_code})"
    )
    results, failures = [], []
    runner = AgentProcessRunner(
        isolate_processes=False, guard_timeout_seconds=1 if guarded else None
    )

    def execute():
        try:
            results.append(
                runner.run(
                    [sys.executable, "-c", script],
                    cwd=tmp_path,
                    env=provider_environment(),
                    stdin_text="private-prompt",
                    timeout_seconds=8,
                    max_output_bytes=8,
                )
            )
        except BaseException as error:
            failures.append(error)

    worker = threading.Thread(target=execute, daemon=True)
    worker.start()
    try:
        first = next_observation(
            observations,
            lambda r: (
                r["final"] == "False" and int(r["stdout_bytes"]) > 8 and int(r["stderr_bytes"]) > 0
            ),
        )
        older = next_observation(
            observations,
            lambda r: r["final"] == "False" and float(r["last_output_age_seconds"]) > 0.12,
        )
        assert worker.is_alive() and not results and not failures
        earlier, later = fields(first), fields(older)
        assert later["stdout_bytes"] == earlier["stdout_bytes"]
        assert later["stderr_bytes"] == earlier["stderr_bytes"]
        assert float(later["elapsed_seconds"]) > float(earlier["elapsed_seconds"])
        assert float(later["last_output_age_seconds"]) > float(earlier["last_output_age_seconds"])
        for row in (earlier, later):
            assert row["captured_bytes"] == "8" and row["output_truncated"] == "True"
            assert row["timeout_seconds"] == "8" and row["max_output_bytes"] == "8"
        for record in (first, older):
            text = record.getMessage()
            assert len(text) < 400
            for secret in (
                "private-output",
                "private-stderr",
                "private-prompt",
                str(tmp_path),
                sys.executable,
                script,
            ):
                assert secret not in text
    finally:
        release.touch()
        worker.join(timeout=5)
        if worker.is_alive():
            AgentProcessRunner.terminate_all()
            worker.join(timeout=5)
        assert not worker.is_alive()
    assert failures == [] and len(results) == 1
    result = results[0]
    assert result.exit_code == exit_code and not result.cancelled and not result.timed_out
    assert result.output_truncated
    assert len((result.stdout + result.stderr).encode()) == 8
    final = fields(next_observation(observations, lambda r: r["final"] == "True"))
    assert final["pid"] == earlier["pid"]
    assert final["stdout_bytes"] == earlier["stdout_bytes"]


@pytest.mark.parametrize("guarded", [False, True])
def test_silent_timeout_is_unknown_output_and_remains_failing(tmp_path, observations, guarded):
    result = AgentProcessRunner(
        isolate_processes=False, guard_timeout_seconds=1 if guarded else None
    ).run(
        [sys.executable, "-c", "import time;time.sleep(10)"],
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text=None,
        timeout_seconds=1,
        max_output_bytes=8,
    )
    assert result.timed_out and result.exit_code != 0 and not result.cancelled
    assert result.duration_seconds < 5
    interim = fields(next_observation(observations, lambda r: r["final"] == "False"))
    assert interim["last_output_age_seconds"] == "None"
    assert interim["stdout_bytes"] == interim["stderr_bytes"] == "0"
    final = fields(next_observation(observations, lambda r: r["final"] == "True"))
    assert final["stdout_bytes"] == "0"


def test_observation_cadence_does_not_log_per_output_chunk(caplog):
    caplog.set_level(logging.INFO, logger=module.__name__)
    capture = _CaptureBuffer(8)
    observer = module._ProcessObserver(capture, 123, time.monotonic(), 60)
    for _ in range(1000):
        capture.append("stdout", b"content-never-logged")
        observer.emit()
    assert caplog.records == []
    observer.emit(final=True)
    assert len(caplog.records) == 1
    row = fields(caplog.records[0])
    assert row["stdout_bytes"] == str(1000 * len(b"content-never-logged"))
    assert row["captured_bytes"] == "8" and row["output_truncated"] == "True"
    assert "content-never-logged" not in caplog.text


def test_broken_observation_sink_cannot_change_actual_child_failure(tmp_path, monkeypatch):
    def broken(*_args, **_kwargs):
        raise RuntimeError("owned log-sink failure")

    monkeypatch.setattr(module.LOGGER, "info", broken)
    result = AgentProcessRunner(isolate_processes=False).run(
        [sys.executable, "-c", "print('owned payload');raise SystemExit(7)"],
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text=None,
        timeout_seconds=3,
        max_output_bytes=100,
    )
    assert result.exit_code == 7 and result.stdout == "owned payload\n"
    assert not result.timed_out and not result.cancelled
    assert AgentProcessRunner._processes == set()
