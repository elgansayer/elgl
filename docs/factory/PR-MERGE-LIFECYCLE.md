# Factory pull request review, merge and notifications

The OpenHands Factory owns the decision that a pull request is safe to merge. GitHub remains authoritative for repository state and checks.

## Lifecycle

A pull request now advances through these observable states:

```text
REVIEWING
  -> stays draft with factory-stack-blocked while a declared Depends-On/
     Factory-Stack-Parent PR is still open (see PR-CONVERGENCE-AND-WIP.md)
  -> factory review approves the exact head SHA
  -> factory/independent-review = success
  -> factory-reviewed label is applied
  -> Telegram: REVIEWED

CI_PENDING
  -> CI / required succeeds
  -> every terminal check succeeds, is neutral, or is skipped
  -> no CHANGES_REQUESTED human review
  -> reviewed head SHA is still current
  -> GitHub reports CLEAN + MERGEABLE

MERGE_QUEUED
  -> Telegram: MERGE_QUEUED
  -> Factory re-reads GitHub on the next bounded transition
  -> exact-head squash merge using --match-head-commit
  -> no --admin bypass and no native auto-merge

MERGED
  -> GitHub is re-read to confirm the merge
  -> Telegram: MERGED
  -> normal issue/worktree cleanup continues
```

The scheduled `Factory Merge Gate` workflow remains a recovery fallback for a daemon interruption after review. The scheduled fallback additionally requires the `factory-reviewed` label. The direct Factory path relies on durable `MERGE_QUEUED` state produced only after review approval, then rechecks the SHA-scoped `factory/independent-review` status, `CI / required`, the current reviewed head, and GitHub merge state immediately before merging.

## Durable tracking

Lifecycle evidence is stored in:

```text
<FACTORY_STATE_DIR>/pr_lifecycle.json
```

Each event is keyed by pull request number, reviewed head SHA and lifecycle event. A new commit therefore gets a new review lifecycle, while repeated polling and daemon restarts de-duplicate the same success event during normal operation.

Stored events include:

- pull request number
- reviewed head SHA
- event: `reviewed`, `merge-queued`, or `merged`
- title and bounded operator detail
- recorded timestamp
- last notification attempt timestamp
- successful notification timestamp

Sent history is bounded; pending undelivered events are retained.

## Notification reliability

Notifications use the existing credential-safe `AlertService` and the configured Telegram bot/chat. Notification delivery is deliberately not a merge gate. If Telegram is temporarily unavailable, the Factory records the lifecycle event first, leaves it pending, and retries a bounded number of due notifications on later Factory transitions.

This prevents an alerting outage from blocking a safe merge while still making delivery recoverable.

## Merge safety

The Factory never merges merely because a PR has the `factory-reviewed` label. Before a direct merge it rechecks:

- GitHub still reports the same reviewed `head_sha`
- required Factory and CI checks have passed
- checks are no longer pending
- mergeability is `MERGEABLE`
- merge state is `CLEAN`
- no `CHANGES_REQUESTED` decision is active

The merge command uses `--match-head-commit <reviewed_sha>`. If a commit lands after review, GitHub rejects the stale merge and the Factory refreshes the PR through independent review again.
