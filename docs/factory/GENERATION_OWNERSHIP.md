# Factory Generation Ownership

The VPS has exactly one authoritative OpenHands Factory control plane. The retired AI swarm has no ownership role.

The existing host-level `factory.lock` prevents two daemon processes from starting as authoritative at the same time. After acquiring that lock, the daemon creates a unique generation identifier and writes `generation.json`. That identifier is copied into `FACTORY_GENERATION` for every pipeline and provider conversation created by that daemon.

Before scheduling work, starting the architect, or writing its heartbeat, the daemon rechecks `generation.json`. If another deployment has replaced the identifier, the stale daemon fails closed instead of mutating the current queue.

`daemon.json` exposes the generation, runtime version, durable-state schema version, PID and hostname so operator diagnostics identify exactly which Factory instance is authoritative.

## Durable state schema

`state-schema.json` is the durable-state compatibility manifest. A missing manifest is initialized at the current schema version. An unknown schema version is never silently interpreted: the incompatible manifest is moved to a timestamped `state-schema.incompatible-*.json` quarantine file and daemon activation fails.

Future changes to jobs, leases, reviews, provider attribution, or queue state that require incompatible persistence changes must increment the schema version and provide an explicit migration before deployment.

## Upgrade sequence

1. Stop or restart the systemd Factory service through the normal deployment path.
2. The old process releases `factory.lock` as it exits.
3. The replacement process acquires the lock, validates the durable-state schema, creates a new generation, and rebuilds its pipeline with that generation ID.
4. Any stale process that somehow continues executing fails its generation check before further scheduling or heartbeat writes.
5. Provider attribution created by the new process carries the same generation identifier.

Rollback follows the same ownership transition. A rollback binary must support the durable-state schema already present; otherwise it fails closed rather than guessing how to read newer state.
