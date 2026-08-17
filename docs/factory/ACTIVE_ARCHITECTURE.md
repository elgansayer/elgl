# Active architecture: OpenHands Factory with one production conversation boundary

## Authority

`automation/openhands_factory` is the only autonomous engineering control plane. It owns GitHub discovery,
scheduling, durable state, retries, worktrees, provider health, prompts, verification, reviews, repairs, pull
requests, CI polling, and merge safety. Model providers supply intelligence beneath that control plane and cannot
independently schedule work, write merge policy, push to `main`, or merge.

The static deployment identity remains `FACTORY_ARCHITECTURE=openhands-agent-canvas-v1` for durable-state and
operator compatibility.

Production engineering phases cross one OpenHands SDK conversation boundary. The Factory does not route normal
production work directly to Claude CLI, Codex CLI, Google/Gemini CLI, or OpenCode CLI. Those outer adapters may
remain in the codebase temporarily while convergence removes them, but production configuration keeps them
disabled.

Inside the OpenHands conversation boundary, provider selection is:

1. OpenAI subscription-backed Codex OAuth.
2. OpenCode Go subscription fallback.

Google/Gemini is disabled and is not selected by the production conversation runner. Historical provider state may
still be readable for migration or diagnostics, but it must not make Gemini eligible for new work.

The retired swarm, Aider workers, GitHub Actions issue resolvers, separate autonomous reviewers, meta-agent, and
PTY wrapper must not return. A watchdog may restart the daemon and perform read-only diagnostics, but it cannot
invoke an agent or patch a checkout.

## Control flow

```text
                      +------------------------+
GitHub -------------->| daemon scheduler       |
issues and PRs        | one host lock and UUID |
                      +-----------+------------+
                                  |
                                  v
                      +------------------------+
                      | FactoryPipeline        |
                      | durable state machine  |
                      +-----------+------------+
                                  |
                                  v
                      +------------------------+
                      | outer phase routing    |
                      | production: OpenHands  |
                      +-----------+------------+
                                  |
                                  v
                      +------------------------+
                      | OpenHands SDK          |
                      | conversation boundary  |
                      +-----------+------------+
                                  |
                     +------------+-------------+
                     |                          |
                     v                          v
           OpenAI subscription            OpenCode Go
           Codex OAuth, primary            subscription fallback
                     \                          /
                      +------------+-------------+
                                   |
                                   v
                      +------------------------+
                      | isolated task worktree |
                      +-----------+------------+
                                  |
              verification -> structured review -> GitHub checks
                                  |
                         SHA-bound merge gate
```

`AgentRouter` can remain as a compatibility layer while direct outer adapters are removed, but the canonical
production configuration routes every phase only to the OpenHands adapter. Re-enabling a direct outer provider is
an architecture change, not a routine configuration tweak.

## Production provider boundary

`config/factory/agents.production.json` is the canonical production reference. It must satisfy these invariants:

- `openhands` is the only enabled provider eligible in every production phase route;
- direct `claude`, `codex`, `google`, and `opencode` outer adapters are disabled;
- `openhands` is not marked emergency-only because it is the normal production execution boundary;
- planning, architecture, implementation, security review, quality repair, code review, CI repair, and general
  actions each route exactly through `openhands`;
- OpenAI subscription/Codex OAuth and OpenCode Go fallback remain inside `conversation_runner.py`;
- Google/Gemini is not an inner production fallback.

Deployment preserves an existing operator-owned `/etc/hellotalk-factory/agents.json` rather than silently
rewriting it. Operators must reconcile that file with the canonical production reference when this contract
changes. Startup and doctor checks must fail closed when the configured production execution boundary cannot run.

## Runtime boundaries

| Boundary | Behaviour |
| --- | --- |
| Factory controller | Dedicated `hellotalk-factory` user, one host lock, durable generation UUID |
| Production execution | One OpenHands SDK conversation per leased task/phase under Factory wall-clock bounds |
| Inner provider choice | OpenAI subscription/Codex OAuth first, OpenCode Go fallback, with durable attribution and provider health |
| Direct CLI outer adapters | Transitional code only; disabled in production and not eligible for normal phase routing |
| Verification | Private user/mount/PID/proc/network namespaces, fresh home and private temporary filesystems, read-only deployed Factory tree, no provider sessions or Factory state |
| OpenHands terminal | Rootless Podman, no network, no capabilities, bounded resources, worktree mount only |
| OpenHands file editor | Resolved paths must remain inside the task worktree |
| Git operations | Factory-owned host code, protected-base push rejection, reset credential-helper chain, root-managed GitHub token scoped only to Git children |
| GitHub operations | Typed client with bounded retries and no provider transcript publication |

The OpenHands conversation process is placed in its own process group so Factory shutdown and task timeout logic
can terminate the complete conversation tree. Inner-provider health, cooldown, capacity, and attribution are
persisted by Factory-owned code. Provider-side authentication material must never expand the GitHub or merge
authority of the model process.

## Core modules

