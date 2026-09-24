# Active architecture: OpenHands Factory with interchangeable agents

## Authority

`automation/openhands_factory` is the only autonomous engineering control plane. It owns GitHub discovery,
scheduling, durable state, retries, worktrees, provider health, phase routing, prompts, verification, reviews,
repairs, pull requests, CI polling, and merge safety. Providers supply intelligence beneath the Factory and
cannot independently schedule, push to `main`, create merge policy, or merge.

The static identity remains `FACTORY_ARCHITECTURE=openhands-agent-canvas-v1` for deployment and durable-state
compatibility. In this architecture, "OpenHands" names the Factory control plane. It does not mean every phase
must run through one OpenHands SDK conversation. OpenHands SDK is one optional provider adapter in the same
router as subscription-backed CLIs.

The retired swarm, Aider workers, GitHub Actions issue resolvers, separate reviewers, meta-agent, and PTY wrapper
must not return. A watchdog may restart the daemon and perform read-only diagnostics, but it cannot invoke an
agent or patch the checkout.

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
                      | AgentRouter            |
                      | policy, health, leases |
                      +--+-------+------+---+--+
                         |       |      |   |
                Claude CLI  Codex CLI  Google CLI  OpenCode CLI
                         \       |      |   /
                          \      |      |  /
                           OpenHands SDK adapter
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

## Runtime boundaries

| Boundary               | Behaviour                                                                                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factory controller     | Runs as the operator's own login user (`dev`), one host lock, durable generation UUID                                                                                                                                                                      |
| Direct CLI adapter     | Argument-vector subprocess, private user/mount/PID/proc namespaces, non-interactive stdin, bounded output and timeout                                                                                                                                      |
| Direct CLI environment | Current worktree, read-only base repository, provider-specific credential paths, read-only runtime paths, and minimal environment; other sessions, Factory state, logs, runtime sockets, host temp, proxy credentials, API keys, and daemon secrets hidden |
| Direct CLI health      | Disposable empty working directory, provider-specific session paths, bounded no-generation probe, removed after use                                                                                                                                        |
| Verification           | Private user/mount/PID/proc/network namespaces, fresh home and private temporary filesystems, read-only deployed Factory tree, no provider sessions or Factory state                                                                                       |
| OpenHands adapter      | Existing SDK runner behind the same `AgentProvider` protocol; no GitHub, Telegram, or legacy Gemini credentials in child configuration                                                                                                                     |
| OpenHands terminal     | Rootless Podman, no network, no capabilities, bounded resources, worktree mount only                                                                                                                                                                       |
| OpenHands file editor  | Resolved paths must remain inside the task worktree                                                                                                                                                                                                        |
| Git operations         | Factory-owned host code, protected-base push rejection, reset credential-helper chain, root-managed GitHub token scoped only to Git children                                                                                                               |
| GitHub operations      | Typed client with bounded retries and no provider transcript publication                                                                                                                                                                                   |

Direct subscription CLIs require provider network access and access to the shared service-user authentication
cache. Their own tool sandbox is therefore part of the current trust boundary even though host process, state,
runtime, and worktree boundaries are enforced outside the CLI. A future stable ACP transport or provider-specific
credential broker can separate provider sessions without changing `FactoryPipeline` or routing policy.

## Core modules

| Module                       | Ownership                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `daemon.py`                  | Single-owner daemon, scheduling, abandoned-attempt recovery, pause, and graceful shutdown |
| `pipeline.py`                | One bounded state transition and all repository safety gates                              |
| `agents/base.py`             | Typed phases, requests, results, health, failure classes, and provider protocol           |
| `agents/router.py`           | Eligibility, bounded retry, fallback, diversity, capacity, provenance, and metrics        |
| `agents/policy.py`           | Configured phase order, emergency tier, and repair rotation                               |
| `agents/process.py`          | Child process groups, output bounds, timeout, TERM, and forced KILL                       |
| `agents/health.py`           | Durable circuit breakers and atomic half-open admission                                   |
| `provider_capacity.py`       | Generation-aware cross-process provider leases                                            |
| `conversation_runner.py`     | OpenHands SDK compatibility transport and inner-provider attribution                      |
| `jobs.py`, `retry_policy.py` | Backwards-compatible durable state and restart-stable retry authority                     |
| `task_source.py`            | Logical task claims, worker CAS leases and canonical branch/PR provenance                |
| `git_workflow.py`            | Worktree, branch, commit, push, and recovery archive safety                               |
| `review_report.py`           | Authoritative `.factory-review.json` schema and acceptance validation                     |
| `architect_report.py`        | Authoritative `.factory-architect.json` schema                                            |
| `doctor.py`                  | Read-only runtime, isolation, GitHub, provider, state, and capacity diagnostics           |
| `control_panel.py`           | Sanitised GitHub status projection and fixed trusted-actor controls                       |

