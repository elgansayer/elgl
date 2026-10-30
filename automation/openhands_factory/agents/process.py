"""Bounded, cancellable subprocess execution for subscription agent CLIs."""

from __future__ import annotations

import math
import os
import select
import signal
import socket
import subprocess
import sys
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, ClassVar

from openhands_factory.agents.process_guard import NAMESPACE_INIT

_ENVIRONMENT_ALLOWLIST = {
    "HOME",
    "LANG",
    "LC_ALL",
    "PATH",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
}

_PROVIDER_PID_PREFIX = (
    "unshare",
    "--user",
    "--map-root-user",
    "--mount",
    "--pid",
    "--fork",
    "--mount-proc",
    "--kill-child",
)

_PROVIDER_SANDBOX_SCRIPT = r"""
set -eu
workspace=$1
repository=$2
state_dir=$3
log_dir=$4
service_home=$5
mount_count=$6
sandbox_root=$7
shift 7

/usr/bin/mount --make-rprivate /
/usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$sandbox_root"
staging=$sandbox_root/factory-provider
for name in workspace repository credentials; do
  /usr/bin/mkdir -p "$staging/$name"
done
/usr/bin/mount --bind "$workspace" "$staging/workspace"
/usr/bin/mount --bind "$repository" "$staging/repository"
/usr/bin/mount -o remount,bind,ro "$staging/repository"

manifest=$staging/mounts
: > "$manifest"
index=0
while [ "$index" -lt "$mount_count" ]; do
  mode=$1
  relative=$2
  shift 2
  source=$service_home/$relative
  if [ -e "$source" ]; then
    staged=$staging/credentials/$index
    if [ -d "$source" ]; then
      /usr/bin/mkdir -p "$staged"
    else
      /usr/bin/mkdir -p "$(/usr/bin/dirname "$staged")"
      : > "$staged"
    fi
    /usr/bin/mount --bind "$source" "$staged"
    if [ "$mode" = ro ]; then
      /usr/bin/mount -o remount,bind,ro "$staged"
    fi
    /usr/bin/printf '%s|%s|%s\n' "$index" "$mode" "$relative" >> "$manifest"
  fi
  index=$((index + 1))
done
for masked_root in /mnt /srv /media; do
  if [ "$masked_root" != "$sandbox_root" ] && [ -d "$masked_root" ]; then
    /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$masked_root"
  fi
done
for container_socket in /run/containerd/containerd.sock /run/docker.sock \
  /run/podman/podman.sock; do
  if [ -S "$container_socket" ]; then
    /usr/bin/mount --bind /dev/null "$container_socket"
  fi
done
[ "$1" = -- ]
shift

if [ -d "$state_dir" ]; then
  /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$state_dir"
fi
if [ -d "$log_dir" ]; then
  /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$log_dir"
fi
/usr/bin/mount -t tmpfs -o mode=755,nosuid,nodev tmpfs /run/user
/usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /tmp
if [ -d /var/tmp ]; then
  /usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /var/tmp
fi
if [ -d /dev/shm ]; then
  /usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /dev/shm
fi
if [ -d /opt/hellotalk-factory ]; then
  /usr/bin/mount --bind /opt/hellotalk-factory /opt/hellotalk-factory
  /usr/bin/mount -o remount,bind,ro /opt/hellotalk-factory
fi

/usr/bin/mkdir -p "$service_home" "$workspace" "$repository"
/usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$service_home"
/usr/bin/chmod 700 "$service_home"
/usr/bin/mkdir -p "$workspace" "$repository"
if [ "$repository" != "$workspace" ]; then
  /usr/bin/mount --bind "$staging/repository" "$repository"
  /usr/bin/mount -o remount,bind,ro "$repository"
fi
/usr/bin/mount --bind "$staging/workspace" "$workspace"
while IFS='|' read -r index mode relative; do
  staged=$staging/credentials/$index
  target=$service_home/$relative
  /usr/bin/mkdir -p "$(/usr/bin/dirname "$target")"
  if [ -d "$staged" ]; then
    /usr/bin/mkdir -p "$target"
  else
    : > "$target"
  fi
  /usr/bin/mount --bind "$staged" "$target"
  if [ "$mode" = ro ]; then
    /usr/bin/mount -o remount,bind,ro "$target"
  fi
done < "$manifest"

cd "$workspace"
exec /usr/bin/setpriv \
  --bounding-set=-all \
  --inh-caps=-all \
  --ambient-caps=-all \
  --no-new-privs \
  -- "$@"
"""


