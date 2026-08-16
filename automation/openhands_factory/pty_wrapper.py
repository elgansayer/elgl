"""Headless PTY Wrapper for Interactive CLIs.

Intercepts interactive prompts, strips ANSI color codes, and standardizes 
CLI output so the State Machine and Sandbox can digest it cleanly.
"""

import pty
import os
import re
import select
from subprocess import Popen

class PTYWrapper:
    """Wraps an interactive CLI to run headlessly."""
    
    def __init__(self, command: list[str]):
        self.command = command
        
    def execute(self) -> str:
        """Executes the command in a pseudo-terminal, stripping ANSI and intercepting prompts."""
        master, slave = pty.openpty()
        
        process = Popen(
            self.command,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            close_fds=True
        )
        os.close(slave)
        
        output = []
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        
        try:
            while process.poll() is None:
                r, _, _ = select.select([master], [], [], 0.1)
                if master in r:
                    try:
                        data = os.read(master, 1024).decode('utf-8', errors='replace')
                        clean_data = ansi_escape.sub('', data)
                        output.append(clean_data)
                        
                        # Auto-answer common interactive prompts to run headlessly
                        if "Do you want to run this bash command? [Y/n]" in clean_data:
                            os.write(master, b"Y\n")
                        elif "Continue? (y/n)" in clean_data:
                            os.write(master, b"y\n")
                            
                    except OSError:
                        break
        finally:
            os.close(master)
            
        return "".join(output)
