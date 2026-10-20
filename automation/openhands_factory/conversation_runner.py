"""One wall-clock-bounded OpenHands conversation per leased task."""

from __future__ import annotations

import multiprocessing
import os
import signal
import threading
import time
from collections.abc import Callable
from contextlib import suppress
from dataclasses import dataclass
from inspect import signature
from multiprocessing.connection import Connection
from multiprocessing.process import BaseProcess
from pathlib import Path
from typing import ClassVar, Protocol

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import FactoryError
from openhands_factory.metrics import MetricsStore
from openhands_factory.models import FailureKind, ProviderName, Task
from openhands_factory.provider_capacity import provider_slot
from openhands_factory.provider_health import (
    CircuitBreaker,
    ProviderHealthStore,
    classify_failure,
    extract_retry_after_seconds,
)
from openhands_factory.provider_profiles import select_provider_decision
from openhands_factory.provider_runtime import (
    ProviderAttributionStore,
    conversation_role,
    provider_model,
)


class ConversationProtocol(Protocol):
    def send_message(self, message: str) -> None: ...

    def run(self) -> None: ...

    def pause(self) -> None: ...

    def close(self) -> None: ...


ConversationFactory = Callable[..., ConversationProtocol]


def _silence_child_output() -> None:
    """Keep SDK transcripts and third-party diagnostics out of daemon logs."""

    sink = os.open(os.devnull, os.O_WRONLY)
    try:
        os.dup2(sink, 1)
        os.dup2(sink, 2)
    finally:
        os.close(sink)


class ConversationProviderError(FactoryError):
    """A typed provider-side SDK failure preserved for the outer AgentRouter."""

    def __init__(
        self,
        message: str,
        failure_kind: FailureKind,
        retry_after_seconds: int | None = None,
    ) -> None:
        super().__init__(message)
        self.failure_kind = failure_kind
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class ConversationResult:
    task_id: str
    elapsed_seconds: float
    completed: bool
    provider: ProviderName = ProviderName.OPENAI_SUBSCRIPTION
    model: str = ""
    role: str = "factory-phase"
    fallback: bool = False
    fallback_reason: str | None = None


