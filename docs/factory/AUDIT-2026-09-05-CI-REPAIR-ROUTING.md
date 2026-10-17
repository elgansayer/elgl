# Factory efficiency audit: CI repair routing

Date: 2026-09-05
Follow-up: 2026-09-07

## Finding

Production CI repair originally started with Codex even though the phase is tightly bounded by concrete failing-check evidence and every resulting mutation is forced back through deterministic local verification, independent review on the new head, reviewed-SHA protection, and required GitHub merge checks.

That made the strongest OpenAI subscription route the default consumer for a routine recovery phase before lower-capacity routine models had been tried. Unlike planning, architecture, implementation, security review, and independent review, CI repair does not establish the quality floor itself: it proposes a repair and the existing machine-owned gates prove whether that repair is acceptable.

The first change correctly moved OpenCode and Google Flash ahead of Codex, but the follow-up found an interaction with the production conservative resource policy. Production exposes only two provider candidates per phase attempt and admits at most four provider starts per task in the hourly route window. With Codex fifth, a hard CI repair could therefore spend starts on OpenCode, Google, Claude, and Pi before Codex became the first unused candidate. At that point the per-task hourly start budget could already be exhausted, delaying the flagship fallback until the next admission window.

## Current change

The production `ci_repair` preference order remains:

1. OpenCode (`opencode-go/deepseek-v4-flash`)
2. Google (`gemini-3.7-flash-low`)
3. Claude (`haiku`)
4. Pi (`github-copilot/claude-haiku-4.5`)
5. Codex (`gpt-5.6-sol`)

The routing policy now promotes unused Codex ahead of the remaining candidates only after two configured providers have actually started for the task's CI-repair phase. The conservative router still exposes only two candidates at once, so with every provider healthy the first candidate window remains OpenCode and Google. After both have been attempted, the next candidate window becomes Codex and Claude.

Keeping Codex last in the static preference also preserves the low-cost boundary when a preferred provider is already unhealthy. For example, if OpenCode is unavailable before the phase starts, the first window is Google and Claude rather than Google and Codex. If those two providers are then attempted, the next window promotes Codex ahead of Pi.

This keeps easy CI repairs away from flagship Codex while ensuring a hard repair can reach Codex after two lower-tier starts rather than after four.

## Why quality is unchanged

This only changes candidate ordering for CI repair. It does not change:

- planning, architecture, implementation, security-review, or general-action routing;
- independent-review routing or provider-separation rules;
- local verification commands;
- quality gates;
- repair-attempt bounds;
- `factory/independent-review`;
- reviewed-head-SHA protection;
- `CI / required` or any other required GitHub check;
- mergeability or branch-protection enforcement;
- autonomous provider failover, backoff, or persistent-task recovery;
- the two-candidate conservative cap or hourly provider-start budgets.

A lower-tier provider cannot make its own repair mergeable. If its mutation is wrong, deterministic verification or the later independent/required checks reject it and the autonomous repair/failover path continues.

## Expected efficiency effect

For CI failures solved by OpenCode or Google, the Factory still avoids a `gpt-5.6-sol` provider start entirely.

For harder CI failures, the number of provider starts required before Codex is promoted falls from as many as four to two, a 50% reduction in pre-flagship attempts when the phase starts with a fresh task allowance. This lets Codex fit inside that four-start window while avoiding the opposite failure mode of selecting it early merely because one preferred low-cost provider is already unhealthy. Admissions consumed by earlier task phases still count towards the same rolling per-task limit, so no unconditional same-window guarantee is claimed.

No token percentage is claimed because subscription accounting differs by provider and the repository does not expose a trustworthy cross-provider token-to-allowance conversion.

## Regression coverage

Production policy tests exercise the real `ConfigRoutingPolicy` together with `ConservativeAgentRouter`: the all-healthy first window must be `[opencode, google]`, and after those providers are recorded as attempted the second window must be `[codex, claude]`. Separate outage cases prove that an unavailable OpenCode or Google keeps the first window on the remaining low-cost providers, followed by `[codex, pi]` after those real attempts. This locks both the rotation and health-filtering interactions that route-list-only assertions miss.