## Durable state and recovery

State beneath `FACTORY_STATE_DIR` is written atomically, schema checked where applicable, and protected by a
last-known-good backup:

- `jobs.json`: state, branch, PR, reviewed SHA, attempts, retry evidence, findings, and the latest 500 provider
  provenance entries per job;
- `leases.json`: persistent logical claims plus expiring worker ownership, canonical branch/PR identity, base and
  verified SHAs, predecessor/successor links, path and failure fingerprints;
- `agent_health.json`: circuit state, failures, cooldown, and half-open ownership;
- `provider-capacity.json`: current-generation provider leases;
- `metrics.json`: provider, model, phase, result, duration, fallback, quota, timeout, and typed failure counters;
- `generation.json`: active daemon ownership UUID and schema version;
- `daemon.json`: heartbeat, PID, generation, queue counts, active tasks, pause state, and provider health;
- `control.json`: pause state;
- `control_panel.json`: issue cursor, publication fingerprint, and last accepted bounded command;
- `control_request.json`: optional mode-0600, single-use watchdog restart request;
- `architect_state.json`: architect completion and retry data;
- `provider-attribution.json`: detailed OpenHands inner-provider attribution.

Typed metric failure counters are an additive state expansion. New readers treat an absent or malformed counter
map as empty, while older readers ignore the added field, so mixed-version startup and rollback preserve the
existing call, success, failure, quota, fallback, duration, and timeout counters.

A restart never assumes a provider process is alive. The daemon stops admitting work, terminates registered CLI,
OpenHands, Git, verification, and repository child process groups, waits for workers to unwind, and records itself
stopped. Stale generation leases are ignored. Malformed, timezone-naive, future-acquired, and overlong provider or
task leases are bounded or discarded rather than suppressing work indefinitely. Task-lease and `jobs.json`
read-modify-write operations use cross-process locks. The watchdog recovers old execution states through the
normal timeout class and deterministic retry policy while leaving live futures and polling-only states untouched.
Released task leases retain canonical claim history. Before branch creation, Factory reconciles open and recently
closed PRs using issue links, logical titles, branch metadata, changed paths and explicit supersession links. See
[TASK-OWNERSHIP.md](TASK-OWNERSHIP.md).

A repeated identical task-side failure opens a durable, recoverable quarantine after
`FACTORY_MAX_CONSECUTIVE_FAILURES`. This bounded circuit stops deterministic bugs from retrying forever and adds
`factory-quarantined` plus `needs-human` once. Provider auth, quota, rate-limit, availability, timeout, transport,
crash, malformed-output, and busy-capacity exhaustion never consume a task attempt or open this task circuit.
After the bounded window, automatic recovery preserves failure evidence, returns the job to discovery, and
requests a startup-equivalent reconciliation that silently removes GitHub quarantine labels no longer backed by
durable state. `backlog requeue-quarantined`
provides an earlier operator-selected reset, with repeatable `--issue` targeting and optional `--announce`
comments. Historical quarantine entries without the new reason marker are migrated back into normal retry flow.
Successful issue completion removes the Factory ownership label before closing the issue, preventing new stale
`factory-active` markers from accumulating after merge. Startup also compares open ownership labels with durable
active jobs and protected workers, including retired `swarm-active` markers. It releases only a configured bounded
batch per refresh, restoring the ready label to preserve admission and posting no comments, until historical drift
reaches zero.

## GitHub operator panel

The health watchdog maintains one open `factory-status` and `factory-skip` issue as a sanitised projection of
daemon, queue, provider, metric, service, and timer state. It publishes on material change and at least every 15
minutes, so a stale update is a dead-man indicator. The issue never contains prompts, transcripts, issue bodies,
environment values, credentials, raw provider diagnostics, or exception text.

