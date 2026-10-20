"""Shared implementation for direct, subscription-authenticated agent CLIs."""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import threading
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.process import (
    AgentProcessRunner,
    ProcessResult,
    ProviderHomeMount,
    provider_environment,
)

_SECRET_PATTERNS = (
    re.compile(r"(?i)(?:sk|ghp|github_pat|xox[baprs]|AIza)[-_A-Za-z0-9]{12,}"),
    re.compile(r"(?i)(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s]+"),
    re.compile(r"(?i)(api[_-]?key\s*[:=]\s*)[^\s]+"),
    re.compile(
        r"(?i)((?:[a-z0-9_-]*(?:token|secret|password|passwd|credential)"
        r"[a-z0-9_-]*)[\"']?\s*[:=]\s*[\"']?)[^\"'\s,;}]+"
    ),
)
_AUTH_MARKERS = (
    "authentication required",
    "authentication failed",
    "not logged in",
    "please log in",
    "please sign in",
    "unauthorised",
    "unauthorized",
    "invalid token",
    "expired token",
    "invalid credentials",
)
_QUOTA_MARKERS = (
    "quota exhausted",
    "quota exceeded",
    "individual quota reached",
    "usage limit reached",
    "subscription limit",
    "credit balance",
    "insufficient balance",
    "monthly spend limit",
)
_RATE_LIMIT_MARKERS = (
    "rate limit",
    "too many requests",
    "429",
    "resets_in_seconds",
    "retry-after",
)
_TEST_MARKERS = (
    "tests failed",
    "test suite failed",
    "compilation failed",
    "build failed",
)
_REPOSITORY_MARKERS = (
    "not a git repository",
    "repository is read-only",
    "repository is locked",
    "worktree is locked",
    "merge conflict",
)
_POLICY_MARKERS = (
    "blocked by policy",
    "permission denied by policy",
    "sandbox denied",
    "approval required",
)
_TASK_MARKERS = (
    "task cannot be completed",
    "task is not feasible",
)


def redact_agent_output(value: str) -> str:
    redacted = value
    for pattern in _SECRET_PATTERNS:
        redacted = pattern.sub(
            lambda match: f"{match.group(1)}[redacted]" if match.lastindex else "[redacted]",
            redacted,
        )
    return redacted


def extract_retry_after_seconds(value: str) -> int | None:
    patterns = (
        r"(?i)retry[-_ ]after(?: seconds)?[\s:=]+(\d+)",
        r'(?i)"?resets[_ ]in[_ ]seconds"?[\s:=]+(\d+)',
        r"(?i)try again in\s+(\d+)\s*seconds?",
    )
    for pattern in patterns:
        match = re.search(pattern, value)
        if match:
            return min(int(match.group(1)), 7 * 24 * 3600)
    duration = re.search(
        r"(?i)resets?\s+in\s+"
        r"(?:(\d+)\s*(?:h|hours?)\s*)?"
        r"(?:(\d+)\s*(?:m|minutes?)\s*)?"
        r"(?:(\d+)\s*(?:s|seconds?)\s*)?",
        value,
    )
    if duration and any(part is not None for part in duration.groups()):
        hours, minutes, seconds = (int(part or 0) for part in duration.groups())
        return min(hours * 3600 + minutes * 60 + seconds, 7 * 24 * 3600)
    return None


def classify_process_failure(result: ProcessResult) -> AgentFailure:
    combined = redact_agent_output(f"{result.stderr}\n{result.stdout}").strip()
    lowered = combined.lower()
    retry_after = extract_retry_after_seconds(lowered)
    if result.timed_out:
        kind = AgentFailureKind.PROVIDER_TIMEOUT
    elif result.exit_code in {126, 127}:
        kind = AgentFailureKind.PROVIDER_UNAVAILABLE
    elif any(marker in lowered for marker in _AUTH_MARKERS):
        kind = AgentFailureKind.PROVIDER_AUTH
    elif any(marker in lowered for marker in _QUOTA_MARKERS):
        kind = AgentFailureKind.PROVIDER_QUOTA
    elif any(marker in lowered for marker in _RATE_LIMIT_MARKERS):
        kind = AgentFailureKind.PROVIDER_RATE_LIMIT
    elif result.exit_code < 0:
        kind = AgentFailureKind.AGENT_CRASH
    elif any(marker in lowered for marker in _TEST_MARKERS):
        kind = AgentFailureKind.TEST_FAILURE
    elif any(marker in lowered for marker in _REPOSITORY_MARKERS):
        kind = AgentFailureKind.REPOSITORY_FAILURE
    elif any(marker in lowered for marker in _POLICY_MARKERS):
        kind = AgentFailureKind.POLICY_FAILURE
    elif any(marker in lowered for marker in _TASK_MARKERS):
        kind = AgentFailureKind.TASK_FAILURE
    else:
        kind = AgentFailureKind.PROVIDER_TRANSPORT
    detail = combined[-1000:] if combined else "no diagnostic output"
    return AgentFailure(
        kind=kind,
        message=f"Agent CLI exited with status {result.exit_code}: {detail}",
        exit_code=result.exit_code,
        retry_after_seconds=retry_after,
    )


