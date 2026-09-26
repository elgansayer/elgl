# Agent routing policy

## Contract

Every AI-backed action is an `AgentRequest` with a typed `AgentPhase`, trusted Factory system instructions,
shared logical prompt, isolated working directory, timeout, output limit, and optional structured-output
validator. Every provider returns an `AgentResult` with provider, transport, model, timestamps, exit status,
summary, and typed failure.

Adding a provider should require one adapter, one configuration entry, and tests. It must not require phase
conditionals in `FactoryPipeline`.

## Phases and production order

The production policy reviewed on 2026-08-17 is:

| Phase           | Candidate order                                      |
| --------------- | ---------------------------------------------------- |
| Planning        | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Architecture    | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Implementation  | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Security review | Claude, Codex, Google, OpenCode, OpenHands emergency |
| Quality repair  | Codex, Claude, Google, OpenCode, OpenHands emergency |
| Code review     | Codex, Claude, Google, OpenCode, OpenHands emergency |
| CI repair       | Codex, Claude, Google, OpenCode, OpenHands emergency |
| General action  | OpenCode, Google, Codex, Claude, OpenHands emergency |

Disabled, unhealthy, cooling down, unsupported, and busy providers are skipped. Google and OpenCode health
checks also require every configured phase model to appear in the authenticated account catalogue. Emergency
providers are always placed after healthy non-emergency providers. `skip_busy_providers=true` lets lower-priority
subscriptions start instead of waiting for the preferred provider's slot.

## Model policy as of 2026-08-17

| Provider     | Coding default        | Reasoning and review override                                                                                               | Policy                                                                                                                                                       |
| ------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Code  | `fable`               | `fable`                                                                                                                     | Current most capable generally available Claude coding model and stable CLI alias                                                                            |
| Codex CLI    | `gpt-5.6-sol`         | `gpt-5.6-sol`, `max` effort                                                                                                 | Current OpenAI flagship for complex production and coding work                                                                                               |
| Google agent | `gemini-3.1-pro-high` | same, `high` effort                                                                                                         | Strongest Google-native Pro reasoning tier exposed by the verified Antigravity catalogue                                                                     |
| OpenCode Go  | `opencode-go/kimi-k3` | `opencode-go/qwen3.8-max` for planning, architecture, security, and review; `opencode-go/kimi-k2.7-code` for general action | Quality-first current catalogue choice for long-horizon coding, a diverse reasoning model for review, and a higher-capacity coding model for mechanical work |
| OpenHands    | `gpt-5.6-sol`         | same                                                                                                                        | Emergency compatibility provider only                                                                                                                        |

Primary references:

