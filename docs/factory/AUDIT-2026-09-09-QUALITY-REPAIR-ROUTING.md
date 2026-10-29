# Factory quality-repair routing efficiency audit

Date: 2026-09-09

## Scope

This pass re-audited the current OpenHands Factory routing, reasoning tiers, retries, provider failover, duplicate-work controls, prompt bounds, CI/review loops, concurrency, scheduling, GitHub Actions interactions, and autonomous recovery. Existing controls for zero immediate same-provider retries, bounded provider candidates, durable provider health/cooldowns, mechanical CI repair, prompt/output bounds, review-head settling, deterministic verification, security review, independent review, reviewed-SHA protection, and required merge checks remain in place.

## Finding

`QUALITY_REPAIR` is a bounded repair phase driven by deterministic quality-gate findings or structured independent-review findings. The resulting repository state is always sent back through authoritative local verification and a fresh independent review before merge eligibility can be restored.

Despite that bounded evidence and downstream verification, production still started quality repair with Codex `gpt-5.6-sol`. This made the flagship subscription the default spend for routine repair work even though the same production profile already configures OpenCode DeepSeek Flash, Google Flash-low, Claude Haiku, and Pi Haiku for bounded repair phases.

CI repair had already been corrected to use a cheap-first route with automatic Codex promotion after two real provider starts. Quality repair had the same cost shape but retained the older flagship-first ordering.

## Change

Production quality-repair routing is now:

1. OpenCode (`opencode-go/deepseek-v4-flash`)
2. Google (`gemini-3.7-flash-low`)
3. Claude (`haiku`)
4. Pi (`github-copilot/claude-haiku-4.5`)
5. Codex (`gpt-5.6-sol`)

The conservative router still exposes only two candidates per scheduling window. Provider history rotates already-used providers behind unused providers. After two configured quality-repair providers have actually started, the routing policy now promotes unused Codex into the next bounded candidate window, matching the existing CI-repair recovery rule. This means routine repairs avoid flagship allowance, while a difficult repair reaches Codex automatically within the per-task four-start budget instead of waiting for a later allowance window.

Provider health, circuit breakers, and capacity remain authoritative. An unavailable or quota-exhausted cheap provider is skipped without consuming a provider start, and persistent failures continue through the normal autonomous scheduler/cooldown path. No quarantine, human release, or manual triage path is introduced.

## Quality and safety invariants

This change does not alter planning, architecture, implementation, security-review, code-review, or general-action routing. It does not weaken repair prompts, deterministic verification, security review, independent review, reviewed-SHA protection, `factory/independent-review`, `CI / required`, mergeability checks, or exact-head merge protection.

A successful quality repair still has no merge authority by itself. The repaired tree must pass Factory verification and then receive a fresh independent review on the resulting exact SHA. Codex remains an automatic flagship fallback for difficult repairs.

## Expected efficiency

The common quality-repair path no longer spends Codex allowance before cheaper bounded-phase models have been tried. No token percentage is claimed because subscription CLIs do not expose one portable token meter. The deterministic saving is routing-level: the first quality-repair provider start is moved off the flagship subscription, while the hard-task fallback remains bounded and automatic.

## Validation target

Regression coverage locks the production route, proves the first conservative candidate window is `[opencode, google]`, and proves that after two real quality-repair starts the next bounded window is `[codex, claude]`. Existing CI-repair rotation coverage remains in place so the shared promotion behavior cannot silently regress either repair phase.
