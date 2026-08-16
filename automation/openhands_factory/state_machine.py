"""File-based State Machine for Agent Context Transfer.

Maintains FACTORY_PLAN.md and FACTORY_STATE.md in the isolated worktree
so that when an agent crashes or falls back, the next CLI simply reads the 
latest state and resumes from exactly where the last agent left off.
"""

from pathlib import Path
from dataclasses import dataclass

@dataclass
class FactoryState:
    plan: str
    state: str

class StateMachine:
    """Manages the file-based state handover between CLIs."""
    
    def __init__(self, worktree: Path):
        self.worktree = worktree
        self.plan_file = self.worktree / "FACTORY_PLAN.md"
        self.state_file = self.worktree / "FACTORY_STATE.md"
        
    def initialize_state(self, initial_plan: str) -> None:
        """Sets the initial execution plan."""
        self.plan_file.write_text(initial_plan, encoding="utf-8")
        if not self.state_file.exists():
            self.state_file.write_text("Execution started.\n", encoding="utf-8")
            
    def read_context(self) -> FactoryState:
        """Reads the current plan and state context for a fresh CLI prompt."""
        plan = self.plan_file.read_text(encoding="utf-8") if self.plan_file.exists() else ""
        state = self.state_file.read_text(encoding="utf-8") if self.state_file.exists() else ""
        return FactoryState(plan=plan, state=state)
        
    def update_state(self, new_state: str) -> None:
        """Appends the latest checkpoint to the state file before a CLI is killed."""
        current = self.state_file.read_text(encoding="utf-8") if self.state_file.exists() else ""
        self.state_file.write_text(f"{current}\n- {new_state}", encoding="utf-8")
