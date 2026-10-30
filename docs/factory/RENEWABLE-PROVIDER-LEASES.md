# Renewable provider capacity: protocol 1

`ProviderCapacityStore.acquire_renewable()` is a broker primitive for a supervised
manual-session launcher. It does not launch an agent, enrol existing sessions,
increase provider limits, install a service or enable continuous scheduling.
Neptune issue [536](https://github.com/elgansayer/Neptune-Bomberman/issues/536)
tracks that remaining integration and its live acceptance evidence.

## Compatibility and ownership

Use the same shared capacity directory, provider key and existing account limit
as the factory router. Shared participants must not use per-daemon generation
filtering. The protocol adds `lease_protocol` and a random `lease_token` to the
existing entry format. Existing readers continue to count the legacy
`acquired_at`/`expires_at` envelope; no new capacity pool is created.

Each reservation lasts at most 60 seconds and cannot exceed the store's configured
maximum. All participating readers must accept that interval. In particular, a
60-second reservation is visible to the existing 3,900-second production reader;
writing a 3,960-second reservation with a more permissive writer is unsafe.
`renew()` atomically refreshes both legacy timestamps, so a long-running session
does not become invisible after the original start plus the reader's bound.

The frozen `RenewableCapacityLease` handle includes protocol version, canonical
store path, provider, owner, duration and random ownership token. Persist
`dataclasses.asdict(handle)` using the existing atomic JSON writer in a private
operator checkpoint, outside repositories and prompts. Reconstruct with
`RenewableCapacityLease(**payload)` in a replacement supervisor. This handle is
coordination state, not a provider credential. It must still remain private to
prevent accidental ownership reuse.

A live owner cannot acquire a second renewable reservation for the same provider.
Renewal requires exactly one matching live entry. Expired or lost ownership
raises `ProviderCapacityUnavailable` and never silently reacquires capacity.
`release_renewable(handle)` matches the token as well as the owner; stale cleanup
cannot release a replacement reservation with the same owner. Repeated release
returns false. Use this fenced release rather than the legacy owner-only release.
Unrelated provider and factory reservations remain intact.

## Required launcher contract before deployment

The supervisor must acquire before starting provider work, heartbeat well inside
the lease interval and reserve a bounded shutdown margin. For a 60-second lease,
a proposed 15-second heartbeat and at most 10-second child shutdown leave margin;
these timings require actual runtime proof before enabling continuity. A missed
heartbeat, state I/O error or lost ownership must stop the supervised provider
process group before its lease expires, not leave a live uncounted session.

A recovered supervisor must validate the persisted process identity and ownership
before renewing. A fresh token must not adopt an unproven existing process. On
normal exit, drain the provider process and then release the token. Supervisor
crash windows need an independent bounded watchdog; expiration alone is not proof
that a model process has stopped. Sessions already running outside this protocol
are not automatically counted and must be integrated without dropping live work.

## Validation boundary

`tests/test_renewable_provider_capacity.py` checks long-session visibility against
a 3,900-second reader, expiry without resurrection, duplicate-owner admission,
stale-token fencing, scope/version validation, unrelated-entry preservation,
fresh-process recovery of a persisted handle and three real processes contending
for two shared slots. Tests use private temporary broker state and no model calls.
They do not establish that existing manual Codex, Claude or Antigravity sessions
are enrolled, that vendor quota is available or that Neptune continuity is safe.
