# Factory execution architecture

## One orchestration owner, one production conversation boundary

The production system has exactly one autonomous orchestration control plane: OpenHands Factory. The daemon and
`FactoryPipeline` own scheduling, durable state, retries, worktrees, verification, review, pull requests, CI repair,
and merge safety. `AgentRouter` remains an internal compatibility service while older direct adapters are removed;
it is not a second control plane and production routing must resolve only to `OpenHandsProvider`.

Every AI-backed phase becomes one typed `AgentRequest`. In production, that request crosses the OpenHands SDK
conversation boundary. Provider choice inside that boundary is:

1. OpenAI subscription-backed Codex OAuth.
2. OpenCode Go subscription fallback.

Google/Gemini is disabled for new production selection. Direct Claude Code, Codex CLI, Google agent, and OpenCode
CLI adapters may remain in source temporarily for migration and diagnostics, but the canonical production config
disables them and does not list them in any phase route.

Providers cannot discover work, own job state, merge, or weaken Factory policy. Model execution never receives
Factory merge authority.

## Architecture invariants

- `FACTORY_ARCHITECTURE` remains `openhands-agent-canvas-v1` for deployment and state compatibility.
- `FactoryPipeline` may call the compatibility `AgentRouter`, but every production route is exactly `["openhands"]`.
- `OpenHandsProvider` delegates to the bounded `ConversationRunner` and is the only production outer executor.
- OpenAI subscription/Codex OAuth is the primary inner provider; OpenCode Go is the fallback.
- Google/Gemini is disabled for new production selection.
- Direct Claude, Codex, Google, and OpenCode outer providers are disabled in production.
- Direct provider children receive no GitHub token, vendor API-key override, proxy credential, Telegram secret,
  or application secret.
- Repository-controlled verification receives neither provider sessions nor external network access.
- Provider-side failures are typed and bounded. Repository, test, task, policy, and internal Factory failures do
  not blindly rotate.
- No-provider capacity defers work without consuming a task attempt or entering permanent quarantine.
- Repeated identical task-side failures may open a recoverable task circuit at the configured limit, while
  different failure fingerprints retain independent bounded backoff histories.
- Provider health, circuits, retry evidence, attribution, and job state are durable across restart.
- Persisted provider and task leases are generation-aware, duration-bounded, and reject malformed timestamps.
- Task leases and every `jobs.json` read-modify-write path are locked across processes.
- Per-job provider provenance is bounded so durable state cannot grow without limit.
- Provider credential artefacts, high-confidence tokens, and private keys fail the pre-push quality gate.
- Persistent GitHub CLI and Git credential stores are forbidden in the service home; GitHub access is injected
  only into trusted Factory-owned children from root-only configuration.
- Retired swarm, Aider, guardian, resolver, reviewer, meta-agent, and autonomous GitHub executor entrypoints remain
  absent.

## Production route

Every production phase has one outer candidate:

| Phase | Outer execution boundary |
| --- | --- |
| Planning | OpenHands SDK |
| Architecture | OpenHands SDK |
| Implementation | OpenHands SDK |
| Security review | OpenHands SDK |
| Quality repair | OpenHands SDK |
| Code review | OpenHands SDK |
| CI repair | OpenHands SDK |
| General action | OpenHands SDK |

The inner model-provider order is OpenAI subscription/Codex OAuth first and OpenCode Go second. It is owned by
`conversation_runner.py`, not by the outer phase-routing table. The legacy `emergency_only` flag may remain on the
OpenHands compatibility provider while the outer router exists; because every production route contains only
`openhands`, that metadata cannot place another outer provider ahead of the production boundary.

## Independent review and merge authority

Review approval is based on a fresh authoritative `.factory-review.json`, not natural-language stdout. Review and
security-review diversity use recorded inner-provider attribution. If no independent eligible inner provider can
run, last-resort behavior must be explicit and recorded rather than inferred from the OpenHands outer adapter.

Every PR-backed AI phase, refresh, and base update removes stale review authority and marks the current SHA-scoped
status `PENDING` before work starts. A changed review head is rebuilt and reviewed again. An otherwise reviewed
head that falls behind `main` receives a SHA-bound base update and returns to verification and review.

Merge readiness is fail-closed. Both `CI / required` and `factory/independent-review` must be present and report
literal `SUCCESS`, the reviewed SHA must equal the PR head, mergeability must be clean, and no human review may
report `CHANGES_REQUESTED`. The scheduled merge workflow is the only merge authority and binds the merge to the
inspected head SHA without native auto-merge or administrator bypass. Repository rules must require pull requests
and both canonical statuses with no bypass actors.

## Recovery authority

`JobStore` and `retry_policy.py` are the single durable task-retry authority. Repeated failure classes use
independent counters, stable semantic fingerprints, deterministic jitter, and capped exponential delay. Inner
provider health and cooldowns prevent a known-broken subscription from being hammered for every issue. The
watchdog only recovers stale active states through that same retry path and never starts an agent itself.

See [ACTIVE_ARCHITECTURE.md](ACTIVE_ARCHITECTURE.md) for module and trust boundaries and
[AGENT-ROUTING.md](AGENT-ROUTING.md) for detailed production provider policy.
