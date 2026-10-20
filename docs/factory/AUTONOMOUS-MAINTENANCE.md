# Autonomous Factory maintenance

The primary Repo Factory now has a durable incident and self-improvement loop.
It runs inside the existing daemon, not a second competing executor. The shared
runtime and provider circuits serve both factories; the primary controller also
records the configured peer factory's heartbeat and throughput.

## Schedule and continued work

Production checks every 15 minutes while unpaused, with disk headroom and host
capacity available. No chat window or desktop application needs to remain open.
The existing enabled systemd service restarts after failures and server boots;
the existing health timers and change-aware updater remain responsible for host
supervision and deployment. Scheduling resumes from durable state after restart.

Production permits six bounded AI analyses per UTC day, at least four hours apart,
to diagnose distinct incidents or propose a daily throughput experiment. The
typed deployment defaults remain four analyses with no additional spacing until
configured. Each provider attempt has a three-minute
deadline; the existing conservative router permits one distinct fallback and
continues enforcing shared provider capacity and route allowance accounting.
There is at most one active maintenance implementation. Active jobs are never
cancelled to start maintenance, and exclusive verification still owns the host.

The programme in `config/factory/maintenance-programme.json` supplies seven
evidence-based priorities for the coming week and beyond: verified deployment
rollback, generation canaries, common-cause repair playbooks, application-specific
throughput, scheduler fairness, targeted verification and routing evaluations.
The model must inspect existing code and recent outcomes before proposing work.
These are prioritised future tasks, not claims that all seven are implemented.

## Control loop

1. Group repeated failure shapes across unfinished jobs. Treat historical watchdog
   messages as historical evidence, not proof of current process crashes. The
   baseline snapshot reports actual watchdog recoveries by the running daemon
   generation (`watchdog.recovered_total`) separately from queued age.
2. Give AI bounded, redacted diagnostic data, lifetime phase-model metrics and
   read-only repository access. Require a typed report; unknown task IDs and
   arbitrary action names are rejected. Repair proposals must cite exact excerpts
   from tracked source files, checked by the host. Manual/dead-letter proposals
   and fabricated or escaping source references are rejected. Diagnoses remain
   hypotheses until verified. Choosing observation is legitimate, but even an
   observation must contain a host-verified source quotation proving source access.
   Inaccessible source is a failed assessment, eligible for bounded provider fallback,
   not a successful observation that silently stops useful improvement work.
   Maintenance requests explicitly register the canonical, read-only main checkout
   with the provider's inner workspace policy, as well as the existing outer mount
   sandbox. A filesystem integration test verifies that source remains readable
   after the service home is masked and that opening it for writing fails read-only.
3. Deduplicate one concrete maintenance issue. Only identities in the controller's
   private ledger receive the maintenance scheduling tag. A GitHub label or body
   alone cannot obtain this privilege.
4. Advance the ordinary isolated implementation, security, verification, PR,
   independent review and exact-head merge pipeline. The maintenance lane can
   advance while ordinary issue intake is WIP-paused, but it has no merge bypass.
   The issue-cache optimisation performs a fresh scan when a controller-authorised
   repair or canary is missing from the cache; ordinary issue admission stays closed.
   Daemon generation activation retains the configured host gate and exclusive
   verification semaphore rather than rebuilding a router with default capacity.
5. A closed issue is not proof of success. Require its actual PR to be merged,
   current-main CI to be green, the checkout to match that head and this daemon's
   installed package identity to match that immutable source.
6. Release one matching failed job as a canary. Require a new head with completed
   local verification before releasing the remaining selected matches in bounded
   batches. Changed heads, changed errors and live workers are excluded.
7. Stop bulk recovery if the canary fails or cannot progress. Preserve all attempt
   and error history. A per-job recovery identity prevents a crash between queue
   persistence and ledger acknowledgement from resetting a budget twice.
   A job owned by a different canonical task is not eligible as a canary; a retired
   canary is recorded obsolete immediately and never counted as a recovery success.
8. For experiments, retain a baseline and a 24-hour outcome snapshot. These are
   observations, not causal proof that a routing or scheduler change improved it.

Inconclusive or failed episodes can be reassessed after six hours within the
daily analysis ceiling. Follow-up repairs have distinct durable task identities,
so a prior completed claim cannot falsely satisfy the new repair. Successful
recoveries receive a seven-day deduplication window rather than immediate churn.
Unchanged observations also receive a seven-day window based on task identity,
head and error evidence, not retry counters or elapsed age. New heads or changed
errors permit reassessment. Current watchdog telemetry showing no recoveries
prevents historical watchdog messages alone from becoming a fresh crash incident.
The final daily analysis slot is reserved for the improvement programme. Records
include `next_analysis_at`; routine checks and daily reporting continue during
analysis spacing. Issue inventory is fetched only for an active repair or actual
issue deduplication, not on every observation-only or budget-exhausted check.

## Operational records

`repo-factory maintenance show` reads the current instance's private
`maintenance.json`. It includes scheduling deadlines, analysis allowance, incident
status, linked issues, recovery receipts and up to 30 daily baseline snapshots.
The controller retains up to 100 incident/experiment records. Known component
metadata survives lightweight GitHub inventory refreshes; unknown components are
never counted as application merges.

The analysis worker is registered as reserved task `0` in daemon heartbeats, so
the updater drains it before replacing code. GitHub issue numbers are positive.
Pause/resume affects maintenance as well as ordinary scheduling.

Disable new maintenance cycles with `FACTORY_MAINTENANCE_ENABLED=false` through
the normal deployment workflow. The daily analysis ceiling, interval and timeout
are typed, bounded settings. No subscription purchases, credentials, branch
rules, administrator merge bypasses or untracked model executors are added.

## Limits

This loop cannot create missing credentials or guarantee a week's uninterrupted
progress through provider outages. Unknown root causes remain observations after
source access has been demonstrated.
Models propose reviewed code changes, not arbitrary privileged host commands.
Playbooks beyond existing deterministic cleanup and recovery controls are future
reviewed work, not an unrestricted shell controlled by generated text.

Verification cleans up a narrowly recognised, unstaged generated build-number
change after both successful and failed checks, and before a stale-base merge.
Only the known local build-number format matching the worktree's current HEAD is
eligible. Version changes, staged edits, symlinks, executable files, untracked
files and any other content changes are preserved. This does not discard product
repairs, ignore build failures or relax CI.
