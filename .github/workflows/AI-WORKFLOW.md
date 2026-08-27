# OpenHands Factory workflow

The canonical autonomous engineering system is `automation/openhands_factory`. OpenHands Factory owns issue
discovery, scheduling, durable jobs, worktrees, provider routing, verification, review, repair, pull requests,
CI polling, and merge safety. Claude Code, Codex CLI, Google coding agents, OpenCode, and the OpenHands SDK are
interchangeable execution engines beneath that control plane.

GitHub Actions owns repository CI and the final scheduled merge gate. It must not contain a competing issue
resolver, reviewer, provider router, or direct provider merge implementation.

## End-to-end flow

```text
eligible GitHub issues and external pull requests
  -> Factory daemon reconciles durable jobs
  -> worker pool selects the highest-priority runnable job
  -> worker-distinct logical task claim and equivalent-PR reconciliation
  -> isolated task worktree
  -> phase-specific AgentRouter selection
       Claude Code, Codex CLI, Google agent, OpenCode, OpenHands emergency
  -> security review and repository-native verification
  -> task branch push and draft pull request
  -> independent provider writes a fresh .factory-review.json
  -> validated SHA-scoped factory/independent-review status
  -> GitHub checks and mergeability polling
  -> provider-rotated repair with current failed-check evidence when needed
  -> verification and independent review repeat after every code change
  -> scheduled merge gate validates labels, SHA status, and every required check
  -> autonomous squash merge without administrator bypass
  -> issue closure only after GitHub reports MERGED
```

External pull requests skip implementation but use the same verification, review, repair, and merge path. A new
head commit invalidates the previous review, removes review labels, rebuilds the isolated worktree, and returns
the current head to review.

## Components

| Component                                             | Responsibility                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `automation/openhands_factory/daemon.py`              | Single-owner scheduling, abandoned-attempt recovery, pause, generation, and shutdown |
| `automation/openhands_factory/pipeline.py`            | Durable issue-to-merge state machine and repository safety gates                     |
| `automation/openhands_factory/agents/`                | Provider protocol, adapters, policy, process runner, health, and router              |
| `automation/openhands_factory/jobs.py`                | Backwards-compatible durable state and retry authority                               |
| `automation/openhands_factory/provider_capacity.py`   | Cross-process, generation-aware provider concurrency leases                          |
| `automation/openhands_factory/conversation_runner.py` | Existing OpenHands SDK provider transport                                            |
| `automation/openhands_factory/github.py`              | Typed issue, PR, label, check, status, and merge boundary                            |
| `automation/openhands_factory/control_panel.py`       | Sanitised GitHub status issue and bounded operator commands                          |
| `.github/workflows/ci.yml`                            | Application and Factory verification plus `CI / required`                            |
| `.github/workflows/factory-merge.yml`                 | Final fail-closed merge gate for reviewed pull requests                              |
| `config/systemd/hellotalk-factory.service`            | Always-on daemon from the dedicated `main` checkout                                  |
| `config/systemd/hellotalk-factory-health.timer`       | Periodic read-only health and restart supervision                                    |

## Guarantees

- Production Factory code is deployed from `origin/main` only.
- Agents cannot push application changes directly to `main` or merge pull requests.
- Routing is typed, phase-specific, configurable, health-aware, and capacity-aware.
- Provider-side failures can fall through; task, test, repository, policy, and internal Factory failures cannot
  blindly rotate.
- A no-provider condition defers the job without consuming a task attempt or permanently quarantining it.
- Retry classes, deterministic jittered backoff, provider circuits, provider history, and worktree state survive
  daemon restart.
- Corrupt future or overlong provider and task leases cannot suppress scheduling indefinitely.
- Logical task claims retain canonical branch, PR and provenance after an expiring worker lease is released.
- Concurrent equivalent dispatches converge on one owner and one canonical active implementation PR.
- A watchdog can recover abandoned execution states but cannot start an LLM or modify the base checkout.
- Review avoids every provider that may have mutated the code when another healthy provider is available.
- `.factory-review.json` and `.factory-architect.json` are fresh, validated, authoritative control artefacts and
  are removed before repository commits.
- Every repair returns to local verification and independent review.
- The reviewed head SHA must still be current before merge eligibility.
- A reviewed head that becomes behind `main` loses eligibility, receives an expected-SHA base update, and is
  verified and reviewed again.
- The merge call is atomically bound to the inspected head SHA with `--match-head-commit`.
- `CI / required` and `factory/independent-review` must both report literal `SUCCESS` for autonomous merge.
  Missing, skipped, neutral, pending, or failed required contexts fail closed.
- A baseline ruleset on `main` requires pull requests and strict `CI / required`. A review-only ruleset requires
  `factory/independent-review`. The sole optional bypass actor on either ruleset is the exact repository-owner
  user in pull-request mode. Roles, teams, apps, deploy keys, direct pushes, and always-mode bypasses remain
  prohibited. Factory automation still requires both statuses and never invokes the manual path. Pin each status
  to its expected GitHub App integration; a context name alone does not attest its publisher.
- A human `CHANGES_REQUESTED` review blocks merge.
- GitHub comments describe user-visible lifecycle changes and never expose credentials or routine provider
  fallback noise.
- The `factory-status` issue is a projection of authoritative daemon state. Only exact pause, resume, status, and
  restart comments from `FACTORY_CONTROL_GITHUB_ACTORS` are accepted; no comment can execute arbitrary code or
  bypass merge safety.
- The pre-push quality gate rejects provider credential directories, high-confidence tokens, and private keys.

The owner-only pull-request override is documented in
[`docs/factory/MANUAL-MERGE.md`](../../docs/factory/MANUAL-MERGE.md). Factory automation never invokes it.

## Parallelism and recovery

`FACTORY_MAX_PARALLEL_JOBS=3` is the production starting point. Each provider also has an independent
`max_concurrency`. Busy providers can be skipped so another healthy subscription can make progress. Fixed-port
verification commands use a separate semaphore.

Use `docs/factory/README.md` for deployment and recovery. Historical resolver and reviewer workflows must not be
restored beside the daemon because they would create duplicate workers, branches, comments, pull requests, and
merge decisions.

A green scheduled merge-workflow run does not prove that a pull request was merged. The workflow intentionally
does nothing when no eligible PR exists. Check daemon state, durable jobs, PR labels, required checks, and the
SHA-scoped review status for throughput evidence.

`hellotalk-factory doctor --online` fails when GitHub does not enforce the two canonical statuses. Production
activation also requires `hellotalk-factory legacy scan` to report no competing executor.
