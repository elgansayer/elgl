"""Meta-Agent: Autonomous Self-Modification Watchdog.

Monitors the factory daemon's own error logs. If it detects continuous Python
exceptions or crashes in the orchestration logic, it spins up an isolated Claude
instance to debug its own source code, write a fix, and push a PR.
"""

import subprocess
import time
from pathlib import Path

LOG_PATH = Path("/var/log/hellotalk-factory.log")
REPO_PATH = Path("/home/dev/hellotalk")


def monitor_logs() -> None:
    print("Meta-Agent watchdog started. Monitoring factory logs...")

    if not LOG_PATH.exists():
        print(f"Log file {LOG_PATH} not found. Meta-Agent will sleep.")
        return

    with LOG_PATH.open(encoding="utf-8") as log_file:
        log_file.seek(0, 2)

        buffer = ""
        while True:
            line = log_file.readline()
            if not line:
                time.sleep(1.0)
                continue

            buffer += line

            if "Traceback" in line:
                time.sleep(0.5)
                buffer += log_file.read(2000)

                print("FATAL ERROR DETECTED IN FACTORY DAEMON.")
                trigger_self_repair(buffer)
                buffer = ""


def trigger_self_repair(error_log: str) -> None:
    print("Triggering Claude Code to repair the factory orchestration layer...")

    prompt = f"""
    The OpenHands Factory daemon just crashed with the following Python exception:

    ```
    {error_log}
    ```

    Analyze the traceback, locate the bug in the automation/openhands_factory directory,
    fix the code, and commit the changes.
    """

    subprocess.run(
        ["claude", "-p", prompt],
        cwd=REPO_PATH,
        text=True,
        check=False,
    )

    print("Self-repair completed.")


if __name__ == "__main__":
    monitor_logs()
