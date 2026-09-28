# Agent branch and pull request policy

This policy applies to every coding agent, automation worker, and human-assisted agent operating on this repository.

## Required lifecycle

A pushed branch is not, by itself, a completed task, and a branch existing is not, by itself, work owed a pull
request. One task or issue gets one active implementation pull request; a branch with no reviewable change beyond
an already-open or already-merged equivalent does not get a second one.

Agents must:

1. synchronise from current `main` before starting;
2. search open PRs, closed/merged PRs, and branches for overlapping work (by branch name, issue number, task key,
   and touched files) before creating a new branch or pull request;
3. update the existing branch or PR in place rather than creating a `-v2`, `-v3`, `-current`, `-green`, or
   `-current-main` replacement branch merely because `main` advanced - rebase and rerun checks instead;
4. create one coherent branch per independently reviewable change;
5. run the relevant verification suite before pushing;
6. push the branch and create or update its PR only once there is a real reviewable diff;
7. verify the PR is visible on GitHub and record its number in job state;
8. repair conflicts and CI failures on the same PR branch whenever practical;
9. use squash merge with branch deletion after required checks and review pass;
10. close any pull request proven superseded (duplicate, or equivalent to an already-merged change) atomically,
    as part of the same operation that establishes the canonical replacement, not as a later cleanup step.

## Replacement branch exception

A replacement branch is allowed only when the original branch cannot safely be repaired or rebased. The
replacement PR must explicitly identify the superseded PR or branch, and the superseded PR is closed in the same
operation that opens or promotes the replacement, not left open pending later confirmation.

For Factory automation specifically, this decision is made by a single locked convergence owner
(`automation/openhands_factory/pr_convergence.py`, wired into `pipeline.py`) so the Architect, resolver, reviewer,
and branch-hygiene lanes never independently open competing replacement PRs for the same task. See
[PR-CONVERGENCE-AND-WIP.md](../docs/factory/PR-CONVERGENCE-AND-WIP.md) for the full contract, including WIP limits
and stacked-dependency handling.

## Repository safety net

The Branch PR Hygiene workflow (`.github/workflows/branch-pr-hygiene.yml`, scheduled every six hours) is read-only:
it classifies every remote branch with the canonical Factory classifier and publishes an audit artifact. It never
opens, modifies, reopens, closes, or merges a pull request, and it never deletes a branch. An unmerged branch with
no pull request is not, on its own, treated as a defect: it may be abandoned, superseded by later work on a
different branch, or intentionally exempted. Do not reintroduce automation whose goal is "every unmerged branch
must have a PR" - a branch is not work merely because it exists, and manufacturing a PR for one manufactures
review and CI churn without a corresponding change worth reviewing.