Only actors in the narrower `FACTORY_CONTROL_GITHUB_ACTORS` allowlist can submit the exact fixed commands
`status`, `pause`, `resume`, and `restart`. Comment text never enters a shell. Restart crosses the privilege
boundary through a schema, owner, mode and age checked single-use request consumed by the existing root watchdog.
No panel action can
select work, change routes, execute a task, push, review, approve, or merge. See
[CONTROL-PANEL.md](CONTROL-PANEL.md).

## Routing and independent review

Phase order is validated from `/etc/hellotalk-factory/agents.json`. The router skips disabled, unsupported,
unhealthy, cooling-down, and optionally busy providers. Emergency-only OpenHands remains behind all healthy
subscription providers. Provider-side auth, quota, rate, timeout, transport, crash, availability, and malformed
output failures may fall through. Task, test, repository, policy, and internal Factory failures return to Factory
repair or retry logic instead of blind provider rotation.

Every code review and security review excludes providers that may have mutated the current worktree, including
failed or timed-out attempts. If no alternative can run, the same provider is allowed only as a recorded
`diversity-last-resort` fallback.

`.factory-review.json` and `.factory-architect.json` are removed before each attempt, validated before the router
accepts success, then deleted before repository change detection. Natural-language stdout never substitutes for
these authoritative files.

## Repository and merge safety

Issue work starts from fresh `origin/main` in an isolated branch and worktree. External PRs use their recorded
remote branch in a separate worktree. Only trusted Factory code performs Git add, commit, push, status, and merge
operations. Provider subprocesses do not receive GitHub or application secrets.

Review approval publishes `factory/independent-review` on the exact reviewed head and adds `factory-reviewed`.
Before every PR-backed AI phase, refresh, or base update, the Factory removes review labels and republishes that
status as `PENDING` on the current SHA. A crash or timeout therefore leaves the merge gate closed. If GitHub
reports a different head, the latest branch is rebuilt and the new SHA is also marked pending before verification.
If GitHub reports the reviewed head as `BEHIND`, the Factory asks GitHub for a base update bound to that exact head
SHA. The resulting head is then rebuilt, verified, and reviewed again. Merge readiness requires all of the
following:

- the PR head equals the reviewed SHA;
- `CI / required` is present and reports literal `SUCCESS`;
- `factory/independent-review` is present and reports literal `SUCCESS`;
- any duplicate rollup entry for either required context also reports literal `SUCCESS`;
- every visible terminal check is allowed;
- mergeability is clean;
- no human review reports `CHANGES_REQUESTED`.

The scheduled merge workflow is the only autonomous merge authority. It re-reads the live conditions, binds the
squash merge atomically to the inspected head with `--match-head-commit`, and never uses native `--auto` or an
administrator bypass. A baseline ruleset requires pull requests and strict `CI / required`. A second,
review-only ruleset requires `factory/independent-review`. The exact repository-owner user may be the sole
pull-request-only bypass actor on both rulesets, allowing deliberate manual waiver of CI, review, or both without
permitting direct pushes. Factory automation still requires literal success from both statuses and never invokes
that path. See
[MANUAL-MERGE.md](MANUAL-MERGE.md).

A dedicated GitHub App and ruleset expected-source binding are still required to prevent another write actor from
publishing the same legacy status-context name. Online doctor currently validates the layered rules, context
names, and narrow manual actor, not status publisher identity.

## Deployment identity and change policy

Factory code is deployed only from a clean, fast-forwarded `origin/main`. Task changes still use branches and pull
requests. Deployment refreshes the frozen Python environment, Node dependency trees, Cypress, worker image, and
systemd files while preserving the operator-owned `agents.json`. The optional `--fast` mode may reuse Node trees
and the worker image only through deployment-owned fingerprints that bind lockfiles, toolchains, installed npm
state, tracked worker inputs, and the rootless image ID. It never skips Git synchronisation, host repair, Python
synchronisation, systemd installation, startup preflight, online doctor, or service verification.

The startup preflight deliberately mirrors the service unit's `HOME` and `PATH`, so a deploy cannot reject valid
service-user CLI installations merely because root or sudo has a narrower interactive path.

Any change to provider order, authentication, transport, retry authority, worktree confinement, review
independence, or merge authority must update these architecture documents and executable regression tests in the
same logical change. Model aliases are configuration and must be reviewed after provider deprecation or catalogue
changes rather than silently substituted during a job.
