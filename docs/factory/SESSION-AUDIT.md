# Read-only supervised-session audit

## Optional existing Codex daemon observation

Pass an explicit private Unix control socket to add a bounded metadata read:

```sh
repo-factory sessions audit --codex-socket /path/to/existing/control.sock
```

The observer uses WebSocket framing over the existing Unix socket. It checks
socket ownership, private permissions and Linux peer credentials, then permits
only `initialize`, `initialized`, `thread/loaded/list` and `thread/read` with
`includeTurns: false`. It never launches a daemon, resumes/subscribes to a
thread, starts or interrupts a turn, requests history or writes accounting.
The installed locked `websockets` dependency is declared directly without a
version change.

Default bounds are 15 seconds plus bounded connection cleanup, 100 threads,
four pages, 128 KiB per response frame, 1 MiB total response data and 32 ignored
notifications. Invalid, partial, duplicate, unavailable or raced metadata is
unknown, with no partial count reported as zero. Output contains only counts,
known status enums, hashed IDs and fixed diagnostics. Preview, title, working
directory, provider fields and arbitrary remote errors are omitted.

Loaded thread observations span requests and are not an atomic snapshot. Any
loaded threads fail audit consistency because no lease correlation has been
established, including idle threads. An empty loaded list covers only this
daemon at observation time. Account-wide coverage and continuity authority
remain false, even on success. Standalone CLIs, other daemons and remote or GUI
sessions remain outside this scope. This is diagnosis, not model admission.

Codex's [app-server interface](https://learn.chatgpt.com/docs/app-server) supports
the metadata read. Its [hooks documentation](https://learn.chatgpt.com/docs/hooks)
describes model-request hooks as observational. Hook bookkeeping alone cannot
enforce shared account admission. Managed launch, interruption and restart
remain separate acceptance work; do not install hooks or enable continuity on
the strength of this audit.

## Checkpoint and lease reconciliation

Neptune #627 is a diagnostic prerequisite of #536. Use the existing operator
configuration and shared broker through the installed command:

```sh
repo-factory sessions audit
```

It reads `<state_dir>/manual-session-identities` and the configured shared
`provider-capacity.json`, using the same maximum lease bound as the router. It
does not run provider/auth probes, renew/release/acquire leases, adopt or signal
processes, change health/quotas or start a daemon. It acquires the existing broker
file lock for a bounded two seconds; an absent lock file can be created by that
locking mechanism. No capacity or identity data is written. A missing journal is
reported rather than created. Existing default commands are unchanged.

The JSON reports session UUID, provider, guardian PID, verified live identity,
current token ownership and status. It omits lease tokens, owners, prompts,
commands, exception text and credentials. An empty journal is not proof that
manual Codex/Claude/Antigravity participants are enrolled. Every report explicitly
sets `account_wide_coverage_proven` and `continuity_authorised` to false.

Statuses distinguish live guardian/current lease, live guardian/missing lease,
dead guardian/retained lease, historical dead guardian, and unknown lease state.
The exact token must appear once in current compatible entries. A successor
reservation with the same owner is not proof of ownership. Unexpired entries
outside the configured reader envelope are counted separately and fail the audit.
The process and broker observations are point-in-time evidence, not a permission
to dispatch or a guarantee that either remains live after the read.

The broker audit uses a bounded private regular **current primary** under its
existing lock. It rejects unsafe files, duplicate JSON fields and malformed time
envelopes. Unlike recoverable operational state reads, it cannot use an older
backup as proof that a released token still exists. Journal loading retains the
existing no-follow/private/immutable schema checks. Enumeration is limited to
1,000 entries; exceeding that limit fails without deleting historical evidence.
Choose any future retention policy separately, preserving active sessions.

Exit zero means only that retained observations are internally consistent. Dead
historical records are expected; malformed evidence, unknown current state, live
guardians without leases and retained leases without guardians return nonzero.
Actual outside-protocol session enrolment, namespace containment, provider health,
guarded restart recovery and Neptune continuity remain separate acceptance gates.

`tests/test_session_audit.py` uses owned real subprocesses and private stores,
including a fresh interpreter, stale successor tokens, expiry, mismatched reader
bounds, dead processes, corrupt/missing/unsafe primary data and bounded/private
journals. These are control-tool tests, not a model, emulator or game health check.
