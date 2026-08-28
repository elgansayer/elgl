# Factory efficiency audit: 2026-08-28

## Scope

This audit reviewed the current Repo Factory/OpenHands Factory runtime after the multi-repository rollout in PR #8679, including provider routing and health, conservative admission controls, prompt construction, daemon scheduling, recovery, repository isolation, CI/workflow behavior, and the two production instance profiles.

The priority remains useful engineering output per subscription/provider start. Safety gates, independent review, verification, exact-head merge protection, provider isolation, and durable recovery are not weakened to save allowance.

## Existing controls retained

The current Factory already contains strong controls that should not be reduced blindly:

- implementation task bodies are bounded to 24,000 input characters;
- review/security bodies are bounded to 12,000 characters and repair bodies to 6,000;
- stable prompt material is placed before task-specific material to improve provider prompt-cache reuse;
- conservative mode permits at most two provider candidates for a phase;
- same-provider immediate retries are disabled in conservative mode;
- global agent concurrency is two and review concurrency is one;
- the durable global provider-start allowance is six starts per hour;
- one task may consume at most four provider starts per hour;
- independent review is prioritized and provider diversity is preserved;
- provider concurrency leases are durable and shared through `FACTORY_PROVIDER_CAPACITY_DIR`;
- mechanical CI repair is attempted before spending an agent route;
- quarantine recovery uses adaptive backoff instead of repeatedly recycling a chronic task.

These controls already prevent the largest classes of repeated prompt, retry, and concurrency waste.

## Finding: multi-repository capacity was shared, provider failure knowledge was not

PR #8679 correctly moved HelloTalk and Workout Agent provider-capacity accounting to the same coordination root:

```text
FACTORY_PROVIDER_CAPACITY_DIR=/var/lib/repo-factory/shared
```

That prevents the two daemons from exceeding the same subscription's concurrency allowance. Circuit-breaker state, however, was still constructed at each repository's own `state_dir/agent_health.json`.

Authentication failure, provider outage, rate limiting, and subscription quota exhaustion are properties of the provider account, not of the repository. With repository-local circuit state, the following sequence was possible:

1. HelloTalk starts Claude and learns that the subscription is quota exhausted.
2. HelloTalk opens its Claude circuit and falls through appropriately.
3. Workout Agent has no knowledge of that circuit because its `agent_health.json` is separate.
4. Workout Agent starts Claude again, spends another scarce provider-start admission, receives the same quota error, and only then opens its own circuit.

As more repositories are added, the same known-broken provider could be rediscovered once per instance. This defeats part of the value of the shared provider-capacity layer and wastes the global conservative allowance precisely when capacity is scarce.

## Implemented change

The standard `AgentHealthStore(.../agent_health.json)` now resolves to the existing shared provider coordination root whenever `FACTORY_PROVIDER_CAPACITY_DIR` is configured with an absolute path.

For the two production instances this produces:

```text
/var/lib/repo-factory/shared/agent_health.json
```

The change deliberately redirects only the canonical `agent_health.json` filename. Explicit custom health stores remain local, preserving test/tool isolation and backwards-compatible single-repository behavior. When no shared coordination directory is configured, the path is unchanged.

The existing `AgentHealthStore` file lock now also becomes the cross-repository lock. That means only one daemon can lease the half-open recovery probe for a provider at a time instead of each repository probing independently after cooldown.

## Deterministic allowance impact

For one provider-wide quota/auth incident, the first repository still needs one real failure to learn the condition. Every additional active repository can then observe the same open circuit without starting that known-broken provider.

With the two currently configured Repo Factory instances, this removes **up to one duplicate provider failure start per provider incident**. With `N` instances, it prevents **up to `N - 1` duplicate discovery starts** for the same already-known provider-wide failure before cooldown/recovery.

The production conservative policy admits only six real provider starts per hour. Avoiding even one duplicate outage/quota start therefore preserves up to one sixth of that hourly budget for productive implementation, repair, or independent review during the affected hour.

No exact token or monetary saving is claimed because subscription CLIs do not expose a portable remaining-token or dollar counter. The saved provider start is deterministic; its avoided prompt/output usage varies by the point at which the provider reports the failure.

## Safety and compatibility

- Job state, worktrees, GitHub repository state, metrics, and task retries remain repository-local.
- Only provider/subscription circuit knowledge is shared.
- Provider concurrency was already shared at the same trusted coordination root.
- Existing atomic JSON persistence and cross-process locking remain authoritative.
- Half-open probe leasing is safer across multiple daemons because the same lock serializes it.
- Custom health-store filenames are not redirected.
- Relative coordination paths are ignored by this low-level resolver rather than becoming surprising process-relative state.
- Single-repository deployments without `FACTORY_PROVIDER_CAPACITY_DIR` continue to use their existing local path.
- Routing order, phase model selection, independent review, verification, merge rules, and emergency-provider policy are unchanged.

A deployment moving from repository-local to shared health starts with an empty shared circuit file if none exists. Circuit state is transient operational evidence, so the migration intentionally does not pick one repository's potentially contradictory old circuit file as authoritative. The first subsequent health observation repopulates the shared state.

## Regression coverage

`automation/tests/test_shared_provider_health.py` proves that:

1. two repository-local `AgentHealthStore` constructors resolve to the same shared path under Repo Factory configuration;
2. a quota circuit opened by one instance is immediately visible to the other;
3. explicit custom health stores remain local; and
4. a relative coordination path does not redirect health state.

## Remaining observation

The no-PR stall detector still deserves a separate correctness change: when active implementation work exists but the durable job set has never produced a pull request, `no_pr_progress_check()` reports a warning immediately. The daemon then applies the shorter stall-alert timer rather than measuring the configured no-PR age first. PR #8436 already bounds the resulting best-effort diagnostic to one non-emergency provider, so the allowance blast radius is contained, but the signal itself should eventually be made age-aware with explicit durable-state semantics rather than guessed from historical PR jobs.

That change is not bundled here because the correct definition of "progress toward the first PR" needs a durable timestamp that survives daemon restart and distinguishes a legitimate long implementation from a truly stalled one. Sharing provider health is independent, mechanically testable, and does not alter job-state semantics.

## Validation

Standard repository CI should validate Ruff formatting/lint, mypy, Factory pytest, workflow/governance contracts, and the canonical required gate. No real provider subscription test is needed: the regression uses synthetic circuit state and exercises the same persistence/locking path used in production.
