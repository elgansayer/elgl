# Branch and pull request hygiene

Every remote branch that contains commits not reachable from `main` should have an open pull request unless it is intentionally exempted by repository policy.

## Why

A pushed branch is not a pull request. GitHub does not automatically create a PR when an agent, workflow, or developer pushes a branch. Without a repository-wide reconciliation step, completed agent work can become invisible to normal review, CI, and merge queues.

## Enforcement

`.github/workflows/branch-pr-hygiene.yml` enforces the invariant in two ways:

- on every push to a non-`main` branch, it checks whether the branch is ahead of `main` and opens a draft PR if no open PR exists;
- every six hours, it scans all repository branches and repairs any orphan branch missed by an individual producer.

Branches with no commits ahead of `main` are intentionally ignored because GitHub cannot create a meaningful pull request for them.

## Producer contract

Coding agents and automation should still create their own pull requests immediately. The hygiene workflow is a safety net, not the primary PR creation path. Producers should:

1. create a purpose-specific branch from current `main`;
2. make and test one coherent change;
3. push the branch;
4. create a PR immediately;
5. record the PR number in their job state;
6. stop creating replacement branches when a PR can instead be updated or rebased;
7. delete the branch after merge.

## Follow-up maintenance

Periodically review branches that are already merged, superseded by newer branches, or associated only with closed PRs. Prefer deleting those stale refs rather than keeping historical implementation branches indefinitely.
