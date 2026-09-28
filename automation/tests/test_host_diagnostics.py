from pathlib import Path

from openhands_factory.host_diagnostics import _disk_usage, _run, gather_diagnostics


def test_run_returns_stripped_combined_output() -> None:
    output = _run("bash", "-c", "echo out; echo err >&2")

    assert output == "out\nerr"


def test_run_never_raises_on_a_missing_executable() -> None:
    output = _run("definitely-not-a-real-command-xyz")

    assert "failed to run" in output


def test_run_never_raises_on_timeout() -> None:
    output = _run("sleep", "999", timeout=0.05)

    assert "failed to run" in output


def test_disk_usage_reports_free_and_total_for_an_existing_path(tmp_path: Path) -> None:
    output = _disk_usage(tmp_path)

    assert str(tmp_path) in output
    assert "GiB free" in output
    assert "% used)" in output


def test_disk_usage_degrades_gracefully_for_a_missing_path() -> None:
    output = _disk_usage(Path("/definitely/does/not/exist/anywhere"))

    assert "unavailable" in output


def test_gather_diagnostics_includes_every_section(tmp_path: Path) -> None:
    output = gather_diagnostics(tmp_path, service_name="does-not-exist.service")

    assert "## Disk usage" in output
    assert "## Service status" in output
    assert "## Recent service log" in output
    assert "## Largest directories under the state disk" in output
    assert str(tmp_path) in output
