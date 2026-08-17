# OpenHands factory workflow

The canonical autonomous development system is the OpenHands SDK factory under
`automation/openhands_factory`. GitHub Actions provide repository CI and the
final merge gate. There must not be a second issue resolver, direct-provider
agent router, or PR reviewer implementation in GitHub Actions or the Factory
pipeline.

## End-to-end flow

```text
open GitHub issues
  -> factory daemon refreshes and persists the backlog
  -> worker pool selects the highest-priority available issues
  -> isolated worktree and issue comment
  -> OpenHands SDK conversation
       OpenAI subscription/Codex OAuth -> OpenCode Go
  -> local constitution, lint, build, unit and E2E verification
  -> factory branch push and draft pull request
  -> fresh OpenHands SDK review on the same branch
  -> SHA-anchored independent-review status, labels and pull request comments
  -> GitHub checks and mergeability polling
  -> repair loop for failed checks
  -> auto-merge only after `CI / required` and `factory/independent-review` succeed
  -> issue closure after GitHub reports MERGED
```

The worker pool is intentionally parallel. `FACTORY_MAX_PARALLEL_JOBS=3` is
the safe default for the current memory limit. Increase it only with more
RAM, or reduce it to `1` when diagnosing a provider or repository problem.

## Components

| Component | Responsibility |
| --- | --- |
| `automation/openhands_factory/daemon.py` | Refreshes the backlog, recovers abandoned attempts, and schedules independent jobs |
| `automation/openhands_factory/pipeline.py` | Durable issue-to-merge state machine |
| `automation/openhands_factory/conversation_runner.py` | Bounded OpenHands SDK process execution and conversation-scoped provider selection |
| `automation/openhands_factory/provider_profiles.py` | OpenAI subscription/Codex OAuth first, then OpenCode Go; historical providers are not eligible for production routing |
| `automation/openhands_factory/github.py` | Credential-safe GitHub issue, PR, comment, label, status, and fail-closed merge-readiness operations |
| `.github/workflows/ci.yml` | Application and Factory verification plus the canonical `CI / required` aggregate |
| `.github/workflows/factory-merge.yml` | Final merge gate for Factory-reviewed pull requests |
| `config/systemd/hellotalk-factory.service` | Always-on daemon |
| `config/systemd/hellotalk-factory-health.timer` | Periodic read-only health checks |

## Guarantees

- Existing environment variables are preserved. The complete list is in
  `config/systemd/factory.env.example`.
- OpenHands is the sole outer execution control plane. Direct Claude, Codex,
  Google/Gemini, and OpenCode agent executors are disabled outside that boundary.
- Production model routing is conversation-stable: Codex subscription OAuth is
  preferred and OpenCode Go is the only production fallback.
- No worker can push directly to `main`.
- A pull request is reviewed on the same branch that implemented it.
- The reviewed head SHA must still match before merge is enabled.
- Factory merge readiness requires the named `CI / required` aggregate and the
  SHA-anchored `factory/independent-review` status to be present and successful.
- Failed checks return the job to the repair phase.
- Repeated failures use persisted failure-class/fingerprint accounting,
  deterministic jittered backoff, and provider circuit breakers. The Factory
  does not use a terminal issue quarantine as its recovery strategy.
- Durable execution states abandoned by a crashed daemon are recovered into the
  same bounded retry path without discarding their worktree or job history.
- Every lifecycle transition is visible through GitHub comments and labels.
- Worktree, lease and job state are durable across daemon restarts.
- GitHub Actions do not create competing resolver or reviewer jobs.

## Recovery

Use the runbook in `docs/factory/README.md`. To inspect the retired pre-SDK
GitHub Actions implementation for historical reference, inspect the parent of
the deployment commit:

```bash
git show 7569bf64^:.github/workflows/architect.yml
git show 7569bf64^:.github/workflows/auto-dispatcher.yml
git show 7569bf64^:.github/workflows/openhands.yml
git show 7569bf64^:.github/workflows/pr-reviewer.yml
```

Those files are historical reference only. Restoring them alongside the SDK
daemon would create duplicate issue workers, duplicate reviews, and duplicate
pull requests.
