# Pull-request convergence, WIP limits, and stacked dependencies

The Factory previously let independent lanes (Architect, resolver, reviewer, branch-hygiene, task
implementation) each open their own pull request for the same underlying task. When `main` advanced
before a PR merged, the usual response was a new `current-main replay` / `supersedes` pull request
rather than an update of the existing branch. Combined with branch-hygiene automation that treated
every unmerged branch as work needing a PR, this produced more review and CI churn than the repository
could productively absorb.

This document describes the convergence, WIP-limit, and stacking controls that replace that behaviour.
The implementation lives in `automation/openhands_factory/pr_convergence.py` and
`automation/openhands_factory/pr_metrics.py`, wired into `pipeline.py` and `daemon.py`.

## Single merge/replay owner

`FactoryPipeline` holds one process-wide `pr-convergence.lock` file lock
(`<FACTORY_STATE_DIR>/pr-convergence.lock`). Every place that could create, update, reopen, or close a
Factory-owned pull request, opening a brand new PR from `_ensure_pull_request`, closing a superseded
PR during the periodic refresh, runs inside that lock. There is no separate resolver, reviewer, or
branch-hygiene code path that independently opens a competing pull request: `create_pull_request` is
called from exactly one place in `pipeline.py`. Branch-hygiene automation
(`branch_hygiene.py`, `.github/workflows/branch-pr-hygiene.yml`) is read-only: it classifies branches
and can delete only branches already proven merged or integrated with zero commits ahead of `main`. It
never opens, closes, or reopens a pull request, so an existing branch is never treated as work merely
because it exists.

## Deduplication before opening a pull request

Before a task branch becomes (or reuses) a pull request, `_ensure_pull_request` fetches the full open
and historical pull-request inventory (`GitHubClient.list_pull_requests`) and calls
`resolve_pull_request(identity, records)`. Every Factory-authored pull request carries an HTML-comment
marker block in its body:

```text
<!-- factory-convergence:v1 -->
Factory-Task-Key: <logical task key>
Factory-Change-Fingerprint: <sha256 of the committed diff's blob hashes>
Factory-Touched-Files: <sha256 of the sorted touched-path set>
Factory-Lane: <architect|factory|dependency|...>
Factory-Component: <frontend|backend|automation|ci|database|docs|admin-portal|multi>
Factory-Owner: factory
Factory-Stack-Parent: #<parent PR number>   (only when explicitly stacked)
<!-- /factory-convergence -->
```

A candidate matches an existing record on any of: head branch name, referenced issue number
(`Fixes #N` / `Closes #N` / `Resolves #N`), logical task key, or change fingerprint. A pure
touched-file overlap without one of those stronger signals blocks creation rather than guessing at
intent, unless the new PR declares that overlapping PR as its `Depends-On` stack parent. Resolution
returns exactly one action:

- **CREATE**: no equivalent pull request exists.
- **REUSE**: an open pull request already owns this task. Its title/body are updated in place and, for
  a Factory-owned branch, the branch itself is synced with `git push --force-with-lease` bound to the
  exact head SHA observed during the same locked pass (`GitWorkflow.sync_remote_branch`), so `main`
  advancing normally produces an update and re-test, not a new replay PR.
- **REOPEN**: only a closed, non-merged, same-repository Factory branch (`factory/*`) matches. It is
  reopened and updated rather than replaced.
- **ALREADY_MERGED**: an equivalent change is already merged. The new branch is deleted
  (`GitWorkflow.delete_remote_branch`, also SHA-bound) and the job adopts the merged PR's identity
  instead of opening a duplicate.
- **BLOCKED**: convergence cannot safely proceed automatically (for example, the matching open PR is
  not Factory-owned). Factory never force-syncs, retitles, closes, or deletes a branch it does not own.

`factory_owned` is decided solely by the `factory/` branch prefix (the same prefix
`ensure_push_target` already restricts every Factory push to) on a same-repository head ref. It never
trusts the `Factory-Owner` marker text alone, since pull-request body text is attacker-controlled on
any external contributor's PR, and it never trusts the branch name alone either, since a fork can name
its own head branch `factory/...`. Neither may grant authority to force-sync or delete a branch.

Ownership binds in both directions. A pull request Factory does not own can be the *reason* Factory
stands down (BLOCKED), but never the *authority* under which Factory closes something: `superseded`
only ever lists Factory-owned pull requests, so a contributor writing `Fixes #123` for an issue
Factory is already implementing, or copying a marker block into their body, cannot have their own PR
closed as a Factory duplicate, nor nominate their PR as the canonical owner whose "duplicates" (the
real Factory branch) get closed and deleted.

## Automatic supersession

On every scheduler refresh, `convergence_supersessions` scans the fresh inventory for:

- an open Factory-owned pull request whose change fingerprint (or explicit task key plus a shared issue
  reference) matches an already-merged pull request; and
- duplicate open Factory-owned pull requests sharing the same explicit task key, change fingerprint, or
  issue number (excluding pairs in an explicit stack relationship).

Only Factory-owned pull requests take part in that duplicate grouping at all. Every grouping signal is
writable by whoever opened the pull request: marker text can be copied verbatim, and any contributor
may reference an issue Factory is working on. Admitting an unowned record would let it become the
group's canonical owner and have the genuine Factory branch closed and deleted underneath it.

