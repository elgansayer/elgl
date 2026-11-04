"""Real owned Unix-WebSocket peers; never contact a model or shared daemon."""

import hashlib
import json
import socket
import threading
import time
from contextlib import contextmanager
from dataclasses import replace

import pytest
from websockets.exceptions import ConnectionClosed
from websockets.sync.server import unix_serve

from openhands_factory import codex_observer as module
from openhands_factory.codex_observer import ObserverBounds, observe_codex


@contextmanager
def peer(tmp_path, responder):
    path = tmp_path / "control.sock"
    requests, failures = [], []

    def handle(channel):
        try:
            for raw in channel:
                request = json.loads(raw)
                requests.append(request)
                assert request["method"] in {
                    "initialize",
                    "initialized",
                    "thread/loaded/list",
                    "thread/read",
                }
                if request["method"] == "initialized":
                    assert "id" not in request
                    continue
                if request["method"] == "thread/read":
                    assert request["params"]["includeTurns"] is False
                reply = responder(request, channel)
                if reply is not None:
                    channel.send(reply if isinstance(reply, (str, bytes)) else json.dumps(reply))
        except ConnectionClosed:
            pass
        except BaseException as error:
            failures.append(error)

    with unix_serve(handle, str(path), compression=None, close_timeout=0.1) as server:
        path.chmod(0o600)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        try:
            yield path, requests
        finally:
            server.shutdown()
            worker.join(timeout=2)
            assert not worker.is_alive()
            assert failures == []


def valid(request, _channel):
    method = request["method"]
    if method == "initialize":
        result = {"userAgent": "private diagnostic"}
    elif method == "thread/loaded/list":
        result = {"data": ["private-id"], "nextCursor": None}
    else:
        result = {
            "thread": {
                "id": request["params"]["threadId"],
                "status": {"type": "active"},
                "turns": [],
                "preview": "secret prompt",
                "cwd": "/private/cwd",
                "title": "secret title",
                "modelProvider": "private provider",
            }
        }
    return {"id": request["id"], "result": result}


def assert_unknown(report):
    assert report["inventory_complete"] is False
    assert report["error"]
    assert "loaded_threads" not in report and "threads" not in report
    assert not report["account_wide_coverage_proven"]
    assert not report["continuity_authorised"]
    assert report["model_calls"] == 0


def test_real_pagination_private_symlink_and_redacted_statuses(tmp_path):
    def paginated(request, channel):
        response = valid(request, channel)
        if request["method"] == "thread/loaded/list":
            cursor = request["params"]["cursor"]
            response["result"] = {
                "data": ["private-id"] if cursor is None else ["second", "third"],
                "nextCursor": "cursor" if cursor is None else None,
            }
        elif request["method"] == "thread/read":
            response["result"]["thread"]["status"]["type"] = {
                "private-id": "active",
                "second": "idle",
                "third": "systemError",
            }[request["params"]["threadId"]]
        return response

    with peer(tmp_path, paginated) as (path, requests):
        link = tmp_path / "rendezvous"
        link.symlink_to(path)
        report = observe_codex(link)
    assert report["inventory_complete"]
    assert report["status_counts"] == {"active": 1, "idle": 1, "systemError": 1}
    assert report["loaded_threads"] == 3
    assert report["threads"][0]["id_sha256"] == hashlib.sha256(b"private-id").hexdigest()
    serialised = json.dumps(report)
    for private in (
        "private-id",
        "secret prompt",
        "secret title",
        "/private/cwd",
        "private provider",
        "private diagnostic",
        "cursor",
    ):
        assert private not in serialised
    assert [row["method"] for row in requests] == [
        "initialize",
        "initialized",
        "thread/loaded/list",
        "thread/loaded/list",
        "thread/read",
        "thread/read",
        "thread/read",
    ]
    assert not report["account_wide_coverage_proven"]
    assert not report["threads_correlated_with_leases"]


