# OpenHands factory workflow

The canonical autonomous development system is the OpenHands SDK factory under
`automation/openhands_factory`. GitHub Actions provide repository CI and the
final merge gate. There must not be a second issue resolver or PR reviewer
implementation in GitHub Actions.

## End-to-end flow

```text
open GitHub issues
  -> factory daemon refreshes and persists the backlog
  -> worker pool selects the highest-priority available issues
  -> isolated worktree and issue comment
  -> OpenHands SDK conversation
       OpenAI subscription -> OpenCode Go -> Gemini free tier
  -> local constitution, lint, build, unit and E2E verification
  -> factory branch push and draft pull request
  -> fresh OpenHands SDK review on the same branch
  -> review status, labels and pull request comments
  -> GitHub checks and mergeability polling
  -> repair loop for failed checks
  -> auto-merge after the reviewed head SHA remains current
  -> issue closure after GitHub reports MERGED
```

The worker pool is intentionally parallel. `FACTORY_MAX_PARALLEL_JOBS=3` is
the safe default for the current memory limit. Increase it only with more
RAM, or reduce it to `1` when diagnosing a provider or repository problem.

## Components

| Component | Responsibility |
| --- | --- |
| `automation/openhands_factory/daemon.py` | Refreshes the backlog and schedules independent jobs |
| `automation/openhands_factory/pipeline.py` | Durable issue-to-merge state machine |
| `automation/openhands_factory/conversation_runner.py` | Bounded OpenHands SDK process execution |
| `automation/openhands_factory/provider_profiles.py` | OpenAI subscription, OpenCode Go and Gemini fallback chain |
| `automation/openhands_factory/github.py` | Credential-safe GitHub issue, PR, comment, label and status operations |
| `.github/workflows/ci.yml` | Application and factory verification on pushes and pull requests |
| `.github/workflows/factory-merge.yml` | Merge gate for factory-reviewed pull requests |
| `config/systemd/hellotalk-factory.service` | Always-on daemon |
| `config/systemd/hellotalk-factory-health.timer` | Periodic read-only health checks |

## Guarantees

- Existing environment variables are preserved. The complete list is in
  `config/systemd/factory.env.example`.
- No worker can push directly to `main`.
- A pull request is reviewed on the same branch that implemented it.
- The reviewed head SHA must still match before merge is enabled.
- Failed checks return the job to the repair phase.
- Three consecutive failures quarantine the issue and add `needs-human`.
- Every lifecycle transition is visible through GitHub comments and labels.
- Worktree, lease and job state are durable across daemon restarts.
- GitHub Actions do not create competing resolver or reviewer jobs.

## Recovery

Use the runbook in `docs/factory/README.md`. To recover the pre-SDK GitHub
Actions implementation for reference, inspect the parent of the deployment
commit:

```bash
git show 7569bf64^:.github/workflows/architect.yml
git show 7569bf64^:.github/workflows/auto-dispatcher.yml
git show 7569bf64^:.github/workflows/openhands.yml
git show 7569bf64^:.github/workflows/pr-reviewer.yml
```

Those files are historical reference only. Restoring them alongside the SDK
daemon would create duplicate issue workers and duplicate pull requests.
