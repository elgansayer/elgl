from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DASHBOARD_ROOT = REPOSITORY_ROOT / "factory-dashboard"


def test_factory_dashboard_node_tests_are_part_of_factory_validation() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is not installed in this local Factory test environment")

    result = subprocess.run(
        [node, "--test"],
        cwd=DASHBOARD_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stdout + result.stderr
