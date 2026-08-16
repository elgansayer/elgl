"""One wall-clock-bounded OpenHands conversation per leased task."""

from __future__ import annotations

import multiprocessing
import os
import signal
import time
from collections.abc import Callable
from dataclasses import dataclass
from multiprocessing.connection import Connection
from pathlib import Path
from typing import Protocol

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import FailureKind, ProviderName, Task
from openhands_factory.provider_health import (
    CircuitBreaker,
    ProviderHealthStore,
    classify_failure,
    extract_retry_after_seconds,
)
from openhands_factory.provider_profiles import select_primary_provider


class ConversationProtocol(Protocol):
    def send_message(self, message: str) -> None: ...

    def run(self) -> None: ...

    def pause(self) -> None: ...

    def close(self) -> None: ...


ConversationFactory = Callable[[Path, int, ProviderName], ConversationProtocol]


@dataclass(frozen=True)
class ConversationResult:
    task_id: str
    elapsed_seconds: float
    completed: bool


def _conversation_process(
    factory: ConversationFactory,
    workspace: Path,
    max_turns: int,
    provider: ProviderName,
    prompt: str,
    result_connection: Connection,
) -> None:
    """Run the SDK in its own process group so the parent can cancel every child."""
    os.setsid()
    conversation: ConversationProtocol | None = None
    outcome: dict[str, object] = {"completed": False, "error": "Conversation did not start"}

    def pause_for_shutdown(signum: int, frame: object) -> None:
        if conversation is not None:
            conversation.pause()
        raise SystemExit(124)

    signal.signal(signal.SIGTERM, pause_for_shutdown)
    try:
        conversation = factory(workspace, max_turns, provider)
        conversation.send_message(prompt)
        conversation.run()
        outcome = {"completed": True}
    except BaseException as error:
        outcome = {
            "completed": False,
            "error": f"{type(error).__name__}: {error}"[-2000:],
        }
    finally:
        if conversation is not None:
            try:
                conversation.close()
            except Exception as error:
                outcome = {
                    "completed": False,
                    "error": f"Conversation close failed: {error}"[-2000:],
                }
        try:
            result_connection.send(outcome)
        finally:
            result_connection.close()


