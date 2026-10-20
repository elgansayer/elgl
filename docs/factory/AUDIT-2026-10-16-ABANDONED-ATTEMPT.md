# Abandoned-attempt scheduling - 16 October 2026

## Evidence

The deployed package was reproduced directly. A `QUALITY_REPAIRING` job had seven attempts, a known validation
error, `updated_at` three hours old and `next_attempt_at` six hours ahead. `recover_abandoned_attempts` with a
two-hour limit reported it recovered, raised its attempts to eight, replaced the validation error with a
task-timeout and pulled the existing retry deadline forward to fifteen minutes. No worker had run.

The watchdog treated "old `updated_at` in an execution state" as proof of a lost worker. `updated_at` only moves when
an attempt's outcome commits, and every pipeline step is one worker run. A job therefore sits in an active state
with an old `updated_at` whenever it is backed off, waiting for a free worker, or held back by review-only
admission, with no worker having started. Age could not distinguish that from a genuinely crashed attempt, so queue
length alone manufactured fresh timeout incidents, inflated attempts and escalated backoff for work that never ran.

The earlier hypotheses were rejected after reading the code. Backoff is not missing: recovery already schedules
through the restart-stable retry policy. A manual triage or dead-letter state would contradict the autonomy
mandate and is not part of this change.

## Changes

- A job now carries `attempt_started_at` and `attempt_generation`. `JobStore.begin_attempt` sets them in the same
  locked read that loads the job, under the existing process lock, file lock and generation fence, so a superseded
  daemon can neither start nor mark an attempt. The write that commits the outcome (success, failure or capacity
  deferral) clears them, so queued, backed-off and polling jobs never carry the marker.
- An attempt that begins while an earlier one was never committed inherits the earlier start. A job that keeps
  killing its worker still ages towards recovery instead of restarting the clock on every attempt.
- `recover_abandoned_attempts` recovers only a marked attempt older than the maximum task duration. It never
  touches an explicit future `next_attempt_at`, a live future, or a CI-pending, ready or merge-queued job.
  Recovery reuses the existing retry policy and fifteen-minute cap, keeps the state, branch, pull request, head,
  worktree identity and provider history, and clears the marker so the attempt is accounted for once.
- Reopening a finished job drops any stale marker.

## Measurement

Actual watchdog recoveries are now measured apart from queue age. `daemon.json` has a `watchdog` section:

- `recovered_total`, `last_recovered_at` and `last_recovered_task_ids` move only when the watchdog recovers an
  attempt, and cover the running daemon generation;
- `queued_count` and `oldest_queued_age_seconds` describe runnable mid-pipeline work with no attempt in flight.
  A large age here means work is waiting for a worker, not that anything crashed.

Each recovery also logs `factory.watchdog.recovered` with the state, attempt age and both generations. The
maintenance snapshot embeds the section and its prompt tells the planner to use it. A `Watchdog recovered abandoned`
message left on a job is history until that job next runs, so it is not evidence of a current crash.

## Safeguards and limits

- Retries stay autonomous. There is no manual or dead-letter state, no `needs-human` label and no blanket retry
  reset. CI, independent review, exact-head checks, merge rules and credential isolation are unchanged.
- The change is an additive state expansion. A job written by an older release has no marker and is treated as
  queued, so an attempt in flight at the moment of upgrade is re-run by the scheduler rather than recovered by the
  watchdog. Older releases ignore the new fields, so rollback restores the previous behaviour.
- Only attempts that start in a state the watchdog can recover are marked. That adds one durable queue write to
  each long agent attempt and none to the frequent CI, merge and discovery attempts. The existing outcome write
  carries the clearing.
- Existing jobs keep their historical errors and attempt counts. Inflated counters from earlier false recoveries are
  not rewritten; they decay through the normal success reset.

## Validation

Regression tests reproduce the future-deadline case and assert that attempts, error, state and deadline are
unchanged, and that queued work in every recoverable state is never recovered by age. They also cover a
prior-generation attempt that is recovered exactly once with its worktree identity and diagnostic history intact,
marker inheritance across restarts, the generation fence, corrupt and legacy state, worker lifecycle for success,
failure, capacity deferral and a hard worker death, and the daemon and maintenance measurements.
