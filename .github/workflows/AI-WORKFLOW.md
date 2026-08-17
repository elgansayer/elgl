# OpenHands Factory workflow

The canonical autonomous engineering system is `automation/openhands_factory`. OpenHands Factory owns issue
discovery, scheduling, durable jobs, worktrees, provider health, verification, review, repair, pull requests, CI
polling, and merge safety. Production model execution crosses one OpenHands SDK conversation boundary. OpenAI
subscription-backed Codex OAuth is the primary inner provider and OpenCode Go is the fallback.

Direct Claude Code, Codex CLI, Google agent, and OpenCode CLI outer adapters are transitional compatibility code
only. The canonical production configuration disables them and every production phase route resolves exactly to
`openhands`. Google/Gemini is disabled for new production selection.

GitHub Actions owns repository CI and the final scheduled merge gate. It must not contain a competing issue
resolver, reviewer, provider router, or direct provider merge implementation.

## End-to-end flow

```text
eligible GitHub issues and external pull requests
  -> Factory daemon reconciles durable jobs
  -> worker pool selects the highest-priority runnable job
  -> isolated task worktree
  -> typed Factory phase request
  -> OpenHands SDK conversation boundary
       OpenAI subscription/Codex OAuth primary
       OpenCode Go fallback
  -> security review and repository-native verification
  -> task branch push and draft pull request
  -> independent review writes a fresh .factory-review.json
  -> validated SHA-scoped factory/independent-review status
  -> GitHub checks and mergeability polling
  -> bounded repair with current failed-check evidence when needed
  -> verification and independent review repeat after every code change
  -> scheduled merge gate validates labels, SHA status, and every required check
  -> squash merge without administrator bypass
  -> issue closure only after GitHub reports MERGED
```

External pull requests skip implementation but use the same verification, review, repair, and merge path. A new
head commit invalidates the previous review, removes review labels, rebuilds the isolated worktree, and returns the
current head to review.

## Components

| Component | Responsibility |
| --- | --- |
| `automation/openhands_factory/daemon.py` | Single-owner scheduling, abandoned-attempt recovery, pause, generation, and shutdown |
| `automation/openhands_factory/pipeline.py` | Durable issue-to-merge state machine and repository safety gates |
| `automation/openhands_factory/conversation_runner.py` | Canonical production OpenHands transport and inner OpenAI/OpenCode selection |
| `automation/openhands_factory/agents/` | Typed provider protocol and transitional outer compatibility adapters/router |
| `automation/openhands_factory/jobs.py` | Backwards-compatible durable state and retry authority |
| `automation/openhands_factory/provider_health.py` | Durable inner-provider health and cooldown state |
| `automation/openhands_factory/provider_capacity.py` | Cross-process, generation-aware provider concurrency leases |
| `automation/openhands_factory/github.py` | Typed issue, PR, label, check, status, and merge boundary |
| `.github/workflows/ci.yml` | Application and Factory verification plus `CI / required` |
| `.github/workflows/factory-merge.yml` | Final fail-closed merge gate for reviewed pull requests |
| `config/systemd/hellotalk-factory.service` | Always-on daemon from the dedicated `main` checkout |
| `config/systemd/hellotalk-factory-health.timer` | Periodic read-only health and restart supervision |

## Guarantees

- Production Factory code is deployed from `origin/main` only.
- Agents cannot push application changes directly to `main` or merge pull requests.
- Every production AI-backed phase crosses the OpenHands SDK conversation boundary.
- Direct Claude, Codex, Google, and OpenCode outer providers are disabled in the canonical production config.
- OpenAI subscription/Codex OAuth is the first inner provider and OpenCode Go is the fallback.
- Google/Gemini is disabled for new production selection.
- Provider-side failures are typed and bounded; task, test, repository, policy, and internal Factory failures do
  not blindly rotate.
- A no-provider condition defers the job without consuming a task attempt or permanently quarantining it.
- Retry classes, deterministic jittered backoff, provider health, provider attribution, and worktree state survive
  daemon restart.
- Corrupt future or overlong provider and task leases cannot suppress scheduling indefinitely.
- A watchdog can recover abandoned execution states but cannot start an LLM or modify the base checkout.
- `.factory-review.json` and `.factory-architect.json` are fresh, validated, authoritative control artefacts and
  are removed before repository commits.
- Independent-review diversity uses recorded inner-provider attribution rather than treating the OpenHands outer
  adapter as evidence of model independence.
- Every repair returns to local verification and independent review.
- The reviewed head SHA must still be current before merge eligibility.
- A reviewed head that becomes behind `main` loses eligibility, receives an expected-SHA base update, and is
  verified and reviewed again.
- The merge call is atomically bound to the inspected head SHA.
- `CI / required` and `factory/independent-review` must both report literal `SUCCESS`. Missing, skipped, neutral,
  pending, or failed required contexts fail closed.
- One active GitHub ruleset on `main` must have no bypass actors and require pull requests plus both canonical
  statuses. The scheduled workflow is not a substitute for a server-side rule.
- A human `CHANGES_REQUESTED` review blocks merge.
- GitHub comments describe user-visible lifecycle changes and never expose credentials or routine provider
  fallback noise.
- The pre-push quality gate rejects provider credential directories, high-confidence tokens, and private keys.

## Parallelism and recovery

`FACTORY_MAX_PARALLEL_JOBS=3` is the production starting point. The OpenHands conversation boundary has bounded
capacity, while its inner providers have durable health/cooldown state. Temporary provider exhaustion defers work
through the durable retry authority instead of consuming a task attempt.

Use `docs/factory/README.md` for deployment and recovery. Historical resolver, reviewer, direct-agent, and swarm
entrypoints must not be restored beside the daemon because they would create duplicate workers, branches,
comments, pull requests, or merge decisions.

A green scheduled merge-workflow run does not prove that a pull request was merged. The workflow intentionally
does nothing when no eligible PR exists. Check daemon state, durable jobs, PR labels, required checks, and the
SHA-scoped review status for throughput evidence.

`hellotalk-factory doctor --online` fails when GitHub does not enforce the canonical merge statuses. Production
activation also requires `hellotalk-factory legacy scan` to report no competing executor.
