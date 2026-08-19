# Factory execution architecture

## One orchestration owner, multiple execution providers

The production system has exactly one autonomous orchestration control plane: OpenHands Factory. The daemon and
`FactoryPipeline` own scheduling, durable state, retries, worktrees, verification, review, PRs, CI repair, and
merge safety. `AgentRouter` is an internal Factory service, not a competing swarm.

Every AI-backed phase becomes one typed `AgentRequest` and can run through an eligible adapter:

- Claude Code CLI using a Claude subscription;
- Codex CLI using ChatGPT subscription authentication;
- configurable Google agent CLI, with Antigravity preferred for supported consumer subscriptions;
- OpenCode CLI using OpenCode Go authentication;
- OpenHands SDK as an optional emergency compatibility provider.

Providers cannot discover work, own job state, merge, or weaken Factory policy. The transport may be CLI,
OpenHands SDK, or a future ACP adapter without changing pipeline ownership.

The scheduler uses one bounded pull-request review lane. If no review is already active, the highest-priority
runnable external PR is submitted before issue work, including when only one worker is available. A second PR
cannot enter while that lane is active. The router reserves one slot on each provider from non-review jobs while
the selected PR worker is active, so issue workers cannot consume every healthy subscription before the required
review starts. Existing provider calls are never pre-empted. Remaining worker and provider slots retain normal
issue priority order. Reviews default to priority 5. Trusted `guardian-alert`, `priority:critical`, and
`priority:high` labels promote urgent PRs within that lane, with numeric identifier as the tie-breaker.

GitHub discovery and stale-worktree reconciliation run on one control-plane worker. The owning daemon waits for
that bounded pass while continuing to publish heartbeat state every ten seconds. Retired inactive jobs are merged
into the latest durable snapshot in one write, so a large cleanup neither rewrites the full queue per job nor
overwrites a sibling worker transition.

## Architecture invariants

- `FACTORY_ARCHITECTURE` remains `openhands-agent-canvas-v1` for deployment and state compatibility.
- `FactoryPipeline` calls `AgentRouter` for every AI-backed phase.
- Provider adapters contain vendor invocation details; routing policy contains only provider names and phase order.
- Direct provider children receive no GitHub token, vendor API-key override, proxy credential, Telegram secret,
  or application secret.
- Direct provider children run with private process and mount views that hide durable Factory state, logs, host
  temporary files, runtime sockets, and other provider sessions while retaining only the assigned worktree,
  read-only base, provider-owned credential paths, and read-only runtime paths.
- Repository-controlled verification receives neither provider sessions nor external network access.
- OpenHands remains available through `OpenHandsProvider`; there is no parallel legacy conversation path.
- Disabled, unsupported, unhealthy, cooling-down, quota-exhausted, auth-broken, and optionally busy providers are
  skipped.
- Provider-side failures may fall through according to typed policy. Repository, test, task, policy, and internal
  Factory failures do not blindly rotate.
- No-provider capacity defers work without consuming a task attempt or entering task quarantine.
- A bounded pull-request review lane receives the first worker position and one reserved provider slot, preventing
  required merge reviews from starving behind the issue backlog.
- Repeated identical task-side failures open a recoverable circuit at the configured limit, while different
  failure fingerprints retain independent bounded backoff histories.
- Provider health, circuits, retry evidence, history, and job state are durable across restart.
- Provider health probes run in disposable empty workspaces instead of the writable canonical checkout.
- Persisted provider and task leases are generation-aware, duration-bounded, and reject malformed timestamps.
- Task leases and every `jobs.json` read-modify-write path are locked across processes.
- Per-job provider provenance retains the latest 500 attempts, bounding durable state growth.
- Provider credential artefacts, high-confidence tokens, and private keys fail the pre-push quality gate.
- Persistent GitHub CLI and Git credential stores are forbidden in the service home; GitHub access is injected
  only into trusted Factory-owned children from root-only configuration.
- Retired swarm, Aider, guardian, resolver, reviewer, meta-agent, and autonomous GitHub executor entrypoints remain
  absent.

## Default production route

| Phase           | Ordered candidates                                   |
| --------------- | ---------------------------------------------------- |
| Planning        | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Architecture    | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Implementation  | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Security review | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Quality repair  | Codex, Claude, Google, OpenCode, OpenHands emergency |
| Code review     | Codex, Claude, Google, OpenCode, OpenHands emergency |
| CI repair       | Codex, Claude, Google, OpenCode, OpenHands emergency |
| General action  | OpenCode, Google, Codex, Claude, OpenHands emergency |

The route is configuration, not hard-coded business logic. The initial production file keeps Google disabled
until its service-user authentication and non-interactive output contract pass a canary. OpenHands is
emergency-only and must not silently create unrestricted PAYG spend.

## Independent review and merge authority

Review excludes every provider that may have mutated the current worktree. Same-provider review is allowed only
when no alternative can run and is recorded as a diversity fallback. `.factory-review.json` is removed before
each attempt and validated before success. Every PR-backed AI phase, refresh, and base update removes review
labels and marks the current SHA-scoped status `PENDING` before work starts. A changed review head is marked
pending before verification. An otherwise reviewed head that falls behind `main` is updated through GitHub with
an expected-head guard, then returns to local verification and independent review.

Autonomous merge readiness is fail-closed. Both `CI / required` and `factory/independent-review` must be present
and report literal `SUCCESS`, the reviewed SHA must equal the PR head, mergeability must be clean, and no human
review may report `CHANGES_REQUESTED`. The scheduled merge workflow is the only autonomous merge authority and
enforces the same boundary with an atomic `--match-head-commit` guard, without native `--auto` or `--admin`.

GitHub applies a baseline ruleset requiring pull requests and strict `CI / required`, plus a second review-only
ruleset requiring `factory/independent-review`. Only the exact repository-owner user may bypass either ruleset,
and only through an existing pull request. This permits a deliberate human waiver of CI, review, or both while
Factory automation continues to require literal success from both statuses. Roles, apps, teams, deploy keys,
direct pushes, and always-mode bypasses remain prohibited. Expected-source binding through a dedicated GitHub App
is still required to attest the publisher; online doctor validates the layered rules, context names, and narrow
owner bypass. See [MANUAL-MERGE.md](MANUAL-MERGE.md).

## Recovery authority

`JobStore` and `retry_policy.py` are the single durable retry authority. Repeated failure classes use independent
counters, stable semantic fingerprints, deterministic jitter, and capped exponential delay. Provider circuits
prevent a known-broken subscription from being hammered for every issue. The watchdog only recovers stale active
states through that same path and never starts an agent itself.

See [ACTIVE_ARCHITECTURE.md](ACTIVE_ARCHITECTURE.md) for module and trust boundaries and
[AGENT-ROUTING.md](AGENT-ROUTING.md) for detailed routing, failure, health, and model policy.
