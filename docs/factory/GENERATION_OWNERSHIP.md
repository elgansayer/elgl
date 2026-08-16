# OpenHands Factory generation ownership

The VPS must have exactly one authoritative OpenHands Factory daemon. The retired AI swarm has no queue, lease, review, alerting, credential or merge authority.

## Single-instance ownership

The Factory already uses an exclusive `factory.lock` under the Factory state directory. Startup fails when another daemon owns that lock.

Each successful daemon start now also creates a unique generation identifier and publishes it to `generation.json` only after acquiring the host lock. The daemon heartbeat includes the same generation, runtime version, schema version, PID, hostname and start time.

Before every scheduling loop and heartbeat write, the daemon verifies that its generation is still the active generation. If another deployment publishes a newer generation, the stale process fails closed instead of continuing to schedule or mutate queue state.

## Durable-state schema

`STATE_SCHEMA_VERSION` is the explicit compatibility contract for Factory-owned durable state. Unknown state schema versions must not be silently interpreted by a newer or older daemon. Future schema changes must include a deliberate migration or quarantine path before the schema number changes.

## Upgrade contract

1. Pause or stop the active daemon.
2. Build and validate the replacement virtual environment.
3. Run Factory tests and `doctor --online`.
4. Restart through systemd.
5. Confirm that `generation.json` and `daemon.json` report the same new generation.
6. Confirm the expected runtime/schema versions and service PID.
7. Roll back the virtualenv symlink and restart if the new generation fails health checks.

Never run two manually-started Factory daemons to achieve zero-downtime deployment. The Factory is a single-controller scheduler; work concurrency belongs inside that controller.

## Operator verification

`hellotalk-factory status` exposes the daemon heartbeat, including generation ownership. Compare it with `/var/lib/hellotalk-factory/generation.json` when diagnosing a stale process.

A generation mismatch is an ownership failure, not a recoverable provider error. Stop the stale process and allow systemd to keep one authoritative daemon.
