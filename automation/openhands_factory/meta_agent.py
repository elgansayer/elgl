"""Meta-Agent: Autonomous Self-Modification Watchdog.

Monitors the factory daemon's own error logs. If it detects continuous Python
exceptions or crashes in the orchestration logic, it spins up an isolated Claude
instance to debug its own source code, write a fix, and push a PR.
"""

import time
import re
import subprocess
from pathlib import Path

LOG_PATH = Path("/var/log/hellotalk-factory.log")
REPO_PATH = Path("/home/dev/hellotalk")

def monitor_logs():
    print("Meta-Agent watchdog started. Monitoring factory logs...")
    
    if not LOG_PATH.exists():
        print(f"Log file {LOG_PATH} not found. Meta-Agent will sleep.")
        return
        
    error_pattern = re.compile(r"Traceback \(most recent call last\):.*", re.MULTILINE)
    
    with open(LOG_PATH, "r") as f:
        # Move to the end of the file
        f.seek(0, 2)
        
        buffer = ""
        while True:
            line = f.readline()
            if not line:
                time.sleep(1.0)
                continue
                
            buffer += line
            
            # Simple heuristic: if we see a Traceback, we capture a chunk
            if "Traceback" in line:
                # Read the rest of the traceback (simplified)
                time.sleep(0.5)
                rest = f.read(2000)
                buffer += rest
                
                print("FATAL ERROR DETECTED IN FACTORY DAEMON.")
                trigger_self_repair(buffer)
                buffer = "" # reset buffer

def trigger_self_repair(error_log: str):
    print("Triggering Claude Code to repair the factory orchestration layer...")
    
    prompt = f"""
    The OpenHands Factory daemon just crashed with the following Python exception:
    
    ```
    {error_log}
    ```
    
    Analyze the traceback, locate the bug in the automation/openhands_factory directory, 
    fix the code, and commit the changes.
    """
    
    # We use a raw subprocess call here because this is outside the normal orchestration router
    # (Since the router itself is what crashed!)
    subprocess.run(
        ["claude", "-p", prompt],
        cwd=REPO_PATH,
        text=True
    )
    
    print("Self-repair completed.")

if __name__ == "__main__":
    monitor_logs()
