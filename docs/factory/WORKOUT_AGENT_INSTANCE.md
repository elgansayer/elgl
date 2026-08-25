# Workout Agent Factory instance

`elgansayer/workout-agent` is processed by the same OpenHands Factory code,
prompts, provider routing, verification lifecycle, independent review gate, and
exact-head merge gate as the primary repository. It is not a GitHub-hosted AI
workflow and does not reactivate any retired swarm workflow.

## Policy

The repository-specific environment fixes the intake policy at:

- one newly discovered GitHub issue per 3,600 seconds;
- one parallel job for this repository;
- review, CI repair, and merge progress before another new issue is admitted;
- backend compilation and pytest verification for backend changes;
- Angular production build and headless unit tests for frontend changes;
- both stacks for cross-cutting changes.

A successful local verification does not itself permit a merge. The ordinary
Factory lifecycle must still publish an independent review for the current head,
observe the required GitHub checks, confirm clean mergeability, and merge the
same reviewed SHA.

## Install

First merge this change and deploy the primary Factory so
`/opt/hellotalk-factory/venv` contains
`openhands_factory.repository_instance`. Then run from an up-to-date `elgl`
checkout:

```bash
sudo scripts/install-workout-agent-factory.sh
```

The installer:

1. clones or fast-forwards Workout Agent at
   `/var/lib/workout-agent-factory/repository`;
2. prepares the backend virtual environment and frontend dependency tree;
3. installs repository-specific, secret-free environment overrides;
4. installs and starts `workout-agent-factory.service`.

Secrets and subscription-provider configuration remain in
`/etc/hellotalk-factory/factory.env`. The repository instance inherits them and
then applies `/etc/workout-agent-factory/factory.env`, which isolates its target
repository, state, worktrees, recovery archives, logs, and hourly admission
budget.

## Operations

```bash
systemctl status workout-agent-factory.service
journalctl -u workout-agent-factory.service -f
sudo systemctl restart workout-agent-factory.service
```

To pause only Workout Agent without stopping the primary Factory:

```bash
sudo systemctl stop workout-agent-factory.service
```

After dependency-lock changes in Workout Agent, rerun the installer. It refuses
a dirty canonical checkout and fast-forwards only, so dependency preparation can
never silently overwrite task work.

## Failure behavior

Startup fails closed when a retired agent workflow has any autonomous trigger.
The manual `workflow_dispatch` tombstones may remain because they document and
enforce retirement. Missing backend dependencies, failed builds/tests, required
CI failures, stale review SHAs, conflicts, or provider exhaustion prevent merge.
Provider exhaustion is retried by the normal durable Factory scheduler; it is not
a reason to bypass verification or review.
