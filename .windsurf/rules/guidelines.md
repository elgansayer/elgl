# Windsurf repository guidelines

Windsurf inherits the repository's central engineering and UI authorities. Before frontend work, read `AGENTS.md`, `frontend/AGENTS.md`, `DESIGN.md`, `docs/agent-ui-governance.md`, `docs/spartan-relay-architecture.md`, and `docs/claude-design-two-way-sync.md`.

Relay is the application-facing visual/component authority. Spartan owns supported accessible interaction mechanics through the repository-owned Helm layer. Feature code must not import Brain directly when Relay/Helm owns the capability, and must not recreate focus, keyboard, overlay, selection, menu, dialog or combobox behaviour already provided by Spartan.

Claude Design is the two-way design-intent/review workspace. Material visual contracts must update deterministic preview/design-sync metadata and follow the documented design-first, code-first or reconciliation flow.

Preserve semantic tokens, first-class light/dark themes, per-user accents, RTL, i18n, accessibility, high zoom/reflow, reduced motion, forced colours and deliberate responsive layouts. Original product screenshots are reference evidence rather than strict styling authority.

Detailed Angular, TypeScript, testing, API and verification rules remain authoritative in the AGENTS files. Relevant frontend work must pass `npm run check:spartan-boundaries` and `npm run check:design-sync` in addition to the normal gates.