@pytest.mark.parametrize(
    "damage",
    [
        "identity",
        "status",
        "status_object",
        "not_loaded",
        "history",
        "duplicate_ids",
        "excess_ids",
        "missing_cursor",
        "repeat_cursor",
        "page_bound",
        "bad_ids",
        "bad_cursor",
        "duplicate_fields",
        "malformed",
        "binary",
        "remote_error",
        "server_request",
        "wrong_id",
        "missing_result",
        "invalid_notification",
    ],
)
def test_real_peer_invalid_or_partial_inventory_never_becomes_zero(tmp_path, damage):
    def damaged(request, channel):
        response = valid(request, channel)
        if request["method"] == "thread/loaded/list":
            if damage == "duplicate_ids":
                response["result"]["data"] *= 2
            elif damage == "excess_ids":
                response["result"]["data"] = ["first", "second"]
            elif damage == "missing_cursor":
                del response["result"]["nextCursor"]
            elif damage in {"repeat_cursor", "page_bound"}:
                response["result"] = {"data": [], "nextCursor": "next"}
            elif damage == "bad_ids":
                response["result"]["data"] = [5]
            elif damage == "bad_cursor":
                response["result"]["nextCursor"] = {}
            elif damage == "duplicate_fields":
                return '{"id":2,"id":2,"result":{}}'
            elif damage == "malformed":
                return "{"
            elif damage == "binary":
                return b"private remote bytes"
            elif damage == "remote_error":
                return {"id": request["id"], "error": "private remote error"}
            elif damage == "server_request":
                return {"id": request["id"], "method": "approval/request"}
            elif damage == "wrong_id":
                response["id"] = True
            elif damage == "missing_result":
                return {"id": request["id"]}
            elif damage == "invalid_notification":
                return {"params": "private notification"}
        elif request["method"] == "thread/read":
            thread = response["result"]["thread"]
            if damage == "identity":
                thread["id"] = "another"
            elif damage == "status":
                thread["status"]["type"] = ["active"]
            elif damage == "status_object":
                thread["status"] = None
            elif damage == "not_loaded":
                thread["status"]["type"] = "notLoaded"
            elif damage == "history":
                thread["turns"] = [{"text": "private history"}]
        return response

    limits = ObserverBounds(threads=1, pages=1 if damage == "page_bound" else 2)
    with peer(tmp_path, damaged) as (path, _):
        report = observe_codex(path, bounds=limits)
    assert_unknown(report)
    assert "private" not in json.dumps(report)


@pytest.mark.parametrize("budget", ["frame", "total", "notifications", "deadline"])
def test_real_peer_bounded_reads(tmp_path, budget):
    def noisy(request, channel):
        if request["method"] == "thread/loaded/list":
            if budget == "deadline":
                time.sleep(0.2)
            else:
                count = 3 if budget == "notifications" else 1
                for _ in range(count):
                    channel.send(json.dumps({"method": "ignored", "params": "x" * 300}))
        return valid(request, channel)

    limits = replace(
        ObserverBounds(),
        **{
            "frame": {"frame_bytes": 200},
            "total": {"total_bytes": 200},
            "notifications": {"notifications": 2},
            "deadline": {"seconds": 0.05},
        }[budget],
    )
    with peer(tmp_path, noisy) as (path, _):
        report = observe_codex(path, bounds=limits)
    assert_unknown(report)
    assert report["elapsed_seconds"] < 2


def test_missing_regular_and_public_socket_are_rejected_without_rpc(tmp_path):
    assert_unknown(observe_codex(tmp_path / "absent"))
    plain = tmp_path / "plain"
    plain.touch(mode=0o600)
    assert observe_codex(plain)["error"] == "unsafe_control_socket"
    with peer(tmp_path, valid) as (path, requests):
        path.chmod(0o666)
        assert observe_codex(path)["error"] == "unsafe_control_socket"
        assert requests == []


def test_unsupported_and_mismatched_peer_identity_fail_without_rpc(tmp_path, monkeypatch):
    with peer(tmp_path, valid) as (path, requests):
        with monkeypatch.context() as patch:
            patch.delattr(socket, "SO_PEERCRED")
            assert observe_codex(path)["error"] == "peer_identity_unavailable"
        real_unpack = module.struct.unpack
        monkeypatch.setattr(
            module.struct,
            "unpack",
            lambda fmt, data: (1, -1, 1) if fmt == "3i" else real_unpack(fmt, data),
        )
        assert observe_codex(path)["error"] == "wrong_control_peer"
        assert requests == []


@pytest.mark.parametrize(
    "changes",
    [
        {"seconds": True},
        {"seconds": float("nan")},
        {"seconds": 61},
        {"pages": 0},
        {"threads": 251},
        {"frame_bytes": 1048577},
        {"total_bytes": 8388609},
        {"notifications": True},
    ],
)
def test_invalid_bounds_are_rejected(changes):
    with pytest.raises(ValueError):
        ObserverBounds(**changes)