- [Claude Fable 5 availability](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
- [OpenAI model catalogue](https://developers.openai.com/api/docs/models)
- [OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [GPT-5.6 availability in Codex](https://help.openai.com/en/articles/20001354-gpt-5-6-in-chatgpt)
- [Codex configuration reference](https://developers.openai.com/codex/config-reference/)
- [Google subscription transition announcement](https://github.com/google-gemini/gemini-cli/discussions/27274)
- [Antigravity CLI](https://github.com/google-antigravity/antigravity-cli)
- [Antigravity releases](https://github.com/google-antigravity/antigravity-cli/releases)
- [Google Antigravity CLI model selection](https://codelabs.developers.google.com/antigravity-cli-hands-on)
- [Gemini CLI configuration](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md)
- [OpenCode Go models](https://opencode.ai/docs/go/)
- [Kimi K3 technical report and model card](https://github.com/MoonshotAI/Kimi-K3)

Model names are configuration, not business logic. Review this table monthly and after any provider deprecation.
Do not silently replace an unavailable model during a job. A model/configuration error is observable provider
failure and follows the configured fallback policy.

The verified Codex catalogue also exposes an `ultra` effort that adds Codex-managed task delegation. The Factory
deliberately uses `max`: it is the strongest single-agent reasoning tier, while hidden nested delegation would
bypass Factory-owned provider capacity, phase provenance, and independent-review diversity. If `ultra` is ever
enabled, model its child attempts explicitly rather than treating them as one opaque provider run.

The OpenCode choices are a reasoned starting point based on the authenticated OpenCode Go catalogue, not a claim
of measured superiority in this repository. Kimi K3 is the provider's strongest available long-horizon coding
model and is assigned to implementation and repair. Qwen3.8 Max supplies model-family diversity for planning and
review. Kimi K2.7 Code has much greater subscription capacity and handles general mechanical actions. OpenCode's
published Go quotas make Kimi K3 substantially scarcer, so repeated quota failures should fall through to the
next provider rather than weakening the configured model silently. Compare completion rate, review findings, CI
repair success, duration, and quota failures before changing the split. Vendor documentation can lag the
authenticated catalogue, so the service-user model listing remains the final deployment check.

Google consumer subscription routing uses Antigravity CLI by default. Google moved consumer Free, AI Pro, and AI
Ultra access away from Gemini CLI in June 2026. Gemini CLI remains a configurable `cli_variant` for supported
enterprise, Google Cloud, and API-authenticated deployments. Antigravity 1.1.1 or newer is required because older
print-mode releases could hang or omit captured output in non-TTY automation. The adapter sends the full prompt
on stdin, disables slash-command expansion, pins the account-visible `gemini-3.1-pro-high` slug, uses high effort,
and applies both the CLI print timeout and the Factory process timeout. Pinning avoids the CLI's omitted-model
behaviour, which follows the account's last interactive selection rather than a guaranteed strongest model.

The no-cost CLI contract audit used Claude Code 2.1.233, Codex CLI 0.147.0, Antigravity 1.1.13, and OpenCode
1.18.15. It verified every configured non-interactive flag and model listing without launching a coding task.
These versions are evidence for the current deployment contract, not permanent maximum versions.

## Selection algorithm

For each phase the router:

1. loads durable circuit state and performs a cheap provider health probe in a disposable empty workspace;
2. asks `ConfigRoutingPolicy` for the configured candidate order;
3. removes disabled, unsupported, unhealthy, cooling-down, and unavailable providers;
4. moves emergency-only providers to the final tier;
5. applies phase rotation and review diversity;
6. acquires a generation-aware provider capacity lease;
7. runs the provider with a phase timeout and bounded output;
8. validates any authoritative file output before accepting success;
9. records provenance, health, metrics, and fallback reason;
10. releases capacity in a `finally` path.

The candidate list is finite and each provider attempt is bounded. There is no infinite rotation loop.

## Failure semantics

| Failure                   | Same-provider retry              | Next-provider fallback | Circuit impact                   |
| ------------------------- | -------------------------------- | ---------------------- | -------------------------------- |
| Provider unavailable      | no                               | yes                    | unavailable cooldown             |
| Authentication required   | no                               | yes                    | auth cooldown                    |
| Rate limit                | no                               | yes                    | short or reported cooldown       |
| Quota exhausted           | no                               | yes                    | longer cooldown                  |
| Timeout                   | once by default                  | yes                    | timeout cooldown                 |
| Transport error           | once by default                  | yes                    | transport cooldown               |
| Agent crash               | once by default                  | yes                    | crash cooldown                   |
| Invalid structured output | once after clearing stale output | yes                    | short cooldown                   |
| Task failure              | no                               | no                     | Factory task retry/repair        |
| Test failure              | no                               | no                     | verification or repair flow      |
| Repository failure        | no                               | no                     | repository recovery flow         |
| Policy failure            | no                               | no                     | fail closed                      |
| Internal Factory failure  | no                               | no                     | operator-visible Factory failure |

Provider errors are classified from real process exit status plus bounded, redacted diagnostics. The router does
not use `except Exception: next provider` as policy. Unexpected adapter crashes become `AGENT_CRASH`; unexpected
Factory validation crashes become `INTERNAL_FACTORY_FAILURE` and do not rotate.

When every candidate fails for a provider-side reason, the router raises `ProviderCapacityUnavailable`. Factory
keeps the current phase, schedules the earliest bounded retry, and does not increment the task-attempt counter.
Task, test, repository, policy, and internal failures return to the durable Factory retry or repair path. If the
same task-side failure fingerprint reaches `FACTORY_MAX_CONSECUTIVE_FAILURES`, Factory opens a recoverable
quarantine rather than looping forever. The bounded recovery window releases the circuit automatically and
reconciles stale GitHub quarantine labels before discovery. Run
`hellotalk-factory backlog requeue-quarantined --issue NUMBER` after fixing the underlying cause when an earlier
retry is appropriate. Add `--announce` only when an issue comment is warranted.

## Circuit breakers and health

Circuit state is persisted in `agent_health.json`. The default threshold is two provider-side failures. One
half-open probe is admitted atomically after cooldown. A persisted half-open lease expires after 60 seconds so a
daemon crash during the probe cannot strand a provider forever. Provider-side execution failures invalidate any
cached health result, ensuring the later half-open decision performs a real probe. A successful probe, successful
run, or typed task-side response closes and resets the provider circuit. Task, test, repository, and policy
failures still return to Factory logic and never become fallback reasons. Rate, quota, authentication, transport,
timeout, crash, unavailable, and invalid-output cooldowns are separately configurable.

Malformed known-provider circuit entries fail closed for one bounded cooldown instead of silently returning to
healthy. Timezone-naive timestamps are rejected, future timestamps are clamped to the current time, and negative
or absurd provider retry hints are bounded. This lets a fresh probe recover service without allowing corrupt state
to exclude a provider indefinitely.

Exact remaining subscription quota is not fabricated. Health uses installed command checks, local authentication
status where exposed, observed exit text, and provider retry hints. `retry_after` is capped and persisted.
Health probes receive provider-specific session mounts but never use the writable canonical repository as their
working directory. The temporary workspace is removed after every cached probe refresh.

## Concurrency and no-provider behaviour

Each provider has `max_concurrency`; these leases are shared across daemon workers. A lease expires after the
entire bounded same-provider retry window plus a safety margin, is released on every normal or exceptional
return, and is scoped to the active daemon generation. Stale leases from a crashed daemon do not consume the new
generation's capacity. Persisted leases with missing or timezone-naive timestamps, impossible acquisition times,
or expiry beyond the longest configured attempt window are discarded. Task leases apply the same bounded-duration
rule, and their mutations use a cross-process file lock so operator reconciliation cannot race the daemon.

The daemon admits at most one pull-request review lane and submits it before issue work. While that PR worker is
active, `AgentRouter` subtracts one slot from the limit offered to non-review jobs on every provider. The PR job
retains the full configured limit. This reservation does not cancel an existing provider process, but it prevents
new issue phases from repeatedly taking a newly freed slot before the required review can acquire it. The
reservation is released by the worker future on success, failure, cancellation, or shutdown drain.

`jobs.json` read-modify-write operations also use a cross-process lock. Provider history is bounded to the latest
500 entries per job on append and deserialisation, preserving useful provenance without unbounded state growth.

If no provider can start, `ProviderCapacityUnavailable` records a retry time without incrementing the task's
attempt count. The job remains in its current state, the task lease is released, and other jobs continue. The
daemon itself remains online when every provider is temporarily unusable, allowing health checks and durable jobs
to recover after authentication, quota, or transport becomes available again. `last_provider_failure` records a
bounded reason even when no provider process starts, so restart diagnostics do not depend on transient logs.

## Independent review and repair rotation

Code review excludes every provider that attempted a code-mutating phase for the job. This deliberately includes
timed-out and crashed attempts because they may have changed the worktree before failing. Same-provider review is
a last resort only and appears in history with `fallback_reason=diversity-last-resort`.

Quality and CI repair move all providers already attempted in that phase behind unused candidates. Failed GitHub
check names and current mergeability are included in the CI-repair prompt. Every repair is locally verified,
committed, pushed, and independently reviewed again before CI can enable merge.

A deterministic local verification failure transitions to `QUALITY_REPAIRING` with bounded failure evidence.
This applies both to issue implementations and externally created pull requests. An empty implementation diff is
never treated as proof that an issue is already satisfied, so the Factory cannot close a ticket on an agent no-op.

## Structured output

`.factory-review.json` and `.factory-architect.json` remain provider-neutral and file-authoritative. Before every
attempt the prior artefact is removed. The router validates the newly written file before recording provider
success. Invalid output can retry once and then fall through to another provider. The pipeline deletes the file
before checking the repository diff, so control artefacts cannot become product commits.

## Configuration and compatibility

Production configuration is JSON because `FACTORY_AGENTS_CONFIG` already names a validated external file. See
[`config/factory/agents.production.json`](../../config/factory/agents.production.json).

If `FACTORY_AGENTS_CONFIG` is absent, typed configuration creates legacy OpenHands-only routing with routing
disabled. Invalid provider names, phases, limits, transports, or routes fail configuration clearly. Optional
missing providers are reported individually. Temporary exhaustion of every configured provider is an aggregate
warning rather than a daemon startup failure, so durable work remains online until health recovers.

The OpenHands adapter preserves its inner SDK provider classification when returning to the outer router. An SDK
authentication, quota, rate, transport, configuration, or malformed-response failure can therefore fall through
to the next outer provider instead of being mistaken for a repository task failure. Its outer history entry names
the `openhands-sdk` transport; detailed inner OpenAI subscription or configured API attribution remains in
`provider-attribution.json`.
The child receives a reduced typed configuration with GitHub, Telegram, and legacy Gemini credentials removed;
those control-plane secrets are not required for model execution.

## Prompt trust channels

GitHub issue and PR text is untrusted. Claude receives repository-owned Factory policy through
`--append-system-prompt` and only task data on stdin. Codex receives Factory policy through the documented
`developer_instructions` configuration channel and task data on stdin. OpenHands builds the SDK agent system
prompt from the dedicated main checkout.

Antigravity/Gemini and OpenCode do not currently expose an equally stable dedicated system-instruction channel
in the verified non-interactive contract. Their adapter combines trusted policy before untrusted task data, but
that is a weaker boundary than a provider-native system channel. Keep Google disabled until its canary passes and
enable OpenCode only with the documented service-user and filesystem trust assumptions.

Prompt separation does not protect the provider's own subscription session from every possible malicious tool
action. Direct providers must read that session and reach their vendor. Production therefore admits configured
repository actors automatically and requires a maintainer-controlled `factory-ready` label for other public
authors. A vendor-domain egress proxy or external credential broker is the recommended stronger boundary.

Before any Factory branch push, the deterministic quality gate rejects provider credential directories,
high-confidence access-token formats, and private-key material. Findings store only redacted evidence. This is a
last-line repository control and does not replace service-user permissions or provider-specific credential
isolation.

Every direct CLI runs in a private user, mount, PID, and proc namespace. It sees its assigned worktree, a read-only
canonical repository, its explicit read-write credential paths, and read-only executable paths. Other provider
sessions, durable Factory state, logs, rootless runtime sockets, host temporary files, and sibling processes stay
hidden. The long-lived daemon is non-dumpable because deleting a secret from `os.environ` does not erase the
original procfs environment. Repository verification uses a stricter no-network namespace and receives a fresh
home, so a modified test script cannot inspect subscription files or scan a concurrent token-bearing Git process.

Persistent GitHub authentication is never allowed in the service home: the configured Git helper first resets
inherited helpers, then reads only the token scoped to the trusted Git child. Provider path lists remain an
operator-owned compatibility contract and must be checked after CLI upgrades.

## ACP status

The provider contract is transport-neutral, but production adapters currently use direct CLI or OpenHands SDK.
Antigravity does not yet expose a stable ACP server. Gemini CLI ACP can be evaluated for eligible enterprise
accounts, but it is not enabled merely for architectural symmetry. Introduce ACP only after the selected provider
exposes stable cancellation, structured results, tool permissions, and a service-user credential model. No
pipeline redesign should be required.
