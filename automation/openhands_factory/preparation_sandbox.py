"""Coordinator-only tool preparation; candidate verification stays offline."""

from __future__ import annotations

import os
import subprocess
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path

from openhands_factory.agents.process import AgentProcessRunner, ProviderHomeMount
from openhands_factory.agents.process_guard import NAMESPACE_INIT
from openhands_factory.repository_guard import ProcessResult

_SCRIPT = r"""
set -eu
umask 077
work=$1
cache=$2
stage=$3
network=$4
lifetime=$5
init_source=$6
shift 6
/usr/bin/mount --make-rprivate /
/usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$stage"
/usr/bin/mkdir -p "$stage/work" "$stage/cache"
/usr/bin/mount --bind "$work" "$stage/work"
/usr/bin/mount --bind "$cache" "$stage/cache"
# Debian's resolver may point inside /run. Preserve only that read-only file,
# never systemd/DBus/container control sockets or the surrounding service state.
resolver_target=
if [ "$network" = networked ] && [ -f /etc/resolv.conf ]; then
 resolver_target=$(/usr/bin/readlink -f /etc/resolv.conf)
 : > "$stage/resolv.conf"
 /usr/bin/mount --bind /etc/resolv.conf "$stage/resolv.conf"
fi
for root in /home /root /etc/repo-factory /etc/hellotalk-factory \
 /var/lib/repo-factory /var/log/repo-factory \
 /var/lib/hellotalk-factory /var/log/hellotalk-factory; do
 if [ -d "$root" ]; then /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$root"; fi
done
for root in /mnt /srv /media; do
 if [ "$root" != "$stage" ] && [ -d "$root" ]; then
  /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$root"
 fi
done
/usr/bin/mount -t tmpfs -o mode=755,nosuid,nodev tmpfs /run
/usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /tmp
for root in /var/tmp /dev/shm; do
 if [ -d "$root" ]; then /usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs "$root"; fi
done
if [ -d /opt ]; then
 /usr/bin/mount --bind /opt /opt
 /usr/bin/mount -o remount,bind,ro /opt
fi
if [ -n "$resolver_target" ]; then
 /usr/bin/mkdir -p "$(/usr/bin/dirname "$resolver_target")"
 if [ ! -e "$resolver_target" ]; then : > "$resolver_target"; fi
 /usr/bin/mount --bind "$stage/resolv.conf" "$resolver_target"
 /usr/bin/mount -o remount,bind,ro "$resolver_target"
fi
/usr/bin/mkdir -p "$work" "$cache" /tmp/home
/usr/bin/mount --bind "$stage/work" "$work"
/usr/bin/mount --bind "$stage/cache" "$cache"
/usr/bin/mount --bind "$work/source" "$work/source"
/usr/bin/mount -o remount,bind,ro "$work/source"
if [ "$network" = offline ]; then /usr/sbin/ip link set lo up; fi
cd "$work"
ulimit -c 0
# Never increase a stricter inherited soft/hard resource allowance.
memory_limit=$(ulimit -v)
if [ "$memory_limit" = unlimited ] || [ "$memory_limit" -gt 3145728 ]; then
 ulimit -v 3145728
fi
file_limit=$(ulimit -f)
if [ "$file_limit" = unlimited ] || [ "$file_limit" -gt 524288 ]; then
 ulimit -f 524288
fi
# Reuse the provider guardian's trusted PID1 and private lifetime pipe. The
# recipe inherits neither the pipe nor any control socket.
exec /usr/bin/python3 -c "$init_source" "$lifetime" /usr/bin/setpriv \
 --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs -- "$@"
"""


class _PreparationRunner(AgentProcessRunner):
    def __init__(
        self,
        work: Path,
        cache: Path,
        stage: Path,
        network: bool,
        on_start: Callable[[int], None] | None,
    ) -> None:
        super().__init__(guard_timeout_seconds=5, on_start=on_start)
        self.work, self.cache, self.stage, self.network = work, cache, stage, network

    def _launch_command(
        self,
        command: Sequence[str],
        *,
        cwd: Path,
        env: Mapping[str, str],
        home_mounts: Sequence[ProviderHomeMount],
        lifetime_fd: int | None = None,
    ) -> list[str]:
        if lifetime_fd is None:
            raise ValueError("Preparation requires its guarded lifetime pipe")
        return [
            "unshare",
            "--user",
            "--map-root-user",
            "--mount",
            "--pid",
            "--fork",
            "--mount-proc",
            "--kill-child",
            *(("--net",) if not self.network else ()),
            "/bin/sh",
            "-c",
            _SCRIPT,
            "factory-tool-preparation",
            str(self.work),
            str(self.cache),
            str(self.stage),
            "networked" if self.network else "offline",
            str(lifetime_fd),
            NAMESPACE_INIT,
            *command,
        ]


def run_preparation(
    arguments: tuple[str, ...],
    *,
    work: Path,
    cache: Path,
    network: bool,
    timeout: int,
    on_start: Callable[[int], None] | None = None,
) -> ProcessResult:
    """Only coordinator-selected trusted source may receive network=True.

    The work directory must contain the immutable accepted `source` snapshot.
    Never call this with an issue's command or an implementation worktree.
    """
    work, cache = work.resolve(), cache.resolve()
    if (
        work == Path("/")
        or cache == Path("/")
        or work.is_relative_to(cache)
        or cache.is_relative_to(work)
        or not (work / "source").is_dir()
        or not cache.is_dir()
        or type(network) is not bool
        or not 0 < timeout <= 1800
    ):
        raise ValueError("Invalid preparation sandbox roots or bounds")
    stage = next(
        (
            path
            for path in (Path("/srv"), Path("/media"))
            if not any(root.is_relative_to(path) for root in (work, cache))
        ),
        None,
    )
    if stage is None:
        raise ValueError("No safe preparation staging root")
    environment = {
        "HOME": "/tmp/home",
        "PATH": os.defpath,
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": "/dev/null",
        "GIT_TERMINAL_PROMPT": "0",
    }
    if network:
        for key in (
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "NO_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
            "no_proxy",
            "SSL_CERT_FILE",
            "SSL_CERT_DIR",
            "REQUESTS_CA_BUNDLE",
            "CURL_CA_BUNDLE",
            "GIT_SSL_CAINFO",
        ):
            if key in os.environ:
                environment[key] = os.environ[key]
    result = _PreparationRunner(work, cache, stage, network, on_start).run(
        arguments,
        cwd=work,
        env=environment,
        stdin_text=None,
        timeout_seconds=timeout,
        max_output_bytes=1024 * 1024,
    )
    if result.timed_out:
        raise subprocess.TimeoutExpired(arguments, timeout)
    if result.output_truncated:
        raise ValueError("Preparation output exceeded its byte bound")
    return ProcessResult(result.exit_code, result.stdout, result.stderr)
