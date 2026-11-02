"""Bounded metadata-only observation of an existing local Codex app-server."""

from __future__ import annotations

import hashlib
import json
import os
import socket
import stat
import struct
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from websockets.exceptions import WebSocketException
from websockets.sync.client import unix_connect
from websockets.sync.connection import Connection


@dataclass(frozen=True)
class ObserverBounds:
    seconds: float = 15
    threads: int = 100
    pages: int = 4
    frame_bytes: int = 131072
    total_bytes: int = 1048576
    notifications: int = 32

    def __post_init__(self) -> None:
        if type(self.seconds) not in (int, float) or not 0 < self.seconds <= 60:
            raise ValueError("Invalid metadata deadline")
        for value, maximum in (
            (self.threads, 250),
            (self.pages, 10),
            (self.frame_bytes, 1048576),
            (self.total_bytes, 8388608),
            (self.notifications, 256),
        ):
            if type(value) is not int or not 0 < value <= maximum:
                raise ValueError("Invalid metadata bound")


class ObservationError(ValueError):
    """Messages are fixed diagnostic codes, never remote payloads."""


def _fields(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ObservationError("duplicate_json_field")
        result[key] = value
    return result


def _object(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ObservationError("invalid_metadata_object")
    return value


class _Reader:
    def __init__(self, channel: Connection, bounds: ObserverBounds, deadline: float) -> None:
        self.channel, self.bounds, self.deadline = channel, bounds, deadline
        self.sequence = self.received = self.notifications = 0

    def request(self, method: str, params: dict[str, object]) -> dict[str, object]:
        if method not in {"initialize", "thread/loaded/list", "thread/read"}:
            raise ObservationError("forbidden_rpc")
        self.sequence += 1
        self.channel.send(json.dumps({"id": self.sequence, "method": method, "params": params}))
        while True:
            remaining = self.deadline - time.monotonic()
            if remaining <= 0:
                raise ObservationError("metadata_deadline")
            raw = self.channel.recv(timeout=remaining)
            if not isinstance(raw, str):
                raise ObservationError("binary_metadata_frame")
            size = len(raw.encode("utf-8"))
            self.received += size
            if size > self.bounds.frame_bytes or self.received > self.bounds.total_bytes:
                raise ObservationError("metadata_byte_budget")
            row = _object(json.loads(raw, object_pairs_hook=_fields))
            if "id" not in row:
                self.notifications += 1
                if not isinstance(row.get("method"), str):
                    raise ObservationError("invalid_notification")
                if self.notifications > self.bounds.notifications:
                    raise ObservationError("notification_budget")
                continue
            if type(row["id"]) is not int or row["id"] != self.sequence or "method" in row:
                raise ObservationError("unexpected_rpc_response")
            if "error" in row or "result" not in row:
                raise ObservationError("metadata_rpc_error")
            return _object(row["result"])

    def loaded_ids(self) -> list[str]:
        ids: list[str] = []
        cursor: object = None
        cursors: set[str] = set()
        for _ in range(self.bounds.pages):
            row = self.request("thread/loaded/list", {"limit": 50, "cursor": cursor})
            values = row.get("data")
            if not isinstance(values, list) or any(
                not isinstance(value, str) or not 0 < len(value) <= 256 for value in values
            ):
                raise ObservationError("invalid_loaded_ids")
            ids.extend(values)
            if len(ids) > self.bounds.threads or len(ids) != len(set(ids)):
                raise ObservationError("duplicate_or_excess_threads")
            if "nextCursor" not in row:
                raise ObservationError("missing_pagination_evidence")
            cursor = row["nextCursor"]
            if cursor is None:
                return ids
            if not isinstance(cursor, str) or not 0 < len(cursor) <= 1024 or cursor in cursors:
                raise ObservationError("invalid_pagination_cursor")
            cursors.add(cursor)
        raise ObservationError("incomplete_loaded_inventory")


def observe_codex(socket_path: Path, *, bounds: ObserverBounds | None = None) -> dict[str, object]:
    """Never start/resume/interrupt a turn or correlate threads with broker leases.

    A success is a complete bounded inventory of this daemon's loaded metadata,
    observed across requests. It is neither an atomic snapshot nor account-wide
    admission. Errors discard partial counts rather than reporting zero.
    """
    limits = bounds or ObserverBounds()
    report: dict[str, object] = {
        "schema": "repo-factory.codex-observer.v1",
        "scope": "specified existing local daemon; loaded metadata only; non-atomic observations",
        "inventory_complete": False,
        "account_wide_coverage_proven": False,
        "continuity_authorised": False,
        "threads_correlated_with_leases": False,
        "model_calls": 0,
    }
    started = time.monotonic()
    try:
        info = socket_path.stat()
        if (
            not stat.S_ISSOCK(info.st_mode)
            or info.st_uid != os.geteuid()
            or stat.S_IMODE(info.st_mode) & 0o077
        ):
            raise ObservationError("unsafe_control_socket")
        if not hasattr(socket, "SO_PEERCRED"):
            raise ObservationError("peer_identity_unavailable")
        with unix_connect(
            path=str(socket_path),
            uri="ws://localhost",
            open_timeout=min(5, limits.seconds),
            close_timeout=1,
            max_size=limits.frame_bytes,
            compression=None,
            proxy=None,
            ping_interval=None,
        ) as channel:
            peer = channel.socket.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12)
            if struct.unpack("3i", peer)[1] != os.geteuid():
                raise ObservationError("wrong_control_peer")
            reader = _Reader(channel, limits, started + limits.seconds)
            reader.request(
                "initialize",
                {
                    "clientInfo": {"name": "repo_factory_readonly_observer", "version": "0.1.0"},
                    "capabilities": {
                        "optOutNotificationMethods": [
                            "item/agentMessage/delta",
                            "item/reasoning/textDelta",
                        ]
                    },
                },
            )
            channel.send(json.dumps({"method": "initialized", "params": {}}))
            ids = reader.loaded_ids()
            rows = []
            for thread_id in ids:
                result = reader.request(
                    "thread/read", {"threadId": thread_id, "includeTurns": False}
                )
                thread = _object(result.get("thread"))
                if thread.get("id") != thread_id:
                    raise ObservationError("thread_identity_mismatch")
                if thread.get("turns") not in (None, []):
                    raise ObservationError("unexpected_history")
                kind = _object(thread.get("status")).get("type")
                if not isinstance(kind, str) or kind not in {"active", "idle", "systemError"}:
                    raise ObservationError("unknown_or_changed_runtime_status")
                rows.append(
                    {"id_sha256": hashlib.sha256(thread_id.encode()).hexdigest(), "status": kind}
                )
            report.update(
                inventory_complete=True,
                loaded_threads=len(rows),
                status_counts=dict(Counter(str(row["status"]) for row in rows)),
                threads=rows,
                received_bytes=reader.received,
                error=None,
            )
    except ObservationError as error:
        report["error"] = str(error)
    except (OSError, TimeoutError, ValueError, RecursionError, WebSocketException):
        report["error"] = "connection_or_metadata_failure"
    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
    return report