class ConversationRunner:
    def __init__(
        self,
        config: FactoryConfig,
        factory: ConversationFactory,
        *,
        timeout_seconds: float | None = None,
        cancellation_grace_seconds: float = 10,
    ) -> None:
        self.config = config
        self.factory = factory
        self.timeout_seconds = timeout_seconds
        self.cancellation_grace_seconds = cancellation_grace_seconds

    def _default_breakers(self) -> list[CircuitBreaker]:
        return [
            CircuitBreaker(
                ProviderName.OPENAI_SUBSCRIPTION,
                self.config.max_consecutive_failures,
                self.config.provider_cooldown_seconds,
            ),
            CircuitBreaker(
                ProviderName.OPENCODE_GO,
                self.config.max_consecutive_failures,
                self.config.provider_cooldown_seconds,
            ),
            CircuitBreaker(
                ProviderName.GEMINI,
                self.config.max_consecutive_failures,
                self.config.provider_cooldown_seconds,
            ),
        ]

    def _mutate_provider_health(
        self,
        provider: ProviderName,
        *,
        failure_kind: FailureKind | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        """Update one provider breaker without losing concurrent worker updates."""
        store = ProviderHealthStore(self.config.state_dir / "health.json")
        lock = FileLock(str(self.config.state_dir / "health.json.lock"))
        with lock:
            breakers = store.load() or self._default_breakers()
            for breaker in breakers:
                if breaker.provider != provider:
                    continue
                if failure_kind is None:
                    breaker.record_success()
                else:
                    breaker.record_failure(
                        failure_kind,
                        retry_after_seconds=retry_after_seconds,
                    )
                break
            store.save(breakers)

    def run(self, task: Task, workspace: Path, prompt: str) -> ConversationResult:
        started = time.monotonic()
        primary_provider = select_primary_provider(self.config)
        context = multiprocessing.get_context("spawn")
        result_connection, child_connection = context.Pipe(duplex=False)
        process = context.Process(
            target=_conversation_process,
            args=(
                self.factory,
                workspace,
                self.config.max_conversation_turns,
                primary_provider,
                prompt,
                child_connection,
            ),
            name=f"factory-conversation-{task.identifier}",
        )
        process.start()
        child_connection.close()
        timeout = self.timeout_seconds or self.config.max_task_minutes * 60
        process.join(timeout)
        if process.is_alive():
            process_identifier = process.pid
            if process_identifier is not None:
                try:
                    os.killpg(process_identifier, signal.SIGTERM)
                except ProcessLookupError:
                    process.terminate()
            process.join(self.cancellation_grace_seconds)
            if process.is_alive():
                if process_identifier is not None:
                    try:
                        os.killpg(process_identifier, signal.SIGKILL)
                    except ProcessLookupError:
                        process.kill()
                process.join()
            result_connection.close()
            process.close()
            self._mutate_provider_health(primary_provider, failure_kind=FailureKind.TRANSIENT)
            raise FactoryError("Conversation exceeded the maximum task duration")

        elapsed = time.monotonic() - started
        outcome: object = result_connection.recv() if result_connection.poll() else None
        result_connection.close()
        exit_code = process.exitcode
        process.close()

        if not isinstance(outcome, dict) or outcome.get("completed") is not True:
            status_code = outcome.get("status_code") if isinstance(outcome, dict) else None
            detail = outcome.get("error") if isinstance(outcome, dict) else None
            if not isinstance(detail, str):
                detail = f"conversation process exited with status {exit_code}"
            kind = classify_failure(status_code, detail)
            retry_after = extract_retry_after_seconds(detail)
            self._mutate_provider_health(
                primary_provider,
                failure_kind=kind,
                retry_after_seconds=retry_after,
            )
            raise FactoryError(detail)

        self._mutate_provider_health(primary_provider)
        return ConversationResult(task.identifier, elapsed, True)


@dataclass(frozen=True)
class SdkConversationFactory:
    config: FactoryConfig

    def __call__(
        self, workspace: Path, max_turns: int, provider: ProviderName
    ) -> ConversationProtocol:
        from openhands.sdk import Agent, Conversation, LLM, Tool

        from openhands_factory.prompts import build_system_prompt
        from openhands_factory.secure_tools import (
            SecureFileEditorTool,
            SecureTerminalTool,
        )

        if provider is ProviderName.OPENAI_SUBSCRIPTION:
            llm = LLM.subscription_login(
                vendor="openai",
                model=self.config.openai_model,
                open_browser=False,
            )
        elif provider is ProviderName.GEMINI:
            llm = LLM(
                model=f"gemini/{self.config.gemini_model}",
                api_key=self.config.gemini_api_key,
                usage_id=self.config.gemini_profile_name,
            )
        else:
            llm = LLM(
                model=f"openai/{self.config.opencode_model}",
                api_key=self.config.opencode_api_key,
                base_url=self.config.opencode_base_url,
                usage_id=self.config.opencode_profile_name,
                reasoning_effort="none",
            )

        agent = Agent(
            llm=llm,
            tools=[Tool(name=SecureTerminalTool.name), Tool(name=SecureFileEditorTool.name)],
            system_prompt=build_system_prompt(workspace / "automation/prompts"),
        )
        return Conversation(  # type: ignore[return-value]
            agent=agent,
            workspace=str(workspace),
            persistence_dir=str(self.config.state_dir / "conversations"),
            max_iteration_per_run=max_turns,
        )


def sdk_conversation_factory(config: FactoryConfig) -> ConversationFactory:
    return SdkConversationFactory(config)