@dataclass(frozen=True)
class ProcessResult:
    command: tuple[str, ...]
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool
    output_truncated: bool
    duration_seconds: float
    cancelled: bool = False


@dataclass(frozen=True)
class ProviderHomeMount:
    """One provider-owned path restored into an otherwise empty service home."""

    relative_path: str
    read_only: bool = False


class _CaptureBuffer:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.size = 0
        self.stdout: list[bytes] = []
        self.stderr: list[bytes] = []
        self.truncated = False
        self.lock = threading.Lock()

    def append(self, stream: str, data: bytes) -> None:
        with self.lock:
            remaining = self.limit - self.size
            if remaining <= 0:
                self.truncated = True
                return
            captured = data[:remaining]
            target = self.stdout if stream == "stdout" else self.stderr
            target.append(captured)
            self.size += len(captured)
            if len(captured) != len(data):
                self.truncated = True


def provider_environment(
    source: Mapping[str, str] | None = None,
    extra: Mapping[str, str] | None = None,
) -> dict[str, str]:
    """Return a minimal environment that preserves local subscription sessions.

    API keys, GitHub credentials and unrelated daemon settings are deliberately
    excluded. This prevents a subscription CLI from silently switching to a PAYG
    API path merely because the service environment contains a vendor key.
    """

    values = os.environ if source is None else source
    environment = {key: values[key] for key in _ENVIRONMENT_ALLOWLIST if key in values}
    environment.setdefault("HOME", str(Path.home()))
    environment.setdefault("PATH", "/usr/local/bin:/usr/bin:/bin")
    environment.setdefault("LANG", "C.UTF-8")
    home = environment["HOME"]
    environment.update(
        {
            "CI": "1",
            "GIT_OPTIONAL_LOCKS": "0",
            "NO_COLOR": "1",
            "TERM": "dumb",
            "TMPDIR": "/tmp",
            "XDG_CACHE_HOME": "/tmp/provider-cache",
            "XDG_CONFIG_HOME": f"{home}/.config",
            "XDG_DATA_HOME": f"{home}/.local/share",
            "XDG_STATE_HOME": "/tmp/provider-state",
        }
    )
    if extra:
        environment.update(extra)
    return environment


