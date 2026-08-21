from __future__ import annotations

import os
import subprocess
import sys


def test_protected_factory_process_denies_child_proc_environment_reads() -> None:
    child_script = """import os
try:
    open(f"/proc/{os.getppid()}/environ", "rb").read()
except PermissionError:
    print("protected")
else:
    print("readable")
"""
    script = f"""
import os
import subprocess
import sys

from openhands_factory.process_security import protect_process_credentials

os.environ.pop("FACTORY_SYNTHETIC_SECRET", None)
protect_process_credentials()
child = subprocess.run(
    [
        sys.executable,
        "-c",
        {child_script!r},
    ],
    capture_output=True,
    text=True,
    check=True,
    env={{"PATH": os.environ.get("PATH", "")}},
)
print(child.stdout.strip())
"""
    environment = dict(os.environ)
    environment["FACTORY_SYNTHETIC_SECRET"] = "synthetic-value"

    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        check=True,
        env=environment,
    )

    assert result.stdout.strip() == "protected"
