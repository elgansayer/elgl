# Read-only supervised-session audit

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
