# Frontend Windsurf guidelines

For frontend work, inherit `../AGENTS.md`, `AGENTS.md`, `../DESIGN.md`, `../docs/agent-ui-governance.md` (`docs/agent-ui-governance.md` in repository-root notation), `../docs/spartan-relay-architecture.md`, and `../docs/claude-design-two-way-sync.md`.

Relay is the application-facing UI authority. Spartan owns supported accessible interaction mechanics through the owned Helm layer. Do not add feature-level Brain imports or recreate focus, keyboard, overlay, menu, dialog, selection, tabs, forms or combobox behaviour already supplied by Relay/Spartan.

Claude Design is the two-way design-intent/review workspace. Material visual changes require repository preview/design-sync metadata updates and documented design-first, code-first or reconciliation handling.

Preserve semantic tokens, light/dark parity, per-user accent semantics, RTL/logical direction, i18n, keyboard and screen-reader accessibility, 200%/400% zoom and reflow, reduced motion, forced colours and deliberate responsive layouts.

Original product screenshots are reference evidence only. Do not restore strict-dark, neon, raw-colour or pixel-parity mandates.

Detailed Angular, TypeScript, testing and verification rules remain in the central AGENTS files. Relevant work must pass `npm run check:spartan-boundaries` and `npm run check:design-sync` from the repository root.