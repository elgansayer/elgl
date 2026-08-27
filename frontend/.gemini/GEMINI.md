# Frontend Gemini instructions

For all frontend work, inherit the repository's central UI and engineering authorities:

- `../AGENTS.md`
- `AGENTS.md`
- `../DESIGN.md`
- `../docs/agent-ui-governance.md` (`docs/agent-ui-governance.md` in repository-root notation)
- `../docs/spartan-relay-architecture.md`
- `../docs/claude-design-two-way-sync.md`
- `../design-sync.manifest.json` for visual-contract work

Relay is the application-facing UI authority. Spartan owns supported accessible interaction mechanics through the repository-owned Helm layer. Do not add feature-level Brain imports or parallel bespoke primitives when Relay/Helm owns the capability.

Claude Design is the two-way design-intent/review workspace. Material visual changes require deterministic preview/design-sync updates and design-first, code-first or reconciliation handling as documented centrally.

Preserve semantic tokens, first-class light/dark themes, per-user accent semantics, RTL/logical direction, i18n, keyboard and screen-reader accessibility, high zoom/reflow, reduced motion, forced colours and intentional responsive layouts.

Use current Relay/Spartan APIs rather than stale custom primitive names or screenshot-parity assumptions. Original product screenshots are reference evidence only.

Detailed Angular, TypeScript, testing and verification rules live in `AGENTS.md` and `../AGENTS.md`. For relevant work run the normal frontend gates plus `npm run check:spartan-boundaries` and `npm run check:design-sync` from the repository root.