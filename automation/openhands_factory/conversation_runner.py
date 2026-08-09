"""One bounded OpenHands conversation per leased task."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Task


class ConversationProtocol(Protocol):
    def send_message(self, message: str) -> None: ...

    def run(self) -> None: ...

    def pause(self) -> None: ...

    def close(self) -> None: ...


ConversationFactory = Callable[[Path, int], ConversationProtocol]


@dataclass(frozen=True)
class ConversationResult:
    task_id: str
    elapsed_seconds: float
    completed: bool


class ConversationRunner:
    def __init__(self, config: FactoryConfig, factory: ConversationFactory) -> None:
        self.config = config
        self.factory = factory

    def run(self, task: Task, workspace: Path, prompt: str) -> ConversationResult:
        started = time.monotonic()
        conversation = self.factory(workspace, self.config.max_conversation_turns)
        completed = False
        
        from openhands_factory.provider_health import ProviderHealthStore, CircuitBreaker, classify_failure
        from openhands_factory.models import ProviderName
        from openhands_factory.provider_profiles import openai_credentials_available
        
        store = ProviderHealthStore(self.config.state_dir / "health.json")
        breakers = store.load()
        if not breakers:
            breakers = [
                CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, self.config.max_consecutive_failures, self.config.provider_cooldown_seconds),
                CircuitBreaker(ProviderName.OPENCODE_GO, self.config.max_consecutive_failures, self.config.provider_cooldown_seconds),
                CircuitBreaker(ProviderName.GEMINI, self.config.max_consecutive_failures, self.config.provider_cooldown_seconds),
            ]
            
        primary_provider = ProviderName.OPENAI_SUBSCRIPTION if openai_credentials_available(self.config) else ProviderName.OPENCODE_GO

        try:
            conversation.send_message(prompt)
            conversation.run()
            elapsed = time.monotonic() - started
            if elapsed > self.config.max_task_minutes * 60:
                conversation.pause()
                raise FactoryError("Conversation exceeded the maximum task duration")
            completed = True
            
            for b in breakers:
                if b.provider == primary_provider:
                    b.record_success()
            store.save(breakers)
            
            return ConversationResult(task.identifier, elapsed, completed)
        except Exception as error:
            status_code = getattr(error, "status_code", None)
            kind = classify_failure(status_code, str(error))
            for b in breakers:
                if b.provider == primary_provider:
                    b.record_failure(kind)
            store.save(breakers)
            
            try:
                conversation.pause()
            except Exception:
                pass
            raise
        finally:
            conversation.close()


def sdk_conversation_factory(config: FactoryConfig) -> ConversationFactory:
    def create(workspace: Path, max_turns: int) -> ConversationProtocol:
        from openhands.sdk import Agent, Conversation, Tool

        from openhands_factory.prompts import build_system_prompt
        from openhands_factory.provider_profiles import build_llm
        from openhands_factory.secure_tools import SecureFileEditorTool, SecureTerminalTool

        agent = Agent(
            llm=build_llm(config),
            tools=[Tool(name=SecureTerminalTool.name), Tool(name=SecureFileEditorTool.name)],
            system_prompt=build_system_prompt(config.repository / "automation/prompts"),
        )
        return Conversation(  # type: ignore[return-value]
            agent=agent,
            workspace=str(workspace),
            persistence_dir=str(config.state_dir / "conversations"),
            max_iteration_per_run=max_turns,
        )

    return create
