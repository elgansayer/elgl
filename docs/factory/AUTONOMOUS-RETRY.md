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

## Spent repair budgets name their cause

A job that spends a repair budget keeps its machine-owned state and backs off like any other repeated failure. Its terminal error always opens with the same words and then names what was still blocking it, so a diagnostic snapshot shows why the budget ran out without reading the pull request:

| Budget                                 | Terminal error                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quality repair (5 consecutive repairs) | `Quality repair limit exceeded: <code> in <path>` for the first quality-gate finding, otherwise `Quality repair limit exceeded: review findings` |
| CI repair (5 model repairs)            | `Repair limit exceeded: <sorted failed check names>`, or `Repair limit exceeded: no failed check reported`                                       |

The quality-gate form mirrors `Quality gate blocked: <code> in <path>`, which verification already raises. `review findings` covers both an independent review rejection and a failed local verification, because both are carried as repair evidence. Evidence text, timestamps and SHAs are never included, so an identical blocker repeats an identical error and fingerprint and the chronic backoff above keeps escalating. A different blocker is new evidence and starts its own repetition count.

Check names and paths are untrusted, and a job retains only the last 2000 characters of its error. Each name is collapsed to one line of at most 200 characters and at most eight check names are listed, followed by `(+N more)`, so the opening words always survive.

The opening words alone decide the failure class and the maintenance incident. Both errors are classified as `budget` and grouped under `exhausted-repair-budget` before any other wording is considered, so a path or check that happens to mention authentication, a timeout, `design-sync-drift` or fonts cannot move the job to another class or family. `Review repair limit exceeded` is unchanged.

The budgets themselves, the stale-unpublished rebuild and the capped-conflict rebuild are unchanged. This is diagnostic only: no limit is raised, no gate is skipped and no job state is reset.

The verification boundary, production baseline and post-deployment measurement protocol are recorded in [AUDIT-2026-10-29-EXHAUSTED-REPAIR-BUDGET.md](AUDIT-2026-10-29-EXHAUSTED-REPAIR-BUDGET.md). Live task causes and outcome changes are not claimed before the maintenance controller records them.

## Interrupted implementations resume their leftover edits

A provider rate limit, transport failure or timeout can end an implementation attempt after it has already edited the claimed worktree. The job stays in `implementing` with those edits in place, and every retry records them in its starting fingerprint. A provider that then finds the work done makes no further edit, so the unchanged-fingerprint check used to fail it with `Implementation produced no changes` on every retry, before the edits ever reached security review or verification.

The check now depends on how the attempt began, and only for the `implementation` phase:

- **Clean worktree at the start** (identical to `HEAD`): unchanged. The attempt is accepted only when its change fingerprint differs from the starting one, otherwise it fails with `Implementation produced no changes`.
- **Dirty worktree at the start** (tracked edits, deletions or untracked files): the attempt is accepted when the worktree still differs from `HEAD` afterwards, whether or not the fingerprint moved. If nothing differs from `HEAD` any more, it fails with `Implementation produced no changes`.

The starting state is read before every provider attempt, so partial edits left by an earlier provider in the same routed run count in the same way. A provider that discards all of the leftover edits has produced no changes, which keeps a clean tree from reaching a security review of an empty diff and then failing repeatedly in verification on `No changed paths were found`.

`quality_repair` and `repair` keep the strict comparison, because their starting tree is the implementation that verification or CI already rejected and a repair must add a change of its own. Accepting leftover edits skips no gate: they still go through security review (unless tests-only merging applies), local verification, the quality gate, independent review and required CI exactly as new edits do.

The change is a no-op for a task whose worktree was clean, so a task whose issue is already resolved on `main` still records `Implementation produced no changes`. The evidence, verification boundary and per-task measurement protocol are recorded in [AUDIT-2026-10-30-INTERRUPTED-IMPLEMENTATION.md](AUDIT-2026-10-30-INTERRUPTED-IMPLEMENTATION.md).

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
