# Branch and pull request hygiene

An unmerged remote branch is not, by itself, work owed a pull request. A branch may be abandoned, superseded by
later work on a different branch, or intentionally exempted; manufacturing a PR for it manufactures review and CI
churn without a corresponding change worth reviewing. This document previously required every branch ahead of
`main` to have an open PR; that requirement produced exactly this churn and has been removed, see
[PR-CONVERGENCE-AND-WIP.md](factory/PR-CONVERGENCE-AND-WIP.md) for the incident this policy replaced.

## Enforcement

`.github/workflows/branch-pr-hygiene.yml` is read-only and runs on a six-hour schedule (`workflow_dispatch` for
manual runs). It audits every repository branch with the canonical Factory classifier
(`automation/openhands_factory/branch_hygiene.py`) and uploads the classification as a machine-readable artifact.
It holds only `contents: read` and `pull-requests: read` permissions: it cannot open, modify, reopen, close, or
merge a pull request, and it cannot delete a branch. There is no push-triggered PR creation.

## Producer contract

Coding agents and automation create or update a pull request only once there is a real reviewable diff, after
checking for an equivalent open, closed, or merged PR (by branch name, issue number, task key, or touched-file
fingerprint). Producers should:

1. create a purpose-specific branch from current `main`;
2. make and test one coherent change;
3. deduplicate against existing open/closed/merged PRs before opening a new one;
4. push the branch and create or update the PR in place;
5. record the PR number in their job state;
6. stop creating replacement branches when a PR can instead be updated or rebased - `main` advancing is not, on
   its own, a reason to open a new PR;
7. when a replacement is genuinely unavoidable, close the superseded PR atomically as part of the same operation;
8. delete the branch after merge.

For Factory automation, a single locked convergence owner
(`automation/openhands_factory/pr_convergence.py`) makes the create/reuse/reopen/supersede decision so no other
lane (Architect, resolver, reviewer, branch-hygiene) opens a competing PR for the same task; see
[PR-CONVERGENCE-AND-WIP.md](factory/PR-CONVERGENCE-AND-WIP.md).

## Follow-up maintenance

Periodically review branches that are already merged, superseded by newer branches, or associated only with closed
PRs. Prefer deleting those stale refs rather than keeping historical implementation branches indefinitely.
