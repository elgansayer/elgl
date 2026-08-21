# Frontend Junie guidelines

For frontend work, Junie inherits `../AGENTS.md`, `AGENTS.md`, `../DESIGN.md`, `../docs/agent-ui-governance.md` (`docs/agent-ui-governance.md` in repository-root notation), `../docs/spartan-relay-architecture.md`, and `../docs/claude-design-two-way-sync.md`.

Relay is the application-facing UI authority. Spartan owns supported accessible interaction mechanics through the repository-owned Helm layer. Do not add direct Brain imports in feature code or recreate interaction behaviour already provided by Relay/Spartan.

Claude Design is the two-way design-intent/review workspace. Material visual changes require deterministic preview/design-sync metadata updates and design-first, code-first or reconciliation handling.

Preserve semantic tokens, light/dark parity, per-user accent semantics, RTL/logical direction, i18n, keyboard and screen-reader accessibility, 200%/400% zoom and reflow, reduced motion, forced colours and intentional mobile/tablet/desktop layouts.

Original product screenshots are reference evidence only. Do not revive strict-dark, neon or pixel-parity rules.

Detailed Angular, TypeScript, testing and verification rules remain in the central AGENTS files. Relevant work must pass `npm run check:spartan-boundaries` and `npm run check:design-sync` from the repository root.