class CLIProvider:
    """Provider-neutral lifecycle for installed coding-agent executables."""

    name = "cli"
    transport = "cli"
    default_command = ""
    default_model = ""
    default_credential_paths: tuple[str, ...] = ()
    default_runtime_paths: tuple[str, ...] = ()

    def __init__(
        self,
        *,
        enabled: bool = True,
        command: str | None = None,
        wrapper_command: str | None = None,
        model: str | None = None,
        phase_models: Mapping[str, str] | None = None,
        extra_args: Sequence[str] = (),
        max_turns: int = 100,
        process_runner: AgentProcessRunner | None = None,
        health_cache_seconds: int = 300,
        credential_paths: Sequence[str] | None = None,
        runtime_paths: Sequence[str] | None = None,
    ) -> None:
        self.enabled = enabled
        self.command = command or self.default_command
        self.wrapper_command = wrapper_command
        self.model = model or self.default_model
        self.phase_models = dict(phase_models or {})
        self.extra_args = tuple(extra_args)
        self.max_turns = max_turns
        self.process_runner = process_runner or AgentProcessRunner()
        selected_credentials = (
            self.default_credential_paths if credential_paths is None else credential_paths
        )
        selected_runtime = self.default_runtime_paths if runtime_paths is None else runtime_paths
        self.home_mounts = (
            *(ProviderHomeMount(path) for path in selected_credentials),
            *(ProviderHomeMount(path, read_only=True) for path in selected_runtime),
        )
        self.health_cache_seconds = health_cache_seconds
        self._cached_health: ProviderHealth | None = None
        self._health_lock = threading.Lock()

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def model_for(self, phase: AgentPhase) -> str:
        return self.phase_models.get(
            phase.value,
            self.phase_models.get(phase.value.replace("-", "_"), self.model),
        )

    def _prefix(self) -> list[str]:
        if self.wrapper_command:
            return [self.wrapper_command, self.command]
        return [self.command]

    def _available(self) -> str | None:
        if self.wrapper_command:
            if shutil.which(self.wrapper_command) is None:
                return f"wrapper {self.wrapper_command!r} is not installed on the service PATH"
            return None
        if shutil.which(self.command) is None:
            return f"command {self.command!r} is not installed on the service PATH"
        return None

    def auth_probe(self) -> tuple[Sequence[str], ProviderStatus]:
        return ([*self._prefix(), "--version"], ProviderStatus.DEGRADED)

    def preflight_health(self, cwd: Path) -> ProviderHealth | None:
        del cwd
        return None

    def _run_process(
        self,
        command: Sequence[str],
        *,
        cwd: Path,
        stdin_text: str | None,
        timeout_seconds: int,
        max_output_bytes: int,
    ) -> ProcessResult:
        return self.process_runner.run(
            command,
            cwd=cwd,
            env=provider_environment(),
            stdin_text=stdin_text,
            timeout_seconds=timeout_seconds,
            max_output_bytes=max_output_bytes,
            home_mounts=self.home_mounts,
        )

    def invalidate_health_cache(self) -> None:
        """Force the next circuit half-open check to execute a real probe."""
        with self._health_lock:
            self._cached_health = None

    def interpret_auth_probe(
        self,
        result: ProcessResult,
        successful_status: ProviderStatus,
    ) -> ProviderHealth:
        if result.exit_code == 0:
            detail = "installed; authentication is verified on the first non-paid invocation"
            return ProviderHealth(self.name, successful_status, datetime.now(UTC), detail=detail)
        failure = classify_process_failure(result)
        status = ProviderStatus.AUTH_REQUIRED
        if failure.kind is AgentFailureKind.PROVIDER_UNAVAILABLE:
            status = ProviderStatus.UNAVAILABLE
        return ProviderHealth(
            self.name,
            status,
            datetime.now(UTC),
            detail=failure.message,
        )

    def health(self) -> ProviderHealth:
        if not self.enabled:
            return ProviderHealth(self.name, ProviderStatus.DISABLED, datetime.now(UTC))
        unavailable = self._available()
        if unavailable:
            return ProviderHealth(
                self.name,
                ProviderStatus.UNAVAILABLE,
                datetime.now(UTC),
                detail=unavailable,
            )
        with self._health_lock:
            now = datetime.now(UTC)
            if self._cached_health is not None and now - self._cached_health.checked_at < timedelta(
                seconds=self.health_cache_seconds
            ):
                return self._cached_health
            with tempfile.TemporaryDirectory(prefix="factory-agent-health-") as directory:
                health_workspace = Path(directory)
                preflight = self.preflight_health(health_workspace)
                if preflight is not None:
                    self._cached_health = preflight
                    return preflight
                command, successful_status = self.auth_probe()
                try:
                    result = self._run_process(
                        command,
                        cwd=health_workspace,
                        stdin_text=None,
                        timeout_seconds=15,
                        max_output_bytes=32_000,
                    )
                    health = self.interpret_auth_probe(result, successful_status)
                except OSError as error:
                    health = ProviderHealth(
                        self.name,
                        ProviderStatus.UNAVAILABLE,
                        now,
                        detail=f"health probe could not start: {type(error).__name__}",
                    )
            self._cached_health = health
            return health

    def build_command(
        self,
        request: AgentRequest,
        model: str,
        prompt_path: Path | None,
    ) -> Sequence[str]:
        raise NotImplementedError

    @contextmanager
    def prompt_file(self, prompt: str, directory: Path) -> Iterator[Path | None]:
        del prompt, directory
        yield None

    def prompt_for_stdin(self, prompt: str, prompt_path: Path | None) -> str | None:
        del prompt_path
        return prompt

    @staticmethod
    def _full_prompt(request: AgentRequest) -> str:
        if not request.system_prompt:
            return request.prompt
        return (
            "# Factory control instructions\n\n"
            f"{request.system_prompt}\n\n"
            "# Assigned phase instructions and untrusted task data\n\n"
            f"{request.prompt}"
        )

    def run(self, request: AgentRequest) -> AgentResult:
        started_at = datetime.now(UTC)
        model = self.model_for(request.phase)
        timeout = request.timeout_seconds or 3600
        max_output = request.max_output_bytes or 1_000_000
        full_prompt = self._full_prompt(request)
        try:
            with self.prompt_file(full_prompt, request.cwd) as prompt_path:
                command = self.build_command(request, model, prompt_path)
                result = self._run_process(
                    command,
                    cwd=request.cwd,
                    stdin_text=self.prompt_for_stdin(full_prompt, prompt_path),
                    timeout_seconds=timeout,
                    max_output_bytes=max_output,
                )
        except FileNotFoundError:
            finished_at = datetime.now(UTC)
            return AgentResult(
                self.name,
                request.phase,
                False,
                started_at,
                finished_at,
                127,
                None,
                None,
                AgentFailure(
                    AgentFailureKind.PROVIDER_UNAVAILABLE,
                    f"Command {self.command!r} is not installed on the service PATH",
                    127,
                ),
                self.transport,
                model,
            )
        except OSError as error:
            finished_at = datetime.now(UTC)
            return AgentResult(
                self.name,
                request.phase,
                False,
                started_at,
                finished_at,
                None,
                None,
                None,
                AgentFailure(
                    AgentFailureKind.PROVIDER_TRANSPORT,
                    f"Agent process could not start: {type(error).__name__}",
                ),
                self.transport,
                model,
            )

        finished_at = datetime.now(UTC)
        stdout = redact_agent_output(result.stdout)
        stderr = redact_agent_output(result.stderr)
        summary = stdout[-4000:] or stderr[-4000:] or None
        failure = (
            None
            if result.exit_code == 0 and not result.timed_out
            else classify_process_failure(result)
        )
        return AgentResult(
            provider=self.name,
            phase=request.phase,
            success=failure is None,
            started_at=started_at,
            finished_at=finished_at,
            exit_code=result.exit_code,
            summary=summary,
            output_path=None,
            failure=failure,
            transport=self.transport,
            model=model,
        )


