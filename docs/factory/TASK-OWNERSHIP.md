# Factory canonical task ownership

## Contract

A logical task has one durable Factory claim, one canonical implementation branch and at most one canonical
active implementation pull request. GitHub issue numbers, retries, providers, daemon generations, branch names and
pull request numbers are references to that claim, not its identity.

The logical key is either an explicit `Logical-Task-Key` or `Factory-Task-Key` marker, or a SHA-256 digest of the
case-folded title after issue and pull request decoration is removed. Factory PR bodies publish the full logical
key so a retry or successor can recover identity without re-deriving it from a mutable GitHub number.

## Durable state

`leases.json` retains its historical filename and top-level `leases` list for rollback compatibility, but each
entry is now a persistent canonical claim. Its expiring `owner`, `acquired_at`, `expires_at` and
`factory_generation` fields describe only the current worker lease. Releasing or expiring that lease clears the
worker owner without deleting the claim.

The same record retains:

- canonical task key and task identifier;
- producer identity and initial claim time;
- canonical branch and pull request;
- initial base SHA and latest locally verified SHA;
- changed-path fingerprint;
- predecessor and successor pull requests;
- predecessor task for a controlled takeover;
- latest stable failure fingerprint;
- completion time.

`jobs.json` carries the same branch, PR and provenance projection needed by the issue-to-merge state machine.
The canonical claim remains authoritative when a worker crashed after a GitHub or Git side effect but before the
job snapshot was saved.

## Acquisition and dispatch

Every dispatch creates a worker-distinct token and acquires the logical claim under the process lock and
`leases.lock` before worktree creation or an implementation agent starts. Acquisition reloads state while holding
the lock and performs a compare-and-swap:

1. the same worker may repeat the same active acquisition idempotently;
2. another worker for the same task skips while the active lease is valid;
3. an equivalent issue attaches to the existing canonical task and becomes terminal without creating a branch;
4. an expired lease for the same canonical task may be taken over;
5. a different task may take over only when it explicitly supersedes the predecessor, the lease is inactive, and
   the predecessor is completed or has a persisted failure fingerprint.

After acquisition, the worker reloads `jobs.json`. This prevents a dispatch that waited behind another worker from
replaying stale `DISCOVERED` or `PR_DRAFT` state. Lease release is owner-checked, so a losing worker cannot clear
the winner's lease. The first branch and initial base binding is compare-and-swap immutable. Crash recovery rebuilds
that exact branch from the recorded base before implementation resumes. Each bounded transition and each agent call
renews the lease. A crash leaves the lease to expire; a newer daemon generation treats the old generation's worker
lease as inactive while retaining canonical metadata.

## Pull request convergence

Before branch creation, the GitHub boundary searches all open PRs and PRs closed in the previous 30 days. It records
equivalence evidence from:

- direct closing-issue links;
- the logical key derived from a normalised title or explicit marker;
- exact canonical branch metadata or a branch reference to the task;
- an exact changed-path fingerprint;
- explicit predecessor, successor, replacement or supersession links.

Path overlap by itself is diagnostic evidence and cannot make an open PR canonical. An open, same-repository,
trusted candidate with a stronger identity signal is checked out and sent through verification and independent
review. A recent merged match resumes at merged cleanup. A recent closed or explicitly noncanonical match is stored
as the predecessor before a new successor branch is created.

Immediately before `gh pr create`, Factory searches again using the now-known branch and changed paths. A persisted
canonical PR wins without another API call. After creation, the PR number is compare-and-swap bound to the claim
before the job transition is saved. A retry therefore attaches to the same PR instead of creating a sibling.

## Recovery and stale state

Malformed claim entries are skipped without hiding valid siblings. Multiple legacy entries that resolve to one
logical key converge deterministically on the active claim, then the earliest initial claim. Overlong, future or
expired worker leases never suppress scheduling indefinitely. `reconcile` clears only expired worker ownership and
retains branch, PR and provenance history.

The invariant tests cover simultaneous logical claims, duplicate dispatch during PR creation, crash-after-claim,
expiry takeover, explicit successor takeover, stale state recovery and pre-branch attachment to an existing PR.

## Upgrade and rollback

This is an additive state expansion. New fields are optional, missing values restore to safe defaults, and the
top-level `leases` and `jobs` shapes do not change. Released claims use an empty legacy owner plus an expired
timestamp, so the previous reader ignores them as inactive while current readers retain their metadata. No data
backfill or destructive schema contraction runs during deployment.

For rollback, stop the current daemon before starting the previous runtime and preserve `leases.json`,
`jobs.json` and their `.bak` files. The previous runtime can read active legacy fields and ignores additions.
If it later rewrites those files, new provenance fields may be dropped, but existing branch, PR and reviewed-SHA
job fields remain available. Returning to the current runtime is safe without cleanup. Do not delete claim records
or introduce a separate branch-hygiene producer during rollback.