class AgentProcessRunner:
    """Run direct CLIs without a shell and terminate their process groups on stop."""

    _processes: ClassVar[set[subprocess.Popen[bytes]]] = set()
    _cancelled_processes: ClassVar[set[subprocess.Popen[bytes]]] = set()
    _processes_lock = threading.Lock()
    _accepting_processes: ClassVar[bool] = True

    def __init__(
        self,
        *,
        isolate_processes: bool = True,
        guard_timeout_seconds: float | None = None,
        heartbeat_check: Callable[[], None] | None = None,
        on_start: Callable[[int], None] | None = None,
    ) -> None:
        if guard_timeout_seconds is not None and (
            not math.isfinite(guard_timeout_seconds) or not 0 < guard_timeout_seconds <= 30
        ):
            raise ValueError("guard timeout must be finite, positive and at most 30 seconds")
        if guard_timeout_seconds is None and (heartbeat_check is not None or on_start is not None):
            raise ValueError("supervision callbacks require a process guard")
        self.isolate_processes = isolate_processes
        self.guard_timeout_seconds = guard_timeout_seconds
        self.heartbeat_check = heartbeat_check
        self.on_start = on_start

    @staticmethod
    def _sandbox_root(
        protected_paths: Sequence[Path],
        *,
        candidates: Sequence[Path] = (Path("/mnt"), Path("/srv"), Path("/media")),
    ) -> Path:
        resolved_paths = tuple(path.resolve() for path in protected_paths)
        for candidate in candidates:
            resolved_candidate = candidate.resolve()
            if not candidate.is_dir():
                continue
            if any(
                protected.is_relative_to(resolved_candidate)
                or resolved_candidate.is_relative_to(protected)
                for protected in resolved_paths
            ):
                continue
            return resolved_candidate
        raise ValueError("No safe provider sandbox staging root is available")

    def _launch_command(
        self,
        command: Sequence[str],
        *,
        cwd: Path,
        env: Mapping[str, str],
        home_mounts: Sequence[ProviderHomeMount],
        lifetime_fd: int | None = None,
    ) -> list[str]:
        if not self.isolate_processes:
            return list(command)
        if self.guard_timeout_seconds is not None:
            if lifetime_fd is None:
                raise ValueError("guarded namespace requires a lifetime descriptor")
            command = [
                str(Path(sys.executable).resolve()),
                "-I",
                "-c",
                NAMESPACE_INIT,
                str(lifetime_fd),
                *command,
            ]
        state_dir = Path(os.environ.get("FACTORY_STATE_DIR", "/var/lib/hellotalk-factory"))
        repository = Path(os.environ.get("FACTORY_REPOSITORY", str(cwd)))
        log_dir = Path(os.environ.get("FACTORY_LOG_DIR", "/var/log/hellotalk-factory"))
        service_home = Path(env.get("HOME", str(Path.home())))
        protected_paths = (cwd, repository, state_dir, log_dir, service_home)
        if any(path.resolve() == Path("/") for path in protected_paths):
            raise ValueError("Provider isolation paths must not resolve to the filesystem root")
        sandbox_root = self._sandbox_root(protected_paths)
        mount_arguments: list[str] = []
        service_home_resolved = service_home.resolve()
        for mount in home_mounts:
            relative = Path(mount.relative_path)
            source = (service_home / relative).resolve()
            if (
                not mount.relative_path
                or relative.is_absolute()
                or relative == Path(".")
                or ".." in relative.parts
                or not source.is_relative_to(service_home_resolved)
                or any(marker in mount.relative_path for marker in ("\x00", "\n", "|"))
            ):
                raise ValueError(f"Unsafe provider home mount: {mount.relative_path!r}")
            mount_arguments.extend(("ro" if mount.read_only else "rw", mount.relative_path))
        return [
            *_PROVIDER_PID_PREFIX,
            "/bin/sh",
            "-c",
            _PROVIDER_SANDBOX_SCRIPT,
            "factory-provider",
            str(cwd.resolve()),
            str(repository.resolve()),
            str(state_dir.resolve()),
            str(log_dir.resolve()),
            str(service_home.resolve()),
            str(len(home_mounts)),
            str(sandbox_root),
            *mount_arguments,
            "--",
            *command,
        ]

    @classmethod
    def _register(cls, process: subprocess.Popen[bytes]) -> None:
        with cls._processes_lock:
            cls._processes.add(process)

    @classmethod
    def _unregister(cls, process: subprocess.Popen[bytes]) -> None:
        with cls._processes_lock:
            cls._processes.discard(process)

    @staticmethod
    def _terminate(process: subprocess.Popen[bytes], grace_seconds: float = 5) -> None:
        if process.poll() is not None:
            return
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            with suppress(subprocess.TimeoutExpired):
                process.wait(timeout=grace_seconds)
            return
        try:
            process.wait(timeout=grace_seconds)
            return
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            with suppress(subprocess.TimeoutExpired):
                process.wait(timeout=grace_seconds)
            return
        try:
            process.wait(timeout=grace_seconds)
        except subprocess.TimeoutExpired:
            with suppress(ProcessLookupError):
                process.kill()
            with suppress(subprocess.TimeoutExpired):
                process.wait(timeout=grace_seconds)

    @classmethod
    def terminate_all(cls) -> None:
        with cls._processes_lock:
            processes = tuple(cls._processes)
            cls._cancelled_processes.update(processes)
        for process in processes:
            cls._terminate(process)

    @classmethod
    def request_shutdown(cls) -> None:
        """Atomically block new starts, then terminate every registered group."""
        with cls._processes_lock:
            cls._accepting_processes = False
            processes = tuple(cls._processes)
            cls._cancelled_processes.update(processes)
        for process in processes:
            cls._terminate(process)

    @classmethod
    def reset_shutdown(cls) -> None:
        """Allow starts for a newly activated singleton daemon generation."""
        with cls._processes_lock:
            cls._accepting_processes = True

    @staticmethod
    def _read_stream(stream: BinaryIO, name: str, capture: _CaptureBuffer) -> None:
        try:
            while data := stream.read(64 * 1024):
                capture.append(name, data)
        finally:
            stream.close()

    @staticmethod
    def _write_stdin(stream: BinaryIO, value: bytes) -> None:
        """Write a prompt without allowing a full pipe to defeat the timeout."""
        try:
            stream.write(value)
            stream.flush()
        except (BrokenPipeError, OSError, ValueError):
            pass
        finally:
            with suppress(OSError):
                stream.close()

    def run(
        self,
        command: Sequence[str],
        *,
        cwd: Path,
        env: Mapping[str, str],
        stdin_text: str | None,
        timeout_seconds: int,
        max_output_bytes: int,
        home_mounts: Sequence[ProviderHomeMount] = (),
    ) -> ProcessResult:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        if max_output_bytes <= 0:
            raise ValueError("max_output_bytes must be positive")
        started = time.monotonic()
        channel: socket.socket | None = None
        peer: socket.socket | None = None
        lifetime: tuple[int, int] | None = None
        if self.guard_timeout_seconds is not None:
            if self.heartbeat_check is not None:
                self.heartbeat_check()
            channel, peer = socket.socketpair()
            channel.setblocking(False)
            lifetime = os.pipe()
        try:
            launch = self._launch_command(
                command,
                cwd=cwd,
                env=env,
                home_mounts=home_mounts,
                lifetime_fd=lifetime[0] if lifetime is not None else None,
            )
            descriptors: tuple[int, ...] = ()
            if peer is not None and lifetime is not None:
                descriptors = (peer.fileno(), *lifetime)
                launch = [
                    str(Path(sys.executable).resolve()),
                    "-I",
                    str(Path(__file__).with_name("process_guard.py").resolve()),
                    "--parent",
                    str(os.getpid()),
                    "--control-fd",
                    str(peer.fileno()),
                    "--life-read",
                    str(lifetime[0]),
                    "--life-write",
                    str(lifetime[1]),
                    "--timeout",
                    str(self.guard_timeout_seconds),
                    *(["--pass-lifetime"] if self.isolate_processes else []),
                    "--",
                    *launch,
                ]
            with self._processes_lock:
                if not self._accepting_processes:
                    raise RuntimeError("Agent process start cancelled during Factory shutdown")
                process = subprocess.Popen(
                    launch,
                    cwd=cwd,
                    env=dict(env),
                    stdin=subprocess.PIPE if stdin_text is not None else subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True,
                    pass_fds=descriptors,
                )
                self._processes.add(process)
        except BaseException:
            if channel is not None:
                channel.close()
            raise
        finally:
            if peer is not None:
                peer.close()
            if lifetime is not None:
                for descriptor in lifetime:
                    os.close(descriptor)
        capture = _CaptureBuffer(max_output_bytes)
        if process.stdout is None or process.stderr is None:
            if channel is not None:
                channel.close()
            self._terminate(process)
            with self._processes_lock:
                self._cancelled_processes.discard(process)
                self._processes.discard(process)
            raise RuntimeError("Agent process pipes were not created")
        readers = (
            threading.Thread(
                target=self._read_stream,
                args=(process.stdout, "stdout", capture),
                daemon=True,
            ),
            threading.Thread(
                target=self._read_stream,
                args=(process.stderr, "stderr", capture),
                daemon=True,
            ),
        )
        for reader in readers:
            reader.start()
        writer = None
        if stdin_text is not None and process.stdin is not None:
            writer = threading.Thread(
                target=self._write_stdin,
                args=(process.stdin, stdin_text.encode("utf-8")),
                daemon=True,
            )
            writer.start()
        timed_out = False
        supervision_failed = False
        try:
            if self.on_start is not None:
                self.on_start(process.pid)
            try:
                if channel is None:
                    process.wait(timeout=timeout_seconds)
                else:
                    timed_out, supervision_failed = self._wait_guarded(
                        process, channel, started + timeout_seconds
                    )
            except subprocess.TimeoutExpired:
                timed_out = True
                self._terminate(process)
        finally:
            self._terminate(process)
            if channel is not None:
                channel.close()
            if writer is not None:
                writer.join(timeout=5)
            if process.stdin is not None and not process.stdin.closed:
                with suppress(OSError):
                    process.stdin.close()
            for reader in readers:
                reader.join(timeout=5)
            with self._processes_lock:
                cancelled = supervision_failed or process in self._cancelled_processes
                self._cancelled_processes.discard(process)
                self._processes.discard(process)

        exit_code = process.returncode if process.returncode is not None else 1
        if timed_out and exit_code == 0:
            exit_code = 124
        if supervision_failed and exit_code == 0:
            exit_code = 125
        return ProcessResult(
            command=tuple(command),
            exit_code=exit_code,
            stdout=b"".join(capture.stdout).decode("utf-8", errors="replace"),
            stderr=b"".join(capture.stderr).decode("utf-8", errors="replace"),
            timed_out=timed_out,
            output_truncated=capture.truncated,
            duration_seconds=time.monotonic() - started,
            cancelled=cancelled,
        )

    def _wait_guarded(
        self,
        process: subprocess.Popen[bytes],
        channel: socket.socket,
        deadline: float,
    ) -> tuple[bool, bool]:
        assert self.guard_timeout_seconds is not None
        last_ack = time.monotonic()
        next_pulse = 0.0
        completed = False
        failed = False
        while True:
            now = time.monotonic()
            # Drain the trusted control channel even after process exit. Neither
            # the model nor its children inherit this descriptor.
            exited = process.poll() is not None
            try:
                readable = select.select([channel], [], [], 0)[0]
                # A completion can arrive between the first poll and this read;
                # check exit before draining, never infer success from exit alone.
                data = channel.recv(4096) if readable else None
            except OSError:
                return False, True
            if data is not None:
                if data:
                    if any(value not in b"ADF" for value in data):
                        return False, True
                    if b"A" in data:
                        last_ack = now
                    completed |= b"D" in data
                    failed |= b"F" in data
                elif not completed:
                    return False, True
            if exited:
                return False, failed or not completed
            if completed:
                try:
                    process.wait(timeout=min(1, max(0, deadline - time.monotonic())))
                except subprocess.TimeoutExpired:
                    return time.monotonic() >= deadline, True
                return False, failed
            if now >= deadline:
                return True, False
            if failed or now - last_ack >= self.guard_timeout_seconds:
                return False, True
            if now >= next_pulse:
                try:
                    if self.heartbeat_check is not None:
                        self.heartbeat_check()
                    channel.sendall(b"H")
                except Exception:
                    return False, True
                next_pulse = now + min(1.0, self.guard_timeout_seconds / 4)
            time.sleep(min(0.05, max(0, deadline - time.monotonic())))


def agent_process_isolation_probe() -> tuple[bool, str]:
    """Prove a direct provider cannot inspect host or sibling process state."""

    environment = {
        "HOME": os.environ.get("HOME", "/var/empty"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
    }
    try:
        result = subprocess.run(
            (
                *_PROVIDER_PID_PREFIX,
                "/bin/sh",
                "-c",
                'set -- /proc/[0-9]*; [ "$#" -eq 1 ] && [ "$$" -eq 1 ]',
            ),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
            env=environment,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return False, f"provider process isolation could not start: {type(error).__name__}"
    if result.returncode != 0:
        detail = f"{result.stdout}\n{result.stderr}".strip()[-1000:]
        return False, detail or f"provider process isolation exited {result.returncode}"
    return True, "private PID and proc namespaces are available"
