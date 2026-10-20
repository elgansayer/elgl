from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DASHBOARD_ROOT = REPOSITORY_ROOT / "factory-dashboard"
DEPENDENCY_FIELDS = (
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
)


def test_factory_dashboard_stays_zero_dependency_for_factory_ci() -> None:
    package = json.loads((DASHBOARD_ROOT / "package.json").read_text(encoding="utf-8"))

    for field in DEPENDENCY_FIELDS:
        assert not package.get(field), f"factory-dashboard {field} must stay empty"


def test_factory_dashboard_node_tests_are_part_of_factory_validation() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is not installed in this local Factory test environment")

    version = subprocess.run(
        [node, "-p", "process.versions.node.split('.')[0]"],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if version.returncode != 0:
        pytest.skip("Installed Node.js cannot report a compatible runtime version")

    try:
        node_major = int(version.stdout.strip())
    except ValueError:
        pytest.skip("Installed Node.js reported an unparseable runtime version")
    if node_major < 22:
        pytest.skip("factory-dashboard requires Node.js >=22 for canonical validation")

    test_files = sorted((DASHBOARD_ROOT / "test").glob("*.test.js"))
    assert test_files, "factory-dashboard must keep at least one explicit Node test file"

    result = subprocess.run(
        [node, "--test", *(str(path.relative_to(DASHBOARD_ROOT)) for path in test_files)],
        cwd=DASHBOARD_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stdout + result.stderr
