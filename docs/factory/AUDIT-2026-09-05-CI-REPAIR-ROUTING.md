# Factory efficiency audit: CI repair routing

Date: 2026-09-05

## Finding

Production CI repair currently starts with Codex even though the phase is tightly bounded by concrete failing-check evidence and every resulting mutation is forced back through deterministic local verification, independent review on the new head, reviewed-SHA protection, and required GitHub merge checks.

That makes the strongest OpenAI subscription route the default consumer for a routine recovery phase before lower-capacity routine models have been tried. Unlike planning, architecture, implementation, security review, and independent review, CI repair does not need to establish the quality floor itself: it proposes a repair and the existing machine-owned gates prove whether that repair is acceptable.

## Change

The production `ci_repair` candidate order is now:

1. OpenCode (`opencode-go/deepseek-v4-flash`)
2. Google (`gemini-3.7-flash-low`)
3. Claude (`haiku`)
4. Pi (`github-copilot/claude-haiku-4.5`)
5. Codex (`gpt-5.6-sol`)

Codex remains available automatically as the final fallback. The router's existing phase rotation moves providers already attempted for a repair behind unused candidates, so a failed repair does not pin the task to the same lower-cost provider forever.

## Why quality is unchanged

This only changes candidate order for CI repair. It does not change:

- implementation or security-review routing;
- independent-review routing or provider-separation rules;
- local verification commands;
- quality gates;
- repair-attempt bounds;
- `factory/independent-review`;
- reviewed-head-SHA protection;
- `CI / required` or any other required GitHub check;
- mergeability or branch-protection enforcement;
- autonomous provider failover, backoff, or persistent-task recovery.

A lower-tier provider cannot make its own repair mergeable. If its mutation is wrong, deterministic verification or the later independent/required checks reject it and the autonomous repair/failover path continues.

## Expected efficiency effect

For CI failures that can be repaired by the bounded routine models, the Factory avoids a `gpt-5.6-sol` provider start entirely. Harder repairs still reach Codex automatically after the lower-tier routes are unavailable or unsuccessful. This preserves the expensive/high-capability subscription allowance for phases where model quality itself is the primary gate rather than spending it first on mechanically verifiable CI recovery.

No token percentage is claimed because subscription accounting differs by provider and the repository does not expose a trustworthy cross-provider token-to-allowance conversion.
