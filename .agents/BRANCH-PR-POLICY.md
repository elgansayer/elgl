# Agent branch and pull request policy

This policy applies to every coding agent, automation worker, and human-assisted agent operating on this repository.

## Required lifecycle

A pushed implementation branch is not a completed task. Every branch containing commits not reachable from `main` must be attached to an open pull request before an agent declares success.

Agents must:

1. synchronise from current `main` before starting;
2. search open PRs and branches for overlapping work before creating a new branch;
3. prefer updating an existing branch or PR over creating a `-v2`, `-v3`, `-current`, `-green`, or `-current-main` replacement branch;
4. create one coherent branch per independently reviewable change;
5. run the relevant verification suite before pushing;
6. push the branch and immediately create or update its PR;
7. verify the PR is visible on GitHub and record its number in job state;
8. repair conflicts and CI failures on the same PR branch whenever practical;
9. use squash merge with branch deletion after required checks and review pass;
10. never leave an ahead-of-main branch without a PR as a normal terminal state.

## Replacement branch exception

A replacement branch is allowed only when the original branch cannot safely be repaired or rebased. The replacement PR must explicitly identify the superseded PR or branch, and the superseded PR should be closed once the replacement is confirmed.

## Repository safety net

The Branch PR Hygiene workflow periodically detects branches ahead of `main` with no open pull request and creates a draft PR. This is a recovery mechanism, not a substitute for agents creating their own PRs immediately.