class JsonAuthProbeMixin:
    """Interpret a CLI authentication probe containing a `loggedIn` boolean."""

    name: str

    def interpret_json_auth_probe(self, result: ProcessResult) -> ProviderHealth:
        if result.exit_code != 0:
            failure = classify_process_failure(result)
            return ProviderHealth(
                self.name,
                ProviderStatus.AUTH_REQUIRED,
                datetime.now(UTC),
                detail=failure.message,
            )
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError:
            return ProviderHealth(
                self.name,
                ProviderStatus.AUTH_REQUIRED,
                datetime.now(UTC),
                detail="authentication could not be verified from the malformed probe response",
            )
        logged_in = payload.get("loggedIn") if isinstance(payload, dict) else None
        auth_method = payload.get("authMethod") if isinstance(payload, dict) else None
        if logged_in is True and auth_method == "claude.ai":
            return ProviderHealth(
                self.name,
                ProviderStatus.HEALTHY,
                datetime.now(UTC),
                detail="authenticated with Claude subscription",
            )
        return ProviderHealth(
            self.name,
            ProviderStatus.AUTH_REQUIRED,
            datetime.now(UTC),
            detail="Claude subscription authentication is required",
        )


@contextmanager
def secure_prompt_file(prompt: str, *, directory: Path) -> Iterator[Path]:
    path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            prefix="factory-agent-prompt-",
            suffix=".md",
            dir=directory,
            delete=False,
        ) as handle:
            handle.write(prompt)
            path = Path(handle.name)
        path.chmod(0o600)
        yield path
    finally:
        if path is not None:
            path.unlink(missing_ok=True)
