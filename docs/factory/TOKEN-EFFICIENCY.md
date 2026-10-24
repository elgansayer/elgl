# Factory token-efficiency policy

The Factory optimises useful engineering work per provider allowance. Token reduction must not weaken repository safety, deterministic verification, independent review, security review, or merge checks.

## Reasoning tiers

Use maximum reasoning where open-ended exploration or correctness risk justifies it:

- planning
- architecture
- implementation
- security review

Use balanced reasoning for bounded phases whose scope is already constrained by a diff, failed checks, review findings, or a concrete action:

- quality repair
- code review
- CI repair
- general action

For Codex on GPT-5.6 Sol, the current policy keeps `max` reasoning for the quality-critical phases and uses `medium` for bounded review/repair/action phases. This preserves the same frontier model while avoiding maximum reasoning-token consumption on every narrow Factory iteration.

## Quality floor

Efficiency changes must not bypass or weaken:

- local verification
- `.factory-review.json` validation
- `.factory-architect.json` validation
- independent-provider review where alternatives are healthy
- security review
- reviewed-SHA protection
- `CI / required`
- `factory/independent-review`

If a cheaper execution strategy causes measurable regressions, prefer restoring reasoning quality for that phase over saving tokens.

## Escalation principle

Do not spend maximum reasoning by default merely because a provider supports it. Start each phase at the tier appropriate to its risk and scope, while retaining the existing provider fallback and repair loops. Escalation should be driven by evidence such as task complexity, repeated ineffective repairs, or validation failures rather than being paid on every invocation.
