# Active Architecture: OpenHands Agent Canvas Factory

## Authority

The production autonomous-development control plane is the OpenHands SDK Factory in
`automation/openhands_factory`. OpenHands owns implementation, security review,
quality repair, independent review, and CI-repair conversations. The repository
must not add a second outer agent router, direct-provider executor swarm, or
GitHub-Actions issue resolver beside this control plane.

`FACTORY_ARCHITECTURE=openhands-agent-canvas-v1` is the static architecture
identity. The daemon separately creates a per-process generation token after it
acquires the Factory lock so stale processes cannot keep writing durable state.

## 1. Conversation and provider boundary

`FactoryPipeline` delegates model work to `ConversationRunner`, which starts one
bounded OpenHands SDK conversation for the requested phase. Provider selection is
conversation-scoped and remains stable for the life of that conversation.

The authoritative production model-provider order is exactly:

1. **OpenAI subscription / Codex OAuth**
2. **OpenCode Go**

If both production providers are unavailable, the job enters the Factory's bounded
recovery path. It does not silently dispatch Claude Code, Gemini, a raw OpenAI API
key, or another direct execution provider.

Historical Claude/Codex/Google/OpenCode direct-executor configuration and Gemini
helpers may remain temporarily for migration/diagnostic compatibility, but they
must be disabled and must never be selected by production routing. Doctor and CI
should treat an enabled direct executor or a non-OpenHands phase route as
architecture drift.

## 2. Execution isolation

Each issue is processed from durable Factory state and an isolated worktree.
Repository/tool execution is constrained by the Factory security boundary and its
Podman-backed worker tooling. Controller credentials are not a license to bypass
that boundary or push directly to protected `main`.

The old direct CLI-agent architecture (`claude`, `codex`, `gemini`, `opencode` as
outer task executors), the historical AI swarm, Aider-style workers, autonomous
GitHub Actions resolvers/reviewers, Caveman orchestration, and a separate
self-patching meta-agent are not part of the active production architecture.
Historical documentation or migration code may mention them, but executable
production paths must not resurrect them.

## 3. Durable bounded recovery

The daemon owns scheduling and restart recovery. Durable job state records attempts,
failure class, stable failure fingerprint, provider history, and next-attempt time.
Repeated failures use deterministic jittered backoff capped by policy and provider
circuit breakers rather than an unbounded hot loop.

Durable execution states abandoned by a crashed or restarted daemon are detected by
the watchdog, classified through the normal timeout failure path, have their stale
lease released, and are retried through the same bounded policy. Live worker
futures and polling-only `CI_PENDING` / `MERGE_QUEUED` jobs are never treated as
abandoned workers.

Terminal issue quarantine is not the production recovery strategy. Legacy
quarantine state is migration compatibility only and must not be reintroduced as
the normal outcome of repeated failures.

## 4. Review and merge authority

A Factory pull request is reviewed on the same head SHA it proposes to merge.
Independent review should prefer the other healthy production provider when
available, while remaining provider-stable within that review conversation.

Factory merge readiness is fail-closed. Both named authorities must be present and
successful before Factory can arm auto-merge:

- `CI / required`
- `factory/independent-review`

Missing canonical checks are treated as pending, not as success. The reviewed head
SHA must still match before merge is enabled. `.github/workflows/factory-merge.yml`
enforces the same named contexts for its scheduled merge gate.

Repository settings must independently require the canonical aggregate for manual
and integration merges as well. Issue #7250 tracks the active `main` ruleset gap
because repository-settings mutation is outside the connected automation surface.

## 5. Sources of truth

| Concern | Authority |
| --- | --- |
| outer execution control plane | `automation/openhands_factory/pipeline.py`, `conversation_runner.py` |
| production provider order | `automation/openhands_factory/provider_profiles.py` |
| provider health / circuit breakers | `automation/openhands_factory/provider_health.py` and related health stores |
| durable retries / abandoned attempts | `automation/openhands_factory/jobs.py`, `retry_policy.py`, `daemon.py` |
| runtime diagnostics | `automation/openhands_factory/doctor.py` |
| static architecture guard | `automation/openhands_factory/architecture_guard.py` |
| canonical application/Factory CI | `.github/workflows/ci.yml` |
| Factory-reviewed merge gate | `.github/workflows/factory-merge.yml` |
| system service configuration | `config/systemd/hellotalk-factory.service`, `factory.env.example` |

## 6. Change policy

Changes to provider order, authentication, execution isolation, outer routing, retry
authority, or merge authority must update this document in the same logical change
and add or update executable regression coverage. Dependency upgrades that change
OpenHands/provider/runtime behavior require migration-specific acceptance criteria;
they must not silently redefine the control plane through a package update alone.