| Module | Ownership |
| --- | --- |
| `daemon.py` | Single-owner daemon, scheduling, abandoned-attempt recovery, pause, and graceful shutdown |
| `pipeline.py` | One bounded state transition and all repository safety gates |
| `conversation_runner.py` | Canonical production OpenHands transport, inner OpenAI/OpenCode selection, cancellation, health, and attribution |
| `agents/base.py` | Typed phases, requests, results, health, failure classes, and provider protocol |
| `agents/router.py` | Outer compatibility routing and eligibility; production policy must resolve only to OpenHands |
| `agents/policy.py` | Configured outer phase policy and compatibility validation |
| `agents/process.py` | Bounded subprocess process groups for remaining non-production/diagnostic adapters |
| `agents/health.py` | Durable outer-provider circuit state used while compatibility adapters remain |
| `provider_health.py` | Durable inner-provider health for OpenAI subscription and OpenCode Go |
| `provider_capacity.py` | Generation-aware cross-process provider leases |
| `provider_runtime.py` | Inner-provider attribution and model/role metadata |
| `jobs.py`, `retry_policy.py` | Durable job state and restart-stable bounded retry authority |
| `git_workflow.py` | Worktree, branch, commit, push, and recovery archive safety |
| `review_report.py` | Authoritative `.factory-review.json` schema and acceptance validation |
| `architect_report.py` | Authoritative `.factory-architect.json` schema |
| `doctor.py` | Read-only runtime, isolation, GitHub, provider, state, and capacity diagnostics |

## Durable state and bounded recovery

State beneath `FACTORY_STATE_DIR` is written atomically, schema checked where applicable, and protected by a
last-known-good backup. Durable state includes job progress and retry evidence, inner-provider health and
attribution, capacity leases, metrics, daemon generation and heartbeat, pause state, and architect state.

A restart never assumes a provider process is alive. The daemon stops admitting work, terminates registered
conversation, Git, verification, and repository child process groups, waits for workers to unwind, and records
itself stopped. Stale generation leases are ignored. Malformed, timezone-naive, future-acquired, and overlong
provider or task leases are bounded or discarded rather than suppressing work indefinitely.

Abandoned execution states recover through the normal typed timeout/retry path. Live futures and polling-only
`CI_PENDING` or `MERGE_QUEUED` states are not reclassified as abandoned work. Provider auth, quota, rate-limit,
availability, timeout, transport, crash, malformed-output, and busy-capacity exhaustion do not consume task
attempts or open the task failure circuit.

Repeated identical task-side failures may open the durable recoverable task circuit after the configured
consecutive-failure threshold. That circuit prevents deterministic task defects from retrying forever. Recovery
must remain explicit and bounded rather than restoring the retired permanent-quarantine/swarm behavior.

## Inner provider routing and independent review

`conversation_runner.py` owns production inner-provider selection. OpenAI subscription/Codex OAuth is the primary
inner provider and OpenCode Go is the fallback. Inner provider attribution is recorded on every attempt so retry,
health, review diversity, and diagnostics can distinguish the model that actually executed the work.

Google/Gemini is excluded from new production selection. Direct Claude, Codex, Google, and OpenCode outer
adapters are likewise disabled by production policy.

Review approval is based on the authoritative structured review artifact, not natural-language stdout. Review and
security-review diversity must use recorded provider attribution and must not silently treat the OpenHands outer
adapter as proof that two reviews used different inner providers. If no independent eligible provider can run,
last-resort behavior must be explicit and recorded rather than hidden by fallback.

`.factory-review.json` and `.factory-architect.json` are removed before their attempts, validated before success is
accepted, and deleted before repository change detection. Natural-language model output never substitutes for
those files.

## Repository and merge safety

Issue work starts from fresh `origin/main` in an isolated branch and worktree. External PRs use their recorded
remote branch in a separate worktree. Only trusted Factory code performs Git add, commit, push, status, and merge
operations. Model/provider execution does not receive merge authority.

Review approval publishes `factory/independent-review` on the exact reviewed head and adds `factory-reviewed`.
Before every PR-backed AI phase, refresh, or base update, Factory invalidates stale review authority and republishes
the status as pending on the current SHA. If the PR head changes, the new head is rebuilt, verified, and reviewed
again. If a reviewed PR is behind `main`, Factory performs a SHA-bound base update and repeats verification/review.

Merge readiness requires all of the following:

- the live PR head equals the reviewed SHA;
- `CI / required` is present and reports literal `SUCCESS`;
- `factory/independent-review` is present and reports literal `SUCCESS`;
- duplicate rollup entries for required contexts do not contradict those successes;
- every visible terminal check is allowed;
- mergeability is clean;
- no human review reports `CHANGES_REQUESTED`.

The scheduled merge workflow is the only merge authority. It re-reads live conditions, binds the squash merge to
the inspected head SHA, and does not use native auto-merge or administrator bypass. Repository rules must require
pull requests, `CI / required`, and `factory/independent-review` with no bypass actors.

## Branch and stale-PR convergence

One canonical active PR is maintained per logical task. Stale work is replayed or updated onto current `main`
rather than duplicated. Superseded PRs are closed and classified explicitly. Branch existence alone never creates
new implementation work.

The canonical branch-hygiene classifier is read-only by default. It distinguishes protected branches, Dependabot,
active canonical and non-canonical PR branches, merged/closed PR branches, fully integrated branches, and orphaned
ahead branches. Deletion is a separate explicit operation and is permitted only for verified safe candidates.

## Deployment identity and change policy

Factory code is deployed only from a clean, fast-forwarded `origin/main`. Task changes use branches and pull
requests. Deployment refreshes the frozen Python environment, application dependency trees, worker image, and
systemd files while preserving operator-owned configuration that requires deliberate reconciliation.

Any change to the production conversation boundary, inner provider order, authentication, transport, retry
authority, worktree confinement, review independence, or merge authority must update this document, the canonical
production configuration, and executable regression tests in the same logical PR. Model aliases are configuration
and must be reviewed after provider deprecation or catalogue changes rather than silently substituted during a job.