def _conversation_process(
    factory: ConversationFactory,
    workspace: Path,
    max_turns: int,
    provider: ProviderName,
    prompt: str,
    result_connection: Connection,
    role: str | None = None,
) -> None:
    """Run the SDK in its own process group so the parent can cancel every child."""
    os.setsid()
    _silence_child_output()
    conversation: ConversationProtocol | None = None
    outcome: dict[str, object] = {"completed": False, "error": "Conversation did not start"}

    def pause_for_shutdown(signum: int, frame: object) -> None:
        if conversation is not None:
            conversation.pause()
        raise SystemExit(124)

    signal.signal(signal.SIGTERM, pause_for_shutdown)
    try:
        parameters = signature(factory).parameters
        if len(parameters) >= 4:
            conversation = factory(workspace, max_turns, provider, role)
        else:
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
    _active_processes: ClassVar[set[BaseProcess]] = set()
    _active_processes_lock = threading.Lock()
    _accepting_processes: ClassVar[bool] = True
    _shutdown_grace_seconds: ClassVar[float] = 5

    @classmethod
    def _register_process(cls, process: BaseProcess) -> None:
        with cls._active_processes_lock:
            cls._active_processes.add(process)

    @classmethod
    def _unregister_process(cls, process: BaseProcess) -> None:
        with cls._active_processes_lock:
            cls._active_processes.discard(process)

    @classmethod
    def _terminate_process(cls, process: BaseProcess) -> None:
        """Stop one SDK process group even when its graceful handler hangs."""

        try:
            alive = process.is_alive()
        except ValueError:
            return
        if not alive:
            return
        identifier = process.pid
        try:
            if identifier is None:
                process.terminate()
            else:
                os.killpg(identifier, signal.SIGTERM)
        except ProcessLookupError:
            return
        process.join(cls._shutdown_grace_seconds)
        try:
            alive = process.is_alive()
        except ValueError:
            return
        if not alive:
            return
        try:
            if identifier is None:
                process.kill()
            else:
                os.killpg(identifier, signal.SIGKILL)
        except ProcessLookupError:
            return
        process.join(cls._shutdown_grace_seconds)

    @classmethod
    def terminate_all(cls) -> None:
        """Terminate all live SDK conversation process groups during daemon shutdown."""
        with cls._active_processes_lock:
            processes = tuple(cls._active_processes)
        for process in processes:
            cls._terminate_process(process)

    @classmethod
    def request_shutdown(cls) -> None:
        """Atomically block new SDK workers before terminating active groups."""
        with cls._active_processes_lock:
            cls._accepting_processes = False
            processes = tuple(cls._active_processes)
        for process in processes:
            cls._terminate_process(process)

    @classmethod
    def reset_shutdown(cls) -> None:
        with cls._active_processes_lock:
            cls._accepting_processes = True

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
        self.attribution = ProviderAttributionStore(config.state_dir / "provider-attribution.json")

    def _default_breakers(self) -> list[CircuitBreaker]:
        # Only the OpenHands adapter's two inner providers get active breakers.
        # Historical Gemini state can be read, but is never selected or refreshed.
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
        ]

    def _mutate_provider_health(
        self,
        provider: ProviderName,
        *,
        failure_kind: FailureKind | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        """Update one inner provider breaker without losing concurrent updates."""
        if provider not in {ProviderName.OPENAI_SUBSCRIPTION, ProviderName.OPENCODE_GO}:
            return
        store = ProviderHealthStore(self.config.state_dir / "health.json")
        lock = FileLock(str(self.config.state_dir / "health.json.lock"))
        with lock:
            breakers = store.load()
            active: dict[ProviderName, CircuitBreaker] = {
                breaker.provider: breaker
                for breaker in breakers
                if breaker.provider in {ProviderName.OPENAI_SUBSCRIPTION, ProviderName.OPENCODE_GO}
            }
            for default in self._default_breakers():
                active.setdefault(default.provider, default)
            breaker = active[provider]
            if failure_kind is None:
                breaker.record_success()
            else:
                breaker.record_failure(
                    failure_kind,
                    retry_after_seconds=retry_after_seconds,
                )
            store.save(list(active.values()))

    def _record_attempt(
        self,
        *,
        task: Task,
        role: str,
        provider: ProviderName,
        model: str,
        successful: bool,
        fallback: bool,
        fallback_reason: str | None,
        elapsed_seconds: float,
        capacity_wait_seconds: float = 0,
        failure_kind: FailureKind | None = None,
    ) -> None:
        MetricsStore(self.config.state_dir / "metrics.json").record(
            provider,
            model,
            phase=role,
            successful=successful,
            fallback=fallback,
            rate_limited=failure_kind is FailureKind.RATE_LIMIT,
            authentication_failure=failure_kind is FailureKind.AUTHENTICATION,
            timed_out=failure_kind is FailureKind.TASK_TIMEOUT,
            duration_seconds=elapsed_seconds,
            capacity_wait_seconds=capacity_wait_seconds,
        )
        self.attribution.record(
            task_id=task.identifier,
            role=role,
            provider=provider,
            model=model,
            generation=self.config.factory_generation,
            successful=successful,
            fallback=fallback,
            fallback_reason=fallback_reason,
            elapsed_seconds=elapsed_seconds,
            capacity_wait_seconds=capacity_wait_seconds,
            failure_kind=failure_kind,
        )

    def run(
        self,
        task: Task,
        workspace: Path,
        prompt: str,
        *,
        timeout_seconds: float | None = None,
    ) -> ConversationResult:
        started = time.monotonic()
        role = conversation_role(prompt)
        implementation_provider = (
            self.attribution.latest_provider(task.identifier, role="implementation")
            if role == "review"
            else None
        )
        decision = select_provider_decision(
            self.config,
            prefer_different_from=implementation_provider,
        )
        provider = decision.provider
        model = provider_model(self.config, provider, role=role)
        fallback = provider is not ProviderName.OPENAI_SUBSCRIPTION
        owner = f"{task.identifier}:{role}:{os.getpid()}:{time.monotonic_ns()}"
        capacity_wait_seconds = 0.0

        try:
            with provider_slot(self.config, provider, owner=owner) as waited:
                capacity_wait_seconds = waited
                context = multiprocessing.get_context("spawn")
                result_connection, child_connection = context.Pipe(duplex=False)
                process = context.Process(
                    target=_conversation_process,
                    args=(
                        self.factory,
                        workspace,
                        self.config.max_conversation_turns,
                        provider,
                        prompt,
                        child_connection,
                        role,
                    ),
                    name=f"factory-conversation-{task.identifier}",
                )
                with self._active_processes_lock:
                    if not self._accepting_processes:
                        child_connection.close()
                        result_connection.close()
                        raise FactoryError("Conversation start cancelled during Factory shutdown")
                    try:
                        process.start()
                    except BaseException:
                        child_connection.close()
                        result_connection.close()
                        with suppress(ValueError):
                            process.close()
                        raise
                    self._active_processes.add(process)
                child_connection.close()
                timeout = (
                    timeout_seconds
                    if timeout_seconds is not None
                    else self.timeout_seconds or self.config.max_task_minutes * 60
                )
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
                    self._unregister_process(process)
                    process.close()
                    elapsed = time.monotonic() - started
                    # A wall-clock task timeout is not evidence that Codex/OpenCode
                    # is unhealthy. It may be caused by a huge issue, slow tests, an
                    # agent loop, or a stuck sandbox. Record it for attribution and
                    # let the durable job backoff handle the retry without poisoning
                    # the provider-wide circuit breaker.
                    self._record_attempt(
                        task=task,
                        role=role,
                        provider=provider,
                        model=model,
                        successful=False,
                        fallback=fallback,
                        fallback_reason=decision.fallback_reason,
                        elapsed_seconds=elapsed,
                        capacity_wait_seconds=capacity_wait_seconds,
                        failure_kind=FailureKind.TASK_TIMEOUT,
                    )
                    raise FactoryError("Conversation exceeded the maximum task duration")

                elapsed = time.monotonic() - started
                try:
                    try:
                        outcome: object = (
                            result_connection.recv() if result_connection.poll() else None
                        )
                    except (EOFError, OSError):
                        outcome = None
                    exit_code = process.exitcode
                finally:
                    result_connection.close()
                    self._unregister_process(process)
                    process.close()
        except FactoryError as error:
            if "Provider capacity exhausted" in str(error):
                self._record_attempt(
                    task=task,
                    role=role,
                    provider=provider,
                    model=model,
                    successful=False,
                    fallback=fallback,
                    fallback_reason="provider-capacity-exhausted",
                    elapsed_seconds=time.monotonic() - started,
                    capacity_wait_seconds=float(self.config.provider_slot_wait_seconds),
                )
            raise

        if not isinstance(outcome, dict) or outcome.get("completed") is not True:
            status_code = outcome.get("status_code") if isinstance(outcome, dict) else None
            detail = outcome.get("error") if isinstance(outcome, dict) else None
            if not isinstance(detail, str):
                detail = f"conversation process exited with status {exit_code}"
            kind = classify_failure(status_code, detail)
            retry_after = extract_retry_after_seconds(detail)
            self._mutate_provider_health(
                provider,
                failure_kind=kind,
                retry_after_seconds=retry_after,
            )
            self._record_attempt(
                task=task,
                role=role,
                provider=provider,
                model=model,
                successful=False,
                fallback=fallback,
                fallback_reason=decision.fallback_reason,
                elapsed_seconds=elapsed,
                capacity_wait_seconds=capacity_wait_seconds,
                failure_kind=kind,
            )
            raise ConversationProviderError(
                detail,
                failure_kind=kind,
                retry_after_seconds=retry_after,
            )

        self._mutate_provider_health(provider)
        self._record_attempt(
            task=task,
            role=role,
            provider=provider,
            model=model,
            successful=True,
            fallback=fallback,
            fallback_reason=decision.fallback_reason,
            elapsed_seconds=elapsed,
            capacity_wait_seconds=capacity_wait_seconds,
        )
        return ConversationResult(
            task.identifier,
            elapsed,
            True,
            provider,
            model,
            role,
            fallback,
            decision.fallback_reason,
        )


@dataclass(frozen=True)
class SdkConversationFactory:
    config: FactoryConfig

    def __call__(
        self, workspace: Path, max_turns: int, provider: ProviderName, role: str | None = None
    ) -> ConversationProtocol:
        from openhands.sdk import Agent, Conversation, Tool

        from openhands_factory.prompts import build_system_prompt
        from openhands_factory.provider_profiles import build_llm
        from openhands_factory.secure_tools import SecureFileEditorTool, SecureTerminalTool

        agent = Agent(
            llm=build_llm(self.config, provider, role=role),
            tools=[Tool(name=SecureTerminalTool.name), Tool(name=SecureFileEditorTool.name)],
            system_prompt=build_system_prompt(
                self.config.prompt_dir,
                system_prompt_path=self.config.system_prompt_path,
            ),
        )
        return Conversation(  # type: ignore[return-value]
            agent=agent,
            workspace=str(workspace),
            persistence_dir=str(self.config.state_dir / "conversations"),
            max_iteration_per_run=max_turns,
        )


def sdk_conversation_factory(config: FactoryConfig) -> ConversationFactory:
    return SdkConversationFactory(config)
