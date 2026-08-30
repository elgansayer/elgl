# Factory autonomous retry policy

The Factory must remain fully machine-operated. A task failure must never create a durable state that requires a person to release, requeue, approve, or triage it before work can continue.

## Zero-quarantine invariant

Current Factory write paths do not persist `quarantined` jobs. Repeated identical task-side failures remain in the machine-owned pipeline and receive a durable `next_attempt_at` deadline instead.

The repeated-failure threshold is therefore a **backoff escalation threshold**, not a terminal-state threshold.

With the production threshold of three repeated identical failures, the chronic-failure floor is:

- third identical failure: 30 minutes
- fourth: 1 hour
- fifth: 2 hours
- sixth: 4 hours
- seventh: 8 hours
- eighth: 16 hours
- ninth and later: 24 hours

The ordinary failure-class exponential backoff still applies. The effective delay is the larger of the ordinary retry delay and the chronic-failure floor, capped at 24 hours.

This preserves autonomous recovery while preventing a deterministic failure from consuming subscription-backed agent routes every few minutes.

## Evidence preservation

Backoff does not erase diagnostic state. The Factory preserves:

- attempt counters;
- failure-class counters;
- stable failure fingerprints;
- repeated-failure counts;
- provider history and failover evidence;
- review findings;
- the latest task error;
- repository and pull-request progress already recorded on the job.

Meaningful pipeline progress continues to reset stale retry diagnostics through the existing retry policy.

## Rolling-upgrade compatibility

Older installations may already have persisted `quarantined` records or GitHub quarantine labels. Those are treated strictly as legacy input.

On load or daemon recovery, a legacy record is converted to `discovered` plus the same bounded autonomous retry deadline derived from its persisted failure evidence. The migration removes quarantine metadata but keeps the underlying failure history. If its calculated retry deadline already passed, the task becomes runnable immediately.

Current persistence also normalizes any legacy `QUARANTINED` job before writing, so a stale caller cannot recreate a durable quarantine state.

Existing label reconciliation remains useful during the transition because the durable queue reports no current quarantines, allowing stale quarantine labels to be removed automatically.

## Quality floor

This policy changes scheduling only. It does not bypass or weaken:

- implementation verification;
- security review;
- quality repair;
- independent review;
- reviewed-SHA protection;
- `factory/independent-review`;
- `CI / required`;
- mergeability and branch-protection requirements.

Autonomy means the Factory decides how and when to retry. It does not mean lowering the engineering or merge gates.