Each match is closed atomically through `GitHubClient.supersede_pull_request`: the `superseded` and
`duplicate` labels are applied, an explanatory comment naming the canonical PR is posted, then the PR
is closed with `--delete-branch`. This is the "atomically close the superseded PR as part of the same
operation" behaviour rather than a separate manual or best-effort cleanup step.

## WIP limits and dispatch pausing

```text
FACTORY_MAX_OPEN_PULL_REQUESTS=40
FACTORY_MAX_QUEUED_CI=12
FACTORY_PULL_REQUEST_HISTORY_LIMIT=2000
FACTORY_LANE_WIP_LIMITS=architect=1,dependency=12,factory=8
FACTORY_COMPONENT_WIP_LIMITS=admin-portal=6,automation=4,backend=12,ci=6,database=4,docs=6,frontend=12,multi=8
```

`calculate_capacity` derives, from the same refreshed inventory, the open PR count, queued-CI count
(pending required checks), and active counts per automation lane and per touched-component. Exceeding
any configured bound produces a human-readable blocked reason and sets `pause_new_dispatch`.

The daemon (`daemon.py`) reads `pipeline.pull_request_capacity.pause_new_dispatch` once per scheduling
iteration and uses it to gate exactly two things, matching "pause new dispatch" rather than "stop
draining the queue":

- new GitHub issue admission (`admission_slots_while_respecting_wip` zeroes the interval-based
  new-issue slot count while paused); and
- the weekly Architect cycle (skipped while paused).

Jobs already admitted, implementing, in review, in CI, or queued to merge keep advancing normally so
the backlog actually drains. Capacity is recalculated on every refresh, so dispatch resumes
automatically the next cycle after superseded/merged PRs close and counts drop back under the
configured limits, with no operator action required.

## Stacked feature chains

A task or pull-request body can declare an explicit dependency:

```text
Depends-On: #123
```

(`Factory-Stack-Parent: #123` is the equivalent marker Factory writes into the PR body it manages.)
Nothing infers a stack relationship from touched-file overlap or timing alone; it must be declared.

Two effects follow from a declared stack parent:

1. **Touched-file overlap is permitted** between a PR and its declared parent during convergence, where
   it would otherwise block creation as ambiguous.
2. **Full review and CI stay withheld until the parent lands.** While a job sits in `REVIEWING`, the
   pipeline checks whether its declared parent pull request is still open
   (`FactoryPipeline._stack_parent_pending`). If it is, the child pull request is labelled
   `factory-stack-blocked` and the cycle returns immediately, before running the (expensive) local
   independent-review agent, so a downstream stacked PR does not consume reviewer or CI capacity ahead
   of its dependency. The pull request itself was already opened as a GitHub draft
   (`create_pull_request` always opens PRs as drafts) and simply stays that way. Once the parent
   reports `MERGED` (or is closed without merging, so an abandoned dependency cannot deadlock the
   child forever), the label is cleared and review proceeds normally. A lookup failure for a mistyped
   or deleted parent reference propagates like any other GitHub control-plane error rather than
   silently treating the child as unblocked.

Only one pull request per dependency-ready task therefore competes for full reviewer/CI capacity at a
time within a declared chain; downstream stacked work waits in draft.

## Metrics

`PullRequestMetricsStore` persists a bounded, durable snapshot at
`<FACTORY_STATE_DIR>/pull-request-metrics.json` on every refresh, pull-request creation/update, review
invocation, and supersession. `hellotalk-factory metrics` prints it alongside provider metrics under a
`pull_requests` key with `capacity` (current open/queued/lane/component counts and any active pause
reasons) and `summary`:

- `active_pr_count_by_lane`
- `superseded_pr_count`, `superseded_prs_per_merged_pr`
- `replay_pr_count`, `replay_prs_per_merged_pr` (bodies still matching legacy `current-main replay` /
  `supersedes` phrasing, tracked so the metric trends to zero as convergence replaces that pattern)
- `ci_workflow_runs_per_merged_pr` (distinct GitHub Actions run IDs observed on merged PRs)
- `reviewer_model_invocations_per_merged_pr`
- `average_green_wait_seconds` (time between a merged PR first reporting every required check green and
  its actual merge)
- `stale_conflicting_pr_rate` (`BEHIND` / `DIRTY` / `UNSTABLE` merge state ever observed)
- `duplicate_task_fingerprints`, `duplicate_change_fingerprints` (excess open PRs sharing an identity
  axis, from the current capacity snapshot)

## Definition of done, mapped to enforcement

- **No task has more than one active implementation PR** unless it declares an explicit stack
  dependency: enforced by `resolve_pull_request` under the single convergence lock.
- **Moving `main` normally causes an update/retest, not a new replay PR**: `REUSE` syncs the existing
  branch in place; the pre-existing `BEHIND` handling in `_advance` (`CI_PENDING` state) rebases and
  re-verifies the same branch rather than opening a new one.
- **Superseded PRs are automatically closed**: `convergence_supersessions`, run every refresh.
- **Automation stops dispatching new work at configured WIP limits and resumes when capacity clears**:
  `admission_slots_while_respecting_wip` plus the Architect gate in `daemon.py`, recalculated every
  refresh.
- **Stacked chains consume full CI/reviewer resources one dependency-ready PR at a time**: the
  `REVIEWING`-state stack-parent gate.
- **Replay/supersession and CI-runs-per-merge metrics are visible**: `hellotalk-factory metrics`.
